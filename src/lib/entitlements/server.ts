/**
 * A13 (S3) — Entitlements serveur : résolution du plan effectif et gating.
 *
 * Source de vérité des règles : `domain/entitlements.ts` (plans, passes,
 * `effectiveEntitlements`, `requiredPlanFor`). Ce module ne fait que :
 *   1. lire le plan/passes de l'utilisateur (`user_entitlements`, service_role)
 *      ou retomber explicitement sur `free` ;
 *   2. fusionner un grant issu des métadonnées Stripe existantes ;
 *   3. produire un refus 402 `{ error: 'entitlement_required', requiredPlan }`.
 *
 * Fail-safe : toute erreur de lecture ⇒ `free` sans entitlement, jamais un
 * accès accordé par accident. Aucun prix n'est créé ni deviné ici.
 */
import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PASSES,
  PLANS,
  effectiveEntitlements,
  requiredPlanFor,
  type Entitlement,
  type PassId,
  type PlanId,
} from '@/features/adventure-intelligence/domain/entitlements';
import { GENERATION_QUOTA_PER_HOUR } from '@/features/adventure-intelligence/domain/generationLimits';

export const USER_ENTITLEMENTS_TABLE = 'user_entitlements';

/**
 * Quota de génération des plans sans entitlement `full_generation` : réduit et
 * explicite (jamais un blocage des fonctions déjà gratuites).
 */
export const FREE_GENERATION_QUOTA_PER_HOUR = 2;

/** Clés d'environnement des price ids Stripe existants (aucune valeur inventée). */
export const STRIPE_PRICE_ENV_KEYS = {
  explorer: 'STRIPE_PRICE_EXPLORER',
  expedition: 'STRIPE_PRICE_EXPEDITION',
  group: 'STRIPE_PRICE_GROUP',
  pass_weekend: 'STRIPE_PRICE_PASS_WEEKEND',
  pass_trip: 'STRIPE_PRICE_PASS_TRIP',
  pass_expedition: 'STRIPE_PRICE_PASS_EXPEDITION',
} as const;

export type EntitlementSource =
  | 'user_entitlements'
  | 'stripe_metadata'
  | 'manual'
  | 'default_free'
  | 'unavailable';

const KNOWN_SOURCES: readonly EntitlementSource[] = [
  'user_entitlements',
  'stripe_metadata',
  'manual',
];

export interface ResolvedEntitlements {
  plan: PlanId;
  activePasses: PassId[];
  entitlements: Entitlement[];
  source: EntitlementSource;
  /** Vrai si Stripe (clé secrète + au moins un price id) est configuré. */
  configured: boolean;
}

export interface EntitlementGate {
  granted: boolean;
  requiredPlan: PlanId;
}

