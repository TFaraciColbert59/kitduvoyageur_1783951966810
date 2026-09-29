/**
 * P1.7 - Ce que la carte recoit REELLEMENT, et non ce qu elle devrait.
 *
 * `steps-sheet-map` prouve qu une carte est montee. Ce fichier prouve ce
 * qu on lui donne : la carte peut etre presente et tracer autre chose que le
 * programme - points inventes, ordre de lecture casse, famille de filtre
 * fantaisiste. `PrepMap` est donc INTERCEPTEE comme dans E5 : on observe la
 * props reellement transmise, pas un rendu qu un stub fabriquerait.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';

import type { ItineraryModel } from '../types';
import { draftAvec, programmeLocalise, programmeSansPosition, storeFactice } from './programmeFactice';

const captured = vi.hoisted(() => ({ appels: [] as unknown[] }));
vi.mock('../components/PrepMap', async (importOriginal) => {
  const original = await importOriginal<typeof import('../components/PrepMap')>();
  const PrepMap = (props: Record<string, unknown>) => {
    captured.appels.push(props);
    return React.createElement('div', { 'data-testid': 'carte-interceptee' });
  };
  return { ...original, PrepMap };
});

const { StepsSheet } = await import('../components/PrepItinerarySheets');

beforeEach(() => {
  captured.appels = [];
});
afterEach(() => cleanup());

function monter(modele: ItineraryModel | null) {
  render(React.createElement(StepsSheet, { draft: draftAvec(modele), actions: storeFactice(), onClose: () => undefined }));
  return captured.appels.at(-1) as Record<string, never> | undefined;
}

describe('P1.7 - le trace transmis est le programme, dans l ordre de lecture', () => {
  it('P1-08: le trace suit jour puis rang, sans repeter un lieu deja passe', () => {
    const props = monter(programmeLocalise()) as unknown as { routeCoords: Array<[number, number]> };

    // Depart Chamonix (j1) -> Refuge (j1) -> Retour Chamonix (j2).
    expect(props.routeCoords).toEqual([
      [45.9237, 6.8694],
      [45.9819, 6.9269],
      [45.9237, 6.8694],
    ]);
  });

  it('P1-09: une seule entree de marqueur par etape localisee, avec son stepId', () => {
    const props = monter(programmeLocalise()) as unknown as {
      points: Array<{ id: string; stepId: string; category: string }>;
    };

    expect(props.points).toHaveLength(3);
    expect(props.points.map((p) => p.id)).toEqual(['s1', 's2', 's3']);
    // C est cet identifiant que le tiroir sait transmettre : sans lui, un
    // marqueur ne pourrait pas ouvrir son etape.
    expect(props.points.map((p) => p.stepId)).toEqual(['s1', 's2', 's3']);
    expect(props.points.map((p) => p.category)).toEqual(['arret', 'nuit', 'repos']);
  });

  it('P1-10: le perimetre annonce est l ensemble, et toutes les familles sont proposees', () => {
    const props = monter(programmeLocalise()) as unknown as {
      scopeLabel: string;
      filterCategories: readonly string[];
    };

    expect(props.scopeLabel).toBe('Ensemble');
    expect(props.filterCategories).toEqual(['trajet', 'arret', 'repos', 'nuit', 'ravitaillement']);
  });

  it('P1-11: sans coordonnee, la carte n est pas montree du tout', () => {
    monter(programmeSansPosition());
    // Un composant remplace par un cadre vide laisserait croire a un trace
    // mesure : mieux vaut une absence, et un mot qui l explique.
    expect(captured.appels).toHaveLength(0);
  });
});
