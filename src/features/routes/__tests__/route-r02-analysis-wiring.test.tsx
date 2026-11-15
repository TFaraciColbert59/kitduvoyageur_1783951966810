// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { buildExplorerRouteAnalysis, wmoCodeFromMetSymbol } from '@/features/routes/analysis/explorerBridge';
import { buildSheetModel } from '@/features/explorer-v2/sheet/SheetContent';
import { OutingTrace } from '@/components/compte/drawer/sortie/OutingTrace';
import type { SheetContext } from '@/features/explorer-v2/sheet/context';
import type { ExplorerState } from '@/features/explorer-v2/state/types';
import type { OutingDetail } from '@/features/compte/server/sorties';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function makeTrailCtx(overrides?: Partial<ExplorerState>): SheetContext {
  const patch = vi.fn();
  const openSubSheet = vi.fn();
  const toggleLayer = vi.fn();
  const state: ExplorerState = {
    level: 3,
    sheet: 'trail',
    detent: 'mid',
    tab: 0,
    mini: 0,
    online: true,
    locationPermission: 'granted',
    theme: 'light',
    orbitPaused: false,
    reveal: true,
    background: false,
    center: [6.869, 45.923],
    zoom: 13,
    selection: { kind: 'trail', id: '101' },
    layerVisibility: { routes: true, fire: true },
    patch,
    showToast: vi.fn(),
    openCountry: vi.fn(),
    openRegion: vi.fn(),
    openPlace: vi.fn(),
    goUp: vi.fn(),
    select: vi.fn(),
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
    toggleLayer,
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
    countries: [],
    country: null,
    regionsGeo: null,
    regionGroups: [],
    place: null,
    pois: [],
    routes: [
      {
        id: 101,
        name: 'Aiguillette des Houches',
        distance_km: 8.5,
        network: 'nwn',
        ref: 'GR TMB',
        geojson: {
          type: 'LineString',
          coordinates: [
            [6.8, 45.9],
            [6.82, 45.92],
            [6.85, 45.94],
          ],
        },
      },
    ],
    weather: {
      lat: 45.923,
      lon: 6.869,
      fetched_at: '2026-08-12T06:00:00Z',
      hours: [
        {
          time: new Date().toISOString(),
          temperature_c: 14,
          wind_ms: 4,
          precipitation_mm: 0.2,
          symbol: 'partlycloudy_day',
        },
        {
          time: new Date(Date.now() + 3600_000).toISOString(),
          temperature_c: 16,
          wind_ms: 8,
          precipitation_mm: 1.5,
          symbol: 'rain',
        },
      ],
    },
    carnets: [],
    reports: [],
    units: 'metric',
    trips: [],
    selectedPoi: null,
    me: null,
    mapViewport: null,
    onStartSport: vi.fn(),
    locale: 'fr-FR',
  };
}

