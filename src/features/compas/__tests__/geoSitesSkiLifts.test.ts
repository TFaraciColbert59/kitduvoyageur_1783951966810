import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Ski (plan 3.5) : les gares de remontée NOMMÉES du référentiel `geo_sites` sont proposées autour des
 * étapes d'un voyage de ski (raquettes comprises : l'intention les range sous `ski`), comme un point
 * « Gare de remontée » de plus. Interrupteur éteint, zone non couverte, autre activité : les points
 * d'avant, exactement.
 *
 * Données simulées (coordonnées et noms d'essai, pas des relevés OSM).
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

const BASE = { lat: 45.45, lon: 6.95 };
const RESTO: RoutePoi = {
  id: 1,
  name: 'Restaurant',
  category: 'resto',
  lat: 45.4502,
  lon: 6.9502,
  distanceM: 30,
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
const SKI_SITES = [
  site('n5001', 'aerialway_station', 'Télécabine des Granges', 45.452, 6.952, 1650),
  site('n5002', 'aerialway_station', 'Gare du Sommet', 45.47, 6.97, null),
  // Un domaine skiable : pas un point « gare de remontée ».
  site('w5003', 'winter_sports', 'Domaine des Granges', 45.451, 6.951, null),
  // Une gare loin des étapes.
  site('n5004', 'aerialway_station', 'Gare Lointaine', 45.9, 7.5, null),
];

beforeEach(() => {
  vi.clearAllMocks();
  h.sitesOn = true;
  h.sitesCovered = true;
  h.sites = SKI_SITES;
  h.cachedPois = [RESTO];
});

describe('ski : les gares de remontée du référentiel autour des étapes', () => {
  it('ski : les gares proches sont ajoutées, avec leur nom, altitude absente laissée absente', async () => {
    const { pois } = await lookupStagePois([BASE], { activity: 'ski' });
    const lifts = pois.filter((p) => p.category === 'aerialway_station');
    expect(lifts.map((p) => p.name).sort()).toEqual(['Gare du Sommet', 'Télécabine des Granges']);
    expect(lifts.find((p) => p.id === 5001)!.elevationM).toBe(1650);
    expect(lifts.find((p) => p.id === 5002)!.elevationM).toBeNull();
    expect(pois.some((p) => p.name === 'Domaine des Granges')).toBe(false);
    expect(pois.some((p) => p.name === 'Gare Lointaine')).toBe(false);
    expect(pois).toContainEqual(RESTO);
    expect(ROUTE_POI_LABEL.aerialway_station).toBe('Gare de remontée');
    expect(
      vi
        .mocked(referentialSitesAround)
        .mock.calls.every((c) => JSON.stringify(c[2]) === '["aerialway_station"]')
    ).toBe(true);
  });

  it('zone non couverte : les points d’avant, exactement', async () => {
    h.sitesCovered = false;
    const { pois } = await lookupStagePois([BASE], { activity: 'ski' });
    expect(pois).toEqual([RESTO]);
  });

  it('interrupteur éteint : aucun appel au référentiel', async () => {
    h.sitesOn = false;
    const { pois } = await lookupStagePois([BASE], { activity: 'ski' });
    expect(pois).toEqual([RESTO]);
    expect(vi.mocked(referentialSitesAround)).not.toHaveBeenCalled();
  });

  it('randonnée : aucun appel ; escalade : via ferrata seulement, jamais de gare', async () => {
    const { pois } = await lookupStagePois([BASE], { activity: 'hiking' });
    expect(pois).toEqual([RESTO]);
    expect(vi.mocked(referentialSitesAround)).not.toHaveBeenCalled();
    const climb = await lookupStagePois([BASE], { activity: 'climbing' });
    expect(climb.pois.some((p) => p.category === 'aerialway_station')).toBe(false);
    expect(
      vi
        .mocked(referentialSitesAround)
        .mock.calls.every((c) => JSON.stringify(c[2]) === '["via_ferrata"]')
    ).toBe(true);
  });

  it('l’écran (compasStagePoisAction) lit l’activité du voyage : gares pour un voyage de ski', async () => {
    const TRIP = '55555555-5555-4555-8555-555555555555';
    h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
    h.db.rows('trips').push({ id: TRIP, user_id: 'u1', primary_activity: 'ski', metadata: {} });
    h.db.rows('trip_steps').push({
      id: 's1',
      trip_id: TRIP,
      day_number: 1,
      latitude: BASE.lat,
      longitude: BASE.lon,
    });
    const res = await compasStagePoisAction({ tripId: TRIP });
    expect(res.success).toBe(true);
    const pois = res.success ? res.pois : [];
    expect(
      pois.some((p) => p.category === 'aerialway_station' && p.name === 'Télécabine des Granges')
    ).toBe(true);
  });
});
