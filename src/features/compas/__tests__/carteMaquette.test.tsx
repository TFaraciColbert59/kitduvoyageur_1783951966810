// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CompasScreen } from '../components/CompasScreen';
import { resetScreenMocks } from './helpers/screenMocks';
import { labCompasData } from '../dev/labData';
import { DEFAULT_BASE, MAP_BASES, calloutOf, parseBase, stepPins } from '../engine/mapStyle';
import { atlasTiles } from '@/components/map/engine/createMapStyle';

/*
 * Carte (PLAN-100 5.5) : fond Relief / Clair / Satellite par ArcGIS (le branchement de /explorer),
 * pastilles d'étape et encart du point touché d'après la maquette. La carte MapLibre elle-même
 * (WebGL) n'existe pas en jsdom : elle est remplacée par un faux qui expose ce que l'écran lui
 * donne (fond, pastilles) et ce qu'il en reçoit (point touché). Le rendu est vu dans Chromium.
 */

const stub = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }));
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStub(props: Record<string, unknown>) {
      stub.last = props;
      const badges = (props.stepBadges as Array<{ id: string; text: string; label: string }> | undefined) ?? [];
      return (
        <div data-testid="map" data-tile={String(props.tileMode)} data-popup={String(props.poiPopup)}>
          {badges.map((b) => (
            <button key={b.id} type="button" aria-label={b.label} onClick={() => (props.onPointSelect as (id: string) => void)(b.id)}>
              {b.text}
            </button>
          ))}
          <button type="button" onClick={() => (props.onPointSelect as (id: string) => void)('p-eau')}>
            toucher la source
          </button>
        </div>
      );
    },
}));
vi.mock('next/navigation', async () => {
  const { router } = await import('./helpers/screenMocks');
  return { useRouter: () => router, usePathname: () => '/compas' };
});
vi.mock('../server/compasActions', async () => (await import('./helpers/screenMocks')).compas);
vi.mock('@/app/voyages/kit-actions', async () => (await import('./helpers/screenMocks')).kit);
vi.mock('@/app/voyages/budget-actions', async () => (await import('./helpers/screenMocks')).budget);
vi.mock('../server/poiActions', async () => (await import('./helpers/screenMocks')).poi);
vi.mock('../server/bottleActions', async () => (await import('./helpers/screenMocks')).bottle);
vi.mock('../server/resaActions', async () => (await import('./helpers/screenMocks')).resa);
vi.mock('../server/autofillActions', async () => (await import('./helpers/screenMocks')).autofill);
vi.mock('@/lib/cart', async () => (await import('./helpers/screenMocks')).cart);

