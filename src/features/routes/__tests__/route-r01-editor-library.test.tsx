// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ebikeSupportedForSport,
  normalizeRoutingOptions,
  routingCacheKeyForSport,
  routingProfileForSport,
} from '@/features/adventure-prep/routeProfiles';
import {
  appendRoutePoint,
  applyRouteShapeMode,
  batchRemoveRoutePoints,
  createRouteDraft,
  estimateDurationMinutesForSpeed,
  gpxFromRouteDraft,
  insertRoutePointOptimal,
  manualRouteSection,
  moveRoutePoint,
  reorderRoutePoint,
  reverseRouteState,
  updateRoutePointMeta,
} from '@/features/adventure-prep/routeRevision';
import {
  convertOutingToRoute,
  copyRouteToDraft,
  deleteSavedRoute,
  loadSavedRoutes,
  renameSavedRoute,
  ROUTE_LIBRARY_STORAGE_KEY,
  saveRouteToLibrary,
} from '@/features/routes/library/routeLibrary';
import { RoutePlannerPanel } from '@/features/explorer-v2/sheet/RoutePlannerPanel';
import { OutingSummary } from '@/components/compte/drawer/sortie/OutingSummary';
import type { SheetContext } from '@/features/explorer-v2/sheet/context';
import type { ExplorerState } from '@/features/explorer-v2/state/types';
import type { OutingDetail } from '@/features/compte/server/sorties';

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  };
}

function makePlannerCtx(overrides?: Partial<ExplorerState>): SheetContext {
  const patch = vi.fn();
  const showToast = vi.fn();
  const state: ExplorerState = {
    level: 3,
    sheet: 'planner',
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
    zoom: 13,
    plannerDraft: null,
    plannerTitle: 'Sortie Chamonix',
    plannerLineHidden: false,
    plannerMapPick: false,
    patch,
    showToast,
    openCountry: vi.fn(),
    openRegion: vi.fn(),
    openPlace: vi.fn(),
    goUp: vi.fn(),
    select: vi.fn(),
    clearSelection: vi.fn(),
    setSheet: vi.fn(),
    openLayers: vi.fn(),
    closeLayers: vi.fn(),
    openSubSheet: vi.fn(),
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
    countries: [],
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
    selectedPoi: null,
    me: { lat: 45.923, lng: 6.869 },
    mapViewport: null,
    onStartSport: vi.fn(),
    locale: 'fr-FR',
  };
}

