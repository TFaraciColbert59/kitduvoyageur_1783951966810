// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Bout en bout du tracé : ExplorerV2 réel, hook GPS réel, `MapStage` remplacé
 * par un espion qui conserve la prop `activityTrack`. On vérifie le GeoJSON
 * réellement remis à la carte, pas seulement les métriques du tracker.
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
vi.mock('@/features/explorer-v2/activity/offRoute', () => ({
  bearingLabel: () => null,
  offRouteLabel: () => '',
  evaluateOffRoute: () => ({ offRoute: false, distanceM: 0, outSinceS: 0 }),
}));
vi.mock('@/features/explorer-v2/ui/XpIcon', () => ({ XpIcon: () => null }));
vi.mock('@/features/explorer-v2/state/haptics', () => ({
  haptic: () => undefined,
}));
vi.mock('@/features/explorer-v2/data/hooks', () => ({
  geometryCenter: () => null,
  useCountriesGeo: () => ({ data: null, status: 'success', error: null }),
  useCountryDetails: () => ({ data: null }),
  useOnline: () => true,
  usePlace: () => ({ data: null }),
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
    kayak: { label: 'Kayak' },
  },
}));

import ExplorerV2 from '@/features/explorer-v2/ExplorerV2';
import type { GpsFix } from '@/features/explorer-v2/activity/tracker';
import {
  AUTO_PAUSE_STORAGE_KEY,
  useExplorerStore,
} from '@/features/explorer-v2/state/store';
import type { Sport } from '@/features/explorer-v2/state/types';

const LAT0 = 45.92;
const LNG0 = 6.87;
const M_PER_DEG_LAT = 111320;

function latFor(distanceM: number): number {
  return LAT0 + distanceM / M_PER_DEG_LAT;
}

function at(t: number, distanceM: number, speedMs: number, receivedAt?: number): GpsFix {
  return {
    t,
    lat: latFor(distanceM),
    lng: LNG0,
    ele: 1200,
    acc: 5,
    speed: speedMs,
    ...(receivedAt === undefined ? {} : { receivedAt }),
  };
}

function push(fix: GpsFix): void {
  const target = window as Window & { __xpPushFix?: (next: GpsFix) => void };
  act(() => target.__xpPushFix?.(fix));
}

interface TrackFeature {
  geometry: { coordinates: number[][] };
}

interface TrackCollection {
  features: TrackFeature[];
}

function track(): TrackCollection | null {
  const value = mapProbe.props?.activityTrack;
  return value ? (value as TrackCollection) : null;
}

function coordinates(): number[][][] {
  return track()?.features.map((feature) => feature.geometry.coordinates) ?? [];
}

async function mount(sport: Sport = 'course'): Promise<void> {
  useExplorerStore.getState().startActivity(sport);
  render(<ExplorerV2 />);
  await waitFor(() => {
    const target = window as Window & { __xpPushFix?: unknown };
    expect(typeof target.__xpPushFix).toBe('function');
  });
  await waitFor(() => {
    expect(mapProbe.props).not.toBeNull();
  });
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
    center: [LNG0, LAT0],
    zoom: 11,
  });
});

afterEach(cleanup);

