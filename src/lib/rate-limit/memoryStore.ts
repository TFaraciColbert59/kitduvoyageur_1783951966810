/**
 * Phase 6 — Store mémoire du rate limiting (repli local).
 *
 * Fenêtre fixe par clé : le compteur est remis à zéro à l'ouverture d'une
 * nouvelle fenêtre. Ce store est utilisé quand Upstash n'est pas configuré, et
 * comme repli dégradé quand Upstash est configuré mais injoignable sur une
 * route non sensible (failMode `open`).
 *
 * Volontairement best-effort : un processus par instance, purge par taille.
 * Il ne remplace pas le stockage distribué, il garantit la continuité.
 */

/** Fenêtre fixe en mémoire : compteur + fin de fenêtre. */
export interface MemoryRateLimitWindow {
  count: number;
  resetAtMs: number;
}

/** Nombre maximal de clés conservées (purge des plus anciennes). */
export const MEMORY_RATE_LIMIT_MAX_KEYS = 20_000;

const windows = new Map<string, MemoryRateLimitWindow>();

export interface MemoryRateLimitResult {
  count: number;
  resetAtMs: number;
}

function sweep(nowMs: number): void {
  if (windows.size <= MEMORY_RATE_LIMIT_MAX_KEYS) return;
  const expired: string[] = [];
  for (const [key, window] of windows) {
    if (window.resetAtMs <= nowMs) expired.push(key);
  }
  for (const key of expired) windows.delete(key);
  while (windows.size > MEMORY_RATE_LIMIT_MAX_KEYS) {
    const oldest = windows.keys().next().value;
    if (oldest === undefined) break;
    windows.delete(oldest);
  }
}

/**
 * Consomme une unité pour `key` dans la fenêtre courante. Une fenêtre expirée
 * repart de zéro ; une fenêtre encore active incrémente. `nowMs` est injecté
 * (déterminisme des tests).
 */
export function consumeMemoryWindow(
  key: string,
  windowMs: number,
  nowMs: number
): MemoryRateLimitResult {
  const existing = windows.get(key);
  if (!existing || existing.resetAtMs <= nowMs) {
    const fresh: MemoryRateLimitWindow = { count: 1, resetAtMs: nowMs + windowMs };
    windows.set(key, fresh);
    sweep(nowMs);
    return { count: fresh.count, resetAtMs: fresh.resetAtMs };
  }
  existing.count += 1;
  return { count: existing.count, resetAtMs: existing.resetAtMs };
}

/** Vide le store mémoire (tests, changement d'environnement). */
export function resetMemoryRateLimits(): void {
  windows.clear();
}

/** Nombre de fenêtres actives (diagnostic/tests). */
export function memoryRateLimitSize(): number {
  return windows.size;
}