describe('Lot R01 — Éditeur, préférences, GPX, bibliothèque et conversion (21 IDs)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('K2.03 / K2.04 / K2.05 : profils sport, préférences de surface, évitements et VAE', () => {
    expect(ebikeSupportedForSport('marche')).toBe(false);
    expect(ebikeSupportedForSport('vtt')).toBe(true);
    expect(ebikeSupportedForSport('route')).toBe(true);

    const normalized = normalizeRoutingOptions('marche', {
      ebike: true,
      surfacePref: 'prefer_unpaved',
      avoidSteps: true,
      avoidFerries: true,
    });
    expect(normalized.ebike).toBeUndefined();
    expect(normalized.surfacePref).toBe('prefer_unpaved');

    const profileVtt = routingProfileForSport('vtt', { ebike: true, avoidSteps: true });
    expect(profileVtt.valhallaOptions?.use_ebike).toBe(true);
    expect(profileVtt.valhallaOptions?.step_penalty).toBe(900);
    expect(profileVtt.geoapifyMode).toBe('mountain_bike');

    const k1 = routingCacheKeyForSport('vtt', { ebike: false, surfacePref: 'balanced' });
    const k2 = routingCacheKeyForSport('vtt', { ebike: true, surfacePref: 'prefer_trails' });
    expect(k1).not.toBe(k2);
  });

  it('K2.06–K2.17 : ajout, déplacement, réordonnancement, insertion optimale, boucle, inversion, manuel, lot, métadonnées GPX & rythme', () => {
    const p0 = appendRoutePoint([], 45.9, 6.8);
    const p1 = appendRoutePoint(p0, 45.94, 6.84);
    expect(p1).toHaveLength(2);

    const moved = moveRoutePoint(p1, 1, 45.95, 6.85);
    expect(moved[1].lat).toBeCloseTo(45.95, 4);

    const inserted = insertRoutePointOptimal(moved, 45.925, 6.825);
    expect(inserted).toHaveLength(3);
    expect(inserted[1].lat).toBeCloseTo(45.925, 3);

    const reordered = reorderRoutePoint(inserted, 1, 2);
    expect(reordered[2].lat).toBeCloseTo(45.925, 3);

    const oar = applyRouteShapeMode(moved, 'out_and_back');
    expect(oar.length).toBe(3);
    expect(oar[2].lat).toBeCloseTo(oar[0].lat, 4);

    const loop = applyRouteShapeMode(inserted, 'loop');
    expect(loop[loop.length - 1].lat).toBeCloseTo(loop[0].lat, 4);

    const sec = [manualRouteSection(0, moved[0], moved[1])];
    const reversed = reverseRouteState(moved, sec);
    expect(reversed.points[0].lat).toBeCloseTo(moved[1].lat, 4);
    expect(reversed.sections[0].mode).toBe('manual');

    const kept = batchRemoveRoutePoints(inserted, [], new Set([1]));
    expect(kept.points).toHaveLength(2);

    const withWater = updateRoutePointMeta(inserted, 1, {
      name: 'Source claire',
      semanticKind: 'water',
      note: 'Eau fraîche',
      shared: true,
    });
    const withPrivate = updateRoutePointMeta(withWater, 0, {
      name: 'Maison privée',
      semanticKind: 'waypoint',
      shared: false,
    });
    const draft = createRouteDraft({
      tripId: 't1',
      sport: 'marche',
      points: withPrivate,
      distanceKm: 10,
      durationMin: 150,
      provider: 'manual',
    });
    const gpxPublic = gpxFromRouteDraft('Mon tour', draft.points, draft.geometry, {
      includeUnshared: false,
    });
    expect(gpxPublic).toContain('<wpt');
    expect(gpxPublic).toContain('Source claire');
    expect(gpxPublic).not.toContain('Maison privée');

    const mins = estimateDurationMinutesForSpeed(12, 4, 700, 'marche');
    expect(mins).toBe(240);
  });

  it('K2.27 / K2.28 / S3.08 : bibliothèque CRUD, copie de tracé public et conversion sortie -> parcours', () => {
    const storage = createMemoryStorage();
    const base = appendRoutePoint(appendRoutePoint([], 45.9, 6.8), 45.93, 6.83);
    const draft = createRouteDraft({
      tripId: 'lib-1',
      sport: 'gravel',
      points: base,
      distanceKm: 4.5,
      durationMin: 20,
      provider: 'ors',
    });
    const saved = saveRouteToLibrary(
      { name: 'Boucle Gravel', sourceType: 'created', sourceId: null, draft },
      storage,
    );
    expect(saved).toHaveLength(1);
    expect(loadSavedRoutes(storage)).toHaveLength(1);

    const renamed = renameSavedRoute(saved[0].id, 'Gravel V2', storage);
    expect(renamed[0].name).toBe('Gravel V2');

    const copied = copyRouteToDraft({
      sourceId: '99',
      name: 'Tour du Mont',
      geojson: { type: 'LineString', coordinates: [[6.8, 45.9], [6.84, 45.93]] },
      sport: 'marche',
    });
    expect(copied).not.toBeNull();
    expect(copied?.name).toContain('(copie)');

    const converted = convertOutingToRoute({
      outingId: 'out-1',
      title: 'Sortie Arve',
      sport: 'vtt',
      points: [
        { lat: 45.9, lng: 6.8 },
        { lat: 45.92, lng: 6.83 },
      ],
      durationS: 3600,
    });
    expect(converted?.sourceType).toBe('converted_outing');
    expect(converted?.draft.sport).toBe('vtt');

    const afterDelete = deleteSavedRoute(saved[0].id, storage);
    expect(afterDelete).toHaveLength(0);
    expect(storage.getItem(ROUTE_LIBRARY_STORAGE_KEY)).toBe('[]');
  });

  it('K2.01 / S3.06 / K2.16 UI : RoutePlannerPanel complet dans le drawer Explorer + masquage tracé + toucher carte', () => {
    const ctx = makePlannerCtx();
    render(<RoutePlannerPanel ctx={ctx} />);

    expect(screen.getByRole('button', { name: 'Vélo route' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vélo route' }));
    expect(screen.getByRole('button', { name: /VAE/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Masquer tracé/i }));
    expect(ctx.state.patch).toHaveBeenCalledWith({ plannerLineHidden: true });

    fireEvent.click(screen.getByRole('button', { name: /Poser sur carte/i }));
    expect(ctx.state.patch).toHaveBeenCalledWith({ plannerMapPick: true });
  });

  it('S3.08 UI : OutingSummary permet de convertir une sortie en parcours dans la bibliothèque', () => {
    const detail = {
      id: 'sortie-42',
      title: 'Rando Brévent',
      date: '2026-08-12',
      startedAt: '2026-08-12T08:00:00Z',
      endedAt: '2026-08-12T12:00:00Z',
      massif: 'Aiguilles Rouges',
      routeName: null,
      sport: 'rando',
      km: 9.4,
      dplus: 850,
      maxAlt: 2525,
      durationS: 14400,
      paceMinPerKm: null,
      movingTimeS: null,
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
        pace: false,
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
        pace: false,
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
        { lat: 45.923, lng: 6.869, elevationM: 1050, timestamp: null },
        { lat: 45.935, lng: 6.855, elevationM: 1850, timestamp: null },
      ],
      traceSegments: [
        [
          { lat: 45.923, lng: 6.869, elevationM: 1050, timestamp: null },
          { lat: 45.935, lng: 6.855, elevationM: 1850, timestamp: null },
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

    render(
      <OutingSummary
        detail={detail}
        saving={false}
        onSave={vi.fn()}
        onSaveMetrics={vi.fn()}
        onResetMetrics={vi.fn()}
        onShare={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Créer un parcours/i }));
    expect(loadSavedRoutes()).toHaveLength(1);
    expect(loadSavedRoutes()[0].sourceType).toBe('converted_outing');
    expect(screen.getByRole('link', { name: /Ouvrir dans Explorer/i })).toBeTruthy();
  });
});