export interface EntitlementGrants {
  plan: PlanId;
  passes: PassId[];
  source: EntitlementSource;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Plan inconnu (ou absent) ⇒ `free` : jamais un plan supérieur par erreur. */
export function parsePlanId(value: unknown): PlanId {
  if (typeof value === 'string' && (PLANS as readonly string[]).includes(value)) {
    return value as PlanId;
  }
  return 'free';
}

/** Passe inconnu ignoré ; dédoublonné dans l'ordre du catalogue canonique. */
export function parsePassIds(value: unknown): PassId[] {
  if (!Array.isArray(value)) return [];
  const requested = new Set(
    value.filter((entry): entry is string => typeof entry === 'string')
  );
  return PASSES.filter((pass) => requested.has(pass));
}

function parseSource(value: unknown): EntitlementSource | null {
  if (typeof value !== 'string') return null;
  return (KNOWN_SOURCES as readonly string[]).includes(value)
    ? (value as EntitlementSource)
    : null;
}

/** Résout plan/passes/entitlements à partir d'une ligne `user_entitlements`. */
export function resolveEntitlementsFromRow(
  row: unknown,
  options: { configured?: boolean; sourceOnMissing?: EntitlementSource } = {}
): ResolvedEntitlements {
  const configured = options.configured ?? false;
  if (!isRecord(row)) {
    return {
      plan: 'free',
      activePasses: [],
      entitlements: [],
      source: options.sourceOnMissing ?? 'default_free',
      configured,
    };
  }

  const plan = parsePlanId(row.plan);
  const activePasses = parsePassIds(row.active_passes);
  // Source inconnue (ligne non conforme) ⇒ état par défaut, jamais un crédit
  // implicite d'origine.
  const source = parseSource(row.source) ?? 'default_free';

  return {
    plan,
    activePasses,
    entitlements: effectiveEntitlements({ plan, activePasses }),
    source,
    configured,
  };
}

/** Configuration Stripe réellement présente : uniquement des booléens. */
export function stripeBillingConfiguration(
  env: Record<string, string | undefined> = process.env
): {
  configured: boolean;
  secretKey: boolean;
  priceIds: Record<keyof typeof STRIPE_PRICE_ENV_KEYS, boolean>;
} {
  const rawSecret = env.STRIPE_SECRET_KEY;
  const secretKey =
    typeof rawSecret === 'string' && rawSecret.trim() !== '' && !rawSecret.includes('your-');

  const priceIds = Object.fromEntries(
    (Object.keys(STRIPE_PRICE_ENV_KEYS) as (keyof typeof STRIPE_PRICE_ENV_KEYS)[]).map((key) => {
      const value = env[STRIPE_PRICE_ENV_KEYS[key]];
      return [key, typeof value === 'string' && value.trim() !== ''];
    })
  ) as Record<keyof typeof STRIPE_PRICE_ENV_KEYS, boolean>;

  return {
    configured: secretKey && Object.values(priceIds).some(Boolean),
    secretKey,
    priceIds,
  };
}

/**
 * Lecture service_role du plan effectif. Toute erreur (table absente, réseau)
 * retombe sur `free` avec `source: 'unavailable'` — jamais d'exception.
 */
export async function resolveUserEntitlements(
  client: SupabaseClient,
  userId: string,
  options: { configured?: boolean } = {}
): Promise<ResolvedEntitlements> {
  const configured = options.configured ?? stripeBillingConfiguration().configured;
  try {
    const { data, error } = await client
      .from(USER_ENTITLEMENTS_TABLE)
      .select('plan, active_passes, source')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      return resolveEntitlementsFromRow(null, { configured, sourceOnMissing: 'unavailable' });
    }
    if (data === null || data === undefined) {
      return resolveEntitlementsFromRow(null, { configured, sourceOnMissing: 'default_free' });
    }
    return resolveEntitlementsFromRow(data, { configured });
  } catch {
    return resolveEntitlementsFromRow(null, { configured, sourceOnMissing: 'unavailable' });
  }
}

/** Vérifie l'accès à un entitlement ; `requiredPlan` reste cohérent domaine. */
export function entitlementGate(
  resolved: Pick<ResolvedEntitlements, 'entitlements'>,
  entitlement: Entitlement
): EntitlementGate {
  return {
    granted: resolved.entitlements.includes(entitlement),
    requiredPlan: requiredPlanFor(entitlement),
  };
}

/** Réponse 402 normative : jamais d'ambiguïté entre gating et erreur serveur. */
export function entitlementRequiredResponse(entitlement: Entitlement): NextResponse {
  return NextResponse.json(
    { error: 'entitlement_required', requiredPlan: requiredPlanFor(entitlement) },
    { status: 402 }
  );
}

export type RequireEntitlementResult =
  | { ok: true; resolved: ResolvedEntitlements }
  | { ok: false; response: NextResponse };

/**
 * Résout puis vérifie l'entitlement. Utilisé par les routes serveur S3 : une
 * résolution en échec reste `free` et produit le 402 attendu.
 */
