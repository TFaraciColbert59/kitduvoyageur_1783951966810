import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

/**
 * Store de réponses IA (routeur Nemotron) — SERVEUR UNIQUEMENT.
 * Accès exclusivement via les fonctions SECURITY DEFINER avec le service role
 * (SUPABASE_SERVICE_ROLE_KEY) : la table n'est lisible par aucun client
 * (policy select=false). Le cache est best-effort : tout échec est loggé et
 * silencieusement ignoré — il ne doit jamais casser une requête IA.
 * Ne jamais logger de contenu utilisateur ni de clé.
 */

let serviceClient: SupabaseClient | null | undefined;

function getServiceClient(): SupabaseClient | null {
  if (serviceClient !== undefined) return serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('[ai/responseStore] SUPABASE_SERVICE_ROLE_KEY absente — cache IA désactivé');
    serviceClient = null;
    return null;
  }

  serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

export function buildCacheKey(parts: {
  feature: string;
  task: string;
  system: string;
  prompt: string;
  maxTokens?: number;
}): string {
  return createHash('sha256')
    .update(
      `${parts.feature}|${parts.task}|${parts.system}|${parts.prompt}|${parts.maxTokens ?? ''}`
    )
    .digest('hex');
}

export async function getCachedResponse(cacheKey: string): Promise<string | null> {
  const client = getServiceClient();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('get_ai_cache', { p_cache_key: cacheKey });
    if (error) {
      console.error('[ai/responseStore] get_ai_cache:', error.message);
      return null;
    }
    return typeof data === 'string' && data.length > 0 ? data : null;
  } catch (err) {
    console.error('[ai/responseStore] get_ai_cache a échoué:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function storeCachedResponse(
  cacheKey: string,
  feature: string,
  response: string,
  model: string,
  ttlSeconds: number
): Promise<void> {
  const client = getServiceClient();
  if (!client) return;
  try {
    const { error } = await client.rpc('set_ai_cache', {
      p_cache_key: cacheKey,
      p_feature: feature,
      p_response: response,
      p_model: model,
      p_ttl_seconds: ttlSeconds,
    });
    if (error) {
      console.error('[ai/responseStore] set_ai_cache:', error.message);
    }
  } catch (err) {
    console.error('[ai/responseStore] set_ai_cache a échoué:', err instanceof Error ? err.message : err);
  }
}
