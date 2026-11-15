// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  applySearchCriteriaOverrides,
  parseSearchQuery,
  rankRouteForSearch,
} from '@/features/explorer-v2/search/searchQueryParser';
import { generateSportLoop } from '@/features/routes/loop/loopGenerator';
import { POST as postLoopRoute } from '@/app/api/explorer/v2/routes/loop/route';
import { buildSheetModel } from '@/features/explorer-v2/sheet/SheetContent';
import type { SheetContext } from '@/features/explorer-v2/sheet/context';
import type { ExplorerState } from '@/features/explorer-v2/state/types';

function makeSearchCtx(overrides?: Partial<ExplorerState>): SheetContext {
  const patch = vi.fn();
  const openSubSheet = vi.fn();
  const select = vi.fn();
  const state: ExplorerState = {
    level: 2,
    sheet: 'search',
    detent: 'full',
    tab: 0,
    mini: 0,
    online: true,
    locationPermission: 'granted',
    theme: 'light',
    orbitPaused: false,
    reveal: true,
    background: false,
    center: [6.869, 45.923],
    zoom: 12,
    searchQuery: 'boucle 15 km lac facile gare',
    searchOverrides: null,
    searchSport: 'rando',
    patch,
    showToast: vi.fn(),
    openCountry: vi.fn(),
    openRegion: vi.fn(),
    openPlace: vi.fn(),
    goUp: vi.fn(),
    select,
    clearSelection: vi.fn(),
    setSheet: vi.fn(),
    openLayers: vi.fn(),
    closeLayers: vi.fn(),
    openSubSheet,
    closeSubSheet: vi.fn(),
    setDetent: vi.fn(),
    setTab: vi.fn(),
    setMini: vi.fn(),
    setCenter: vi.fn(),
    toggleLayer: vi.fn(),
    setMapBaseStyle: vi.fn(),
    setTheme: vi.fn(),
    setOnline: vi.fn(),
    setLocationPermission: vi.fn(),
    setOrbitPaused: vi.fn(),
    setReveal: vi.fn(),
    dismissToast: vi.fn(),
    startActivity: vi.fn(),
    updateActivity: vi.fn(),
    setTrailRoute: vi.fn(),
    setRouteGeometry: vi.fn(),
    retryRouteGeometry: vi.fn(),
    stopActivity: vi.fn(),
    setAutoPauseEnabled: vi.fn(),
    storeStrengthLog: vi.fn(),
    clearStrengthLog: vi.fn(),
    ...(overrides ?? {}),
  } as ExplorerState;

  return {
    state,
    countries: [{ iso_a2: 'FR', name: 'France', continent: 'Europe', capital: 'Paris', currency_code: 'EUR', lat: 46.2, lng: 2.2 }],
    country: null,
    regionsGeo: null,
    regionGroups: [],
    place: null,
    pois: [],
    routes: [],
    weather: null,
    carnets: [],
    reports: [],
    units: 'metric',
    trips: [],
    selectedPoi: {
      id: 'poi-1',
      kind: 'summit',
      subtype: 'peak',
      name: 'Le Brévent',
      lat: 45.933,
      lon: 6.837,
      ele_m: 2525,
      potable: null,
      capacity: null,
    },
    me: { lat: 45.923, lng: 6.869 },
    mapViewport: null,
    onStartSport: vi.fn(),
    locale: 'fr-FR',
  };
}