describe('Lot R02 — Profil interactif, montées, difficulté, alertes, feux & météo horodatée (8 IDs)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('K2.19–K2.24 / S3.26 : bridge buildExplorerRouteAnalysis garde des états honnêtes et calcule montées, effort, alertes, feux et météo', () => {
    expect(wmoCodeFromMetSymbol('heavyrain')).toBe(80);
    expect(wmoCodeFromMetSymbol('thunderstorm')).toBe(95);

    const denseProfile = Array.from({ length: 27 }, (_, i) => ({
      d: i * 200,
      ele: 1000 + i * 32,
    }));
    const bundle = buildExplorerRouteAnalysis({
      positions: [
        [6.8, 45.9],
        [6.82, 45.92],
        [6.85, 45.94],
      ],
      profilePoints: denseProfile,
      sport: 'marche',
      speedKmH: 5,
      explorerWeather: {
        hours: [
          {
            time: '2026-08-12T08:00:00Z',
            temperature_c: 12,
            wind_ms: 5,
            precipitation_mm: 0,
            symbol: 'clearsky_day',
          },
          {
            time: '2026-08-12T09:00:00Z',
            temperature_c: 15,
            wind_ms: 6,
            precipitation_mm: 0.4,
            symbol: 'rain',
          },
        ],
      },
      startAtIso: '2026-08-12T08:00:00Z',
    });

    // K2.19 : aucune surface inventée
    expect(bundle.surfaces.status).toBe('unavailable');
    // K2.20 : montée détectée
    expect(bundle.climbs?.climbs.length).toBeGreaterThanOrEqual(1);
    // K2.21 + S3.26 : difficulté et durée personnalisée
    expect(bundle.difficulty.duration.personalized).toBe(true);
    expect(bundle.difficulty.duration.seconds).toBeGreaterThan(0);
    // K2.23 : source feux manquante => explicitement unavailable
    expect(bundle.fire.status).toBe('unavailable');
    // K2.24 : météo horodatée + alerte officielle explicitement unavailable
    expect(bundle.weather?.samples.length).toBeGreaterThan(0);
    expect(bundle.weather?.officialAlerts.status).toBe('unavailable');
  });

  it('K2.19 / K2.20 / K2.21 / K2.22 / K2.23 / K2.24 / S3.26 UI : ToolsTabs trail Trace & Conditions', async () => {
    const densePts = Array.from({ length: 24 }, (_, i) => ({
      d: i * 200,
      ele: 1000 + i * 35,
    }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          points: densePts,
          distance_m: 4600,
          gain_m: 805,
          loss_m: 0,
          min_m: 1000,
          max_m: 1805,
          source: 'aws-terrarium',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const ctx = makeTrailCtx();
    const model = buildSheetModel(ctx);
    const traceTab = model.tabs?.find((t) => t.id === 'trace');
    const condTab = model.tabs?.find((t) => t.id === 'conditions');
    expect(traceTab).toBeTruthy();
    expect(condTab).toBeTruthy();

    const qc = new QueryClient();
    const { rerender } = render(
      <QueryClientProvider client={qc}>{traceTab!.render()}</QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Calculer le profil altimétrique/i }));

    await waitFor(() => {
      expect(screen.getByText(/Surfaces non importées/i)).toBeTruthy();
      expect(screen.getByText(/Montée 4,6 km/i)).toBeTruthy();
    });

    // S3.26 : ajuster le rythme personnel bascule la durée en mode personnel
    fireEvent.click(screen.getByRole('button', { name: '3,5 km/h' }));
    expect(screen.getByText(/Base : rythme personnel/i)).toBeTruthy();

    // K2.20 : cliquer sur une montée publie highlightedSegment dans le store
    const climbRow = screen.getByText(/Montée 4,6 km/i).closest('button');
    expect(climbRow).toBeTruthy();
    fireEvent.click(climbRow!);
    expect(ctx.state.patch).toHaveBeenCalledWith(
      expect.objectContaining({ highlightedSegment: expect.objectContaining({ coordinates: expect.any(Array) }) }),
    );

    // K2.23 + K2.24 : Onglet Conditions
    rerender(<QueryClientProvider client={qc}>{condTab!.render()}</QueryClientProvider>);
    expect(screen.getByText(/Source feux non connectée/i)).toBeTruthy();
    expect(screen.getByText(/Alertes météo officielles/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Demain 07h00/i }));
    fireEvent.click(screen.getByText(/Source feux non connectée/i).closest('button')!);
    expect(ctx.state.toggleLayer).toHaveBeenCalledWith('fire');
  });

  it('S2.03 UI : OutingTrace distingue une séance sans snapshot météo d’une séance avec prévision enregistrée', () => {
    const baseOuting = {
      id: 's-1',
      title: 'Sortie Belledonne',
      date: '2026-06-10',
      startedAt: '2026-06-10T07:30:00Z',
      endedAt: '2026-06-10T11:30:00Z',
      massif: 'Belledonne',
      routeName: null,
      sport: 'rando',
      km: 11,
      dplus: 700,
      maxAlt: 2100,
      durationS: 14400,
      paceMinPerKm: 8.5,
      movingTimeS: 13200,
      heartRateBpm: null,
      powerW: null,
      cadenceRpm: null,
      caloriesKcal: null,
      metricVisibility: {
        distance: true,
        elevationGain: true,
        maxAltitude: true,
        duration: true,
        elevation: true,
        pace: true,
        heartRate: false,
        power: false,
        cadence: false,
        calories: false,
      },
      shareMetricVisibility: {
        distance: true,
        elevationGain: true,
        maxAltitude: true,
        duration: true,
        elevation: true,
        pace: true,
        heartRate: false,
        power: false,
        cadence: false,
        calories: false,
      },
      shareMetricsConfigured: false,
      metricsMasked: false,
      status: 'done',
      visibility: 'private',
      verified: false,
      coverUrl: null,
      notes: '',
      weather: null,
      photos: [],
      photosUnavailable: false,
      participants: [],
      gear: [],
      kit: null,
      missingGear: 0,
      kudos: { count: 0, mine: false, users: [] },
      comments: [],
      points: [
        { lat: 45.2, lng: 6.0, elevationM: 1200, timestamp: null },
        { lat: 45.23, lng: 6.03, elevationM: 1900, timestamp: null },
      ],
      traceSegments: [
        [
          { lat: 45.2, lng: 6.0, elevationM: 1200, timestamp: null },
          { lat: 45.23, lng: 6.03, elevationM: 1900, timestamp: null },
        ],
      ],
      traceMasked: false,
      traceFullyMasked: false,
      traceError: null,
      canEdit: true,
      provenance: null,
      laps: null,
      summary: null,
      samples: null,
    } as unknown as OutingDetail;

    const { rerender } = render(<OutingTrace detail={baseOuting} onExport={vi.fn()} />);
    expect(screen.getByText(/Météo non enregistrée/i)).toBeTruthy();

    rerender(
      <OutingTrace
        detail={{
          ...baseOuting,
          weather: {
            source: 'open-meteo',
            fetchedAt: '2026-06-10T07:25:00Z',
            latitude: 45.2,
            longitude: 6.0,
            days: [
              {
                date: '2026-06-10',
                code: 1,
                label: 'Éclaircies',
                icon: 'partly',
                tMax: 17,
                tMin: 8,
                precipMm: 0,
                windKmh: 12,
              },
            ],
            alerts: [],
          },
        }}
        onExport={vi.fn()}
      />,
    );
    expect(screen.getByText(/Météo enregistrée au départ/i)).toBeTruthy();
  });
});
