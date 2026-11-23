// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouteCollabWorkspace } from '../components/RouteCollabWorkspace';
import { setRouteViewMode } from '../components/workspace/expertMode';
import { resetPlacesForTests } from '../components/workspace/stages/useStagePlaces';
import { baseWorkspace, pt, section, stage } from '../insights/__tests__/fixtures';
import type { RouteWorkspaceState } from '../types';

function ws(complete = false): RouteWorkspaceState {
  const a = { ...pt('a', 'a', 45.9, 6.0), name: 'Départ', kind: 'start' as const };
  const b = { ...pt('b', 'b', 45.9, 6.13), name: 'Col' };
  const c = { ...pt('c', 'c', 45.9, 6.26), name: 'Arrivée', kind: 'finish' as const };
  const withEle = (i: number, base: number) => ({ elevationSamples: [base, base + 150, base + 400] as Array<number | null>, ascentM: 400, descentM: 0, id: `s${i}` });
  return {
    ...baseWorkspace({
      id: 'w-an',
      sport: 'marche',
      points: [a, b, c],
      sections: [
        { ...section('s1', a, b), ...withEle(1, 1000) },
        complete
          ? { ...section('s2', b, c), elevationSamples: [1400, 1350, 1200] as Array<number | null>, ascentM: 0, descentM: 200 }
          : { ...section('s2', b, c), elevationSamples: undefined, ascentM: null, descentM: null },
      ],
      stages: [
        stage('g1', 1, 'a', 'b', {
          dateIso: '2026-11-25',
          hazards: [{ id: 'h1', title: 'Sentier fermé', type: 'closure', severitySource: 'arrêté', observedAt: '2026-11-20T00:00:00Z', expiresAt: '2026-12-31T00:00:00Z', source: 'Mairie' }],
          waterObservations: [{ id: 'w1', name: 'Source du col', lat: 45.9, lon: 6.05, status: 'flowing', potableClaim: 'yes', observedAt: '2026-11-22T00:00:00Z', source: 'user' }],
        }),
        stage('g2', 2, 'b', 'c', { dateIso: '2026-11-26' }),
      ],
    }),
    members: [{ userId: 'u1', displayName: 'Alice', role: 'owner' }],
  };
}

const weatherBody = {
  status: 'ok',
  fetchedAt: '2026-11-23T08:00:00Z',
  horizon: '2026-12-02',
  fire: null,
  official: {
    status: 'lues',
    service: 'Météo-France via Meteoalarm',
    readAt: '2026-11-23T08:00:00Z',
    alerts: [{ id: 'o1', source: 'Météo-France via Meteoalarm', hazard: 'orages', level: 'orange', area: 'Savoie', onset: null, expires: '2026-11-25T18:00:00Z', sent: '2026-11-23T07:00:00Z', fetchedAt: '2026-11-23T08:00:00Z', headline: null }],
  },
  weather: [1, 2].map((day) => ({
    day,
    status: 'ok',
    passageLocal: '11:00',
    basis: 'midday',
    hourLocal: `2026-11-2${4 + day}T12:00`,
    deltaMin: 60,
    approximate: false,
    tempC: 6,
    precipPct: 20,
    precipMm: 0,
    windKmh: 12,
    gustKmh: null,
    code: 1,
    horizon: '2026-12-02',
    fetchedAt: '2026-11-23T08:00:00Z',
    source: 'MET Norway (CC BY 4.0)',
    reason: null,
  })),
};

