import 'server-only';

/**
 * S2.38 — consentement et révocation de l'accès à l'historique.
 *
 * Aucune table nouvelle : la finalité existante `personal_performance` de
 * `adventure_data_consents` est réutilisée. C'est elle qui autorise déjà la
 * lecture du profil de performance ; un assistant externe qui lit l'historique
 * relève de la même finalité. La révocation passe par `setConsent(false)`, qui
 * émet l'événement `consent.revoked` et déclenche la purge RGPD existante.
 *
 * La lecture ci-dessous applique la même règle que `has_active_consent()` :
 * seule la DERNIÈRE `policy_version` du couple (user, purpose) compte.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { setConsent } from '@/features/adventure-intelligence/server/consents';

export const HISTORY_CONSENT_PURPOSE = 'personal_performance' as const;

export interface HistoryConsentPort {
  isGranted(userId: string): Promise<boolean>;
  grant(userId: string): Promise<{ ok: true } | { ok: false; error: string }>;
  revoke(userId: string): Promise<{ ok: true } | { ok: false; error: string }>;
}

interface ConsentRow {
  granted: boolean | null;
  revoked_at: string | null;
  policy_version: string | null;
}

export function createSupabaseHistoryConsentPort(client?: SupabaseClient): HistoryConsentPort {
  return {
    async isGranted(userId: string): Promise<boolean> {
      try {
        const supabase = client ?? (await createClient());
        const { data, error } = await supabase
          .from('adventure_data_consents')
          .select('granted, revoked_at, policy_version')
          .eq('user_id', userId)
          .eq('purpose', HISTORY_CONSENT_PURPOSE)
          .order('policy_version', { ascending: false })
          .limit(1)
          .maybeSingle<ConsentRow>();
        if (error || !data) return false;
        return data.granted === true && data.revoked_at === null;
      } catch {
        // Fail-closed : une lecture en panne ne vaut jamais un consentement.
        return false;
      }
    },

    async grant(_userId: string) {
      const result = await setConsent(HISTORY_CONSENT_PURPOSE, true);
      return result.ok ? { ok: true as const } : { ok: false as const, error: result.error ?? 'consent_failed' };
    },

    async revoke(_userId: string) {
      const result = await setConsent(HISTORY_CONSENT_PURPOSE, false);
      return result.ok ? { ok: true as const } : { ok: false as const, error: result.error ?? 'consent_failed' };
    },
  };
}
