import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISMISS_THRESHOLD_PX,
  DEFAULT_SWIPE_THRESHOLD_PX,
  isHorizontalSwipe,
  isMoveBeyondTolerance,
  shouldDismiss,
} from '../gestureMath';

describe('gestureMath — seuils uniques des gestes', () => {
  it('balayage horizontal : au-delà de 48 px et plus horizontal que vertical', () => {
    expect(DEFAULT_SWIPE_THRESHOLD_PX).toBe(48);
    expect(isHorizontalSwipe(60, 5)).toBe(true);
    expect(isHorizontalSwipe(-60, 5)).toBe(true);
    expect(isHorizontalSwipe(40, 0)).toBe(false);
    expect(isHorizontalSwipe(60, 55)).toBe(false);
  });

  it('fermeture : seuil de 80 px ou coup sec', () => {
    expect(DEFAULT_DISMISS_THRESHOLD_PX).toBe(80);
    expect(shouldDismiss(90, 0)).toBe(true);
    expect(shouldDismiss(30, 800)).toBe(true);
    expect(shouldDismiss(30, 100)).toBe(false);
  });

  it('tap : tolérance de déplacement de 8 px', () => {
    expect(isMoveBeyondTolerance(5, 5)).toBe(false);
    expect(isMoveBeyondTolerance(9, 0)).toBe(true);
  });
});
