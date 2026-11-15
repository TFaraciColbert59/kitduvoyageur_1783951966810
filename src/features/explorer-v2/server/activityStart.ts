import 'server-only';

/**
 * Contrat serveur du démarrage d'activité (S1.02, K6.15).
 *
 * La route `/api/explorer/v2/activity/start` ne fait que transporter ce
 * contrat : validation bornée, normalisation, puis RPC idempotente. Le module
 * est pur (aucun accès réseau, aucune lecture d'environnement) pour être
 * testable sur fixtures.
 *
 * Le `sport` reste l'identifiant historique des neuf sports de l'Explorer.
 * La variante est un enrichissement additif : elle est facultative, mais si
 * elle est fournie elle doit exister, appartenir au sport et être réellement
 * démarrable avec la pile de capture actuelle.
 */

import { z } from 'zod';
import {
  SPORT_FAMILIES,
  getSportVariant,
  startAvailability,
  type SportStartContext,
  type SportVariant,
} from '../sheet/sportSelection';
import type { Sport } from '../state/types';

/**
 * Les neuf identifiants historiques de `Sport`, dérivés de la taxonomie
 * existante pour ne jamais créer une seconde liste divergente.
 */
export const ACTIVITY_START_SPORTS: readonly Sport[] = SPORT_FAMILIES.map((family) => family.sport);

const SPORT_SET: ReadonlySet<string> = new Set<string>(ACTIVITY_START_SPORTS);

/** Contexte serveur : le GPS est disponible et autorisé (la route est appelée
 * après le parcours de permission côté client). */
const SERVER_START_CONTEXT: SportStartContext = {
  locationPermission: 'granted',
  gpsAvailable: true,
};

const startableVariants = new Map<string, SportVariant>();
for (const family of SPORT_FAMILIES) {
  for (const variant of family.variants) {
    if (startAvailability(variant, SERVER_START_CONTEXT).startable) {
      startableVariants.set(variant.id, variant);
    }
  }
}

/** Variantes réellement démarrables, indexées par leur identifiant stable. */
export const STARTABLE_VARIANTS: ReadonlyMap<string, SportVariant> = startableVariants;

/** Bornes partagées entre la route, le test de contrat et la migration SQL. */
export const VARIANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * `hiking_routes.id` est un bigint. La migration `20261003090000` manipule
 * déjà un identifiant à 13 chiffres ; la borne 2^31-1 d'un `integer` n'est
 * donc pas la bonne. On accepte un entier JSON sûr (compatibilité des anciens
 * clients) ou une chaîne décimale canonique, puis on transmet toujours une
 * chaîne à la RPC `bigint` : au-delà de 2^53-1, un nombre JavaScript perdrait
 * des chiffres.
 */
export const ROUTE_ID_PATTERN = /^[1-9][0-9]{0,18}$/;
export const MAX_ROUTE_ID = '9223372036854775807';

export type NormalizedRouteId = { ok: true; value: string } | { ok: false };

/** Vrai pour une chaîne décimale canonique dans la plage du bigint signé. */
export function isCanonicalRouteId(value: string): boolean {
  if (!ROUTE_ID_PATTERN.test(value)) return false;
  return (
    value.length < MAX_ROUTE_ID.length ||
    (value.length === MAX_ROUTE_ID.length && value <= MAX_ROUTE_ID)
  );
}

/**
 * Normalise un identifiant de route sans jamais passer par un `Number` pour
 * une valeur qui dépasserait `Number.MAX_SAFE_INTEGER`. Un nombre non sûr est
 * refusé (le client doit envoyer la chaîne) au lieu d'être arrondi.
 */
export function normalizeRouteId(value: unknown): NormalizedRouteId {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 1) return { ok: false };
    return { ok: true, value: String(value) };
  }
  if (typeof value === 'string' && isCanonicalRouteId(value)) {
    return { ok: true, value };
  }
  return { ok: false };
}

const routeIdSchema = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const normalized = normalizeRouteId(value);
    if (!normalized.ok) {
      ctx.addIssue({ code: 'custom', message: 'routeId invalide' });
      return z.NEVER;
    }
    return normalized.value;
  });

const variantIdSchema = z.string().regex(VARIANT_ID_PATTERN);
const sports = ACTIVITY_START_SPORTS as unknown as [Sport, ...Sport[]];

const bodySchema = z
  .object({
    /** Identifiant stable généré une fois par le client, réutilisé aux rejeux. */
    clientSessionId: z.string().uuid(),
    /** Identifiant historique du sport (les neuf de l'Explorer). */
    sport: z.string().min(1).max(32),
    /** Variante facultative ; absente = comportement historique. */
    variantId: variantIdSchema.nullable().optional(),
    /** Itinéraire facultatif : entier JSON sûr ou chaîne bigint canonique. */
    routeId: routeIdSchema.nullable().optional(),
  })
  .strict();