beforeEach(() => {
  resetPlacesForTests();
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.startsWith('/api/itineraire/analyse')) return new Response(JSON.stringify(weatherBody), { status: 200 });
      if (u.startsWith('/api/itineraire/lieux')) return new Response(JSON.stringify({ status: 'ok', partial: false, fetchedAt: '2026-11-23T09:00:00Z', pois: [] }), { status: 200 });
      return new Response('{}', { status: 503 });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openAnalyser(section: 'Terrain' | 'Milieu' | 'chemin' = 'Terrain', complete = false) {
  render(<RouteCollabWorkspace initialWorkspace={ws(complete)} currentUserId="u1" currentUserName="Alice" forceNoWebGL />);
  fireEvent.click(screen.getByRole('tab', { name: 'Analyser' }));
  if (section === 'Milieu') fireEvent.click(screen.getByRole('tab', { name: /Milieu/ }));
  if (section === 'chemin') fireEvent.click(screen.getByRole('tab', { name: /Sur le chemin/ }));
  return screen.findByTestId('tab-panel-analyser');
}

/** 7.9 : toute valeur de l'onglet porte sa source ET sa date (ou « date inconnue »). */
function assertEveryValueSourced(panel: HTMLElement): number {
  const values = Array.from(panel.querySelectorAll<HTMLElement>('[data-analyse-value]'));
  const bad = values.filter((el) => {
    const src = el.getAttribute('data-source');
    const at = el.getAttribute('data-source-at');
    return !src || src.trim().length < 3 || !at || !(at === 'date inconnue' || Number.isFinite(Date.parse(at)));
  });
  expect(bad.map((el) => el.getAttribute('data-analyse-value'))).toEqual([]);
  return values.length;
}

describe('Analyser · vue simple', () => {
  it('synthèse en trois lignes, effort, difficulté expliquée (3 facteurs), pentes', async () => {
    const panel = await openAnalyser('Terrain', true);
    expect(panel.getAttribute('data-view')).toBe('simple');
    const synth = within(panel).getByTestId('synthesis');
    expect(within(synth).getByText('Ce qui va')).toBeTruthy();
    expect(within(synth).getByText('Ce qui reste à vérifier')).toBeTruthy();
    expect(within(synth).getByText('Ce qui peut bloquer')).toBeTruthy();
    // Effort : score 0-100 % du moteur et une ligne par jour.
    const score = within(panel).getByTestId('effort-score').textContent ?? '';
    expect(Number(score.replace(/\D/g, ''))).toBeLessThanOrEqual(100);
    expect(within(panel).getByTestId('effort-day-1')).toBeTruthy();
    // « Pourquoi ? » : au plus trois facteurs.
    const why = within(panel).getByTestId('difficulty-why');
    expect(why.querySelectorAll('[data-factor]').length).toBeGreaterThan(0);
    expect(why.querySelectorAll('[data-factor]').length).toBeLessThanOrEqual(3);
    // Profil : pentes colorées par bande ; altitude complète, aucune zone inconnue.
    expect(within(panel).getByTestId('slope-strip').querySelectorAll('i[data-band]').length).toBeGreaterThan(0);
    expect(within(panel).queryByTestId('elevation-gaps')).toBeNull();
    // Les surfaces en pourcentage sont réservées à la vue experte.
    expect(within(panel).queryByTestId('surfaces-block')).toBeNull();
    expect(assertEveryValueSourced(panel)).toBeGreaterThan(5);
  });

  it('altitude absente : dite sur la zone du jour 2, la difficulté reste inconnue avec sa raison', async () => {
    const panel = await openAnalyser('Terrain', false);
    expect(within(panel).getByTestId('elevation-gaps').textContent).toMatch(/Altitude inconnue du km .* \(jour 2\)/);
    expect(within(panel).getByTestId('difficulty-unknown')).toBeTruthy();
    assertEveryValueSourced(panel);
  });

  it('le survol du profil colore la bande et envoie le kilomètre vers la carte (curseur lié)', async () => {
    const panel = await openAnalyser();
    const strip = within(panel).getByTestId('slope-strip');
    strip.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 14, right: 100, bottom: 14, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerMove(strip, { clientX: 20 });
    await waitFor(() => expect(within(panel).getByTestId('profile-readout') ?? null).toBeTruthy());
  });
});

describe('Analyser · vue experte', () => {
  beforeEach(() => setRouteViewMode('expert'));

  it('surfaces en pourcentage, méthode et hypothèses de l’effort, source et date visibles', async () => {
    const panel = await openAnalyser();
    expect(panel.getAttribute('data-view')).toBe('expert');
    expect(within(panel).getByTestId('surfaces-block')).toBeTruthy();
    expect(within(panel).getByTestId('surface-sentier').textContent).toMatch(/%/);
    expect(within(panel).getByTestId('effort-method').textContent).toMatch(/effort-score-v1/);
    expect(within(panel).getByTestId('effort-method').textContent).toMatch(/Sac inconnu/);
    expect(within(panel).getByTestId('prov-effort').textContent).toMatch(/Moteur d’effort LKDV \(effort-score-v1\) · 01\/07\/2026/);
    expect(within(panel).queryByTestId('synthesis')).toBeNull();
    assertEveryValueSourced(panel);
  });
});

describe('Analyser · milieu : météo au passage, lumière, eau, alertes', () => {
  it('météo de chaque jour avec heure du relevé et horizon ; lumière, eau en trois niveaux, alerte datée', async () => {
    const panel = await openAnalyser('Milieu');
    await waitFor(() => expect(within(panel).getByTestId('weather-day-1').textContent).toMatch(/6 °C/));
    expect(within(panel).getByTestId('weather-meta').textContent).toMatch(/Relevé MET Norway le .*prévision jusqu’au 02\/12\/2026/);
    expect(within(panel).getByTestId('weather-day-2')).toBeTruthy();
    // Lumière : lever, coucher, marge par étape.
    expect(within(panel).getByTestId('daylight-day-1').textContent).toMatch(/lever \d{2}:\d{2} · coucher \d{2}:\d{2}/);
    // Eau : « potabilité déclarée » compte, jamais « disponible ».
    expect(within(panel).getByTestId('water-day-1').textContent).toMatch(/1 potabilité déclarée|1 confirmé récemment/);
    expect(panel.textContent ?? '').not.toMatch(/disponible/i);
    // Alerte : source, date du relevé, fin de validité.
    const alert = within(panel).getByTestId('alert-hazard:h1');
    expect(alert.textContent).toMatch(/Mairie/);
    expect(alert.textContent).toMatch(/relevé 20\/11\/2026/);
    expect(alert.textContent).toMatch(/valide jusqu’au 31\/12\/2026/);
    // Vigilance officielle (même service que le tiroir Vérifs) avec fin de validité.
    const vig = await within(panel).findByTestId('alert-official:o1');
    expect(vig.textContent).toMatch(/Vigilance orange · orages · Savoie/);
    expect(vig.textContent).toMatch(/valide jusqu’au 25\/11\/2026/);
    expect(within(panel).getAllByTestId('alerts-gap').length).toBeGreaterThan(0);
    assertEveryValueSourced(panel);
  });

  it('météo : la panne de la source est dite, aucune valeur comblée', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
    const panel = await openAnalyser('Milieu');
    await waitFor(() => expect(within(panel).getByTestId('weather-empty').textContent).toMatch(/indisponible/));
  });
});

describe('Analyser · sur le chemin', () => {
  it('la section reste sourcée', async () => {
    const panel = await openAnalyser('chemin');
    assertEveryValueSourced(panel);
  });
});
