/**
 * departCache.ts — Codec pur du cache hors-ligne du cockpit Départ.
 *
 * Format : `v1:<json>`. Toute version inconnue ou JSON invalide ⇒ null.
 */

const CACHE_PREFIX = 'v1:';

export function encodeDepartCache(payload: unknown): string {
  return `${CACHE_PREFIX}${JSON.stringify(payload)}`;
}

export function decodeDepartCache<T>(raw: string | null): T | null {
  if (!raw || !raw.startsWith(CACHE_PREFIX)) return null;
  try {
    return JSON.parse(raw.slice(CACHE_PREFIX.length)) as T;
  } catch {
    return null;
  }
}
