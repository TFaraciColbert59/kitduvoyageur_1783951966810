import 'server-only';
import { getServiceSupabase } from './serviceClient';
import { aiCountersMustBeReadable } from './aiMode';
import type { AITier } from './providers/types';

/**
 * Quota IA quotidien — atomique côté SQL (check_and_increment_ai_quota).
 * Garde tier (120 heavy / 400 fast par jour, relevée le 14 oct. 2026) + garde par feature (registre).
 *
 * Compteur illisible (clé de service absente, erreur RPC, exception) :
 *  - en production (`aiCountersMustBeReadable`) : REFUS, fail-closed (plan 2.5) ; l'appelant
 *    est prévenu par `hooks.onUnreadable` pour dire la vraie cause (et non « quota épuisé ») ;
 *  - ailleurs (développement, tests, aperçu sans clé) : autorisation avec avertissement.
 */
export interface QuotaHooks {
  onUnreadable?: () => void;
}

export async function consumeQuota(
  userId: string,
  tier: AITier,
  feature: string,
  featureLimit: number,
  hooks: QuotaHooks = {}
): Promise<boolean> {
  const unreadable = (why: string): boolean => {
    if (aiCountersMustBeReadable()) {
      console.error(`[ai/quota] ${why} — IA coupée (fail-closed)`);
      hooks.onUnreadable?.();
      return false;
    }
    console.warn(`[ai/quota] ${why} — quota non appliqué (fail-open hors production)`);
    return true;
  };
  const client = getServiceSupabase();
  if (!client) return unreadable('service client indisponible');

  try {
    const { data, error } = await client.rpc('check_and_increment_ai_quota', {
      p_user_id: userId,
      p_tier: tier,
      p_feature: feature,
      p_feature_limit: featureLimit,
    });
    if (error) return unreadable(`rpc en échec (${error.message})`);
    return data === true;
  } catch (err) {
    return unreadable(`consumeQuota a échoué (${err instanceof Error ? err.message : 'erreur'})`);
  }
}
