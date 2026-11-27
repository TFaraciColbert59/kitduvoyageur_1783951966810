// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Montage réel d'ExplorerV2 (architecture 20/20 Apple Liquid Glass) avec ses
 * enfants WebGL neutralisés : vérifie l'hydratation du réglage S1.05, le rendu
 * du tiroir ExplorerGlassDrawer avec ses 5 catégories + bouton Sport ▶, et
 * l'invariant zéro fetch BFF en cran peek au démarrage à froid.
 */
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, profile: null }),
}));
vi.mock('@/features/explorer-v2/map/prefetchMapStage', () => ({}));
vi.mock('@/features/explorer-v2/activity/Countdown', () => ({
  Countdown: () => null,
  useLongPress: () => ({}),
}));
vi.mock('@/features/explorer-v2/activity/useGpsTracker', () => ({
  useGpsTracker: () => ({ markLap: () => undefined }),
}));
vi.mock('@/features/explorer-v2/native/liveActivity', () => ({
  startLiveActivity: async () => undefined,
  updateLiveActivity: async () => undefined,
  endLiveActivity: async () => undefined,
}));
vi.mock('@/features/explorer-v2/activity/sosCall', () => ({
  performSosCall: () => false,
  planSosCall: () => ({ number: '112' }),
  sosSimulated: () => true,
}));
vi.mock('@/features/explorer-v2/offline/queue', () => ({
  enqueue: async () => undefined,
  flushQueue: async () => ({ sent: 0 }),
  listQueue: async () => [],
}));
vi.mock('@/features/explorer-v2/offline/zone', () => ({
  registerOfflineWorker: async () => undefined,
}));
vi.mock('@/features/explorer-v2/activity/offRoute', () => ({
  bearingLabel: () => null,
  offRouteLabel: () => '',
  screenBearingDeg: () => null,
}));
vi.mock('@/features/explorer-v2/state/haptics', () => ({
  haptic: () => undefined,
}));

const hookSpy = vi.hoisted(() => ({
  usePlaceEnabled: [] as boolean[],
  useWeatherArgs: [] as Array<[number | null, number | null]>,
  useHazardsEnabled: [] as boolean[],
  usePokedexEnabled: [] as boolean[],
  useSocialEnabled: [] as boolean[],
  useEncyclopediaEnabled: [] as boolean[],
}));

vi.mock('@/features/explorer-v2/data/hooks', () => ({
  geometryCenter: () => null,
  useCountriesGeo: () => ({ data: null, status: 'success', error: null }),
  useCountryDetails: () => ({ data: null }),
  useOnline: () => true,
  usePlace: (_lat: number, _lng: number, _zoom: number, enabled = true) => {
    hookSpy.usePlaceEnabled.push(Boolean(enabled));
    return { data: null, isPending: false };
  },
  useReducedMotion: () => false,
  useRegionsGeo: () => ({ data: null }),
  useSystemTheme: () => 'light',
  useWeather: (lat: number | null, lng: number | null) => {
    hookSpy.useWeatherArgs.push([lat, lng]);
    return { data: null, isPending: false };
  },
  useContent: () => ({ data: [] }),
  useReportsNear: () => ({ data: [] }),
  useCommunityHeatmap: () => ({ data: null, isPending: false, isError: false }),
  usePersonalHeatmap: () => ({ data: null, isPending: false, isError: false, error: null }),
  useBikePois: () => ({ data: null, isPending: false }),
  useFireIncidents: () => ({ data: null, isPending: false }),
  useRouteSurfaces: () => ({ data: null, isPending: false }),
  useRouteHighlights: () => ({ data: null }),
}));
vi.mock('@/features/explorer-v2/data/unifiedLayersHooks', () => ({
  useExplorerHazards: (_bbox: unknown, opts?: { enabled?: boolean }) => {
    hookSpy.useHazardsEnabled.push(Boolean(opts?.enabled));
    return { data: null, isPending: false };
  },
  useRadarManifest: () => ({ data: null, isPending: false }),
  useAirspaceLive: () => ({ data: null, isPending: false }),
  usePokedexNear: (_pt: unknown, opts?: { enabled?: boolean }) => {
    hookSpy.usePokedexEnabled.push(Boolean(opts?.enabled));
    return { data: null, isPending: false };
  },
  useSocialMapLayers: (_bbox: unknown, _kinds: unknown, opts?: { enabled?: boolean }) => {
    hookSpy.useSocialEnabled.push(Boolean(opts?.enabled));
    return { data: null, isPending: false, refetch: async () => undefined };
  },
  useTerritorialEncyclopedia: (_params: unknown, opts?: { enabled?: boolean }) => {
    hookSpy.useEncyclopediaEnabled.push(Boolean(opts?.enabled));
    return { data: null, isPending: false };
  },
}));
vi.mock('@/features/explorer-v2/sheet/context', () => ({
  distanceKm: () => 0,
  findCountryAt: () => null,
  findRegionAt: () => null,
  formatDistance: () => '0 km',
  formatDuration: () => '0:00',
  SPORT_META: {},
}));

