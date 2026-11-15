// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { OfflineRuntimeStore } from '@/features/offline/offlineRuntimeStore';
import { PREDEFINED_REGIONS_CATALOG } from '@/features/offline';

vi.mock('../offline/zone', () => ({
  registerOfflineWorker: vi.fn(async () => null),
  downloadZone: vi.fn(async () => ({ tiles: 12, bytes: 2048 })),
}));
import {
  buildExternalNavigationLinks,
  computeUpcomingWaypoints,
  createDefaultAudioPreferences,
  createInitialDisplayPreferences,
  createInitialOrientationState,
  createInitialRerouteState,
  createInitialTurnByTurnState,
  detectClimbDescentSegments,
  evaluateClimbDescentCard,
  evaluateDepartureState,
  projectWaypointsOnRoute,
  type AccessGuidancePlan,
  type NavigationWaypointInput,
  type WaypointAlertEvent,
} from '@/features/navigation';
import type { PoiItem } from '../data/hooks';
import { explorerRerouteProvider, type NavigationGuidanceUiState } from '../guidance/useNavigationGuidance';
import { JoinStartCard, WaypointAlertBanner } from '../guidance/ui';
import { useExplorerStore } from '../state/store';
import { buildSheetModel } from '../sheet/SheetContent';
import type { SheetContext } from '../sheet/context';

const SAMPLE_GEOJSON = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [6.869, 45.923, 1035],
      [6.872, 45.926, 1180],
      [6.876, 45.929, 1360],
    ],
  },
  properties: {},
};

const SAMPLE_ROUTE = {
  id: '101',
  name: 'Tour du Lac Blanc',
  geojson: SAMPLE_GEOJSON,
  status: 'ready' as const,
};

const SAMPLE_POIS: PoiItem[] = [
  {
    id: 'poi-refuge',
    name: 'Refuge du Lac',
    kind: 'refuge',
    subtype: 'gardé',
    lat: 45.926,
    lon: 6.872,
    ele_m: 1180,
    potable: true,
    capacity: 24,
  },
  {
    id: 'poi-private-friend',
    name: 'Position privée ami',
    kind: 'friend',
    subtype: 'live',
    lat: 45.927,
    lon: 6.873,
    ele_m: 1200,
    potable: null,
    capacity: null,
  },
];

const SAMPLE_REGION = PREDEFINED_REGIONS_CATALOG[0];

function makeGuidanceUiState(): NavigationGuidanceUiState {
  const orientation = createInitialOrientationState(true);
  const tbt = createInitialTurnByTurnState([
    [
      [6.869, 45.923],
      [6.872, 45.926],
      [6.876, 45.929],
    ],
  ]);
  const departureEvaluation = evaluateDepartureState([6.86, 45.91], SAMPLE_GEOJSON);
  const externalLinks = buildExternalNavigationLinks({
    lat: 45.923,
    lng: 6.869,
    label: SAMPLE_ROUTE.name,
  });
  const waypoints: NavigationWaypointInput[] = [
    {
      id: 'poi-refuge',
      name: 'Refuge du Lac',
      kind: 'refuge',
      lat: 45.926,
      lng: 6.872,
      eleM: 1180,
      authorized: true,
    },
  ];
  return {
    turnByTurn: tbt,
    reroute: createInitialRerouteState(),
    detourGeoJson: null,
    accessRouteGeoJson: null,
    orientation,
    upcomingWaypoints: computeUpcomingWaypoints(
      projectWaypointsOnRoute(
        waypoints,
        [
          [
            [6.869, 45.923],
            [6.872, 45.926],
            [6.876, 45.929],
          ],
        ],
        { sport: 'rando' },
      ),
      0,
      { units: 'metric', currentSpeedMs: 1.4 },
    ),
    activeWaypointAlert: null,
    climbCard: evaluateClimbDescentCard(
      detectClimbDescentSegments([
        { d: 0, ele: 1035 },
        { d: 450, ele: 1180 },
        { d: 900, ele: 1360 },
      ]),
      100,
      { units: 'metric' },
    ),
    audioPrefs: createDefaultAudioPreferences(),
    displayPrefs: createInitialDisplayPreferences('rando'),
    customFieldValues: [
      {
        key: 'distance',
        label: 'Distance',
        formattedValue: '1,2 km',
        unitLabel: 'km',
        available: true,
        unavailableReason: null,
      },
      {
        key: 'elevation',
        label: 'D+',
        formattedValue: '+145 m',
        unitLabel: 'm',
        available: true,
        unavailableReason: null,
      },
    ],
    wakeLock: {
      enabled: false,
      supported: false,
      active: false,
      reason: null,
    },
    targetZoom: 15,
    lockScreenPayload: null,
    lockScreenCapability: {
      platform: 'web',
      supported: false,
      liveActivityAvailable: false,
      dynamicIslandAvailable: false,
      ongoingNotificationAvailable: false,
      reason: 'web_environment',
    },
    departureEvaluation,
    externalLinks,
    accessPlan: null,
    availableSwapRoutes: [
      {
        id: '101',
        name: 'Tour du Lac Blanc',
        geojson: SAMPLE_GEOJSON,
        status: 'ready',
      },
      {
        id: '202',
        name: 'Variante Aiguille Rouge',
        geojson: SAMPLE_GEOJSON,
        status: 'ready',
      },
    ],
  };
}