describe('explorer-v2 · tracé de bout en bout', () => {
  it('coupe la ligne après un trou GPS supérieur à maxFixGapS', async () => {
    await mount('course');
    push(at(0, 0, 1));
    push(at(5_000, 5, 1));
    push(at(70_000, 1_005, 1));
    push(at(71_000, 1_010, 1));

    await waitFor(() => expect(coordinates()).toHaveLength(2));
    const [before, after] = coordinates();
    expect(before).toHaveLength(2);
    expect(after).toHaveLength(2);
    // Le trou n'est jamais relié : le second segment commence à la nouvelle
    // borne, pas au dernier point d'avant la coupure.
    expect(after?.[0]?.[1]).toBeCloseTo(latFor(1_005), 6);
    expect(after?.[1]?.[1]).toBeCloseTo(latFor(1_010), 6);

    const activity = useExplorerStore.getState().activity;
    expect(activity?.distanceM).toBeCloseTo(10, 1);
  });

  it('ne dessine ni ne recentre un fix rejeté non monotone', async () => {
    await mount('course');
    push(at(10_000, 0, 1));
    push(at(15_000, 10, 1));
    await waitFor(() => expect(coordinates()).toHaveLength(1));

    const before = coordinates()[0];
    const centerBefore = useExplorerStore.getState().center;
    push(at(12_000, 60, 1));

    expect(useExplorerStore.getState().center).toEqual(centerBefore);
    expect(coordinates()[0]).toEqual(before);

    push(at(16_000, 15, 1));
    await waitFor(() => expect(coordinates()[0]).toHaveLength(3));
    expect(coordinates()[0]).toEqual([...(before ?? []), [LNG0, latFor(15)]]);
  });

  it('sépare les segments autour d’une pause automatique et ignore la dérive', async () => {
    await mount('course');
    push(at(0, 0, 1));
    push(at(5_000, 5, 1));
    push(at(10_000, 10, 1));
    for (let t = 15; t <= 40; t += 5) push(at(t * 1000, 10, 0));

    await waitFor(() =>
      expect(useExplorerStore.getState().activity?.autoPaused).toBe(true),
    );
    await waitFor(() => expect(coordinates()).toHaveLength(1));

    const centerDuringPause = useExplorerStore.getState().center;
    push(at(45_000, 11, 0));
    push(at(50_000, 12, 0));
    expect(useExplorerStore.getState().center).toEqual(centerDuringPause);

    // Reprise : le premier point valide ouvre un second segment.
    push(at(55_000, 71, 1));
    push(at(60_000, 76, 1));
    await waitFor(() => expect(coordinates()).toHaveLength(2));

    const [before, after] = coordinates();
    // Les fixes stationnaires 15..25 s sont encore dessinés avant que la
    // temporisation de 20 s ne déclenche la pause au fix de 30 s.
    expect(before).toHaveLength(6);
    expect(before?.[0]?.[1]).toBeCloseTo(latFor(0), 6);
    expect(before?.[before.length - 1]?.[1]).toBeCloseTo(latFor(10), 6);
    expect(after).toHaveLength(2);
    expect(after?.[0]?.[1]).toBeCloseTo(latFor(71), 6);
    expect(after?.[1]?.[1]).toBeCloseTo(latFor(76), 6);
    // La dérive de 11/12 m pendant la pause n'est jamais dessinée.
    expect(after?.some(([, lat]) => Math.abs(lat - latFor(11)) < 1e-9)).toBe(false);
    expect(after?.some(([, lat]) => Math.abs(lat - latFor(12)) < 1e-9)).toBe(false);
  });

  it('sépare le tracé après une pause manuelle et ignore les fixes tardifs', async () => {
    await mount('course');
    push(at(0, 0, 1));
    push(at(5_000, 5, 1));
    await waitFor(() => expect(coordinates()).toHaveLength(1));

    const centerBeforePause = useExplorerStore.getState().center;
    act(() => useExplorerStore.getState().updateActivity({ paused: true }));
    push(at(10_000, 100, 1));
    expect(useExplorerStore.getState().center).toEqual(centerBeforePause);
    expect(coordinates()).toHaveLength(1);

    act(() =>
      useExplorerStore.getState().updateActivity({ paused: false, autoPaused: false }),
    );
    push(at(20_000, 200, 1));
    push(at(25_000, 205, 1));
    await waitFor(() => expect(coordinates()).toHaveLength(2));

    const [before, after] = coordinates();
    expect(before).toHaveLength(2);
    expect(after).toHaveLength(2);
    expect(after?.[0]?.[1]).toBeCloseTo(latFor(200), 6);
    expect(after?.[1]?.[1]).toBeCloseTo(latFor(205), 6);
    expect(after?.some(([, lat]) => Math.abs(lat - latFor(100)) < 1e-9)).toBe(false);
  });

  it('garde une durée mesurée quand l’horloge murale saute', async () => {
    await mount('rando');
    push(at(0, 0, 1, 0));
    push(at(5_000, 5, 1, 1_000));
    push(at(35_000, 10, 1, 2_000));

    const activity = useExplorerStore.getState().activity;
    expect(activity?.autoPaused).toBe(false);
    expect(activity?.distanceM).toBeCloseTo(10, 1);
    // 5 s mesurées sur le premier intervalle, puis 1 s après correction du
    // saut d'horloge (5 m à 1 m/s, pas 30 s).
    expect(activity?.movingS).toBeCloseTo(6, 5);
  });

  it('ignore un fix de précision insuffisante et reprend sur une nouvelle borne', async () => {
    await mount('rando');
    push(at(0, 0, 1));
    push(at(5_000, 5, 1));
    await waitFor(() => expect(coordinates()).toHaveLength(1));

    const before = coordinates()[0];
    const centerBefore = useExplorerStore.getState().center;
    push({ ...at(10_000, 10, 1), acc: 120 });
    expect(useExplorerStore.getState().center).toEqual(centerBefore);
    expect(coordinates()[0]).toEqual(before);

    // Le premier fix valide suivant ouvre un segment, sans compter l'intervalle
    // non prouvé ; le point suivant le rend visible.
    push(at(11_000, 15, 1));
    push(at(12_000, 20, 1));
    await waitFor(() => expect(coordinates()).toHaveLength(2));
    const after = coordinates()[1];
    expect(after).toHaveLength(2);
    expect(after?.[0]?.[1]).toBeCloseTo(latFor(15), 6);
    expect(after?.[1]?.[1]).toBeCloseTo(latFor(20), 6);
    expect(useExplorerStore.getState().activity?.distanceM).toBeCloseTo(10, 1);
  });

  it('ne dessine pas un saut de 500 m en 30 s et reprend sur une nouvelle borne', async () => {
    await mount('rando');
    push(at(0, 0, 1));
    push(at(5_000, 5, 1));
    await waitFor(() => expect(coordinates()).toHaveLength(1));

    const before = coordinates()[0];
    const centerBefore = useExplorerStore.getState().center;
    push(at(35_000, 505, 1));
    expect(useExplorerStore.getState().center).toEqual(centerBefore);
    expect(coordinates()[0]).toEqual(before);

    // Le premier fix suivant le rejet ouvre un segment, sans compter le saut.
    // Un segment d'un seul point n'est pas encore rendu : le second point le
    // révèle.
    push(at(36_000, 510, 1));
    expect(coordinates()).toHaveLength(1);
    push(at(37_000, 515, 1));
    await waitFor(() => expect(coordinates()).toHaveLength(2));
    const after = coordinates()[1];
    expect(after).toHaveLength(2);
    expect(after?.[0]?.[1]).toBeCloseTo(latFor(510), 6);
    expect(after?.[1]?.[1]).toBeCloseTo(latFor(515), 6);
    const activity = useExplorerStore.getState().activity;
    expect(activity?.distanceM).toBeCloseTo(10, 1);
  });
});
