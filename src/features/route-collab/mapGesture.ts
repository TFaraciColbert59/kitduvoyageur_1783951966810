/**
 * Gestes de la carte (2.2) : toucher = point, appui long = menu. Machine à états pure : l'appelant lui donne
 * les positions et le temps, elle dit ce que le geste est devenu. Un doigt qui bouge est un déplacement de
 * carte (jamais un point posé) ; un appui long ne pose rien, il ouvre le menu.
 */
import { metersPerPixel } from './mapGeometry';

export const LONG_PRESS_MS = 500;
/** Au-delà de ce déplacement (pixels écran), le geste est un glissé : on ne pose rien. */
export const TAP_TOLERANCE_PX = 8;

export interface PressState {
  readonly x: number;
  readonly y: number;
  readonly startedAt: number;
  readonly moved: boolean;
  readonly longFired: boolean;
}

export type PressOutcome = 'tap' | 'long' | 'drag';

export function pressDown(x: number, y: number, now: number): PressState {
  return { x, y, startedAt: now, moved: false, longFired: false };
}

export function pressMove(state: PressState, x: number, y: number): PressState {
  if (state.moved) return state;
  return Math.hypot(x - state.x, y - state.y) > TAP_TOLERANCE_PX ? { ...state, moved: true } : state;
}

/** L'appui est assez long et le doigt n'a pas bougé : le menu s'ouvre (une seule fois). */
export function pressElapsed(state: PressState, now: number): PressState | null {
  if (state.moved || state.longFired) return null;
  return now - state.startedAt >= LONG_PRESS_MS ? { ...state, longFired: true } : null;
}

export function pressUp(state: PressState): PressOutcome {
  if (state.moved) return 'drag';
  return state.longFired ? 'long' : 'tap';
}

/** Distance (m) sous laquelle un point posé est rattaché au tracé voisin : ~22 px d'écran, bornée. */
export function insertionThresholdM(lat: number, zoom: number, pixels = 22): number {
  const m = metersPerPixel(lat, zoom) * pixels;
  if (!Number.isFinite(m)) return 30;
  return Math.min(2000, Math.max(15, Math.round(m)));
}
