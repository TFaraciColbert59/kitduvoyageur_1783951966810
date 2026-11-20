import { apiError } from '../lib/errors';

/**
 * Limitation de débit simple, en mémoire du processus.
 *
 * Suffisante pour un CRM mono-équipe : elle protège des boucles d'interface et
 * d'un agent emballé. Elle n'est pas distribuée (plusieurs instances Vercel) ni
 * persistante : la vraie limite de budget reste `admin.agent_rate` en base.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const MAX_KEYS = 5000;

function prune(now: number): void {
  if (windows.size < MAX_KEYS) return;
  for (const [key, win] of windows) {
    if (win.resetAt <= now) windows.delete(key);
  }
}

/** Consomme une unité ; lève `rate_limited` au-delà de `limit` par fenêtre. */
export function rateLimit(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now();
  prune(now);
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > limit) throw apiError('rate_limited');
}

/** Remise à zéro (tests uniquement). */
export function resetRateLimits(): void {
  windows.clear();
}

export function rateLimitSize(): number {
  return windows.size;
}
