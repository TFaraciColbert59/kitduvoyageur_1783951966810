import { describe, expect, it } from 'vitest';
import { MOBILE_VIEWPORT_MAX, shouldHideCustomCursor } from '../CustomCursor';

describe('curseur personnalise : quand ne pas l afficher', () => {
  const bureau = { hasTouch: false, isCoarsePointer: false, viewportWidth: 1440 };

  it('s affiche sur un poste de bureau large', () => {
    expect(shouldHideCustomCursor(bureau)).toBe(false);
  });

  it('ne s affiche pas sur un appareil tactile', () => {
    expect(shouldHideCustomCursor({ ...bureau, hasTouch: true })).toBe(true);
  });

  it('ne s affiche pas sur un pointeur grossier', () => {
    expect(shouldHideCustomCursor({ ...bureau, isCoarsePointer: true })).toBe(true);
  });

  it('ne s affiche pas dans une fenetre etroite de type telephone', () => {
    expect(shouldHideCustomCursor({ ...bureau, viewportWidth: 390 })).toBe(true);
  });

  it('reste affiche juste au-dessus du seuil', () => {
    expect(shouldHideCustomCursor({ ...bureau, viewportWidth: MOBILE_VIEWPORT_MAX + 1 })).toBe(
      false,
    );
  });

  it('ne depend d aucun autre contexte que ces trois signaux', () => {
    expect(
      shouldHideCustomCursor({
        hasTouch: false,
        isCoarsePointer: false,
        viewportWidth: 1024,
      }),
    ).toBe(false);
  });
});