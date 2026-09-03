import { describe, it, expect } from 'vitest';
import {
  isWithinTapWindow,
  isMoveBeyondTolerance,
  shouldDismiss,
  shouldDragUp,
  DEFAULT_DOUBLE_TAP_WINDOW_MS,
  DEFAULT_LONG_PRESS_MS,
  DEFAULT_MOVE_TOLERANCE_PX,
  DEFAULT_DISMISS_THRESHOLD_PX,
  DEFAULT_DISMISS_VELOCITY_PX_S,
} from '@/hooks/gestures/gestureMath';

describe('gestureMath — double-tap', () => {
  it('constantes alignées sur les timings historiques de la mission', () => {
    expect(DEFAULT_DOUBLE_TAP_WINDOW_MS).toBe(300);
    expect(DEFAULT_LONG_PRESS_MS).toBe(450);
    expect(DEFAULT_MOVE_TOLERANCE_PX).toBe(8);
    expect(DEFAULT_DISMISS_THRESHOLD_PX).toBe(80);
    expect(DEFAULT_DISMISS_VELOCITY_PX_S).toBe(500);
  });

  it('accepte deux taps dans la fenêtre de 300ms', () => {
    expect(isWithinTapWindow(1000, 1150)).toBe(true);
    expect(isWithinTapWindow(1000, 1000 + DEFAULT_DOUBLE_TAP_WINDOW_MS - 1)).toBe(true);
  });

  it('rejette deux taps espacés de 300ms ou plus', () => {
    expect(isWithinTapWindow(1000, 1300)).toBe(false);
    expect(isWithinTapWindow(1000, 2000)).toBe(false);
  });

  it('rejette un premier tap sans historique (lastTap <= 0)', () => {
    expect(isWithinTapWindow(0, 10)).toBe(false);
  });
});

describe('gestureMath — long-press', () => {
  it('annule au-delà de la tolérance de 8px (axe X)', () => {
    expect(isMoveBeyondTolerance(9, 0)).toBe(true);
    expect(isMoveBeyondTolerance(-9, 0)).toBe(true);
  });

  it('annule au-delà de la tolérance (axe Y — scroll de liste)', () => {
    expect(isMoveBeyondTolerance(0, 9)).toBe(true);
  });

  it('ne cancelle pas dans la tolérance', () => {
    expect(isMoveBeyondTolerance(8, 8)).toBe(false);
    expect(isMoveBeyondTolerance(0, 0)).toBe(false);
  });

  it('tolérance personnalisable', () => {
    expect(isMoveBeyondTolerance(15, 0, 20)).toBe(false);
  });
});

describe('gestureMath — drag-to-dismiss', () => {
  it('ferme au-delà du seuil de déplacement vers le bas (strict, comme PremiumBottomSheet historique : offset > 80)', () => {
    expect(shouldDismiss(81, 0)).toBe(true);
    expect(shouldDismiss(120, 0)).toBe(true);
    expect(shouldDismiss(80, 0)).toBe(false);
  });

  it('ferme sur un flick rapide même sous le seuil (comportement IG)', () => {
    expect(shouldDismiss(30, 600)).toBe(true);
  });

  it('ne ferme pas sous le seuil avec vitesse faible', () => {
    expect(shouldDismiss(40, 200)).toBe(false);
    expect(shouldDismiss(0, 0)).toBe(false);
  });

  it('montée du doigt ne déclenche pas la fermeture', () => {
    expect(shouldDismiss(-200, -600)).toBe(false);
  });

  it('shouldDragUp symétrique pour le dépliage de sheet', () => {
    expect(shouldDragUp(-81, 0)).toBe(true);
    expect(shouldDragUp(-30, -600)).toBe(true);
    expect(shouldDragUp(40, 200)).toBe(false);
  });

  it('seuils personnalisables', () => {
    expect(shouldDismiss(50, 0, 40, 900)).toBe(true);
    expect(shouldDismiss(50, 0, 60, 900)).toBe(false);
  });
});