beforeEach(() => {
  resetScreenMocks();
  stub.last = null;
  try {
    window.localStorage.clear();
  } catch {
    /* sans effet */
  }
  class RO {
    observe() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
});
afterEach(cleanup);

const n = (t: string | null | undefined) => (t ?? '').replace(/\s/g, ' ');
const map = () => screen.getByTestId('map');
const openPanel = () => fireEvent.click(screen.getByRole('button', { name: 'Personnaliser la carte' }));

describe('pastilles d’étape : D, numéros, A', () => {
  const pt = (id: string, label: string, kind: 'step' | 'poi' = 'step') => ({ id, lat: 1, lon: 2, label, kind });

  it('départ, étapes numérotées, arrivée ; les points du tracé n’ont pas de pastille', () => {
    const pins = stepPins([pt('a', 'Gavarnie'), pt('w', 'Source', 'poi'), pt('b', 'Refuge'), pt('c', 'Col'), pt('d', 'Troumouse')]);
    expect(pins.map((p) => [p.text, p.variant])).toEqual([['D', 'start'], ['1', 'mid'], ['2', 'mid'], ['A', 'end']]);
    expect(pins.map((p) => p.label)).toEqual(['Départ : Gavarnie', 'Étape 1 : Refuge', 'Étape 2 : Col', 'Arrivée : Troumouse']);
  });

  it('une seule étape est « 1 », pas un départ qui serait aussi une arrivée ; deux étapes : D et A', () => {
    expect(stepPins([pt('a', 'X')]).map((p) => p.text)).toEqual(['1']);
    expect(stepPins([pt('a', 'X'), pt('b', 'Y')]).map((p) => p.text)).toEqual(['D', 'A']);
    expect(stepPins([])).toEqual([]);
  });
});

describe('encart du point touché : seulement ce qui est connu', () => {
  it('étape : jour, distance, dénivelé, nuit ; les parties absentes sont omises', () => {
    const c = calloutOf(
      { label: 'Refuge de Baysselance', kind: 'step', category: 'stay' },
      { day: 3, distanceKm: 14.2, elevationGainM: 800, accommodation: 'Refuge de Baysselance' }
    );
    expect(n(c.subtitle)).toBe('Jour 3 · 14,2 km · +800 m · nuit : Refuge de Baysselance');
    expect(calloutOf({ label: 'X', kind: 'step', category: null }, { day: 1, distanceKm: null, elevationGainM: 0, accommodation: null }).subtitle).toBe('Jour 1');
    expect(calloutOf({ label: 'X', kind: 'step', category: null }, null).subtitle).toBeNull();
  });

  it('point du tracé : son type en mots, sinon rien', () => {
    expect(calloutOf({ label: 'Source du Sarradets', kind: 'poi', category: 'water' }).subtitle).toBe('Point d’eau');
    expect(calloutOf({ label: 'Point', kind: 'poi', category: null }).subtitle).toBeNull();
  });
});

describe('fond de carte : Relief, Clair, Satellite', () => {
  it('les trois fonds de l’Explorer, Relief par défaut ; une valeur inconnue retombe sur Relief', () => {
    expect(MAP_BASES.map((b) => b.label)).toEqual(['Relief', 'Clair', 'Satellite']);
    expect(DEFAULT_BASE).toBe('topo');
    expect(parseBase('satellite')).toBe('satellite');
    expect(parseBase('osm')).toBe('osm');
    expect(parseBase('<script>')).toBe('topo');
    expect(parseBase(null)).toBe('topo');
  });

  it('avec la clé ArcGIS : Relief, Clair et Satellite sont ceux d’ArcGIS Location Platform avec « Powered by Esri »', () => {
    const t = atlasTiles('cle-de-test');
    for (const mode of ['topo', 'osm', 'satellite'] as const) {
      expect(t[mode].tiles[0]).toMatch(/arcgis\.com/);
      expect(t[mode].tiles[0]).toContain('token=cle-de-test');
      expect(t[mode].short).toContain('Powered by Esri');
      expect(t[mode].credits).toContain('Powered by Esri');
    }
  });

  it('le panneau « Personnaliser la carte » propose le fond ; le choix part à la carte et se retient', () => {
    render(<CompasScreen data={labCompasData()} />);
    expect(map().getAttribute('data-tile')).toBe('topo');
    openPanel();
    const group = screen.getByRole('group', { name: 'Fond de carte' });
    expect(within(group).getByRole('button', { name: 'Relief' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(group).getByRole('button', { name: 'Satellite' }));
    expect(map().getAttribute('data-tile')).toBe('satellite');
    expect(within(group).getByRole('button', { name: 'Satellite' }).getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem('lkdv.compas.fond')).toBe('satellite');
  });

  it('un fond retenu revient à l’ouverture ; un réglage illisible est ignoré', () => {
    window.localStorage.setItem('lkdv.compas.fond', 'osm');
    const { unmount } = render(<CompasScreen data={labCompasData()} />);
    expect(map().getAttribute('data-tile')).toBe('osm');
    unmount();
    window.localStorage.setItem('lkdv.compas.fond', 'n’importe quoi');
    render(<CompasScreen data={labCompasData()} />);
    expect(map().getAttribute('data-tile')).toBe('topo');
  });

  it('la carte n’ouvre plus l’infobulle d’origine : l’écran affiche son propre encart', () => {
    render(<CompasScreen data={labCompasData()} />);
    expect(map().getAttribute('data-popup')).toBe('false');
  });
});

describe('pastilles et encart sur l’écran', () => {
  it('la carte reçoit une pastille par étape (D, 1, 2, A), nommée', () => {
    render(<CompasScreen data={labCompasData()} />);
    const names = within(map()).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names).toEqual(expect.arrayContaining(['Départ : Gavarnie', 'Étape 1 : Cabane des Sarradets', 'Étape 2 : Refuge de Baysselance', 'Arrivée : Cirque de Troumouse']));
    expect(within(map()).getByRole('button', { name: 'Départ : Gavarnie' }).textContent).toBe('D');
  });

  it('toucher une étape : l’encart dit son jour, sa distance, son dénivelé et sa nuit ; « Voir dans Parcours » ouvre le tiroir', async () => {
    render(<CompasScreen data={labCompasData()} />);
    fireEvent.click(within(map()).getByRole('button', { name: 'Étape 2 : Refuge de Baysselance' }));
    const callout = screen.getByRole('group', { name: 'Point touché' });
    expect(within(callout).getByText('Refuge de Baysselance')).toBeTruthy();
    expect(n(callout.textContent)).toContain('Jour 3 · 14,2 km · +800 m · nuit : Refuge de Baysselance');
    fireEvent.click(within(callout).getByRole('button', { name: 'Voir dans Parcours' }));
    expect(await screen.findByRole('dialog', { name: 'Préparer' })).toBeTruthy();
  });

  it('toucher un point du tracé : son type, pas de bouton Parcours ; fermer retire l’encart', () => {
    render(<CompasScreen data={labCompasData()} />);
    fireEvent.click(screen.getByRole('button', { name: 'toucher la source' }));
    const callout = screen.getByRole('group', { name: 'Point touché' });
    expect(within(callout).getByText('Source du Sarradets')).toBeTruthy();
    expect(within(callout).getByText('Point d’eau')).toBeTruthy();
    expect(within(callout).queryByRole('button', { name: 'Voir dans Parcours' })).toBeNull();
    fireEvent.click(within(callout).getByRole('button', { name: 'Fermer l’encart' }));
    expect(screen.queryByRole('group', { name: 'Point touché' })).toBeNull();
  });

  it('axe-core : 0 violation avec le panneau et l’encart ouverts', async () => {
    const { container } = render(<CompasScreen data={labCompasData()} />);
    openPanel();
    fireEvent.click(within(map()).getByRole('button', { name: 'Départ : Gavarnie' }));
    const res = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false }, 'landmark-one-main': { enabled: false }, 'page-has-heading-one': { enabled: false } },
    });
    expect(res.violations.map((v) => `${v.id} : ${v.nodes.map((x) => x.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
});

describe('feuille de style de la carte', () => {
  const css = readFileSync(join(__dirname, '..', 'compas.css'), 'utf8');
  const start = css.indexOf('Carte (lot AD 5.5)');
  // Le bloc de la carte s'arrête au bloc suivant : bureau et tablette, ou le squelette (toujours le dernier).
  const ends = ['Bureau et tablette (lot AD 5.6)', '/* ---------- Squelette de chargement']
    .map((m) => css.indexOf(m))
    .filter((i) => i > start);
  const block = css.slice(start, Math.min(...ends));

  it('aucune couleur littérale hex, aucun #E4501C, aucun jeton « role »', () => {
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(block).not.toMatch(/E4501C/i);
    expect(block).not.toMatch(/--[a-z-]*role/);
  });

  it('cibles tactiles de 44 px et aucune animation', () => {
    expect(block).toMatch(/\.cp-callout__btn \{[^}]*width: 2\.75rem;[^}]*height: 2\.75rem/);
    expect(block).toMatch(/\.cp-pin \{[^}]*width: 2\.75rem;[^}]*height: 2\.75rem/);
    expect(block).not.toMatch(/\banimation\s*:|\btransition\s*:|@keyframes/);
  });
});
