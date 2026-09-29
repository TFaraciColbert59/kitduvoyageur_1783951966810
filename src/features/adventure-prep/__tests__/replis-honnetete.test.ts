/**
 * Replis numeriques — une absence ne se convertit pas en mesure.
 *
 * Trois `<... ?? valeur>` transformaient « je ne sais pas » en « je sais » :
 *
 *   1. `isWetDay` : `precipMm ?? 0` faisait dire « jour sec » a une journee
 *      dont on n'avait pas mesure la pluie. La fonction annoncait pourtant
 *      dans son propre commentaire « sans donnee, on ne conclut rien ».
 *   2. `addWaypoint(..., activeDay ?? 1)` : vu en « Ensemble », un appui long
 *      deposait le point de passage sur le JOUR 1. Le parcours affichait un
 *      trait sur une journee qui ne l'avait pas demande.
 *   3. `model?.days ?? 0` : sans modele, il n'y a aucun jour a balayer. Ce
 *      repli-la est sans effet — `useDaySwipe` sort des que `days < 2` — mais
 *      il se lisait comme une mesure. Il est desormais dit.
 *
 * Chaque item porte son contre-exemple : sans lui, une sonde qui observe
 * `false` ou `1` ne prouverait rien, puisque la valeur fabriquee passerait
 * aussi.
 */
// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { useDayFocusStore } from '@/components/mobile-nav/dayFocusStore';
import { buildItinerary } from '../engine/itinerary';
import { isWetDay, type DayWeather } from '../engine/weather';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

const SOURCE = readFileSync(join(__dirname, '..', 'components', 'ItineraryStep.tsx'), 'utf8');

function journee(partiel: Partial<DayWeather>): DayWeather {
  return {
    date: '2026-07-10',
    tMaxC: null,
    tMinC: null,
    precipMm: null,
    precipProbPct: null,
    windMaxKmh: null,
    code: null,
    label: '',
    ...partiel,
  };
}

/* ------------------------------------------------------------------ */
/* 1. La meteo : pas de « jour sec » sans mesure                       */
/* ------------------------------------------------------------------ */

