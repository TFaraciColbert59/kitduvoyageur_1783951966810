// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Parcours réel du composant : ExplorerV2 avec un itinéraire sélectionné,
 * le hook GPS réel et le vrai moteur hors-trace. On vérifie la bannière et la
 * valeur `offRouteM` (distance à la trace), pas la distance parcourue.
 */

const mapProbe = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));

/**
 * Double de la réponse `explorer_routes` (géométrie simplifiée d'affichage) et
 * de `get_route_geojson` (géométrie réelle). Les deux peuvent diverger : c'est
 * précisément ce que le hors-trace doit distinguer.
 */
const routeProbe = vi.hoisted(() => ({
  display: null as unknown,
  full: null as unknown,
  geometryStatus: 200,
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
    data: {
      place: null,
      pois: [],
      routes: [routeProbe.display ?? ROUTE],
      window: { dLat: 0, dLng: 0 },
    },
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

/** Point situé exactement sur la trace réelle de test (45,9209 N). */
function onRoute(t: number, speedMs = 1): GpsFix {
  return {
    t,
    lat: 45.9209,
    lng: LNG0,
    ele: 1200,
    acc: 5,
    speed: speedMs,
  };
}

async function mount(
  expectedStatus: 'ready' | 'unavailable' = 'ready',
): Promise<void> {
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
  await waitFor(() =>
    expect(useExplorerStore.getState().activity?.route?.status).toBe(expectedStatus),
  );
}

beforeEach(() => {
  window.localStorage.removeItem(AUTO_PAUSE_STORAGE_KEY);
  mapProbe.props = null;
  routeProbe.display = null;
  routeProbe.full = null;
  routeProbe.geometryStatus = 200;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/geometry')) {
        if (routeProbe.geometryStatus !== 200) {
          return new Response('{}', { status: routeProbe.geometryStatus });
        }
        return new Response(
          JSON.stringify({ geojson: routeProbe.full ?? ROUTE.geojson }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      return new Response('{}', { status: 404 });
    }),
  );
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
    trailRoute: undefined,
    center: [LNG0, LAT0],
    zoom: 11,
    toast: undefined,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it('mesure sur la géométrie réelle, pas sur la trace simplifiée d’affichage', async () => {
    // La version d'affichage est décalée de ~550 m ; la version complète passe
    // exactement sous les pas. Une mesure sur l'affichage déclencherait une
    // fausse alerte, ce que la fiche interdit.
    routeProbe.display = {
      ...ROUTE,
      geojson: {
        type: 'LineString',
        coordinates: [
          [6.86, 45.9259],
          [6.88, 45.9259],
        ],
      },
    };
    await mount();

    push(onRoute(0));
    push(onRoute(5_000));
    push(onRoute(10_000));
    push(onRoute(20_000));

    const activity = useExplorerStore.getState().activity;
    expect(activity?.offRoute).toBe(false);
    expect(activity?.offRouteM).toBeLessThan(1);
    expect(screen.queryByRole('button', { name: /Hors itinéraire/ })).toBeNull();

    // La carte doit dessiner la même géométrie que celle mesurée : la version
    // d'affichage est décalée de 550 m, donc incohérente avec l'alerte à 40 m.
    await waitFor(() => {
      const drawn = (
        mapProbe.props?.routes as
          | Array<{ id: number; geojson: unknown }>
          | undefined
      )?.find((route) => route.id === 1);
      expect(drawn?.geojson).toEqual(ROUTE.geojson);
    });
  });

  it('oriente la flèche de retour vers le point le plus proche de la trace', async () => {
    await mount();

    // 111 m au nord d'une trace est-ouest : le retour se fait vers le sud.
    const north = (t: number): GpsFix => ({
      ...onRoute(t),
      lat: 45.9219,
    });
    push(north(0));
    push(north(5_000));
    push(north(20_000));

    const activity = useExplorerStore.getState().activity;
    expect(activity?.offRoute).toBe(true);
    expect(activity?.offRouteBearing ?? 0).toBeCloseTo(180, 0);

    const banner = screen.getByRole('button', { name: /Hors itinéraire/ });
    expect(banner.getAttribute('aria-label')).toContain('sud');
    const arrow = banner.querySelector('.xp-offroute__arrow') as HTMLElement | null;
    expect(arrow).not.toBeNull();
    expect(arrow?.getAttribute('data-bearing')).toBe('180');
    expect(arrow?.style.transform).toContain('rotate(180');
  });

  it('tourne la flèche selon la rotation réelle de la carte', async () => {
    await mount();

    const north = (t: number): GpsFix => ({
      ...onRoute(t),
      lat: 45.9219,
    });
    push(north(0));
    push(north(5_000));
    push(north(20_000));

    const banner = screen.getByRole('button', { name: /Hors itinéraire/ });
    const arrow = banner.querySelector('.xp-offroute__arrow') as HTMLElement | null;
    const onBearingChange = mapProbe.props?.onBearingChange as
      | ((bearing: number) => void)
      | undefined;
    expect(typeof onBearingChange).toBe('function');
    expect(arrow?.getAttribute('data-screen-bearing')).toBe('180');

    // La carte tourne de 90° : le retour vers le sud doit être dessiné à 90°
    // à l'écran, et non rester au cap monde de 180°.
    act(() => onBearingChange?.(90));
    expect(arrow?.style.transform).toContain('rotate(90');
    expect(arrow?.getAttribute('data-screen-bearing')).toBe('90');
    // Le libellé accessible reste géographique, indépendant de la rotation.
    expect(banner.getAttribute('aria-label')).toContain('sud');

    // Carte à 180° : le sud est en haut de l'écran.
    act(() => onBearingChange?.(180));
    expect(arrow?.style.transform).toContain('rotate(0');
    expect(arrow?.getAttribute('data-screen-bearing')).toBe('0');

    // Carte à 270° : le sud apparaît à 270°.
    act(() => onBearingChange?.(270));
    expect(arrow?.style.transform).toContain('rotate(270');
    expect(arrow?.getAttribute('data-screen-bearing')).toBe('270');
  });

  it('coupe l’alerte quand la géométrie devient indisponible', async () => {
    await mount();

    const north = (t: number): GpsFix => ({
      ...onRoute(t),
      lat: 45.9219,
    });
    push(north(0));
    push(north(5_000));
    push(north(20_000));
    expect(useExplorerStore.getState().activity?.offRoute).toBe(true);

    act(() => {
      useExplorerStore.getState().setRouteGeometry(
        { id: '1', name: 'Trace de test', geojson: null, status: 'unavailable' },
        { force: true },
      );
    });

    await waitFor(() => {
      const current = useExplorerStore.getState().activity;
      expect(current?.offRoute).toBe(false);
      expect(current?.offRouteM).toBeUndefined();
      expect(current?.offRouteBearing).toBeUndefined();
    });
    expect(useExplorerStore.getState().toast).toBeUndefined();
    expect(screen.queryByRole('button', { name: /Hors itinéraire/ })).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: /Hors-trace indisponible/ }),
      ).toBeTruthy(),
    );
  });

  it('termine le chargement de la séance même après clearSelection', async () => {
    let resolveRequest: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input).includes('/geometry')) return pending;
        return Promise.resolve(new Response('{}', { status: 404 }));
      }),
    );

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
    await waitFor(() =>
      expect(useExplorerStore.getState().activity?.route?.status).toBe('loading'),
    );
    expect(
      screen.getByRole('status', { name: 'Hors-trace en préparation' }),
    ).toBeTruthy();

    // La sélection d'écran disparaît pendant la requête. La copie figée de la
    // séance doit continuer son chargement, sinon elle reste `loading` à vie.
    act(() => useExplorerStore.getState().clearSelection());
    expect(useExplorerStore.getState().activity?.route?.status).toBe('loading');

    await act(async () => {
      resolveRequest(
        new Response(JSON.stringify({ geojson: ROUTE.geojson }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      await pending;
    });
    await waitFor(() =>
      expect(useExplorerStore.getState().activity?.route?.status).toBe('ready'),
    );
  });

  it('propose de réessayer une géométrie indisponible', async () => {
    routeProbe.geometryStatus = 503;
    await mount('unavailable');

    const retry = screen.getByRole('button', { name: 'Réessayer' });
    routeProbe.geometryStatus = 200;
    await act(async () => {
      fireEvent.click(retry);
    });

    await waitFor(() =>
      expect(useExplorerStore.getState().activity?.route?.status).toBe('ready'),
    );
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('affiche un état indisponible quand la géométrie réelle manque', async () => {
    routeProbe.display = { ...ROUTE, geojson: null };
    routeProbe.geometryStatus = 404;
    await mount('unavailable');

    // Des fixes très loin de la trace ne doivent produire ni alerte ni valeur
    // trompeuse : le hors-trace est explicitement désactivé.
    push(at(0, 5_000));
    push(at(5_000, 5_100));
    push(at(20_000, 5_200));

    const activity = useExplorerStore.getState().activity;
    expect(activity?.offRoute).toBe(false);
    expect(activity?.offRouteM).toBeUndefined();
    expect(
      screen.getByRole('status', { name: /Hors-trace indisponible/ }),
    ).toBeTruthy();
  });

  it('garde la trace d’affichage quand la géométrie réelle manque', async () => {
    // La mesure hors-trace est coupée (pas de géométrie réelle), mais le
    // parcours reste lisible sur la carte : l'utilisateur ne perd pas son
    // itinéraire, il perd seulement l'alerte automatique.
    routeProbe.geometryStatus = 404;
    await mount('unavailable');

    await waitFor(() => {
      const drawn = (
        mapProbe.props?.routes as
          | Array<{ id: number; geojson: unknown }>
          | undefined
      )?.find((route) => route.id === 1);
      expect(drawn?.geojson).toEqual(ROUTE.geojson);
    });
    expect(
      screen.getByRole('status', { name: /Hors-trace indisponible/ }),
    ).toBeTruthy();
  });

  it('ne confond pas une route de démonstration avec un identifiant homonyme', async () => {
    // Même si la base possède un tracé d'id 1, la route affichée est une route
    // de secours sans géométrie : on ne doit pas lui substituer ce tracé.
    routeProbe.display = { ...ROUTE, geojson: null, unavailable: true };
    routeProbe.full = ROUTE.geojson;
    await mount('unavailable');

    const fetchMock = globalThis.fetch as unknown as {
      mock: { calls: Array<[RequestInfo | URL, ...unknown[]]> };
    };
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/geometry')),
    ).toBe(false);
    const state = screen.getByRole('status', { name: /Hors-trace indisponible/ });
    expect(state.textContent).toContain('démonstration');
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });
});
