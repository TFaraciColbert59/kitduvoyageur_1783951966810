import 'server-only';
import { getServiceSupabase } from './serviceClient';
import type { AITier } from './providers/types';

/**
 * Quota IA quotidien — atomique côté SQL (check_and_increment_ai_quota).
 * Garde tier (20 heavy / 100 fast par jour) + garde par feature (registre).
 *
 * Fail-open en cas d'erreur RPC : si la migration n'est pas encore appliquée,
 * l'app reste fonctionnelle (warn + autorisation) — dégradation gracieuse
 * assumée, la consommation réelle étant par ailleurs plafonnée par OpenRouter.
 */
export async function consumeQuota(
  userId: string,
  tier: AITier,
  feature: string,
  featureLimit: number
): Promise<boolean> {
  const client = getServiceSupabase();
  if (!client) {
    console.warn('[ai/quota] service client indisponible — quota non appliqué (fail-open)');
    return true;
  }

  try {
    const { data, error } = await client.rpc('check_and_increment_ai_quota', {
      p_user_id: userId,
      p_tier: tier,
      p_feature: feature,
      p_feature_limit: featureLimit,
    });
    if (error) {
      console.error('[ai/quota] rpc en échec (fail-open):', error.message);
      return true;
    }
    return data === true;
  } catch (err) {
    console.error('[ai/quota] consumeQuota a échoué (fail-open):', err instanceof Error ? err.message : err);
    return true;
  }
}
