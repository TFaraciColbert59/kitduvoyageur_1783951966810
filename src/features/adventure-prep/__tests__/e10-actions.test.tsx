/**
 * E10 — « Ajuster », « Étapes », « Ajouter » : trois boutons, trois vraies feuilles.
 *
 * La note de l'item etait exacte : le code existait, la preuve n'existait pas.
 * Ces tests montent l'ecran REEL dans jsdom, avec le VRAI store et le VRAI
 * routeur de feuilles, puis cliquent. Le chemin complet est exerce — clic ->
 * `onOpenSheet` -> `PrepSheets` -> dialogue monte dans le document — parce
 * qu'une assertion sur un spy ne prouverait que le rappel.
 *
 * Un `onClick={() => {}}` fait echouer ces tests : c'est le but. Le temoin
 * `E10-00` verifie meme que le harnais DETECTE un bouton mort, pour que les
 * trois suivants ne puissent pas passer pour rien.
 *
 * Le compte est verrouille aussi : six CTA sur une carte etaient le symptome
 * L3.6, et « Remplacer » a ete RETIRE (E9) plutot que cable en faux. Trois
 * boutons dans la rangee, tous actifs — voila ce que ces tests prouvent.
 */
// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { useAdventurePrepStore } from '../store/useAdventurePrepStore';
import { useDayFocusStore } from '@/components/mobile-nav/dayFocusStore';
import { buildItinerary } from '../engine/itinerary';
import { ItineraryStepScreen } from '../components/ItineraryStep';
import { PrepSheets, type PrepSheetId } from '../components/PrepSheets';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

/* ------------------------------------------------------------------ */
/* Plateforme : ce que jsdom n'implemente pas et que les feuilles       */
/* appellent. Ce ne sont pas des mocks de produit, ce sont des shims.    */
/* ------------------------------------------------------------------ */

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverShim {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverShim;
  }
  if (!('IntersectionObserver' in globalThis)) {
    class IntersectionObserverShim {
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds: readonly number[] = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      IntersectionObserverShim;
  }
  if (typeof window !== 'undefined') {
    if (!window.matchMedia) {
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
    window.scrollTo = (() => {}) as unknown as typeof window.scrollTo;
    window.Element.prototype.scrollTo = function scrollTo() {};
    window.Element.prototype.scrollIntoView = function scrollIntoView() {};
  }
});

/**
 * Pose un VRAI brouillon et son VRAI parcours dans le VRAI store.
 *
 * `buildItinerary` est le moteur de production : les etapes affichees ont donc
 * ete construites par le meme code que celles que voit la personne. Aucun
 * composant ni store n'est mocke — seul le DOM manquant a ete complete.
 */
function poser(overrides: Partial<AdventurePrepDraft> = {}): ItineraryModel {
  const draft = fullDraft(overrides);
  const model = buildItinerary(draft);
  if (!model) throw new Error("le brouillon de reference n'a produit aucun parcours");
  useAdventurePrepStore.setState({ draft: { ...draft, itinerary: model } });
  return model;
}

function dialogue(): HTMLElement | null {
  return document.body.querySelector('[role="dialog"]');
}

/**
 * L'ecran et son routeur de feuilles, RELIES comme en production.
 *
 * Sans ce lien, un `onOpenSheet={() => {}}` passerait tous les tests : le spy
 * recevrait l'identifiant et rien ne s'ouvrirait. Ici le clic remonte jusqu'au
 * `Sheet` de Radix, et le dialogue doit exister dans le document.
 */
function Ecran({ onOpen }: { onOpen: (id: PrepSheetId) => void }): React.ReactElement {
  const [sheet, setSheet] = useState<PrepSheetId | null>(null);
  return (
    <>
      <ItineraryStepScreen
        onOpenSheet={(id) => {
          onOpen(id);
          setSheet(id);
        }}
      />
      <PrepSheets sheet={sheet} onClose={() => setSheet(null)} />
    </>
  );
}

/**
 * Le bouton de la rangee d'action, trouve par son TEXTE rendu.
 *
 * `Icon` rend un `role="img"` porte par un `aria-label` technique
 * (« clipboard-list ») : le nom accessible du bouton est donc
 * « clipboard-list Étapes », pas « Étapes ». La requete par role reste —
 * la preuve reste qu'un BOUTON expose ce texte — mais la comparaison porte sur
 * le texte rendu, pas sur la concatenation operee par l'icone.
 *
 * Un doublon est une erreur explicite : deux boutons « Ajouter » ne
 * pourraient pas dire lequel on a teste.
 */