describe('Lot R03 — Recherche naturelle, correction contextuelle, POI -> parcours & boucles (12 IDs)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('K1.05 / K1.06 / K1.07 / K1.08 / S3.01 / S3.02 / S3.25 : parseSearchQuery, overrides et Smart Tour ranking', () => {
    const parsed = parseSearchQuery('boucle vtt 20 km 2h30 600 m D+ facile sentier gare lac panorama');
    expect(parsed.sport).toBe('vtt');
    expect(parsed.routeType).toBe('boucle');
    expect(parsed.maxDistanceKm).toBe(20);
    expect(parsed.maxDurationHours).toBe(2.5);
    expect(parsed.maxElevGainM).toBe(600);
    expect(parsed.difficulty).toBe('facile');
    expect(parsed.surface).toBe('sentier');
    expect(parsed.startAccess).toBe('gare');
    expect(parsed.landscapeTags).toContain('lac');
    expect(parsed.landscapeTags).toContain('panorama');

    const adjusted = applySearchCriteriaOverrides(parsed, { maxDistanceKm: 10, routeType: 'aller-retour' });
    expect(adjusted.maxDistanceKm).toBe(10);
    expect(adjusted.routeType).toBe('aller-retour');

    const rankedClose = rankRouteForSearch(
      { id: 1, name: 'Boucle du Lac Blanc', network: 'nwn', ref: 'GR5', distance_km: 10, distanceKm: 1.5, matched: false },
      adjusted,
    );
    const rankedFar = rankRouteForSearch(
      { id: 2, name: 'Longue étape', network: 'lwn', ref: null, distance_km: 38, distanceKm: 18, matched: false },
      adjusted,
    );
    expect(rankedClose.smartScore).toBeGreaterThan(rankedFar.smartScore);
    expect(rankedClose.smartReasons.length).toBeGreaterThan(0);
  });

  it('S3.09 : generateSportLoop & POST /api/explorer/v2/routes/loop génèrent une boucle fermée et rejettent les entrées invalides', async () => {
    const loop = await generateSportLoop(
      {
        start: { lat: 45.923, lon: 6.869 },
        targetDistanceKm: 10,
        sport: 'marche',
        bearingDeg: 90,
      },
      {
        router: async (points) => ({
          legs: points.slice(0, -1).map((from, idx) => ({
            distanceKm: 3.33,
            durationMin: 40,
            provider: 'valhalla',
            geometry: [
              [from.lon, from.lat],
              [points[idx + 1].lon, points[idx + 1].lat],
            ],
          })),
          provider: 'valhalla',
          reason: null,
        }),
      },
    );

    expect(loop.status).toBe('ready');
    expect(loop.actualDistanceKm).toBeCloseTo(10, 1);
    const firstCoord = loop.geometry!.coordinates[0];
    const lastCoord = loop.geometry!.coordinates[loop.geometry!.coordinates.length - 1];
    expect(firstCoord[0]).toBeCloseTo(lastCoord[0], 5);
    expect(firstCoord[1]).toBeCloseTo(lastCoord[1], 5);

    const badReq = new Request('http://localhost/api/explorer/v2/routes/loop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lat: 45.923, lon: 6.869, targetDistanceKm: 999 }),
    });
    const badRes = await postLoopRoute(badReq);
    expect(badRes.status).toBe(400);
  });

  it('K1.01–K1.04 / K1.06–K1.08 UI : SearchTab (critères contextuels + création + boucle) & PoiTabs (parcours passant ici)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/explorer/v2/search')) {
        return new Response(
          JSON.stringify({
            filters: {
              kinds: ['summit', 'water'],
              maxDistanceKm: 15,
              routeType: 'boucle',
              difficulty: 'facile',
              startAccess: 'gare',
              easy: true,
              family: false,
            },
            results: [],
            routes: [
              {
                id: 505,
                name: 'Boucle du Lac Vert',
                network: 'rwn',
                ref: 'PR',
                distance_km: 12.2,
                distanceKm: 2.1,
                matched: false,
                smartScore: 88,
                smartReasons: ['Boucle adaptée', 'Proche gare'],
              },
            ],
            adventures: [],
            zone: null,
            truncated: false,
            routesTruncated: false,
            routesUnavailable: false,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('/api/explorer/v2/pois/routes')) {
        return new Response(
          JSON.stringify({
            routes: [
              {
                id: 808,
                name: 'Tour des Aiguilles Rouges',
                network: 'nwn',
                ref: 'GR',
                distance_km: 16.4,
                distanceKm: 0.1,
                proximityM: 45,
                matched: true,
              },
            ],
            radiusM: 400,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ctx = makeSearchCtx();
    const searchModel = buildSheetModel(ctx);
    const { rerender } = render(
      <QueryClientProvider client={qc}>{searchModel.tabs![0].render()}</QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Boucle du Lac Vert')).toBeTruthy();
      expect(screen.getByText('Filtres compris')).toBeTruthy();
    });

    // Correction contextuelle des critères dans le tiroir (C-UI)
    fireEvent.click(screen.getByRole('button', { name: /Corriger/i }));
    fireEvent.click(screen.getByRole('button', { name: '≤ 10 km' }));
    expect(ctx.state.patch).toHaveBeenCalledWith({ searchOverrides: { maxDistanceKm: 10 } });

    // Entrées Création & Boucle depuis SearchTab (K2.01 / S3.06 / S3.09)
    fireEvent.click(screen.getByRole('button', { name: 'Créer un itinéraire' }));
    expect(ctx.state.openSubSheet).toHaveBeenCalledWith('planner', 'full');

    // K1.04 : fiche POI affiche « Parcours passant ici »
    const poiCtx = makeSearchCtx({ sheet: 'summit', selection: { kind: 'summit', id: 'poi-1' } });
    const poiModel = buildSheetModel(poiCtx);
    rerender(<QueryClientProvider client={qc}>{poiModel.tabs![0].render()}</QueryClientProvider>);

    await waitFor(() => {
      expect(screen.getByText('Tour des Aiguilles Rouges')).toBeTruthy();
    });
    expect(fetchSpy).toHaveBeenCalled();
  });
});