describe('M — isWetDay ne conclut pas sur une absence', () => {
  it('M-01: une journee entierement non mesuree vaut null, pas false', () => {
    // Le piege : `(precipMm ?? 0) >= 1` est faux quand precipMm manque, donc
    // la fonction rendait `false` — « jour sec » — a partir d'un silence.
    expect(isWetDay(journee({}))).toBeNull();
  });

  it('M-02: une journee absente elle-meme vaut null', () => {
    expect(isWetDay(null)).toBeNull();
  });

  it('M-03: une mesure reelle qui dit sec vaut bien false', () => {
    // Le contre-exemple qui empeche M-01 de passer pour un simple
    // changement de constante : la, on SAIT que le jour est sec.
    expect(isWetDay(journee({ precipMm: 0, windMaxKmh: 8 }))).toBe(false);
  });

  it('M-04: un seul indice suffit a conclure humide', () => {
    // Sans pluie et sans probabilite, le code WMO seul doit suffire :
    // c'est la mesure la plus fiable, et elle existe.
    expect(isWetDay(journee({ code: 95 }))).toBe(true);
    expect(isWetDay(journee({ windMaxKmh: 72 }))).toBe(true);
    expect(isWetDay(journee({ precipProbPct: 80 }))).toBe(true);
  });

  it('M-05: un vent faible mesure suffit a conclure sec', () => {
    expect(isWetDay(journee({ precipMm: null, windMaxKmh: 12 }))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Le point de passage : jamais de jour invente                      */
/* ------------------------------------------------------------------ */

const state = vi.hoisted(() => ({
  current: null as unknown as { draft: AdventurePrepDraft; addWaypoint: ReturnType<typeof vi.fn> },
}));
vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (s: unknown) => unknown) => selector(state.current)) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

const captured = vi.hoisted(() => ({
  onLongPress: undefined as ((lat: number, lon: number) => void) | undefined,
  scopeLabel: '' as string,
}));
vi.mock('../components/PrepMap', async (importOriginal) => {
  const original = await importOriginal<typeof import('../components/PrepMap')>();
  const PrepMap = (props: { scopeLabel: string; onLongPress?: (lat: number, lon: number) => void }) => {
    captured.onLongPress = props.onLongPress;
    captured.scopeLabel = props.scopeLabel;
    return React.createElement('div', { 'data-testid': 'carte' });
  };
  return { ...original, PrepMap };
});

const { ItineraryStepScreen } = await import('../components/ItineraryStep');

const POINTS: ReadonlyArray<readonly [number, number]> = [
  [45.8326, 6.8652],
  [45.9339, 6.8852],
  [45.8785, 6.8873],
];

function localisee(): ItineraryModel {
  const base = buildItinerary(fullDraft());
  if (!base) throw new Error('modele attendu');
  return {
    ...base,
    steps: base.steps.map((step, index) => {
      const [lat, lon] = POINTS[index % POINTS.length];
      return { ...step, lat, lon };
    }),
  };
}

describe('M — un appui long ne fabrique pas de journee', () => {
  const addWaypoint = vi.fn();

  beforeEach(() => {
    captured.onLongPress = undefined;
    captured.scopeLabel = '';
    addWaypoint.mockClear();
    useDayFocusStore.setState({ selectedDay: null, days: [] });
  });
  afterEach(() => {
    cleanup();
    useDayFocusStore.setState({ selectedDay: null, days: [], focusable: true });
  });

  function afficher(model: ItineraryModel, jour: number | null): void {
    cleanup();
    useDayFocusStore.setState({ selectedDay: jour, days: [] });
    state.current = { draft: { ...fullDraft(), itinerary: model }, addWaypoint };
    render(React.createElement(ItineraryStepScreen, { onOpenSheet: () => undefined }));
  }

  it('M-06: en « Ensemble », le geste n existe pas', () => {
    afficher(localisee(), null);
    expect(captured.scopeLabel).toBe('Ensemble');
    // Un gestionnaire ici deposait le point sur le jour 1 : l'ecran PEIGNAIT
    // une journee que personne n avait choisie.
    expect(captured.onLongPress).toBeUndefined();
  });

  it('M-07: sur un jour focus, le geste vise CE jour', () => {
    afficher(localisee(), 2);
    expect(captured.scopeLabel).toBe('Jour 2');
    expect(typeof captured.onLongPress).toBe('function');
    captured.onLongPress?.(45.9, 6.9);
    expect(addWaypoint).toHaveBeenCalledTimes(1);
    expect(addWaypoint).toHaveBeenCalledWith({ lat: 45.9, lon: 6.9 }, 2);
  });

  it('M-08: aucun `activeDay ?? 1` ne subsiste dans l ecran', () => {
    // Le piege exact, nomme : le repli du jour 1 ne peut pas revenir par
    // une autre voie sans que ce garde-fou ne le dise.
    expect(SOURCE).not.toMatch(/\?\?\s*1\b/);
    expect(SOURCE).toContain('activeDay === null');
  });

  it('M-09: le repli des jours balayes est dit, et sans effet', () => {
    // `model?.days ?? 0` reste : sans modele il n'y a aucun jour, et
    // `useDaySwipe` sort des que `days < 2`. Le commentaire l'assume pour
    // qu'on ne le relise pas comme une mesure.
    expect(SOURCE).toContain('days: model?.days ?? 0');
    expect(SOURCE).toContain('days < 2');
  });

  it('M-10: le modele de test a bien plusieurs jours localises', () => {
    const model = localisee();
    expect(model.days).toBeGreaterThan(1);
    expect(CHAMONIX.lat).not.toBe(ARGENTIERE.lat);
  });
});