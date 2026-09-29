/**
 * E5 — La carte doit tracer LE JOUR SELECTIONNE, pas le parcours entier.
 *
 * Le focus jour existait des le debut du moteur et la carte l'ignorait : elle
 * recevait toujours les deux extremites du voyage, quel que soit l'onglet
 * choisi. Le rail affichait « Jour 2 » et le trace montrait les trois
 * journees d'un coup — la personne jugeait « Jour 2 » sur une carte qui ne
 * contenait pas Jour 2.
 *
 * `dayRouteCoords` existait deja mais n'etait ni exporte ni teste : rien ne
 * pouvait dire s'il recevait reellement le jour, ou si la carte retombait
 * silencieusement sur le voyage entier. Ces tests verrouillent les deux
 * maillons — la fonction pure, puis la PROPS reellement passee a `PrepMap`.
 */
// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { useDayFocusStore } from '@/components/mobile-nav/dayFocusStore';
import { buildItinerary } from '../engine/itinerary';
import { daySteps } from '../engine/itinerary';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel, ItineraryStep as ItineraryStepModel } from '../types';

// Le store de brouillon observe, jamais simule : on rend le VRAI composant.
const state = vi.hoisted(() => ({ current: null as { draft: AdventurePrepDraft } | null }));
vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (s: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as { getState: () => unknown };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

// La carte est INTERCEPTEE, pas simulee : ce qu'on observe est la props
// reellement transmise par l'ecran, pas un rendu qu'un stub fabriquerait.
const captured = vi.hoisted(() => ({
  props: null as { routeCoords: Array<[number, number]>; scopeLabel: string } | null,
}));
vi.mock('../components/PrepMap', async (importOriginal) => {
  const original = await importOriginal<typeof import('../components/PrepMap')>();
  const PrepMap = (props: { routeCoords: Array<[number, number]>; scopeLabel: string }) => {
    captured.props = { routeCoords: props.routeCoords, scopeLabel: props.scopeLabel };
    return React.createElement('div', { 'data-testid': 'carte' });
  };
  return { ...original, PrepMap };
});

const { ItineraryStepScreen, dayRouteCoords } = await import('../components/ItineraryStep');

/**
 * Parcours localise, monte par le moteur puis LOCALISE ICI MEME.
 *
 * La position est ecrite etape par etape plutot que demandee a
 * `assignPlaces` : ce test prouve ce que l ecran transmet a la carte, pas la
 * politique de rattachement d un moteur qui n a pas le meme proprietaire.
 * Deleguer la fixture a ce moteur ferait echouer E5-04 le jour ou sa regle
 * change, sans qu un seul octet deItineraryStep.tsx bouge.
 */
const POINTS: ReadonlyArray<readonly [number, number]> = [
  [45.8326, 6.8652],
  [45.9339, 6.8852],
  [45.8785, 6.8873],
];

function locatedItinerary(): ItineraryModel {
  const draft = fullDraft();
  const base = buildItinerary(draft);
  if (!base) throw new Error('modele attendu');
  return {
    ...base,
    steps: base.steps.map((step, index) => {
      const [lat, lon] = POINTS[index % POINTS.length];
      return { ...step, lat, lon };
    }),
  };
}

function stepAt(index: number, lat: number | null, lon: number | null): ItineraryStepModel {
  return {
    id: `s${index}`,
    day: 1,
    order: index,
    kind: 'arret',
    title: `etape ${index}`,
    placeName: null,
    startTime: null,
    durationMin: null,
    reason: null,
    price: { state: 'a_verifier', amount: null, currency: 'EUR' },
    state: 'a_verifier',
    kept: true,
    icon: null,
    lat,
    lon,
  } as unknown as ItineraryStepModel;
}

const TOUT = [
  [CHAMONIX.lat, CHAMONIX.lon],
  [ARGENTIERE.lat, ARGENTIERE.lon],
];

describe('E5 — dayRouteCoords ne fabrique aucun point', () => {
  it('E5-01: une position absente ou non finie ne produit aucun point', () => {
    // Le piege du `?? 0` : une position manquante remplie a zero placerait
    // l'itineraire sur un point qui n existe pas, et la carte le dessinerait
    // comme s il etait reel.
    expect(
      dayRouteCoords([
        stepAt(0, null, null),
        stepAt(1, Number.NaN, 6.8),
        stepAt(2, 45.8, Number.POSITIVE_INFINITY),
        stepAt(3, Number.NEGATIVE_INFINITY, 6.8),
      ])
    ).toEqual([]);
  });

  it('E5-02: deux etapes consecutive au meme endroit ne comptent qu une fois', () => {
    // Un trajet dont l arret ne bouge pas est un aller-retour : le compter
    // deux fois allongeait le trace sans changer le parcours.
    expect(
      dayRouteCoords([stepAt(0, 45.8, 6.8), stepAt(1, 45.8, 6.8), stepAt(2, 45.9, 6.9)])
    ).toEqual([
      [45.8, 6.8],
      [45.9, 6.9],
    ]);
  });

  it('E5-03: un point retrouve plus loin reste dans le trace', () => {
    // Deduper « le meme point » globalement casserait un aller-retour reel.
    expect(
      dayRouteCoords([stepAt(0, 45.8, 6.8), stepAt(1, 45.9, 6.9), stepAt(2, 45.8, 6.8)])
    ).toHaveLength(3);
  });
});

describe('E5 — la carte recoit LE JOUR, pas le voyage', () => {
  beforeEach(() => {
    captured.props = null;
    useDayFocusStore.setState({ selectedDay: null, days: [] });
  });

  // Rendu CLIENT, obligatoire : en rendu serveur, zustand lit
  // `getInitialState()` et ignorerait `setState`. Le focus jour serait
  // toujours `null` et le test passerait a cote de la verite.
  function renderDay(model: ItineraryModel, day: number | null): void {
    cleanup();
    useDayFocusStore.setState({ selectedDay: day, days: [] });
    state.current = { draft: { ...fullDraft(), itinerary: model } };
    render(React.createElement(ItineraryStepScreen, { onOpenSheet: () => undefined }));
  }

  afterEach(() => {
    cleanup();
    useDayFocusStore.setState({ selectedDay: null, days: [], focusable: true });
  });

  it('E5-04: le modele de test a bien des jours distincts et localises', () => {
    // Garde-fou du test lui-meme : si la fixture change et que les journees
    // cessent d etre localisees, E5-05 ne prouverait plus rien.
    const model = locatedItinerary();
    expect(model.days).toBeGreaterThan(1);
    for (const day of [1, 2, 3]) {
      expect(dayRouteCoords(daySteps(model, day)), `jour ${day}`).not.toEqual([]);
    }
  });

  it('E5-05: sans focus, la carte trace le voyage entier', () => {
    const model = locatedItinerary();
    renderDay(model, null);
    expect(captured.props?.scopeLabel).toBe('Ensemble');
    expect(captured.props?.routeCoords).toEqual(TOUT);
  });

  it('E5-06: un jour focalise ne recoit QUE les points de ce jour', () => {
    const model = locatedItinerary();
    renderDay(model, 2);
    expect(captured.props?.scopeLabel).toBe('Jour 2');
    expect(captured.props?.routeCoords).toEqual(dayRouteCoords(daySteps(model, 2)));
    // Sans cette difference, E5-05-06 passerait avec un `return routeCoords(draft)`
    // qui rend le voyage entier quel que soit le jour.
    expect(captured.props?.routeCoords).not.toEqual(TOUT);
  });

  it('E5-07: changer de jour repeint la carte, sans repasser par le voyage', () => {
    const model = locatedItinerary();
    renderDay(model, 1);
    const jour1 = captured.props?.routeCoords;
    renderDay(model, 2);
    const jour2 = captured.props?.routeCoords;
    const jour3 = render3(model);
    expect(jour1).not.toEqual(jour2);
    expect(jour2).not.toEqual(jour3);
    expect(jour1).not.toEqual(TOUT);
  });

  function render3(model: ItineraryModel): Array<[number, number]> | undefined {
    renderDay(model, 3);
    return captured.props?.routeCoords;
  }
});
