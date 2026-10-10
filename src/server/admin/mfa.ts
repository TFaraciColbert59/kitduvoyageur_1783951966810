import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { PERMISSION_REGISTRY } from '@/server/admin/permissions';

/**
 * Assurance MFA (AAL) — SERVEUR UNIQUEMENT.
 * Lit le niveau d'authentification de la session appelante.
 */

export type AssuranceLevel = 'aal1' | 'aal2';

export async function getAssuranceLevel(
  supabase: SupabaseClient
): Promise<AssuranceLevel | null> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return null;
    return data.currentLevel === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return null;
  }
}

/**
 * Permissions qui exigent une session AAL2 (MFA vérifiée) : tout Tier ≥ 3
 * (sensible → critique), dérivé du registre — aucun ajout manuel à oublier.
 */
export const AAL2_REQUIRED: ReadonlySet<string> = new Set(
  Object.entries(PERMISSION_REGISTRY)
    .filter(([, v]) => v.tier >= 3)
    .map(([k]) => k)
);

export function requiresAal2(code: string): boolean {
  return AAL2_REQUIRED.has(code);
}
