/**
 * PERF — Politique de prefetch réseau (P0).
 *
 * Objectif : ne jamais lancer la cascade de prefetch (routes Next + données
 * React Query) sur une connexion que l'utilisateur a explicitement limitée.
 * LKDV est utilisée en extérieur/montagne : c'est exactement le cas d'usage.
 *
 * Règles (PERF-R2) :
 *   - `saveData: true`            ⇒ tout est coupé (routes + données) ;
 *   - `effectiveType` slow-2g/2g  ⇒ tout est coupé ;
 *   - `effectiveType` 3g          ⇒ routes autorisées, données refusées ;
 *   - API absente / 4g            ⇒ comportement actuel conservé (fail-open).
 */

export interface ConnectionLike {
  saveData?: boolean;
  effectiveType?: string;
}

export type PrefetchReason = 'ok' | 'save-data' | 'slow-network' | 'reduced-data';

export interface PrefetchDecision {
  /** Prefetch de routes Next (`router.prefetch`). */
  allow: boolean;
  /** Prefetch de données (React Query `prefetchQuery`). */
  allowData: boolean;
  reason: PrefetchReason;
}

const NO_PREFETCH_TYPES = new Set(['slow-2g', '2g']);
const ROUTES_ONLY_TYPES = new Set(['3g']);

export function evaluatePrefetchPolicy(
  connection: ConnectionLike | null | undefined
): PrefetchDecision {
  if (!connection) return { allow: true, allowData: true, reason: 'ok' };

  if (connection.saveData === true) {
    return { allow: false, allowData: false, reason: 'save-data' };
  }

  const effectiveType = (connection.effectiveType ?? '').toLowerCase();
  if (NO_PREFETCH_TYPES.has(effectiveType)) {
    return { allow: false, allowData: false, reason: 'slow-network' };
  }
  if (ROUTES_ONLY_TYPES.has(effectiveType)) {
    return { allow: true, allowData: false, reason: 'reduced-data' };
  }

  return { allow: true, allowData: true, reason: 'ok' };
}

/** Lecture SSR-safe de `navigator.connection` (non standard, optionnelle). */
export function readConnection(): ConnectionLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & { connection?: ConnectionLike };
  return nav.connection ?? null;
}

export function evaluateCurrentPrefetchPolicy(): PrefetchDecision {
  return evaluatePrefetchPolicy(readConnection());
}
