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

  return { ok: true };
}
