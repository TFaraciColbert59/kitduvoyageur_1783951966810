/**
 * Etape 2 — ce que l'utilisateur voit reellement une fois le parcours construit.
 *
 * Ces tests portent sur le MARQUAGE rendu, pas sur l intention : une
 * etape presente dans le DOM mais masquee par `display:none` est une etape que
 * l'utilisateur ne voit pas. C est exactement le defaut que ces tests
 * empechent de revenir.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItineraryStepScreen } from '../components/ItineraryStep';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, ItineraryModel } from '../types';
import type { DayWeather } from '../engine/weather';

const state = vi.hoisted(() => ({ current: null as { draft: AdventurePrepDraft } | null }));

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (store: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

const noop = () => undefined;

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function builtDraft(
  over: Partial<AdventurePrepDraft> = {},
  mutate: (model: ItineraryModel) => ItineraryModel = (model) => model,
): AdventurePrepDraft {
  const draft = fullDraft(over);
  const model = buildItinerary(draft);
  if (!model) throw new Error('fixture : le brouillon de base doit etre construisible');
  return { ...draft, itinerary: mutate(model) };
}

const RAVENI: DayWeather = {
  date: '2026-07-11',
  tMaxC: 24,
  tMinC: 11,
  precipMm: 0,
  precipProbPct: 20,
  windMaxKmh: 14,
  code: 2,
  label: 'Partiellement nuageux',
};

describe('IT2 — Le programme du jour est reellement visible', () => {
  it('IT2-01: aucune etape du programme n est masquee', () => {
    state.current = { draft: builtDraft() };
    const html = renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }));
    // Une etape rendue puis masquee par un style n est pas une etape vue :
    // c est le piege exact que ce test ferme.
    expect(html).not.toContain('display:none');
  });

  it('IT2-02: les etapes du jour sont listees avec leur titre', () => {
    state.current = { draft: builtDraft() };
    const model = buildItinerary(state.current.draft)!;
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    const first = model.steps[0];
    expect(first).toBeDefined();
    expect(text).toContain(first.title);
  });

  it('IT2-03: le titre de chaque etape du jour passe, pas seulement le premier', () => {
    state.current = { draft: builtDraft() };
    const model = buildItinerary(state.current.draft)!;
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    for (const step of model.steps.filter((s) => s.day === 1)) {
      expect(text).toContain(step.title);
    }
  });
});

describe('IT2 — La meteo du jour, quand elle existe', () => {
  it('IT2-10: la meteo mesuree du premier jour est affichee', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({ ...model, weather: [RAVENI, null, null] })),
    };
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    expect(text).toContain(RAVENI.label);
  });

  it('IT2-11: chaque jour affiche SAIN meteo, jamais celle d un autre', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({ ...model, weather: [null, RAVENI, null] })),
    };
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    // Vue Ensemble : le programme montre tous les jours, donc Jour 2 affiche sa
    // meteo reelle. Ce qui est interdit, c est que Jour 1 emprunte celle du Jour 2.
    expect(text).toContain('Jour 1 Météo indisponible');
    expect(text).toContain(`Jour 2 ${RAVENI.label}`);
  });

  it('IT2-12: sans meteo, l ecran le dit au lieu de laisser un vide', () => {
    state.current = { draft: builtDraft() };
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    expect(text).toContain('Météo indisponible');
  });

  it('IT2-13: une meteo sans temperature n affiche pas de degree', () => {
    state.current = {
      draft: builtDraft(
        {},
        (model) => ({
          ...model,
          weather: [{ ...RAVENI, tMaxC: null, tMinC: null, precipProbPct: null }, null, null],
        }),
      ),
    };
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    expect(text).toContain(RAVENI.label);
    expect(text).not.toMatch(/\d+\s*°/);
  });
});

/**
 * Perimetre de ces tests : le rendu STATIQUE uniquement. Or
 * `renderToStaticMarkup` lit le snapshot initial des stores : impossible
 * d y reproduire une selection de jour, qui vit dans `dayFocusStore`. La vue
 * « Jour N » est donc verifiee cote moteur (`day-navigation.test.ts`, meme
 * chemin de decision `resolveActiveDay` + `measureScope` + `metricsFor`) et
 * dans le navigateur. Ces tests verrouillent ce qu ils peuvent voir, sans
 * pretendre couvrir ce qu ils ne voient pas.
 */
describe('IT2 — Les mesures affichees ne sont pas des chassis', () => {
  it('IT2-20: en vue Ensemble, la distance affichee est celle du parcours complet', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({
        ...model,
        totals: { ...model.totals, distanceKm: 42.7 },
      })),
    };
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    expect(text).toContain('42,7');
  });

  it('IT2-21: une distance non mesuree affiche « à vérifier », jamais 0 km', () => {
    state.current = {
      draft: builtDraft({}, (model) => ({
        ...model,
        perDay: model.perDay.map((totals, index) =>
          index === 0 ? { ...totals, distanceKm: null } : totals,
        ),
      })),
    };
    const text = visible(renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop })));
    expect(text).not.toMatch(/0\s*km/);
    expect(text).toContain('À vérifier');
  });

  it('IT2-22: la carte annonce la pose d un point de passage', () => {
    state.current = { draft: builtDraft() };
    const html = renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }));
    expect(html).toContain('point de passage');
  });
});
