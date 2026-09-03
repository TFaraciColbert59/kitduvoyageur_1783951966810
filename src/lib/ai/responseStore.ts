import 'server-only';
import { createHash } from 'node:crypto';
import { getServiceSupabase } from './serviceClient';
import type { AIResponse } from './providers/types';

/**
 * Store de réponses IA — SERVEUR UNIQUEMENT, service role.
 * Accès exclusivement via les fonctions SECURITY DEFINER (get_ai_cache /
 * set_ai_cache) : la table n'est lisible par aucun client (policy select=false).
 * Le cache est best-effort : tout échec est loggé puis ignoré — il ne doit
 * jamais casser une requête IA. La clé de service n'est JAMAIS loggée.
 *
 * Choix du hash : SHA-256 côté TS (node:crypto) — stable, pas de dépendance
 * pgcrypto côté SQL, calcul serveur-only. Locale constante 'fr' (site monolingue).
 * NB : nom de fichier sans "cache" (règle *cache* du .gitignore).
 */

const SITE_LOCALE = 'fr';

/** Normalisation : trim + lowercase + collapse des espaces (insensible à la mise en forme). */
export function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildCacheKey(feature: string, prompt: string): string {
  return createHash('sha256')
    .update(`${feature}|${normalizePrompt(prompt)}|${SITE_LOCALE}`)
    .digest('hex');
}

export async function getCached(feature: string, prompt: string): Promise<AIResponse | null> {
  const client = getServiceSupabase();
  if (!client) return null;

  const cacheKey = buildCacheKey(feature, prompt);
  try {
    const { data, error } = await client.rpc('get_ai_cache', { p_cache_key: cacheKey });
    if (error) {
      console.error('[ai/responseStore] get_ai_cache:', error.message);
      return null;
    }
    const stored = data as { text?: unknown; model?: unknown; provider?: unknown; degraded?: unknown } | null;
    if (!stored || typeof stored.text !== 'string' || stored.text.length === 0) return null;

    return {
      text: stored.text,
      model: typeof stored.model === 'string' ? stored.model : 'cache',
      degraded: stored.degraded === true,
      cached: true,
      provider: typeof stored.provider === 'string' ? stored.provider : 'cache',
    };
  } catch (err) {
    console.error('[ai/responseStore] getCached a échoué:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setCached(
  feature: string,
  prompt: string,
  response: AIResponse,
  ttlSeconds: number
): Promise<void> {
  if (!ttlSeconds || ttlSeconds <= 0) return; // TTL 0 = pas de cache (kit personnel, chat…)

  const client = getServiceSupabase();
  if (!client) return;

  const cacheKey = buildCacheKey(feature, prompt);
  try {
    const { error } = await client.rpc('set_ai_cache', {
      p_cache_key: cacheKey,
      p_feature: feature,
      p_response: {
        text: response.text,
        model: response.model,
        degraded: response.degraded,
        provider: response.provider,
      },
      p_model: response.model,
      p_provider: response.provider,
      p_ttl_seconds: ttlSeconds,
    });
    if (error) {
      console.error('[ai/responseStore] set_ai_cache:', error.message);
    }
  } catch (err) {
    console.error('[ai/responseStore] setCached a échoué:', err instanceof Error ? err.message : err);
  }
}
