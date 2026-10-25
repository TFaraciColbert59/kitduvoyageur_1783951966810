/**
 * Phase 8 — Garde uniforme de rate limiting distribué (Phase 6) pour les
 * routes sensibles : un seul appel, une seule forme de refus (429/503).
 *
 * `failMode: 'closed'` (défaut) pour les ressources payantes/financières :
 * Upstash configuré mais injoignable ⇒ 503 explicite, jamais de passage
 * silencieux. `failMode: 'open'` pour les lectures/écritures non payantes :
 * repli mémoire dégradé journalisé par le résultat (`degraded: true`).
 */
import { NextResponse } from 'next/server';
import { rateLimit, rateLimitHeaders, type RateLimitFailMode } from './index';

export interface SensitiveRateLimit {
  /** Portée logique (`rewards-claim`, `ai-…`) — sert de préfixe de clé. */
  scope: string;
  limit: number;
  windowMs: number;
  failMode?: RateLimitFailMode;
}

/**
 * Consomme le quota de `identifier` (id utilisateur ou IP). Retourne une
 * réponse 429/503 si la requête doit être refusée, `null` sinon.
 */
export async function enforceRateLimit(
  identifier: string,
  config: SensitiveRateLimit
): Promise<NextResponse | null> {
  const limit = await rateLimit({
    key: `${config.scope}:${identifier}`,
    limit: config.limit,
    windowMs: config.windowMs,
    failMode: config.failMode ?? 'closed',
  });

  if (limit.outcome === 'limited') {
    return NextResponse.json(
      { error: 'Trop de requêtes', details: `${config.scope}_rate_limited` },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }
  if (limit.outcome === 'unavailable') {
    return NextResponse.json(
      { error: 'Service temporairement indisponible', details: `${config.scope}_rate_limit_unavailable` },
      { status: 503, headers: rateLimitHeaders(limit) }
    );
  }
  return null;
}
