import type { Detent } from '../state/types';

/**
 * Logique pure du geste de la feuille Explorer (comportement d'une feuille iOS).
 *
 * Conventions : les hauteurs sont en px, la vitesse en px/ms et positive vers le BAS
 * de l'écran (un doigt qui descend a une vitesse > 0, la feuille rapetisse).
 */

export type SheetHeights = Record<Detent, number>;
export type SheetRelease = Detent | 'close';

/** Distance de glissement sous le cran bas qui ferme la feuille (px) ... */
export const CLOSE_DISTANCE_PX = 56;
/** ... ou cette part de la hauteur du cran bas, la plus petite des deux. */
export const CLOSE_DISTANCE_RATIO = 0.18;
/** Vitesse de lancer (px/ms) à partir de laquelle un geste vers le bas ou le haut est un lancer. */
export const FLING_VELOCITY = 0.5;
/** Fenêtre de mesure de la vitesse (ms). */
export const VELOCITY_WINDOW_MS = 100;
/** Part de l'écart entre les deux crans qu'il faut parcourir pour changer de cran sans lancer. */
export const SWITCH_RATIO = 0.2;
/** Mouvement (px) avant qu'un appui devienne un glissement. */
export const DRAG_SLOP_PX = 6;

export interface SheetSample {
  y: number;
  t: number;
}

/** Hauteur de la feuille au cran bas / haut. */
export function lowHeight(heights: SheetHeights): number {
  return Math.min(heights.peek, heights.low);
}
export function highHeight(heights: SheetHeights): number {
  return Math.max(heights.mid, heights.full);
}

/** Distance sous le cran bas au-delà de laquelle le relâchement ferme. */
export function closeDistance(heights: SheetHeights): number {
  return Math.min(CLOSE_DISTANCE_PX, lowHeight(heights) * CLOSE_DISTANCE_RATIO);
}

/** Le doigt suit la feuille de 0 au cran haut (plus de borne basse au cran peek). */
export function clampDragHeight(height: number, heights: SheetHeights): number {
  return Math.min(highHeight(heights), Math.max(0, height));
}

/**
 * Vitesse verticale (px/ms, positive vers le bas) sur les ~100 dernières ms.
 * `samples` est ordonné par temps croissant.
 */
export function velocityFromSamples(samples: SheetSample[], windowMs = VELOCITY_WINDOW_MS): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = samples[0];
  for (let i = samples.length - 2; i >= 0; i -= 1) {
    first = samples[i];
    if (last.t - samples[i].t >= windowMs) break;
  }
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return (last.y - first.y) / dt;
}

export interface ReleaseInput {
  /** Hauteur de la feuille au relâchement. */
  height: number;
  /** px/ms, positive vers le bas. */
  velocity: number;
  heights: SheetHeights;
  /** Cran au début du geste. */
  current: Detent;
  /** Faux si la feuille ne peut pas se fermer (pas de `onClose`). */
  canClose?: boolean;
}

/**
 * Décide du cran (ou de la fermeture) au relâchement.
 *
 * - Sous le cran bas de plus de `closeDistance` : fermeture, quelle que soit la vitesse.
 * - Lancer vers le bas : depuis le cran bas, fermeture ; depuis le cran haut, cran bas.
 * - Lancer vers le haut : cran haut.
 * - Sinon : on change de cran dès que le doigt a parcouru `SWITCH_RATIO` de l'écart ;
 *   à défaut on revient au cran de départ.
 */
export function resolveSheetRelease({ height, velocity, heights, current, canClose = true }: ReleaseInput): SheetRelease {
  const low = lowHeight(heights);
  const high = highHeight(heights);
  const startIsHigh = heights[current] > low;
  const lowDetent: Detent = 'peek';
  const highDetent: Detent = 'full';

  if (canClose && height < low - closeDistance(heights)) return 'close';

  if (velocity > FLING_VELOCITY) {
    if (!startIsHigh) return canClose ? 'close' : lowDetent;
    return lowDetent;
  }
  if (velocity < -FLING_VELOCITY) return highDetent;

  const switchDistance = Math.max(1, (high - low) * SWITCH_RATIO);
  const start = heights[current];
  if (startIsHigh) return start - height >= switchDistance ? lowDetent : current;
  return height - start >= switchDistance ? highDetent : current;
}
