// @vitest-environment jsdom

/**
 * F7 - Le tiroir Equipement : les trois onglets, et surtout un « Manquant »
 * ATTEIGNABLE.
 *
 * L onglet « Manquant » etait structurellement vide, et pas par accident :
 * `getGearState` savait produire `manquant`, mais AUCUN ecran n appelait
 * `setGearWeight` ni `assignGear`. Le poids et le porteur restaient donc a
 * `null` pour toujours, et l etat `manquant` n etait pas un etat possible.
 * Une etiquette d onglet sans etat derriere, c est un ecran qui ment.
 *
 * Ce fichier ne teste donc pas que les trois onglets EXISTENT — ca, n
 * importait pas. Il prouve la transition complete, sur le VRAI store :
 *
 *   poids inconnu             -> onglet « A verifier »
 *   poids saisi, sans porteur -> onglet « Manquant »  (l etat avant mort)
 *   porteur designe           -> l objet quitte « Manquant »
 *
 * Le store est le vrai `useAdventurePrepStore` et les mutations passent par
 * le vrai `draftActions` : un tiroir qui n ecrirait que dans un etat local
 * ferait passer les tests 01 et 03, et echouerait ici.
 *
 * Regle de preuve : le sabotage retire le `onChange` du champ Poids. L etat
 * `manquant` redevient inatteignable, et les tests 02 et 04 tombent en Rouge.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { GearSheet, getGearState } from '../components/PrepGearSheets';
import { buildGearNeeds } from '../engine/gear';
import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { draftActions } from '../store/reducer';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, GearNeed } from '../types';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverShim {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverShim;
  }
  if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

/** Le tiroir, branche sur le VRAI store : les clics ecrivent dedans. */
function Hache() {
  const draft = useAdventurePrepStore((state) => state.draft);
  const actions = useAdventurePrepStore.getState();
  return <GearSheet draft={draft} actions={actions} />;
}

function charger(draft: AdventurePrepDraft): void {
  // `refreshGear` est l action de sync reelle du store : elle initialise
  // `draft.gear` depuis les besoins derives de l activite.
  useAdventurePrepStore.setState({ draft: draftActions.refreshGear(draft) });
}

function onglet(nom: string): HTMLElement {
  return screen.getByRole('tab', { name: new RegExp(nom) });
}

/** Le compte affiche SUR l onglet — pas un compte recalcule par le test. */
function compte(nom: string): number {
  const texte = onglet(nom).textContent ?? '';
  const trouve = texte.match(/(\d+)\s*$/);
  return trouve ? Number(trouve[1]) : Number.NaN;
}

/** Le PREMIER champ Poids affiche, et le nom de l objet qu il porte. */
function premierPoids(): { champ: HTMLElement; objet: string } {
  const champ = screen.getAllByLabelText(/^Poids en grammes pour /)[0];
  const objet = (champ.getAttribute('aria-label') ?? '').replace(
    /^Poids en grammes pour /,
    '',
  );
  return { champ, objet };
}

beforeEach(() => {
  charger(fullDraft());
});

afterEach(() => {
  cleanup();
});

