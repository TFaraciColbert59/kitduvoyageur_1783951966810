/**
 * Reservation basse de la bottom bar — une seule source de verite.
 *
 * Le defaut reproduit sur `/prepare` (viewport 393x852, mesure du 2026-09-28) :
 * le rail de jours — pose par `WebNavigationBar`, donc ~40 px AU-DESSUS de la
 * barre — recouvrait le CTA « Enregistrer mon aventure ».
 *
 * Cause racine : `--bottom-nav-height` n etait publie que par `AppShell`, sur
 * SON PROPRE div. Or `/prepare?nouvelle=1` rend `AdventurePrepScreen`
 * directement sous `<main>`, hors de tout `AppShell`. La feuille du
 * preparateur lisait donc `var(--bottom-nav-height, var(--nav-offset, 60px))`
 * et tombait sur le repli de 60 px : 48 px de trop, exactement la hauteur du
 * rail. Le CTA passait sous la barre.
 *
 * Le contrat correct : la reservation est publiee sur la RACINE du document
 * par la barre elle-meme — celle qui sait, seule, si le plateau est rendu —
 * et toute page, encapsulee ou non, la lit.
 *
 * Ces tests sont purs (pas de jsdom dans le repo) : l appliquant recoit sa
 * racine en parametre, donc le comportement est verifie sans navigateur.
 */

import { describe, it, expect } from 'vitest';
import {
  BOTTOM_NAV_HEIGHT_VAR,
  applyBottomNavReservation,
  bottomNavHeightToken,
} from '../bottom-nav-reservation';

/** Racine DOM minimale : le contrat teste est set/remove, pas le DOM. */
interface FakeRoot {
  style: {
    store: Map<string, string>;
    setProperty(name: string, value: string): void;
    removeProperty(name: string): void;
    getPropertyValue(name: string): string;
  };
}

function fakeRoot(): FakeRoot {
  const store = new Map<string, string>();
  return {
    style: {
      store,
      setProperty(name, value) {
        store.set(name, value);
      },
      removeProperty(name) {
        store.delete(name);
      },
      getPropertyValue(name) {
        return store.get(name) ?? '';
      },
    },
  };
}

describe('Reservation basse — calcul du jeton', () => {
  it('NAV-RES-01: sans navigation, seule la barre de securite est reservee', () => {
    expect(
      bottomNavHeightToken({ hasBottomNav: false, hasUpperExtension: false, hasDayPlateau: true }),
    ).toBe('var(--page-bottom-inset-bare)');
  });

  it('NAV-RES-02: le plateau jour impose l offset etendu (nav + rail + marge)', () => {
    expect(
      bottomNavHeightToken({ hasBottomNav: true, hasUpperExtension: false, hasDayPlateau: true }),
    ).toBe('var(--nav-offset-extended)');
  });

  it('NAV-RES-03: le plateau de section impose le meme offset etendu', () => {
    expect(
      bottomNavHeightToken({ hasBottomNav: true, hasUpperExtension: true, hasDayPlateau: false }),
    ).toBe('var(--nav-offset-extended)');
  });

  it('NAV-RES-04: sans plateau, on ne reserve que la barre', () => {
    expect(
      bottomNavHeightToken({ hasBottomNav: true, hasUpperExtension: false, hasDayPlateau: false }),
    ).toBe('var(--nav-offset)');
  });
});

describe('Reservation basse — publication sur la racine du document', () => {
  it('NAV-RES-05: un consommateur hors AppShell lit l offset etendu du rail', () => {
    const root = fakeRoot();
    applyBottomNavReservation(
      root as unknown as HTMLElement,
      bottomNavHeightToken({
        hasBottomNav: true,
        hasUpperExtension: false,
        hasDayPlateau: true,
      }),
    );
    // La feuille du preparateur resout exactement cette variable.
    expect(root.style.getPropertyValue(BOTTOM_NAV_HEIGHT_VAR)).toBe('var(--nav-offset-extended)');
  });

  it('NAV-RES-06: le nettoyage retire la publication — pas de valeur fantome', () => {
    const root = fakeRoot();
    const cleanup = applyBottomNavReservation(root as unknown as HTMLElement, 'var(--nav-offset)');
    expect(root.style.getPropertyValue(BOTTOM_NAV_HEIGHT_VAR)).toBe('var(--nav-offset)');
    cleanup();
    expect(root.style.getPropertyValue(BOTTOM_NAV_HEIGHT_VAR)).toBe('');
  });

  it('NAV-RES-07: une valeur deja presente est RESTAUREE, pas effacee', () => {
    const root = fakeRoot();
    root.style.setProperty(BOTTOM_NAV_HEIGHT_VAR, 'var(--nav-offset)');
    const cleanup = applyBottomNavReservation(
      root as unknown as HTMLElement,
      'var(--nav-offset-extended)',
    );
    expect(root.style.getPropertyValue(BOTTOM_NAV_HEIGHT_VAR)).toBe('var(--nav-offset-extended)');
    cleanup();
    expect(root.style.getPropertyValue(BOTTOM_NAV_HEIGHT_VAR)).toBe('var(--nav-offset)');
  });

  it('NAV-RES-08: une racine absente ne leve jamais — le rendu client ne peut pas casser', () => {
    expect(() => applyBottomNavReservation(null, 'var(--nav-offset)')).not.toThrow();
    expect(() => applyBottomNavReservation(undefined, 'var(--nav-offset)')()).not.toThrow();
  });
});