import ExplorerV2 from '@/features/explorer-v2/ExplorerV2';
import {
  AUTO_PAUSE_STORAGE_KEY,
  useExplorerStore,
} from '@/features/explorer-v2/state/store';

describe('explorer-v2 · montage 20/20 & hydratation', () => {
  beforeEach(() => {
    hookSpy.usePlaceEnabled = [];
    hookSpy.useWeatherArgs = [];
    hookSpy.useHazardsEnabled = [];
    hookSpy.usePokedexEnabled = [];
    hookSpy.useSocialEnabled = [];
    hookSpy.useEncyclopediaEnabled = [];

    window.localStorage.removeItem(AUTO_PAUSE_STORAGE_KEY);
    useExplorerStore.setState({
      activity: undefined,
      summary: undefined,
      summarySaved: undefined,
      autoPauseEnabled: useExplorerStore.getInitialState().autoPauseEnabled,
      locationPermission: 'denied',
      scene: undefined,
      sheet: 'level',
      detent: 'peek',
      mode: 'EXPLORE',
      camera: { type: 'none' },
      center: [6.87, 45.92],
      zoom: 11,
    });
  });

  afterEach(cleanup);

  it('applique la préférence stockée pendant le montage', async () => {
    window.localStorage.setItem(AUTO_PAUSE_STORAGE_KEY, '0');

    render(<ExplorerV2 />);

    await waitFor(() => {
      expect(useExplorerStore.getState().autoPauseEnabled).toBe(false);
    });
  });

  it('conserve le défaut ON quand aucune préférence n’est stockée', async () => {
    expect(useExplorerStore.getInitialState().autoPauseEnabled).toBe(true);

    render(<ExplorerV2 />);

    await waitFor(() => {
      expect(useExplorerStore.getState().autoPauseEnabled).toBe(true);
    });
  });

  it('monte ExplorerGlassDrawer (5 onglets + bouton Sport ▶) avec zéro appel BFF en peek à froid', () => {
    render(<ExplorerV2 />);

    const drawer = screen.getByTestId('xp20-glass-drawer');
    expect(drawer).toBeTruthy();
    expect(drawer.getAttribute('data-detent')).toBe('peek');

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThanOrEqual(5);

    const sportBtn = screen.getByTestId('xp20-sport-launch-btn');
    expect(sportBtn).toBeTruthy();

    // Cold-boot zero-fetch invariant
    expect(hookSpy.usePlaceEnabled.every((v) => v === false)).toBe(true);
    expect(hookSpy.useWeatherArgs.every(([lat, lng]) => lat === null && lng === null)).toBe(true);
    expect(hookSpy.useHazardsEnabled.every((v) => v === false)).toBe(true);
    expect(hookSpy.usePokedexEnabled.every((v) => v === false)).toBe(true);
    expect(hookSpy.useSocialEnabled.every((v) => v === false)).toBe(true);
    expect(hookSpy.useEncyclopediaEnabled.every((v) => v === false)).toBe(true);
  });
});
