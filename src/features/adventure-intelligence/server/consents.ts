/**
 * Consentements serveur (RGPD) — list/set par finalité.
 *
 * `external_readiness` est refusé par double barrière : ici côté serveur, en
 * plus de la contrainte SQL `adventure_data_consents_external_readiness_disabled`
 * (M1). Aucun connecteur santé réel en Phase 1.
 */
import 'server-only';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { buildDomainEvent } from '../domain/events';

export const CONSENT_PURPOSES = [
  'personal_performance',
  'collective_terrain',
  'live_location',
  'group_location',
  'external_readiness',
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const consentPurposeSchema = z.enum(CONSENT_PURPOSES);

export const CONSENT_POLICY_VERSION = 'a1-v1';

/**
 * Version de traitement de l'événement `consent.revoked` (purge 10.7).
 * La clé d'idempotence embarque l'instant de révocation : chaque nouvelle
 * révocation après un regrant produit un nouvel événement de purge.
 */
export const CONSENT_REVOCATION_PROCESSOR_VERSION = 'a10-consent-v1';

/** Finalités désactivées en Phase 1 — non octroyables même côté serveur. */
export const DISABLED_CONSENT_PURPOSES: readonly ConsentPurpose[] = ['external_readiness'];

export interface ConsentRow {
  id: string;
  user_id: string;
  purpose: ConsentPurpose;
  granted: boolean;
  policy_version: string;
  granted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SetConsentResult {
  ok: boolean;
  error?: string;
}

/** Liste les consentements du propriétaire courant ; toute erreur → []. */
export async function listConsents(): Promise<ConsentRow[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('adventure_data_consents')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.error('[LKDV AdventureIntelligence] Erreur listConsents:', error);
    return [];
  }

  return (data ?? []) as ConsentRow[];
}

/** Accorde ou retire une finalité ; `external_readiness` est toujours refusé. */
export async function setConsent(purpose: string, granted: boolean): Promise<SetConsentResult> {
  const parsed = consentPurposeSchema.safeParse(purpose);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_purpose' };
  }

  if (DISABLED_CONSENT_PURPOSES.includes(parsed.data)) {
    return { ok: false, error: 'external_readiness_disabled' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'unauthenticated' };
  }

  const now = new Date().toISOString();

  const { error } = await supabase.from('adventure_data_consents').upsert(
    {
      user_id: user.id,
      purpose: parsed.data,
      granted,
      policy_version: CONSENT_POLICY_VERSION,
      granted_at: granted ? now : null,
      revoked_at: granted ? null : now,
    },
    { onConflict: 'user_id,purpose,policy_version' }
  );

  if (error) {
    console.error('[LKDV AdventureIntelligence] Erreur setConsent:', error);
    return { ok: false, error: error.message };
  }

  if (!granted) {
    await emitConsentRevokedEvent(supabase, user.id, parsed.data, now);
  }

  return { ok: true };
}

/**
 * Émet `consent.revoked` dans `adventure_domain_events`, best effort :
 * la purge est déclenchée par le cron `process-adventure-events`. Une panne
 * de la file ne doit jamais bloquer la révocation côté utilisateur (RGPD :
 * le retrait de consentement est immédiat).
 */
async function emitConsentRevokedEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  purpose: ConsentPurpose,
  revokedAt: string
): Promise<void> {
  try {
    const base = buildDomainEvent({
      type: 'consent.revoked',
      entityType: 'adventure_data_consent',
      entityId: `${userId}:${purpose}`,
      actorId: userId,
      processorVersion: CONSENT_REVOCATION_PROCESSOR_VERSION,
      payload: {
        userId,
        purpose,
        policyVersion: CONSENT_POLICY_VERSION,
        revokedAt,
      },
      createdAt: revokedAt,
    });
    // Clé stable pour CETTE révocation (regrant + nouvelle révocation ⇒
    // nouvelle purge), tout en restant idempotente sur un rejeu du même appel.
    const event = {
      ...base,
      idempotencyKey: `${base.type}:${base.entityId}:${revokedAt}`,
    };

    const { error } = await supabase.from('adventure_domain_events').insert({
      event_type: event.type,
      entity_type: event.entityType,
      entity_id: event.entityId,
      actor_id: event.actorId ?? null,
      payload: event.payload,
      status: 'pending',
      processor_version: event.processorVersion,
      idempotency_key: event.idempotencyKey,
      created_at: event.createdAt,
    });

    if (error) {
      // Doublon d'idempotence ou file indisponible : jamais bloquant.
      console.error('[LKDV AdventureIntelligence] consent.revoked non journalisé:', error.message);
    }
  } catch (error) {
    console.error(
      '[LKDV AdventureIntelligence] consent.revoked non journalisé:',
      error instanceof Error ? error.message : error
    );
  }
}