describe('F7 - trois onglets, et un « Manquant » atteignable', () => {
  it('01 - les trois onglets existent, avec un compte issu du brouillon', () => {
    render(<Hache />);
    for (const nom of ['À vérifier', 'Manquant', 'Tout']) {
      expect(screen.getByRole('tab', { name: new RegExp(nom) })).toBeTruthy();
    }
    const besoins = buildGearNeeds(useAdventurePrepStore.getState().draft);
    expect(compte('Tout')).toBe(besoins.length);
    // Au premier rendu, rien n est pese : tout est « a verifier ».
    expect(compte('À vérifier')).toBe(besoins.length);
    expect(compte('Manquant')).toBe(0);
    // Un seul onglet presse a la fois.
    const presses = screen
      .getAllByRole('tab')
      .filter((t) => t.getAttribute('aria-pressed') === 'true');
    expect(presses).toHaveLength(1);
  });

  it('02 - saisir un poids SANS porteur rend l objet Manquant', () => {
    render(<Hache />);
    const avant = compte('Manquant');
    expect(avant).toBe(0);

    // On pese un objet, et on ne designe personne : c est le trou dans le
    // groupe. C est cet etat que l onglet doit montrer.
    const { champ } = premierPoids();
    fireEvent.change(champ, { target: { value: '820' } });

    expect(compte('Manquant')).toBe(avant + 1);
    expect(compte('À vérifier')).toBe(compte('Tout') - 1);

    // Et l objet se lit « Personne ne le porte » dans l onglet Manquant.
    fireEvent.click(onglet('Manquant'));
    expect(screen.getByText('Personne ne le porte')).toBeTruthy();
  });

  it('03 - designer un porteur fait quitter l objet de « Manquant »', () => {
    render(<Hache />);
    const { champ, objet } = premierPoids();
    fireEvent.change(champ, { target: { value: '820' } });
    expect(compte('Manquant')).toBe(1);

    // Des que le poids est connu, l objet QUITTE « A verifier » : c est la
    // regle de cet onglet. On le designe donc depuis « Tout », comme le ferait
    // la personne — et c est la que l objet est reellement affiche.
    fireEvent.click(onglet('Tout'));

    // On designe le porteur par l etiquette de L OBJET, pas par position :
    // plusieurs objets peuvent porter le meme nom de categorie.
    const selecteur = screen.getByLabelText(`Qui porte ${objet}`);
    fireEvent.change(selecteur, { target: { value: 'Camille' } });
    expect(compte('Manquant')).toBe(0);

    // La ligne, elle, se deduit du select : c est la meme carte.
    const ligne = selecteur.closest('li');
    expect(ligne).not.toBeNull();
    expect(within(ligne as HTMLElement).getByText('Embarqué')).toBeTruthy();
    // Le detail de la ligne porte le porteur ET le poids saisi : les deux
    // viennent du brouillon, aucun des deux n est affiche en dur.
    const detail = ligne?.querySelector('.t2')?.textContent ?? '';
    expect(detail).toContain('Camille');
    expect(detail).toContain('820 g');
  });

  it('04 - la mutation passe par le store, pas par un etat local', () => {
    render(<Hache />);
    const { champ, objet } = premierPoids();
    fireEvent.change(champ, { target: { value: '1350' } });

    // On relit le STORE, pas le DOM : c est la que la donnee doit vivre.
    const needs: readonly GearNeed[] = useAdventurePrepStore.getState().draft.gear;
    const saisi = needs.find((item) => item.name === objet);
    expect(saisi?.weightGrams).toBe(1350);
    expect(getGearState(saisi as GearNeed)).toBe('manquant');
  });

  it('05 - un onglet vide dit POURQUOI il est vide, et n invente rien', () => {
    // On prepare le cas par le REDUCTEUR, avant le rendu : tout le materiel
    // est pese et porte, donc « A verifier » et « Manquant » n ont plus rien
    // a dire. C est un etat REEL du brouillon, pas un etat bidon du test.
    let etat = draftActions.refreshGear(fullDraft());
    for (const item of buildGearNeeds(etat)) {
      etat = draftActions.assignGear(
        draftActions.setGearWeight(etat, item.id, 500),
        item.id,
        'Camille',
      );
    }
    charger(etat);
    render(<Hache />);
    expect(compte('À vérifier')).toBe(0);
    expect(compte('Manquant')).toBe(0);

    for (const nom of ['À vérifier', 'Manquant']) {
      fireEvent.click(onglet(nom));
      const question = screen.getByRole('status').textContent ?? '';
      expect(question.trim().length).toBeGreaterThan(0);
      // Aucune distance, aucun poids, aucun kilometre : rien de mesure.
      expect(question).not.toMatch(/\d+\s*(kg|g|km)\b/);
    }
  });
});