function boutonAction(texte: string): HTMLElement {
  const rangee = document.body.querySelector('.prep-actionrow');
  expect(rangee, 'la rangee d’action a disparu de l’ecran').not.toBeNull();
  const boutons = within(rangee as HTMLElement)
    .getAllByRole('button')
    .filter((bouton) => (bouton.textContent ?? '').trim() === texte);
  expect(boutons, `aucun bouton « ${texte} » dans la rangee d’action`).toHaveLength(1);
  return boutons[0] as HTMLElement;
}

/** Le libelle exact du bouton, pour ne pas confondre « Ajouter » et « Ajouter une étape ». */
const BOUTON: Readonly<Record<'adjust' | 'steps' | 'add', string>> = {
  adjust: 'Ajuster',
  steps: 'Étapes',
  add: 'Ajouter',
};

/** Le titre que porte le tiroir une fois ouvert (`TITLES` de `PrepSheets`). */
const TITRE: Readonly<Record<'adjust' | 'steps' | 'add', string>> = {
  adjust: 'Ajuster le parcours',
  steps: 'Le programme complet',
  add: 'Ajouter une étape',
};

describe('E10 — les trois boutons d’action ouvrent leur feuille', () => {
  beforeEach(() => {
    useAdventurePrepStore.getState().resetDraft();
    useDayFocusStore.getState().clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /* ---------------------------------------------------------------- */
  /* Temoin : ce fichier DOIT detecter un bouton mort.                 */
  /* ---------------------------------------------------------------- */

  it('E10-00 : un bouton qui n’appelle rien n’ouvre aucune feuille', () => {
    function Mort(): React.ReactElement {
      return (
        <>
          <button type="button" onClick={() => undefined}>
            Ajuster
          </button>
          <PrepSheets sheet={null} onClose={() => undefined} />
        </>
      );
    }

    render(<Mort />);
    fireEvent.click(screen.getByRole('button', { name: /ajuster/i }));

    expect(
      dialogue(),
      'le harnais ne verrait rien : un onClick mort passerait pour un succes',
    ).toBeNull();
  });

  /* ---------------------------------------------------------------- */
  /* Les trois boutons, un par un.                                     */
  /* ---------------------------------------------------------------- */

  const FEUILLES: ReadonlyArray<readonly ['adjust' | 'steps' | 'add', string]> = [
    ['adjust', 'E10-01'],
    ['steps', 'E10-02'],
    ['add', 'E10-03'],
  ];

  it.each(FEUILLES)('%s : « %s » ouvre le bon tiroir', (feuille, id) => {
    poser();
    const vues: PrepSheetId[] = [];
    render(<Ecran onOpen={(ouverte) => vues.push(ouverte)} />);

    fireEvent.click(boutonAction(BOUTON[feuille]));

    expect(vues, `${id} : le clic doit demander la feuille « ${feuille} »`).toEqual([feuille]);
    const monte = dialogue();
    expect(monte, `${id} : aucun dialogue monte par le clic`).not.toBeNull();
    expect(
      monte?.textContent,
      `${id} : la feuille ouverte n'est pas « ${TITRE[feuille]} »`,
    ).toContain(TITRE[feuille]);
  });

  /* ---------------------------------------------------------------- */
  /* Un tiroir, pas une decoration.                                    */
  /* ---------------------------------------------------------------- */

  it('E10-04 : la feuille se referme, le bouton n’ouvre pas une vue figée', () => {
    poser();
    render(<Ecran onOpen={() => undefined} />);

    fireEvent.click(boutonAction(BOUTON.steps));
    const ouverte = dialogue();
    expect(ouverte, 'la feuille « Étapes » ne s’ouvre pas').not.toBeNull();

    fireEvent.keyDown(ouverte as HTMLElement, { key: 'Escape' });

    expect(dialogue(), 'Échap doit retirer le tiroir de l’ecran').toBeNull();
  });

  /* ---------------------------------------------------------------- */
  /* Le compte : plus de six CTA, et aucun bouton sans effet.           */
  /* ---------------------------------------------------------------- */

  it('E10-05 : la rangée d’action ne contient que ces trois boutons', () => {
    poser();
    render(<Ecran onOpen={() => undefined} />);

    const rangee = document.body.querySelector('.prep-actionrow');
    expect(rangee, 'la rangée d’action a disparu de l’ecran').not.toBeNull();
    const libelles = Array.from(rangee?.querySelectorAll('button') ?? []).map(
      (bouton) => (bouton.textContent ?? '').trim(),
    );

    expect(libelles, 'la rangée d’action ne porte plus exactement les trois CTA').toEqual([
      BOUTON.adjust,
      BOUTON.steps,
      BOUTON.add,
    ]);
  });

  it('E10-06 : « Remplacer » ne réapparaît pas', () => {
    poser();
    render(<Ecran onOpen={() => undefined} />);

    expect(
      screen.queryByRole('button', { name: /remplacer/i }),
      "E9 : un « Remplacer » sans moteur d'alternatives serait un mensonge",
    ).toBeNull();
  });
});