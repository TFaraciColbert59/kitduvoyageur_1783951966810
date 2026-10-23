import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN-100 3.5 (b) : « 6 jours dans les Dolomites via ferrata ». Les via ferrata du référentiel
 * `geo_sites` sont proposées autour des étapes (`sitesAround`, nature `via_ferrata`), comme un point
 * « Via ferrata » de plus. Interrupteur éteint, zone non couverte, autre activité : les points d'avant,
 * exactement. Les points déjà connus viennent du cache partagé (aucun appel au réseau).
 *
 * Données simulées (coordonnées approchées autour de Canazei, noms pour l'essai).
 */
const h = vi.hoisted(() => ({
  sitesOn: true,
  sitesCovered: true,
  sites: [] as Array<{
    osm_id: string;
    kind: string;
    name: string;
    lat: number;
    lon: number;
    ele_m: number | null;
  }>,
  /** Points du cache partagé pour chaque lieu d'étape. */
  cachedPois: [] as unknown[],
  db: null as unknown as MemorySupabase,
}));

vi.mock('server-only', () => ({}));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  cached: vi.fn(async () => null),
  readShared: vi.fn(async () => h.cachedPois),
  writeShared: vi.fn(async () => undefined),
}));
vi.mock('../server/geoSites', async () => {
  const { sitesAround } = await import('../engine/geoSites');
  return {
    geoSitesEnabled: vi.fn(() => h.sitesOn),
    GEO_SITES_MAX_RADIUS_M: 20_000,
    referentialSitesAround: vi.fn(
      async (point: { lat: number; lon: number }, radiusM: number, kinds?: readonly string[]) =>
        h.sitesOn && h.sitesCovered
          ? sitesAround(h.sites as never, point, Math.min(radiusM, 20_000) / 1000, kinds as never)
          : null
    ),
  };
});
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/observability/appErrors', () => ({
  reportServerError: vi.fn(async () => undefined),
}));

import { lookupStagePois } from '../server/stagePoiLookup';
import { compasStagePoisAction } from '../server/poiActions';
import { referentialSitesAround } from '../server/geoSites';
import { ROUTE_POI_LABEL, type RoutePoi } from '../engine/routePois';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const CANAZEI = { lat: 46.476, lon: 11.77 };
const CAMPITELLO = { lat: 46.475, lon: 11.74 };
const RESTO: RoutePoi = {
  id: 1,
  name: 'Ristorante',
  category: 'resto',
  lat: 46.4762,
  lon: 11.7705,
  distanceM: 40,
  elevationM: null,
};
const site = (
  osm: string,
  kind: string,
  name: string,
  lat: number,
  lon: number,
  ele: number | null
) => ({ osm_id: osm, kind, name, lat, lon, ele_m: ele });
const DOLOMITES_SITES = [
  site('w4001', 'via_ferrata', 'Via ferrata delle Trincee', 46.47, 11.85, 2600),
  site('w4002', 'via_ferrata', 'Via ferrata Col dei Rossi', 46.48, 11.79, null),
  // Une falaise : pas une via ferrata, jamais rangée comme telle.
  site('n4003', 'crag', 'Sass Pordoi crag', 46.49, 11.81, null),
  // Une via ferrata du Brenta, loin des étapes.
  site('w4004', 'via_ferrata', 'Via delle Bocchette', 46.17, 10.9, null),
];

beforeEach(() => {
  vi.clearAllMocks();
  h.sitesOn = true;
  h.sitesCovered = true;
  h.sites = DOLOMITES_SITES;
  h.cachedPois = [RESTO];
});

describe('Dolomites via ferrata : les via ferrata du référentiel autour des étapes', () => {
  it('escalade : les via ferrata proches sont ajoutées, avec leur nom, une seule fois, altitude absente laissée absente', async () => {
    const { pois } = await lookupStagePois([CANAZEI, CAMPITELLO], { activity: 'climbing' });
    const vf = pois.filter((p) => p.category === 'via_ferrata');
    expect(vf.map((p) => p.name).sort()).toEqual([
      'Via ferrata Col dei Rossi',
      'Via ferrata delle Trincee',
    ]);
    expect(vf.map((p) => p.id).sort()).toEqual([4001, 4002]);
    const rossi = vf.find((p) => p.id === 4002)!;
    expect(rossi.elevationM).toBeNull();
    expect(vf.find((p) => p.id === 4001)!.elevationM).toBe(2600);
    // Distance au lieu d'étape le plus proche (Canazei → Col dei Rossi ≈ 1,7 km).
    expect(rossi.distanceM).toBeGreaterThan(1000);
    expect(rossi.distanceM).toBeLessThan(2500);
    // La falaise n'est pas un point « via ferrata », et les points d'avant restent.
    expect(pois.some((p) => p.name === 'Sass Pordoi crag')).toBe(false);
    expect(pois).toContainEqual(RESTO);
    expect(ROUTE_POI_LABEL.via_ferrata).toBe('Via ferrata');
    expect(
      vi
        .mocked(referentialSitesAround)
        .mock.calls.every((c) => JSON.stringify(c[2]) === '["via_ferrata"]')
    ).toBe(true);
  });

  it('zone non couverte : les points d’avant, exactement', async () => {
    h.sitesCovered = false;
    const { pois } = await lookupStagePois([CANAZEI, CAMPITELLO], { activity: 'climbing' });
    expect(pois).toEqual([RESTO]);
  });

  it('interrupteur éteint : aucun appel au référentiel', async () => {
    h.sitesOn = false;
    const { pois } = await lookupStagePois([CANAZEI, CAMPITELLO], { activity: 'climbing' });
    expect(pois).toEqual([RESTO]);
    expect(vi.mocked(referentialSitesAround)).not.toHaveBeenCalled();
  });

  it('autre activité ou activité inconnue : aucun appel, les points d’avant', async () => {
    for (const opts of [{ activity: 'hiking' }, undefined]) {
      const { pois } = await lookupStagePois([CANAZEI], opts);
      expect(pois).toEqual([RESTO]);
    }
    expect(vi.mocked(referentialSitesAround)).not.toHaveBeenCalled();
  });

  it('l’écran (compasStagePoisAction) lit l’activité du voyage : via ferrata pour un voyage d’escalade', async () => {
    const TRIP = '66666666-6666-4666-8666-666666666666';
    h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
    h.db
      .rows('trips')
      .push({ id: TRIP, user_id: 'u1', primary_activity: 'climbing', metadata: {} });
    h.db
      .rows('trip_steps')
      .push({
        id: 's1',
        trip_id: TRIP,
        day_number: 1,
        latitude: CANAZEI.lat,
        longitude: CANAZEI.lon,
      });
    const res = await compasStagePoisAction({ tripId: TRIP });
    expect(res.success).toBe(true);
    const pois = res.success ? res.pois : [];
    expect(
      pois.some((p) => p.category === 'via_ferrata' && p.name === 'Via ferrata Col dei Rossi')
    ).toBe(true);
  });
});
