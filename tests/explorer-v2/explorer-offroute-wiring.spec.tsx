// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Parcours réel du composant : ExplorerV2 avec un itinéraire sélectionné,
 * le hook GPS réel et le vrai moteur hors-trace. On vérifie la bannière et la
 * valeur `offRouteM` (distance à la trace), pas la distance parcourue.
 */

const mapProbe = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));

vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    mapProbe.props = props;
    return null;
  },
}));
vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('@/features/explorer-v2/map/prefetchMapStage', () => ({}));
vi.mock('@/features/explorer-v2/sheet/ExplorerSheet', () => ({
  ExplorerSheet: () => null,
}));
vi.mock('@/features/explorer-v2/sheet/SheetContent', () => ({
  buildSheetModel: () => ({
    title: '',
    subtitle: '',
    tabs: [],
    actions: [],
    mini: 0,
    onBack: undefined,
    tabsBottom: false,
  }),
}));
vi.mock('@/features/explorer-v2/chrome/TopChrome', () => ({ TopChrome: () => null }));
vi.mock('@/features/explorer-v2/chrome/BottomBar', () => ({ ActivityPill: () => null }));
vi.mock('@/features/explorer-v2/chrome/SosButton', () => ({ SosButton: () => null }));
vi.mock('@/features/explorer-v2/activity/Countdown', () => ({
  Countdown: () => null,
  useLongPress: () => ({}),
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
vi.mock('@/features/explorer-v2/ui/XpIcon', () => ({ XpIcon: () => null }));
vi.mock('@/features/explorer-v2/state/haptics', () => ({
  haptic: () => undefined,
}));

const ROUTE = {
  id: 1,
  name: 'Trace de test',
  distance_km: 1.5,
  network: 'rwn',
  ref: 'PR',
  geojson: {
    type: 'LineString',
    coordinates: [
      [6.86, 45.9209],
      [6.88, 45.9209],
    ],
  },
};

vi.mock('@/features/explorer-v2/data/hooks', () => ({
  geometryCenter: () => null,
  useCountriesGeo: () => ({ data: null, status: 'success', error: null }),
  useCountryDetails: () => ({ data: null }),
  useOnline: () => true,
  usePlace: () => ({
    data: { place: null, pois: [], routes: [ROUTE], window: { dLat: 0, dLng: 0 } },
  }),
  useReducedMotion: () => false,
  useRegionsGeo: () => ({ data: null }),
  useSystemTheme: () => 'light',
  useWeather: () => ({ data: null }),
  useContent: () => ({ data: [] }),
  useReportsNear: () => ({ data: [] }),
}));
vi.mock('@/features/explorer-v2/sheet/context', () => ({
  distanceKm: () => 0,
  findCountryAt: () => null,
  findRegionAt: () => null,
  formatDistance: () => '0 km',
  formatDuration: () => '0:00',
  SPORT_META: {
    course: { label: 'Course' },
    rando: { label: 'Randonnée' },
  },
}));

import ExplorerV2 from '@/features/explorer-v2/ExplorerV2';
import type { GpsFix } from '@/features/explorer-v2/activity/tracker';
import {
  AUTO_PAUSE_STORAGE_KEY,
  useExplorerStore,
} from '@/features/explorer-v2/state/store';

const LAT0 = 45.92;
const LNG0 = 6.87;
const M_PER_DEG_LAT = 111320;

function at(t: number, distanceM: number, speedMs = 1): GpsFix {
  return {
    t,
    lat: LAT0,
    lng: LNG0 + distanceM / M_PER_DEG_LAT,
    ele: 1200,
    acc: 5,
    speed: speedMs,
  };
}

function push(fix: GpsFix): void {
  const target = window as Window & { __xpPushFix?: (next: GpsFix) => void };
  act(() => target.__xpPushFix?.(fix));
}

async function mount(): Promise<void> {
  useExplorerStore.setState({
    level: 3,
    geo: 'FR',
    placeId: 'chamonix',
    center: [LNG0, LAT0],
    zoom: 12,
    selection: { kind: 'trail', id: '1' },
  });
  useExplorerStore.getState().startActivity('course');
  render(<ExplorerV2 />);
  await waitFor(() => {
    const target = window as Window & { __xpPushFix?: unknown };
    expect(typeof target.__xpPushFix).toBe('function');
  });
  await waitFor(() => expect(mapProbe.props).not.toBeNull());
}

beforeEach(() => {
  window.localStorage.removeItem(AUTO_PAUSE_STORAGE_KEY);
  mapProbe.props = null;
  useExplorerStore.setState({
    activity: undefined,
    summary: undefined,
    summarySaved: undefined,
    autoPauseEnabled: true,
    locationPermission: 'granted',
    scene: undefined,
    sheet: 'level',
    detent: 'peek',
    camera: { type: 'none' },
    selection: undefined,
    center: [LNG0, LAT0],
    zoom: 11,
    toast: undefined,
  });
});

afterEach(cleanup);

describe('explorer-v2 · hors-trace branché sur le composant', () => {
  it('affiche la distance à la trace, pas la distance parcourue', async () => {
    await mount();

    push(at(0, 0));
    push(at(5_000, 50));
    push(at(10_000, 60));
    push(at(20_000, 80));

    const activity = useExplorerStore.getState().activity;
    expect(activity?.offRoute).toBe(true);
    expect(activity?.distanceM).toBeGreaterThan(50);
    // La trace est à ~100 m au nord : la distance à la trace n'est pas la
    // distance parcourue (~56 m).
    expect(activity?.offRouteM).toBeGreaterThan(90);
    expect(activity?.offRouteM).toBeLessThan(110);

    const banner = screen.getByRole('button', { name: /Hors itinéraire/ });
    expect(banner.textContent).toContain(`${Math.round(activity?.offRouteM ?? 0)} m`);
    expect(banner.textContent).not.toContain(`${Math.round(activity?.distanceM ?? 0)} m`);

    // Retour sous 25 m : la bannière disparaît et la distance à la trace suit.
    push({ t: 30_000, lat: 45.9209, lng: 6.87, ele: 1200, acc: 5, speed: 1 });
    expect(useExplorerStore.getState().activity?.offRoute).toBe(false);
    expect(screen.queryByRole('button', { name: /Hors itinéraire/ })).toBeNull();
  });
});
