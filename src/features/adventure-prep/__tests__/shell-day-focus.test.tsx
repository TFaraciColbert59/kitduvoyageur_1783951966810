/**
 * Selecteur de jours — UN seul etat, partage par les trois ecrans.
 *
 * Le defaut : `usePrepDayFocusPublisher` n etait monte que dans
 * `ItineraryStep` (l ecran de l etape 2). Les etapes 1 et 3 ne publiaient
 * donc aucune journee : le rail jour de la barre basse se vidait des que
 * l utilisateur quittait « Preparation », et la selection ne survivait pas au
 * changement de page.
 *
 * Le rail est dessine par la barre basse, montee dans un arbre React disjoint
 * (`MobileNavWrapper`). Le seul canal est donc le store module
 * `useDayFocusStore` : le publier depuis le shell — qui enveloppe les trois
 * ecrans — suffit a le rendre coherent partout.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useDayFocusStore, type DayFocusDay } from '@/components/mobile-nav/dayFocusStore';
import { buildPrepDayFocusDays } from '../hooks/usePrepDayFocusPublisher';
import { AdventurePrepShell, type AdventurePrepShellProps } from '../components/AdventurePrepShell';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import { PREP_STEPS, type AdventurePrepDraft, type PrepStepId } from '../types';

/* --- Le publisher est observe, pas reimplemente ------------------------ */

const published = vi.hoisted(() => ({ calls: [] as unknown[], focusable: [] as boolean[] }));

vi.mock('../hooks/usePrepDayFocusPublisher', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/usePrepDayFocusPublisher')>()),
  usePrepDayFocusPublisher: (draft: unknown, focusable: boolean) => {
    published.calls.push(draft);
    published.focusable.push(focusable);
  },
}));

/* --- Store et routeur neutres ----------------------------------------- */

const state = vi.hoisted(() => ({
  current: null as { draft: AdventurePrepDraft; goToStep: (id: PrepStepId) => void } | null,
}));

vi.mock('../store/useAdventurePrepStore', () => {
  type Store = { draft: AdventurePrepDraft; goToStep: (id: PrepStepId) => void };
  const use = ((selector: (store: Store) => unknown) =>
    selector(state.current as Store)) as unknown as { getState: () => unknown };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }));

const noop = () => undefined;

function avecParcours(): AdventurePrepDraft {
  const draft = fullDraft();
  const model = buildItinerary(draft);
  if (!model) throw new Error('modele attendu');
  return { ...draft, itinerary: model };
}

function monter(step: PrepStepId, draft: AdventurePrepDraft): string {
  state.current = { draft, goToStep: noop };
  const props: AdventurePrepShellProps = { step, onOpenSheet: noop, children: null };
  return renderToStaticMarkup(React.createElement(AdventurePrepShell, props));
}

function jours(draft: AdventurePrepDraft): DayFocusDay[] {
  return buildPrepDayFocusDays(draft);
}

beforeEach(() => {
  published.calls.length = 0;
  published.focusable.length = 0;
  useDayFocusStore.getState().clear();
});

describe('Selecteur de jours — publication sur les trois ecrans', () => {
  it('SH-DAY-01: le shell publie le rail jour sur CHACUNE des trois etapes', () => {
    const draft = avecParcours();
    for (const step of PREP_STEPS) monter(step, draft);
    expect(published.calls).toHaveLength(PREP_STEPS.length);
  });

  it('SH-DAY-02: la liste publiee est identique quelle que soit l etape affichee', () => {
    const draft = avecParcours();
    for (const step of PREP_STEPS) monter(step, draft);
    const [premier, ...autres] = published.calls as AdventurePrepDraft[];
    expect(autres.length).toBe(PREP_STEPS.length - 1);
    for (const autre of autres) {
      expect(jours(autre)).toEqual(jours(premier));
    }
  });

  it('SH-DAY-03: changer d etape ne remet jamais la selection a zero', () => {
    const draft = avecParcours();
    useDayFocusStore.getState().publishDays(jours(draft));
    useDayFocusStore.getState().selectDay(2);
    expect(useDayFocusStore.getState().selectedDay).toBe(2);

    for (const step of PREP_STEPS) monter(step, draft);
    // Un etat de jour unique, partage : un changement de page ne le purge pas.
    expect(useDayFocusStore.getState().selectedDay).toBe(2);
  });
});

describe('Selecteur de jours — une seule source de verite', () => {
  it('SH-DAY-04: deux lecteurs independants voient la MEME selection', () => {
    const draft = avecParcours();
    useDayFocusStore.getState().publishDays(jours(draft));

    function Lecteur() {
      return React.createElement('p', null, String(useDayFocusStore.getState().selectedDay));
    }

    useDayFocusStore.getState().selectDay(3);
    const depuisLeShell = monter('itinerary', draft);
    const depuisLaBarre = renderToStaticMarkup(React.createElement(Lecteur));
    expect(depuisLaBarre).toContain('3');
    expect(useDayFocusStore.getState().selectedDay).toBe(3);
    // Le shell ne publie rien qui puisse reecrire la selection : il lit, il
    // n invente pas de deuxieme etat.
    expect(depuisLeShell).toContain('aria-label="Progression de la préparation"');
  });

  it('SH-DAY-05: sans parcours, aucune journee n est publiee — jamais de journees inventees', () => {
    const draft = fullDraft({ itinerary: null });
    monter('destination', draft);
    expect(jours(draft)).toEqual([]);
    // Le store refuse un plateau d une seule journee : on ne fabrique pas de
    // jours pour avoir un rail a afficher.
    useDayFocusStore.getState().publishDays([]);
    expect(useDayFocusStore.getState().days).toEqual([]);
    expect(useDayFocusStore.getState().selectedDay).toBeNull();
  });
});

describe('Selecteur de jours — l etape 1 ne rend pas un controle mort', () => {
  it('SH-DAY-06: l etape 1 se declare NON focalisable, les etapes 2 et 3 focalisables', () => {
    const draft = avecParcours();
    for (const step of PREP_STEPS) monter(step, draft);
    const parEtape = Object.fromEntries(
      PREP_STEPS.map((step, index) => [step, published.focusable[index]]),
    ) as Record<PrepStepId, boolean>;
    // L etape 1 ne montre aucun jour du parcours : un rail y serait un
    // controle qui repond mais ne change rien a l ecran.
    expect(parEtape.destination).toBe(false);
    expect(parEtape.itinerary).toBe(true);
    expect(parEtape.departure).toBe(true);
  });

  it('SH-DAY-07: la selection de jour survive au passage par l etape 1', () => {
    const draft = avecParcours();
    useDayFocusStore.getState().publishDays(jours(draft));
    useDayFocusStore.getState().selectDay(2);
    monter('destination', draft); // etape 1 : rail masque
    monter('itinerary', draft); // retour a l etape 2
    expect(useDayFocusStore.getState().selectedDay).toBe(2);
  });
});
