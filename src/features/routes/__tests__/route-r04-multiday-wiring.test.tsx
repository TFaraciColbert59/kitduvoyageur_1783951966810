// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  buildExplorerCatalogAdventures,
  consumePendingStageLaunch,
  trailSnapshotFromStage,
  writePendingStageLaunch,
} from '@/features/planning/explorerAdapter';
import { searchMultiDayPlans } from '@/features/planning/library';
import { MultiDaySheetPanel } from '@/features/explorer-v2/sheet/MultiDaySheetPanel';
import type { SheetContext } from '@/features/explorer-v2/sheet/context';
import type { ExplorerState } from '@/features/explorer-v2/state/types';
import type { ExplorerStore } from '@/features/explorer-v2/state/store';

function makeMultiDayCtx(overrides?: Partial<ExplorerState>): SheetContext {
  const patch = vi.fn();
  const select = vi.fn();
  const showToast = vi.fn();
  const state = {
    level: 3,
    sheet: 'multiday',
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
    searchSport: 'rando',
    activeMultiDayPlan: null,
    selection: { kind: 'trail', id: '77' },
    patch,
    showToast,
    openCountry: vi.fn(),
    openRegion: vi.fn(),
    openPlace: vi.fn(),
    goUp: vi.fn(),
    select,
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
  } as unknown as ExplorerStore;

  const coords = Array.from({ length: 16 }, (_, idx) => [
    6.8 + idx * 0.015,
    45.9 + idx * 0.008,
    1200 + idx * 45,
  ]);

  return {
    state,
    countries: [],
    country: null,
    regionsGeo: undefined,
    regionGroups: [],
    place: undefined,
    pois: [
      {
        id: 'ref-1',
        kind: 'refuge',
        subtype: 'alpine_hut',
        name: 'Refuge de Balme',
        lat: 45.96,
        lon: 6.91,
        ele_m: 1950,
        potable: true,
        capacity: 40,
      },
      {
        id: 'biv-2',
        kind: 'bivouac',
        subtype: 'camp_site',
        name: 'Bivouac du Lac',
        lat: 45.99,
        lon: 6.96,
        ele_m: 2150,
        potable: false,
        capacity: 12,
      },
    ],
    routes: [
      {
        id: 77,
        name: 'Traversée du Beaufortain',
        distance_km: 34,
        network: 'nwn',
        ref: 'GR',
        geojson: { type: 'LineString', coordinates: coords },
      },
    ],
    weather: undefined,
    carnets: [],
    reports: [],
    units: 'metric',
    trips: [],
    selectedPoi: null,
    me: null,
    mapViewport: null,
    terrain: {
      slope: { state: 'idle' as const, summary: null, routeName: null, hasRoute: false },
      distance: { hasRoute: false, status: null, count: 0, intervalLabel: '1 km' },
    },
    onStartSport: vi.fn(),
    locale: 'fr-FR',
  };
}

describe('Lot R04 — Trek multi-jours, découpage, bornes, hébergements & lancement étape (5 IDs)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('K1.13 : catalogue public et recherche d’aventures multi-jours', () => {
    const catalog = buildExplorerCatalogAdventures();
    expect(catalog.length).toBeGreaterThanOrEqual(2);
    const alpes = searchMultiDayPlans(
      catalog,
      { rawQuery: 'Mont-Blanc' },
      { viewerId: null, friendIds: [], tribuIds: [], blockedUserIds: [] },
    );
    expect(alpes.items.some((a) => a.id === 'adv-tmb-alpes')).toBe(true);
  });

  it('K2.29 / K2.30 / K2.31 / K2.32 UI : découpage en N jours, déplacement de borne, ancrage hébergement et démarrage d’étape dans Explorer', () => {
    const ctx = makeMultiDayCtx();
    render(<MultiDaySheetPanel ctx={ctx} />);

    // K2.29 : 3 jours par défaut, changement vers 4 jours recalcule en 4 étapes
    expect(screen.getByText(/Jour 1/i)).toBeTruthy();
    expect(screen.getByText(/Jour 3/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Nombre de jours du découpage'), {
      target: { value: '4' },
    });
    expect(screen.getByText(/Jour 4/i)).toBeTruthy();

    // K2.30 : déplacer la borne du jour 1
    fireEvent.click(screen.getAllByRole('button', { name: /Ajuster la fin du jour/i })[0]);
    fireEvent.change(screen.getByLabelText("Position de la fin d'étape"), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Valider la nouvelle étape/i }));
    expect(ctx.state.patch).toHaveBeenCalledWith(
      expect.objectContaining({ activeMultiDayPlan: expect.objectContaining({ daysCount: 4 }) }),
    );

    // K2.31 : ancrer un hébergement réel POI
    fireEvent.click(screen.getAllByRole('button', { name: /Ancrer à un refuge/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Refuge de Balme/i }));
    expect(screen.getByText(/Refuge de Balme/i)).toBeTruthy();

    // K2.32 : démarrer une étape individuellement dans Explorer
    fireEvent.click(screen.getAllByRole('button', { name: /Démarrer cette étape/i })[0]);
    expect(ctx.state.setTrailRoute).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready' }),
    );
    expect(ctx.state.select).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'trail' }),
      'trail',
      'mid',
    );
  });

  it('K2.32 : round-trip handoff Hub Planning -> Explorer (writePendingStageLaunch / consumePendingStageLaunch / trailSnapshotFromStage)', () => {
    const ok = writePendingStageLaunch({
      planId: 'trip-9',
      planTitle: 'Tour des Écrins',
      stageId: 'trip-9-j2',
      dayNumber: 2,
      stageRevision: 1,
      sport: 'hiking',
      points: [
        { lat: 44.9, lon: 6.2, eleM: null },
        { lat: 44.95, lon: 6.28, eleM: null },
      ],
    });
    expect(ok).toBe(true);

    const launch = consumePendingStageLaunch();
    expect(launch).not.toBeNull();
    expect(launch?.dayNumber).toBe(2);
    expect(consumePendingStageLaunch()).toBeNull();

    const snapshot = trailSnapshotFromStage(launch!.planTitle, {
      stageId: launch!.stageId,
      dayNumber: launch!.dayNumber,
      points: launch!.points,
      revision: launch!.stageRevision,
    });
    expect(snapshot.status).toBe('ready');
    expect(snapshot.id).toBe('stage-trip-9-j2-r1');
    expect(snapshot.name).toBe('Tour des Écrins · Jour 2');
  });
});
