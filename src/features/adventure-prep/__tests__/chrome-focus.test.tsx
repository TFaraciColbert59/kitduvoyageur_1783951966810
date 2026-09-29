// @vitest-environment jsdom

/**
 * Le focus orphelin des actions retirees du bandeau haut.
 *
 * Les deux capacites que le bandeau ne montre plus (revenir au hub, ouvrir
 * les preferences) vivent dans un groupe prep-visually-hidden : 1 px, clip a
 * inset(50%). C est correct pour la vue, et faux pour le clavier : un bouton
 * focusable dans une boite coupee est un focus orphelin — le focus y va, rien
 * ne se dessine, la personne ne sait pas ou elle est.
 *
 * Ces tests montent le composant, deplacent vraiment le focus, et regardent ce
 * que la feuille produit apres coup. Ils mordent : retirer le revirement au
 * focus les fait echouer, la seule peinture ne les fait pas passer.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { PrepNavActions } from '../components/AdventurePrepShell';

afterEach(cleanup);

function monterActions() {
  const surHub = vi.fn();
  const surPreferences = vi.fn();
  const rendu = render(
    <PrepNavActions onOpenPreferences={surPreferences} onGoHub={surHub} />
  );
  const groupe = rendu.container.querySelector('[aria-label]') as HTMLElement;
  const boutons = Array.from(rendu.container.querySelectorAll('button'));
  return { groupe, boutons, surHub, surPreferences };
}

describe('CH-FOCUS — plus de focus orphelin dans le bandeau', () => {
  it('CH-FOCUS-01: au repos le groupe est coupe, et rien ne se voit', () => {
    const { groupe, boutons } = monterActions();
    expect(groupe.className).toContain('prep-visually-hidden');
    // Aucune propriete inline ne neutralise la coupe tant que le focus n est pas la.
    expect(groupe.style.clipPath).toBe('');
    for (const bouton of boutons) expect(bouton.style.minHeight).toBe('');
  });

  it('CH-FOCUS-02: le focus revele le groupe ET le bouton qui le porte', () => {
    const { groupe, boutons } = monterActions();
    act(() => {
      boutons[0].focus();
    });
    // Le groupe sort de la coupe...
    expect(groupe.style.clipPath).toBe('none');
    expect(groupe.style.width).toBe('auto');
    expect(groupe.style.height).toBe('auto');
    expect(groupe.style.position).toBe('fixed');
    // ...et le bouton redevient un bouton dessine, pas un point invisible.
    for (const bouton of boutons) {
      expect(bouton.style.minHeight).toBe('44px');
      expect(bouton.style.borderRadius).toBe('999px');
    }
  });

  it('CH-FOCUS-03: la perte du focus rebouche le groupe', () => {
    const { groupe, boutons } = monterActions();
    act(() => {
      boutons[0].focus();
    });
    expect(groupe.style.clipPath).toBe('none');
    act(() => {
      boutons[0].blur();
    });
    expect(groupe.style.clipPath).toBe('');
    expect(boutons[0].style.minHeight).toBe('');
  });

  it('CH-FOCUS-04: passer d un bouton a l autre ne rebrouille rien', () => {
    const { groupe, boutons } = monterActions();
    act(() => {
      boutons[0].focus();
    });
    act(() => {
      boutons[1].focus();
    });
    expect(groupe.style.clipPath).toBe('none');
    expect(boutons[1].style.minHeight).toBe('44px');
  });

  it('CH-FOCUS-05: reveler ne coute pas la capacite — les deux actions partent', () => {
    const { boutons, surHub, surPreferences } = monterActions();
    act(() => {
      boutons[0].focus();
    });
    act(() => {
      boutons[0].click();
    });
    act(() => {
      boutons[1].focus();
    });
    act(() => {
      boutons[1].click();
    });
    expect(surHub).toHaveBeenCalledTimes(1);
    expect(surPreferences).toHaveBeenCalledTimes(1);
  });
});
