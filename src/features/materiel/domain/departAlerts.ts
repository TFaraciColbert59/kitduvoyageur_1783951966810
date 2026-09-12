/**
 * departAlerts.ts — Règles pures de dissociation des alertes du cockpit Départ.
 *
 * Une alerte masquée le reste pendant 24 h (TTL par défaut) puis réapparaît.
 * Aucun accès au DOM/localStorage : les hooks branchent ces règles.
 */

export interface DismissState {
  [alertId: string]: number; // timestamp de masquage (ms epoch)
}

export const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

/** Ajoute ou écrase l'horodatage de masquage d'une alerte (immuable). */
export function mergeDismissed(state: DismissState, id: string, now: number): DismissState {
  return { ...state, [id]: now };
}

/** Vrai si l'alerte a été masquée il y a moins de `ttlMs` (24 h par défaut). */
export function isDismissed(
  state: DismissState,
  id: string,
  now: number,
  ttlMs: number = DISMISS_TTL_MS
): boolean {
  const dismissedAt = state[id];
  if (typeof dismissedAt !== 'number') return false;
  return now - dismissedAt < ttlMs;
}

/** Alertes encore visibles : ni masquées, ni expirées. */
export function visibleAlerts<T extends { id: string }>(
  alerts: T[],
  state: DismissState,
  now: number
): T[] {
  return alerts.filter((alert) => !isDismissed(state, alert.id, now));
}
