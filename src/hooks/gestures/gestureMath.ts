/**
 * Logique de décision pure des gestes — séparée des hooks React pour être
 * testable sans DOM (vitest, environnement node). Aucun import React ici.
 */

// ── Double-tap ────────────────────────────────────────────────────────────

export const DEFAULT_DOUBLE_TAP_WINDOW_MS = 300;

/** Vrai si deux taps (lastTap, now) tombent dans la même fenêtre de double-tap. */
export function isWithinTapWindow(
  lastTapAt: number,
  now: number,
  windowMs: number = DEFAULT_DOUBLE_TAP_WINDOW_MS
): boolean {
  if (lastTapAt <= 0) return false;
  return now - lastTapAt < windowMs;
}

// ── Long-press ────────────────────────────────────────────────────────────

export const DEFAULT_LONG_PRESS_MS = 450;
export const DEFAULT_MOVE_TOLERANCE_PX = 8;

/**
 * Vrai si le doigt a dépassé la tolérance de déplacement : le long-press
 * doit être annulé pour ne pas gêner le scroll de la liste (cf. audit 1.4).
 */
export function isMoveBeyondTolerance(
  dx: number,
  dy: number,
  tolerancePx: number = DEFAULT_MOVE_TOLERANCE_PX
): boolean {
  return Math.abs(dx) > tolerancePx || Math.abs(dy) > tolerancePx;
}

// ── Drag-to-dismiss (framer-motion) ───────────────────────────────────────

export const DEFAULT_DISMISS_THRESHOLD_PX = 80;
export const DEFAULT_DISMISS_VELOCITY_PX_S = 500;

/**
 * Décision de fermeture au drag : dépasser le seuil de déplacement OU
 * donner un coup sec (velocity) vers le bas, comme un swipe IG stories.
 * offsetY positif = le doigt est descendu.
 */
export function shouldDismiss(
  offsetY: number,
  velocityY: number,
  thresholdPx: number = DEFAULT_DISMISS_THRESHOLD_PX,
  velocityThresholdPxS: number = DEFAULT_DISMISS_VELOCITY_PX_S
): boolean {
  return offsetY > thresholdPx || velocityY > velocityThresholdPxS;
}

/** Seuil franchi vers le haut (dépliage de sheet, ex. ExplorerMobileSheet). */
export function shouldDragUp(
  offsetY: number,
  velocityY: number,
  thresholdPx: number = DEFAULT_DISMISS_THRESHOLD_PX,
  velocityThresholdPxS: number = DEFAULT_DISMISS_VELOCITY_PX_S
): boolean {
  return offsetY < -thresholdPx || velocityY < -velocityThresholdPxS;
}