function makeSheetContext(overrides: Partial<SheetContext> = {}): SheetContext {
  return {
    state: useExplorerStore.getState(),
    countries: [],
    country: null,
    regionsGeo: undefined,
    regionGroups: [],
    place: undefined,
    pois: SAMPLE_POIS,
    routes: [
      {
        id: 101,
        name: SAMPLE_ROUTE.name,
        distance_km: 8.4,
        network: 'GR',
        ref: 'GR5',
        geojson: SAMPLE_GEOJSON,
      },
    ],
    weather: undefined,
    carnets: [],
    reports: [],
    units: 'metric',
    trips: [],
    selectedPoi: null,
    me: { lat: 45.923, lng: 6.869 },
    mapViewport: {
      minLng: 6.82,
      minLat: 45.88,
      maxLng: 6.94,
      maxLat: 45.98,
      zoom: 13,
    },
    terrain: {
      slope: { state: 'ready', summary: null, routeName: SAMPLE_ROUTE.name, hasRoute: true },
      distance: { hasRoute: true, status: 'ready', count: 8, intervalLabel: '1 km' },
    },
    guidance: {
      state: makeGuidanceUiState(),
      onSetOrientationMode: vi.fn(),
      onRecenter: vi.fn(),
      onSetAudioPrefs: vi.fn(),
      onTestVoice: vi.fn(),
      onSetDisplayPrefs: vi.fn(),
      onSwapRoute: vi.fn(),
      onSelectDepartureAction: vi.fn(),
      onRetryReroute: vi.fn(),
      onLockScreenAction: vi.fn(),
    },
    offline: {
      installedPacks: [],
      progress: null,
      coverageVisible: false,
      onDownloadRegion: vi.fn(),
      onPausePack: vi.fn(),
      onDeletePack: vi.fn(),
      onDownloadZones: vi.fn(),
      onDownloadRoutePack: vi.fn(),
      onShowCoverage: vi.fn(),
      onLaunchShortcut: vi.fn(),
    },
    locale: 'fr',
    ...overrides,
  };
}

