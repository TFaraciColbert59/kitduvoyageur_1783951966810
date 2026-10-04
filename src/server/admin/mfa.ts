import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

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

/** Permissions qui exigent une session AAL2 (MFA vérifiée). */
export const AAL2_REQUIRED = new Set(['roles.grant', 'rewards.write']);

export function requiresAal2(code: string): boolean {
  return AAL2_REQUIRED.has(code);
}