export interface ActivityStartValue {
  clientSessionId: string;
  sport: Sport;
  variantId: string | null;
  /** Chaîne décimale exacte, jamais un nombre arrondi. */
  routeId: string | null;
}

export type ActivityStartRejectionCode =
  | 'invalid_body'
  | 'unknown_sport'
  | 'unknown_variant'
  | 'variant_sport_mismatch'
  | 'variant_unavailable';

export type ActivityStartParseResult =
  | { ok: true; value: ActivityStartValue }
  | { ok: false; code: ActivityStartRejectionCode; error: string };

function reject(code: ActivityStartRejectionCode, error: string): ActivityStartParseResult {
  return { ok: false, code, error };
}

export function isActivityStartSport(value: string): value is Sport {
  return SPORT_SET.has(value);
}

/**
 * Valide et normalise le corps JSON. Toute clé inconnue est refusée : le
 * contrat est fermé tant qu'une évolution additive n'est pas décidée.
 */
export function parseActivityStartBody(input: unknown): ActivityStartParseResult {
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) {
    return reject('invalid_body', 'démarrage invalide');
  }

  const sport = parsed.data.sport;
  if (!isActivityStartSport(sport)) {
    return reject('unknown_sport', 'sport inconnu');
  }

  const variantId = parsed.data.variantId ?? null;
  if (variantId !== null) {
    const variant = getSportVariant(variantId);
    if (!variant) {
      return reject('unknown_variant', 'variante inconnue');
    }
    if (variant.sport !== sport) {
      return reject('variant_sport_mismatch', 'variante incompatible avec le sport');
    }
    if (!STARTABLE_VARIANTS.has(variantId)) {
      return reject('variant_unavailable', 'variante non démarrable');
    }
  }

  return {
    ok: true,
    value: {
      clientSessionId: parsed.data.clientSessionId,
      sport,
      variantId,
      routeId: parsed.data.routeId ?? null,
    },
  };
}

/** Corps exact attendu par la RPC `start_activity_session`. */
export function buildStartActivityRpcBody(value: ActivityStartValue): {
  p_client_session_id: string;
  p_sport: Sport;
  p_variant_id: string | null;
  /** PostgREST/PostgreSQL convertit cette chaîne en `bigint` sans perte. */
  p_route_id: string | null;
} {
  return {
    p_client_session_id: value.clientSessionId,
    p_sport: value.sport,
    p_variant_id: value.variantId,
    p_route_id: value.routeId,
  };
}

export type ActivitySessionStatus = 'live' | 'paused' | 'finished' | 'abandoned';

export interface ActivityStartSession {
  sessionId: string;
  clientSessionId: string;
  sport: Sport;
  variantId: string | null;
  routeId: string | null;
  startedAt: string;
  sessionStatus: ActivitySessionStatus;
  created: boolean;
}

export type ActivityStartRpcResult =
  | { ok: true; session: ActivityStartSession }
  | { ok: false; reason: 'payload_mismatch' | 'invalid_response' };

const rpcConflictSchema = z
  .object({ ok: z.literal(false), reason: z.literal('payload_mismatch') })
  .strict();

/**
 * L'ancienne route n'accepte qu'un nombre `<= 2^31-1` ; la RPC renvoie un
 * nombre dans cette plage et une chaîne exacte au-delà. Accepter les deux
 * rend le déploiement tolérant à l'ordre route/migration.
 */
const rpcRouteIdSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    // Une réponse numérique non sûre a déjà perdu des chiffres dans
    // `JSON.parse` : on refuse plutôt que de fabriquer un identifiant faux.
    if (typeof value === 'number' && !Number.isSafeInteger(value)) {
      ctx.addIssue({ code: 'custom', message: 'routeId hors précision' });
      return z.NEVER;
    }
    const normalized = normalizeRouteId(value);
    if (!normalized.ok) {
      ctx.addIssue({ code: 'custom', message: 'routeId invalide' });
      return z.NEVER;
    }
    return normalized.value;
  })
  .nullable();

const rpcSuccessSchema = z
  .object({
    ok: z.literal(true),
    created: z.boolean(),
    sessionId: z.string().uuid(),
    clientSessionId: z.string().uuid(),
    sport: z.enum(sports),
    variantId: variantIdSchema.nullable(),
    routeId: rpcRouteIdSchema,
    startedAt: z.string().min(1).max(64),
    sessionStatus: z.enum(['live', 'paused', 'finished', 'abandoned']),
  })
  .strict();

/**
 * Lit la réponse de la RPC. Un rejeu légitime (`created=false`) garde le même
 * `sessionId` ; un contenu différent est un conflit explicite.
 */
export function parseStartActivityRpcResult(input: unknown): ActivityStartRpcResult {
  if (rpcConflictSchema.safeParse(input).success) {
    return { ok: false, reason: 'payload_mismatch' };
  }
  const parsed = rpcSuccessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid_response' };
  }
  const { ok: _ok, ...session } = parsed.data;
  return { ok: true, session };
}
