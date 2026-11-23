import { describe, expect, it } from 'vitest';
import {
  LONG_PRESS_MS,
  TAP_TOLERANCE_PX,
  insertionThresholdM,
  pressDown,
  pressElapsed,
  pressMove,
  pressUp,
} from '../mapGesture';

describe('mapGesture · toucher = point, appui long = menu (2.2)', () => {
  it('un toucher bref sans mouvement est un point', () => {
    const s = pressDown(100, 100, 0);
    expect(pressElapsed(s, LONG_PRESS_MS - 50)).toBeNull();
    expect(pressUp(s)).toBe('tap');
  });

  it('un appui long immobile ouvre le menu, une seule fois, et ne pose pas de point', () => {
    const s = pressDown(100, 100, 0);
    const long = pressElapsed(s, LONG_PRESS_MS);
    expect(long).not.toBeNull();
    expect(pressElapsed(long!, LONG_PRESS_MS + 100)).toBeNull();
    expect(pressUp(long!)).toBe('long');
  });

  it('un doigt qui bouge au-delà de la tolérance est un glissé : ni point ni menu', () => {
    let s = pressDown(100, 100, 0);
    s = pressMove(s, 100 + TAP_TOLERANCE_PX - 1, 100);
    expect(s.moved).toBe(false);
    s = pressMove(s, 100 + TAP_TOLERANCE_PX + 2, 100);
    expect(s.moved).toBe(true);
    expect(pressElapsed(s, LONG_PRESS_MS * 2)).toBeNull();
    expect(pressUp(s)).toBe('drag');
  });

  it('seuil de rattachement au tracé : ~22 px d’écran, borné, plus large quand on dézoome', () => {
    const near = insertionThresholdM(45, 16);
    const far = insertionThresholdM(45, 8);
    expect(near).toBeGreaterThanOrEqual(15);
    expect(far).toBeGreaterThan(near);
    expect(far).toBeLessThanOrEqual(2000);
    expect(insertionThresholdM(45, 30)).toBe(15);
    expect(insertionThresholdM(Number.NaN, 12)).toBe(30);
  });
});
