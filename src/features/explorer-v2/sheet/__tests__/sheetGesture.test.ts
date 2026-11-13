import { describe, expect, it } from 'vitest';
import {
  CLOSE_DISTANCE_PX,
  clampDragHeight,
  closeDistance,
  resolveSheetRelease,
  velocityFromSamples,
  type SheetHeights,
} from '../sheetGesture';

// Viewport 932 px : cran bas 30 % = 280, cran haut 90 % = 839.
const heights: SheetHeights = { peek: 280, low: 280, mid: 839, full: 839 };

describe('closeDistance', () => {
  it('est le plus petit de 56 px et de 18 % du cran bas', () => {
    expect(closeDistance(heights)).toBeCloseTo(50.4, 1);
    expect(closeDistance({ peek: 600, low: 600, mid: 800, full: 800 })).toBe(CLOSE_DISTANCE_PX);
  });
});

describe('clampDragHeight', () => {
  it('laisse la feuille descendre sous le cran bas (plus de borne basse à 82 %)', () => {
    expect(clampDragHeight(150, heights)).toBe(150);
    expect(clampDragHeight(-30, heights)).toBe(0);
  });
  it('borne en haut au cran haut', () => {
    expect(clampDragHeight(2000, heights)).toBe(839);
  });
});

describe('velocityFromSamples', () => {
  it('est positive vers le bas, en px/ms, sur ~100 ms', () => {
    const samples = [
      { y: 100, t: 0 },
      { y: 110, t: 40 },
      { y: 140, t: 80 },
      { y: 180, t: 120 },
    ];
    // fenêtre de 100 ms : de t=0 (y=100) à t=120 (y=180)
    expect(velocityFromSamples(samples)).toBeCloseTo(80 / 120, 3);
  });
  it('est négative vers le haut et nulle sans mouvement', () => {
    expect(velocityFromSamples([{ y: 300, t: 0 }, { y: 200, t: 100 }])).toBeCloseTo(-1, 3);
    expect(velocityFromSamples([{ y: 300, t: 0 }])).toBe(0);
    expect(velocityFromSamples([{ y: 300, t: 0 }, { y: 300, t: 100 }])).toBe(0);
  });
  it("ignore les anciens points : un doigt arrêté a une vitesse faible", () => {
    const samples = [
      { y: 100, t: 0 },
      { y: 400, t: 50 },
      { y: 401, t: 400 },
      { y: 401, t: 520 },
    ];
    expect(Math.abs(velocityFromSamples(samples))).toBeLessThan(0.05);
  });
});

describe('resolveSheetRelease', () => {
  it('ferme depuis le cran bas après un glissement vers le bas suffisant', () => {
    expect(resolveSheetRelease({ height: 280 - 60, velocity: 0.1, heights, current: 'peek' })).toBe('close');
    expect(resolveSheetRelease({ height: 280 - 51, velocity: 0, heights, current: 'low' })).toBe('close');
  });

  it('reste au cran bas si le glissement vers le bas est trop court et lent', () => {
    expect(resolveSheetRelease({ height: 280 - 30, velocity: 0.1, heights, current: 'peek' })).toBe('peek');
  });

  it('ferme sur un lancer vers le bas depuis le cran bas, même court', () => {
    expect(resolveSheetRelease({ height: 280 - 20, velocity: 0.8, heights, current: 'peek' })).toBe('close');
  });

  it('ne ferme pas en dessous du seuil de vitesse', () => {
    expect(resolveSheetRelease({ height: 280 - 20, velocity: 0.5, heights, current: 'peek' })).toBe('peek');
  });

  it('descend d\'un cran depuis le cran haut après un glissement vers le bas', () => {
    expect(resolveSheetRelease({ height: 839 - 200, velocity: 0.1, heights, current: 'full' })).toBe('peek');
    expect(resolveSheetRelease({ height: 400, velocity: 0, heights, current: 'mid' })).toBe('peek');
  });

  it('un lancer vers le bas depuis le cran haut descend d\'un cran sans fermer', () => {
    expect(resolveSheetRelease({ height: 700, velocity: 1.5, heights, current: 'full' })).toBe('peek');
  });

  it('depuis le cran haut, ferme seulement si le doigt finit sous le seuil de fermeture', () => {
    expect(resolveSheetRelease({ height: 100, velocity: 0.2, heights, current: 'full' })).toBe('close');
  });

  it('revient au cran haut si le glissement vers le bas est trop court', () => {
    expect(resolveSheetRelease({ height: 839 - 40, velocity: 0, heights, current: 'full' })).toBe('full');
  });

  it('monte au cran haut après un glissement vers le haut suffisant ou un lancer', () => {
    expect(resolveSheetRelease({ height: 280 + 200, velocity: -0.1, heights, current: 'peek' })).toBe('full');
    expect(resolveSheetRelease({ height: 280 + 30, velocity: -0.9, heights, current: 'peek' })).toBe('full');
    expect(resolveSheetRelease({ height: 280 + 40, velocity: 0, heights, current: 'peek' })).toBe('peek');
  });

  it('ne ferme jamais sans onClose', () => {
    expect(resolveSheetRelease({ height: 100, velocity: 2, heights, current: 'peek', canClose: false })).toBe('peek');
    expect(resolveSheetRelease({ height: 100, velocity: 0, heights, current: 'full', canClose: false })).toBe('peek');
  });
});