describe('N01 + N02 Explorer wiring', () => {
  beforeEach(() => {
    useExplorerStore.setState({
      sheet: 'level',
      sheetParent: undefined,
      detent: 'peek',
      tab: 0,
      selection: undefined,
      trailRoute: undefined,
      activity: undefined,
      northUp: true,
    });
  });

  it('OfflineRuntimeStore installe région (K4.14), zone multi (K4.15), paquet itinéraire, couverture (K4.16), raccourci (K4.19) et purge déconnexion (K4.17)', async () => {
    const store = new OfflineRuntimeStore();

    // K4.14: région prédéfinie
    const regProg = await store.downloadOrResumeRegion(SAMPLE_REGION, {
      pois: SAMPLE_POIS,
      routes: [],
    });
    expect(regProg.failureReason).toBeNull();
    expect(regProg.status).toBe('available');

    // K4.15: zone personnalisée
    const customProgs = await store.downloadCustomZones(
      {
        zones: [
          {
            zoneId: 'custom-argentiere',
            label: 'Argentière',
            bounds: { west: 5.7, south: 44.8, east: 5.8, north: 44.9 },
            minZoom: 11,
            maxZoom: 14,
            valid: true,
            validationError: null,
            estimatedTiles: 120,
            estimatedBytes: 2_000_000,
            areaKm2: 85,
          },
        ],
        maxZonesAllowed: 5,
        maxTilesPerZone: 4000,
        combinedNetTileCount: 120,
        combinedEstimatedBytes: 2_000_000,
        visibleLimitsGeoJson: { type: 'FeatureCollection', features: [] },
      },
      { pois: SAMPLE_POIS, routes: [] },
    );
    expect(customProgs).toHaveLength(1);
    expect(customProgs[0].status).toBe('available');

    // N02 route-level pack + K4.17 filtrage POI privé ('friend')
    const routeProg = await store.downloadRouteOfflinePack(
      { id: 'route-private-1', name: 'Trace privée', geojson: SAMPLE_GEOJSON, sport: 'rando' },
      SAMPLE_POIS,
      { ownerUserId: 'user-1' },
    );
    expect(routeProg.failureReason).toBeNull();
    expect(routeProg.status).toBe('available');
    const navData = store.getInstalledRouteNavigationData('route-private-1');
    expect(navData).not.toBeNull();
    expect(navData?.pois.some((p) => p.id === 'poi-refuge')).toBe(true);
    expect(navData?.pois.some((p) => p.id === 'poi-private-friend')).toBe(false);

    // K4.16: emprise polygonale GeoJSON
    const coverage = store.buildCoverageGeoJson();
    expect(coverage.features.length).toBeGreaterThanOrEqual(3);

    // K4.19: raccourci système sans entrée de navigation principale ni écriture serveur
    const shortcutRes = store.resolveShortcut('lkdv://shortcut/route/route-private-1');
    expect(shortcutRes.status).toBe('resolved');
    expect(shortcutRes.actionKind).toBe('open_downloaded_route');
    expect(shortcutRes.targetRouteId).toBe('route-private-1');
    expect(shortcutRes.addsMainNavigationEntry).toBe(false);
    expect(shortcutRes.performsServerWrite).toBe(false);

    // K4.17: purge à la déconnexion supprime uniquement les packs privés user-1
    await store.purgePrivateOnLogout('user-1');
    expect(store.getInstalledRouteNavigationData('route-private-1')).toBeNull();
    expect(store.listInstalledPacks().some((p) => p.manifest.regionId === SAMPLE_REGION.regionId)).toBe(
      true,
    );
  });

  it('Store N01 : openLiveSettings / closeLiveSettings restaure sheetParent (C-UI) et swapActivityRoute conserve clientSessionId (K4.10)', () => {
    useExplorerStore.setState({
      sheet: 'live',
      detent: 'mid',
      tab: 1,
      trailRoute: SAMPLE_ROUTE,
      activity: {
        sport: 'rando',
        sessionId: null,
        startedAt: 1_700_000_000_000,
        clientSessionId: 'client-sess-42',
        paused: false,
        autoPaused: false,
        offRoute: false,
        distanceM: 2340,
        elevGainM: 185,
        movingS: 1420,
        route: SAMPLE_ROUTE,
        splits: [],
        mileSplits: [],
        laps: [],
      },
    });

    useExplorerStore.getState().openLiveSettings();
    expect(useExplorerStore.getState().sheet).toBe('liveSettings');
    expect(useExplorerStore.getState().sheetParent).toEqual({
      sheet: 'live',
      detent: 'mid',
      tab: 1,
    });

    const nextRoute = { ...SAMPLE_ROUTE, id: '202', name: 'Variante Aiguille Rouge' };
    useExplorerStore.getState().swapActivityRoute(nextRoute);
    const afterSwap = useExplorerStore.getState();
    expect(afterSwap.activity?.route?.id).toBe('202');
    expect(afterSwap.activity?.clientSessionId).toBe('client-sess-42');
    expect(afterSwap.activity?.distanceM).toBe(2340);

    useExplorerStore.getState().closeLiveSettings();
    expect(useExplorerStore.getState().sheet).toBe('live');
    expect(useExplorerStore.getState().tab).toBe(1);
    expect(useExplorerStore.getState().sheetParent).toBeUndefined();
  });

  it('explorerRerouteProvider (K4.05) consomme /api/route et n’invente aucune géométrie en cas d’indisponibilité', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'ok',
          provider: 'geoapify',
          legs: [
            {
              distanceM: 310,
              durationS: 240,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [6.87, 45.924],
                  [6.872, 45.926],
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const okRes = await explorerRerouteProvider(
      { lat: 45.924, lng: 6.87 },
      { lat: 45.926, lng: 6.872 },
      'rando',
    );
    expect(okRes.reason).toBeNull();
    expect(okRes.leg?.geometry).toHaveLength(2);
    expect(okRes.leg?.provider).toBe('geoapify');

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const failRes = await explorerRerouteProvider(
      { lat: 45.924, lng: 6.87 },
      { lat: 45.926, lng: 6.872 },
      'rando',
    );
    expect(failRes.leg).toBeNull();
    expect(failRes.reason).toBe('provider_unavailable');
    fetchSpy.mockRestore();
  });

  it('SheetContent branche N02 (offline + trail) et N01 (live + liveSettings 4 onglets)', () => {
    // 1) Tiroir offline -> OfflinePacksScreen
    useExplorerStore.setState({ sheet: 'offline', detent: 'mid', tab: 0 });
    const offlineModel = buildSheetModel(makeSheetContext());
    expect(offlineModel.tabs).toHaveLength(1);
    const { unmount: unmountOffline } = render(<>{offlineModel.tabs[0].render()}</>);
    expect(screen.getByText('Disponibles hors ligne')).toBeTruthy();
    unmountOffline();

    // 2) Tiroir trail -> JoinStartCard (K4.03/S3.12) + téléchargement itinéraire (N02)
    useExplorerStore.setState({
      sheet: 'trail',
      detent: 'mid',
      tab: 0,
      selection: { kind: 'trail', id: '101' },
      trailRoute: SAMPLE_ROUTE,
    });
    const trailModel = buildSheetModel(makeSheetContext());
    const { unmount: unmountTrail } = render(<>{trailModel.tabs[0].render()}</>);
    expect(screen.getByText('Hors ligne · Itinéraire')).toBeTruthy();
    expect(screen.getByText(/Télécharger l’itinéraire/)).toBeTruthy();
    expect(screen.getByText('Plans (Apple)')).toBeTruthy();
    unmountTrail();

    // 3) Tiroir live -> TurnByTurn + ClimbDescentCard + UpcomingWaypoints + bouton Réglages -> liveSettings
    useExplorerStore.setState({
      sheet: 'live',
      detent: 'mid',
      tab: 0,
      trailRoute: SAMPLE_ROUTE,
      activity: {
        sport: 'rando',
        sessionId: null,
        startedAt: Date.now(),
        clientSessionId: 'sess-ui-1',
        paused: false,
        autoPaused: false,
        offRoute: false,
        distanceM: 500,
        elevGainM: 40,
        movingS: 300,
        route: SAMPLE_ROUTE,
        splits: [],
        mileSplits: [],
        laps: [],
      },
    });
    const liveModel = buildSheetModel(makeSheetContext());
    const { unmount: unmountLive } = render(
      <>
        {liveModel.actions}
        {liveModel.tabs[0].render()}
      </>,
    );
    const settingsBtn = screen.getByRole('button', { name: 'Réglages guidage et sortie' });
    fireEvent.click(settingsBtn);
    expect(useExplorerStore.getState().sheet).toBe('liveSettings');
    expect(screen.getByText('Refuge du Lac')).toBeTruthy();
    unmountLive();

    // 4) Sous-drawer liveSettings -> 4 onglets (Audio, Carte, Champs, Parcours & verrou) + retour vers live
    const settingsModel = buildSheetModel(makeSheetContext());
    expect(settingsModel.tabs.map((t) => t.id)).toEqual([
      'audio',
      'orientation',
      'champs',
      'parcours-verrou',
    ]);
    settingsModel.onBack?.();
    expect(useExplorerStore.getState().sheet).toBe('live');
  });

  it('K4.03 : JoinStartCard et tiroir trail affichent accessPlan en ligne et repli boussole hors ligne', () => {
    const evalAway = evaluateDepartureState([6.86, 45.91], SAMPLE_GEOJSON);
    const routedPlan: AccessGuidancePlan = {
      status: 'routed_online',
      targetKind: 'origin',
      targetPosition: [6.869, 45.923],
      entryAlongTrackM: 0,
      directDistanceM: 1600,
      directBearingDeg: 32,
      routedGeometry: [
        [6.86, 45.91],
        [6.869, 45.923],
      ],
      routedDistanceM: 1850,
      routedDurationS: 1200,
      provider: 'geoapify',
      reason: null,
    };
    const offlinePlan: AccessGuidancePlan = {
      status: 'offline_compass_only',
      targetKind: 'nearest_point',
      targetPosition: [6.872, 45.926],
      entryAlongTrackM: 450,
      directDistanceM: 950,
      directBearingDeg: 45,
      routedGeometry: null,
      routedDistanceM: null,
      routedDurationS: null,
      provider: null,
      reason: 'Aucun réseau : utilisez le cap boussole pour rejoindre le tracé.',
    };

    const { rerender, unmount } = render(
      <JoinStartCard evaluation={evalAway} accessPlan={routedPlan} />,
    );
    expect(screen.getByText(/Approche vers le départ/)).toBeTruthy();
    expect(screen.getByText(/20 min/)).toBeTruthy();
    expect(screen.getByText(/via geoapify/)).toBeTruthy();

    rerender(<JoinStartCard evaluation={evalAway} accessPlan={offlinePlan} />);
    const accessBox = within(screen.getByLabelText('Itinéraire d’approche'));
    expect(accessBox.getByText(/Cap vers le tracé/)).toBeTruthy();
    expect(accessBox.getByText(/950 m/)).toBeTruthy();
    expect(accessBox.getByText(/cap nord-est/)).toBeTruthy();
    expect(accessBox.getByText(/Aucun réseau : utilisez le cap boussole/)).toBeTruthy();
    unmount();

    // Vérifie le passage effectif depuis SheetContent (tiroir trail)
    useExplorerStore.setState({
      sheet: 'trail',
      detent: 'mid',
      tab: 0,
      selection: { kind: 'trail', id: '101' },
      trailRoute: SAMPLE_ROUTE,
    });
    const baseCtx = makeSheetContext();
    const trailModel = buildSheetModel(
      makeSheetContext({
        guidance: {
          ...baseCtx.guidance!,
          state: {
            ...baseCtx.guidance!.state,
            accessPlan: routedPlan,
          },
        },
      }),
    );
    const { unmount: unmountSheet } = render(<>{trailModel.tabs[0].render()}</>);
    expect(screen.getByText(/Approche vers le départ/)).toBeTruthy();
    unmountSheet();
  });

  it('K4.08 : LiveDirectTab et WaypointAlertBanner affichent puis effacent l’alerte visuelle waypoint', () => {
    const sampleAlert: WaypointAlertEvent = {
      id: 'wp-alert-1',
      waypointId: 'poi-refuge',
      waypointName: 'Refuge du Lac',
      waypointKind: 'refuge',
      stage: 'approach',
      distanceRemainingM: 120,
      title: 'Refuge du Lac à 120 m',
      spokenMessage: 'Dans 120 mètres, Refuge du Lac.',
      triggeredAtMs: Date.now(),
      hapticPattern: 'waypoint-approach',
    };

    const { rerender, unmount } = render(<WaypointAlertBanner alert={sampleAlert} units="metric" />);
    expect(screen.getByText('Refuge du Lac à 120 m')).toBeTruthy();
    expect(screen.getByText('À proximité')).toBeTruthy();
    rerender(<WaypointAlertBanner alert={null} units="metric" />);
    expect(screen.queryByText('Refuge du Lac à 120 m')).toBeNull();
    unmount();

    useExplorerStore.setState({
      sheet: 'live',
      detent: 'mid',
      tab: 0,
      trailRoute: SAMPLE_ROUTE,
      activity: {
        sport: 'rando',
        sessionId: null,
        startedAt: Date.now(),
        clientSessionId: 'sess-ui-k408',
        paused: false,
        autoPaused: false,
        offRoute: false,
        distanceM: 500,
        elevGainM: 40,
        movingS: 300,
        route: SAMPLE_ROUTE,
        splits: [],
        mileSplits: [],
        laps: [],
      },
    });
    const baseCtx = makeSheetContext();
    const withAlertModel = buildSheetModel(
      makeSheetContext({
        guidance: {
          ...baseCtx.guidance!,
          state: {
            ...baseCtx.guidance!.state,
            activeWaypointAlert: sampleAlert,
          },
        },
      }),
    );
    const { rerender: rerenderSheet, unmount: unmountSheet } = render(
      <>{withAlertModel.tabs[0].render()}</>,
    );
    expect(screen.getByText('Refuge du Lac à 120 m')).toBeTruthy();

    const clearedModel = buildSheetModel(baseCtx);
    rerenderSheet(<>{clearedModel.tabs[0].render()}</>);
    expect(screen.queryByText('Refuge du Lac à 120 m')).toBeNull();
    unmountSheet();
  });
});