export async function requireEntitlement(
  client: SupabaseClient,
  userId: string,
  entitlement: Entitlement,
  options: { configured?: boolean } = {}
): Promise<RequireEntitlementResult> {
  const resolved = await resolveUserEntitlements(client, userId, options);
  if (!entitlementGate(resolved, entitlement).granted) {
    return { ok: false, response: entitlementRequiredResponse(entitlement) };
  }
  return { ok: true, resolved };
}

/** Quota de génération : standard avec `full_generation`, réduit sinon. */
export function generationQuotaFor(
  resolved: Pick<ResolvedEntitlements, 'entitlements'>
): number {
  return resolved.entitlements.includes('full_generation')
    ? GENERATION_QUOTA_PER_HOUR
    : FREE_GENERATION_QUOTA_PER_HOUR;
}

/**
 * Parse strict des métadonnées Stripe existantes : `plan` et `pass`/`passes`.
 * Toute valeur inconnue est ignorée — aucun entitlement accordé par erreur.
 */
export function parseEntitlementMetadata(metadata: unknown): {
  plan: PlanId | null;
  passes: PassId[];
} {
  if (!isRecord(metadata)) return { plan: null, passes: [] };

  const rawPlan = metadata.plan;
  const plan =
    typeof rawPlan === 'string' && (PLANS as readonly string[]).includes(rawPlan)
      ? (rawPlan as PlanId)
      : null;

  const rawPasses = metadata.passes;
  const rawPass = metadata.pass;
  const candidates: unknown[] = Array.isArray(rawPasses)
    ? rawPasses
    : typeof rawPasses === 'string'
      ? rawPasses.split(',')
      : [];
  if (typeof rawPass === 'string') candidates.push(rawPass);

  const requested = new Set(
    candidates
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0)
  );
  const passes = PASSES.filter((pass) => requested.has(pass));

  return { plan, passes };
}

/** Fusion d'un grant : le plan ne régresse jamais, les passes s'unionent. */
export function mergeEntitlementGrants(
  existing: EntitlementGrants | null,
  incoming: EntitlementGrants
): { plan: PlanId; passes: PassId[] } {
  const planRank = (plan: PlanId) => PLANS.indexOf(plan);
  const plan =
    existing && planRank(existing.plan) > planRank(incoming.plan)
      ? existing.plan
      : incoming.plan;
  const passes: PassId[] = [];
  for (const pass of [...(existing?.passes ?? []), ...incoming.passes]) {
    if (!passes.includes(pass)) passes.push(pass);
  }
  return { plan, passes };
}

/**
 * Applique un grant issu des métadonnées Stripe (webhook, service_role).
 * Sans plan ni passe reconnu, aucune écriture. Retourne `applied: false` dans
 * ce cas ; une erreur d'écriture remonte à l'appelant (best-effort webhook).
 */
export async function grantEntitlementsFromMetadata(
  client: SupabaseClient,
  userId: string,
  metadata: unknown
): Promise<{ applied: boolean }> {
  const { plan, passes } = parseEntitlementMetadata(metadata);
  if (plan === null && passes.length === 0) {
    return { applied: false };
  }

  const { data } = await client
    .from(USER_ENTITLEMENTS_TABLE)
    .select('plan, active_passes, source')
    .eq('user_id', userId)
    .maybeSingle();

  const existing: EntitlementGrants | null = isRecord(data)
    ? {
        plan: parsePlanId(data.plan),
        passes: parsePassIds(data.active_passes),
        source: parseSource(data.source) ?? 'user_entitlements',
      }
    : null;

  const merged = mergeEntitlementGrants(existing, {
    plan: plan ?? 'free',
    passes,
    source: 'stripe_metadata',
  });

  const { error } = await client.from(USER_ENTITLEMENTS_TABLE).upsert(
    {
      user_id: userId,
      plan: merged.plan,
      active_passes: merged.passes,
      source: 'stripe_metadata',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(error.message);

  return { applied: true };
}
