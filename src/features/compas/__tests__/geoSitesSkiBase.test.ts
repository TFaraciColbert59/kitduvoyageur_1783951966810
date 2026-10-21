import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Plan 3.5, ski (raquettes comprises : l'intention les range sous `ski`), de bout en bout sur
 * `compasAutofillAction`. Avec le référentiel des sites (interrupteur `COMPAS_GEO_SITES` allumé, zone
 * couverte), la base est le lieu habité de la carte le plus proche du domaine skiable le plus dense
 * (`densestSite` sur `winter_sports`, les gares de remontée nommées départageant une égalité). Une
 * gare de remontée n'est jamais un lieu de nuit, et des gares seules ne font pas une base. Zone non
 * couverte, interrupteur éteint, autre activité, lieu dit par la personne : l'itinéraire d'avant.
 *
 * Données simulées (coordonnées et noms d'essai) : le moteur ne contient aucun lieu, il lit ce que
 * la carte et le référentiel rendent.
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  ai: false,
  stages: null as unknown,
  places: [] as Array<Record<string, unknown>>,
  mapDown: false,
  contour: null as unknown,
  contourAsks: 0,
  stageAsks: 0,
  /** `COMPAS_GEO_SITES` simulé. */
  sitesOn: true,
  /** La zone est-elle importée dans le référentiel ? (`covered:false` → null) */
  sitesCovered: true,
  sites: [] as Array<{
    osm_id: string;
    kind: string;
    name: string;
    lat: number;
    lon: number;
    ele_m: number | null;
  }>,
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

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/observability/appErrors', () => ({
  reportServerError: vi.fn(async () => undefined),
}));

/** Lieux que la carte connaît par leur nom (étapes proposées par l'IA). */
const MAP: Record<string, { lat: number; lon: number }> = {};
const place = (name: string) => ({
  name,
  ...MAP[name],
  countryCode: 'FR',
  country: 'France',
  kind: 'city',
  settlement: true,
  settlementRank: 5,
  extent: null,
});
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async () => null),
  lookupLoose: vi.fn(async () => null),
  lookupNatural: vi.fn(async () => null),
  lookupMassif: vi.fn(async () => null),
  lookupReverse: vi.fn(async () => null),
  lookupRiver: vi.fn(async () => null),
  lookupIslandContour: vi.fn(async () => {
    h.contourAsks += 1;
    const { parseIslandContour: parse } = await import('../engine/islands');
    return h.contour ? parse(h.contour) : null;
  }),
  stageCandidates: vi.fn(async (name: string) => (MAP[name] ? [place(name)] : [])),
  stageAliasCandidates: vi.fn(async () => []),
}));
vi.mock('../server/stagePoiLookup', async () => {
  const { distanceKm } = await import('../engine/places');
  return {
    // La carte rend les lieux de la zone demandée (rayon autour du centre), comme le référentiel.
    lookupAreaPlaces: vi.fn(
      async (q: { center: { lat: number; lon: number }; radiusKm: number }) =>
        h.mapDown
          ? null
          : h.places.filter(
              (p) =>
                distanceKm(q.center, p as { lat: number; lon: number }) <=
                Math.min(q.radiusKm, 400) * 1.05
            )
    ),
    lookupRiverLine: vi.fn(async () => null),
    lookupStagePois: vi.fn(async () => null),
    readCachedStagePois: vi.fn(async () => ({ pois: [], complete: false })),
  };
});
vi.mock('@/lib/geo/terrainElevation', async (orig) => ({
  ...(await orig<typeof import('@/lib/geo/terrainElevation')>()),
  terrainElevations: vi.fn((points: unknown[]) => Promise.resolve(points.map(() => null))),
}));
vi.mock('@/features/adventure-prep/routingService', async (orig) => ({
  ...(await orig<typeof import('@/features/adventure-prep/routingService')>()),
  routeAttempt: vi.fn(async () => ({ legs: null, reason: 'provider_unavailable' })),
}));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) =>
    fn()
  ),
  readShared: vi.fn(async () => undefined),
  writeShared: vi.fn(async () => undefined),
}));
vi.mock('../server/elevation', () => ({
  routeAscentM: vi.fn(async () => null),
  pointsMaxAltitudeM: vi.fn(async () => null),
}));
vi.mock('../server/weather', async (orig) => ({
  ...(await orig<typeof import('../server/weather')>()),
  getClimateNormals: vi.fn(async () => null),
}));
vi.mock('../engine/itinerary', async (orig) => {
  const real = await orig<typeof import('../engine/itinerary')>();
  return { ...real, planItinerary: vi.fn(real.planItinerary) };
});
vi.mock('@/features/trips/engine/contextualKitEngine', async (orig) => {
  const real = await orig<typeof import('@/features/trips/engine/contextualKitEngine')>();
  return { ...real, generateTripContextualKit: vi.fn(real.generateTripContextualKit) };
});
vi.mock('@/lib/ai/askAI', () => ({
  aiEnabled: () => h.ai,
  askAI: vi.fn(async (req: { system?: string }) => {
    const { buildCompasStagesSystem } = await import('@/lib/ai/features/compasAutofill');
    if (req.system === buildCompasStagesSystem()) {
      h.stageAsks += 1;
      if (h.ai && h.stages)
        return {
          text: JSON.stringify(h.stages),
          model: 'x',
          degraded: false,
          cached: false,
          provider: 'nvidia',
        };
    }
    return { text: '{}', model: 'x', degraded: true, cached: false, provider: 'fallback' };
  }),
}));

import { compasAutofillAction } from '../server/autofillActions';
import { referentialSitesAround } from '../server/geoSites';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const TRIP = '88888888-8888-4888-8888-888888888888';
const launch = () =>
  compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'all' });

// Une vallée de montagne simulée (pas d'emprise : zone de 60 km autour du centre).
const VALLEE = {
  name: 'Haute vallée',
  lat: 45.5,
  lon: 6.85,
  countryCode: 'FR',
  country: 'France',
  kind: 'valley',
  extent: null,
};

function trip(activity: string, wishes?: string[]) {
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: 'Séjour · Haute vallée',
    start_date: '2027-02-10',
    end_date: '2027-02-12',
    destination_name: 'Haute vallée',
    destination_country_code: 'FR',
    party_size: 2,
    budget_currency: 'EUR',
    primary_activity: activity,
    estimated_budget: null,
    metadata: { compas: { anchor: VALLEE, ...(wishes ? { prefs: { wishes } } : {}) } },
    updated_at: '2026-10-09T09:00:00.000000+00:00',
  });
}
const steps = () =>
  [...h.db.rows('trip_steps')].sort((a, b) => Number(a.day_number) - Number(b.day_number));
const titles = () => steps().map((s) => String(s.title).replace(/^Jour \d+ · /, ''));
const notesOf = (res: Awaited<ReturnType<typeof launch>>) =>
  res.success && 'summary' in res ? res.summary.notes : [];

const village = (
  id: string,
  name: string,
  lat: number,
  lon: number,
  kind: 'town' | 'village' = 'village',
  population = 1000
) => ({
  id: `g${id}`,
  name,
  lat,
  lon,
  kind,
  population,
  eleM: null,
  countryCode: 'FR',
});
const PLACES = [
  village('1', 'Bourg-Centre', 45.5, 6.85, 'town', 8000),
  village('2', 'Villard', 45.505, 6.855),
  // Au pied de la grappe la plus dense (quatre domaines).
  village('3', 'Les Granges', 45.452, 6.952),
  village('4', 'Le Planay', 45.43, 6.92),
  // Au pied de la petite grappe (deux domaines).
  village('5', 'Col-Village', 45.582, 6.752),
  // Le village isolé, près d'un amas de gares seules.
  village('6', 'Isolé', 45.53, 6.99, 'village', 100),
];
const site = (osm: string, kind: string, name: string, lat: number, lon: number) => ({
  osm_id: osm,
  kind,
  name,
  lat,
  lon,
  ele_m: null,
});
const LIFTS_ALONE = [
  // Cinq gares nommées sans domaine skiable autour : jamais le cœur, jamais une étape.
  site('n301', 'aerialway_station', 'Gare Isolée Amont', 45.531, 6.991),
  site('n302', 'aerialway_station', 'Gare Isolée Aval', 45.532, 6.992),
  site('n303', 'aerialway_station', 'Gare Isolée Milieu', 45.533, 6.993),
  site('n304', 'aerialway_station', 'Gare Isolée Haut', 45.534, 6.994),
  site('n305', 'aerialway_station', 'Gare Isolée Bas', 45.535, 6.995),
];
const SKI_SITES = [
  // Grappe dense : quatre domaines à moins de 5 km les uns des autres, une télécabine.
  site('w101', 'winter_sports', 'Domaine des Granges', 45.45, 6.95),
  site('w102', 'winter_sports', 'Secteur de la Combe', 45.455, 6.96),
  site('w103', 'winter_sports', 'Secteur du Lac', 45.445, 6.945),
  site('w104', 'winter_sports', 'Secteur de la Crête', 45.46, 6.94),
  site('n111', 'aerialway_station', 'Télécabine des Granges', 45.451, 6.951),
  // Petite grappe au nord-ouest.
  site('w201', 'winter_sports', 'Domaine du Col', 45.58, 6.75),
  site('w202', 'winter_sports', 'Secteur Nord', 45.585, 6.755),
  ...LIFTS_ALONE,
];
const STATION_NAMES = SKI_SITES.filter((s) => s.kind === 'aerialway_station').map((s) => s.name);

beforeEach(() => {
  vi.clearAllMocks();
  h.ai = false;
  h.stages = null;
  h.places = PLACES;
  h.mapDown = false;
  h.contour = null;
  h.contourAsks = 0;
  h.stageAsks = 0;
  h.sitesOn = true;
  h.sitesCovered = true;
  h.sites = SKI_SITES;
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
});

/** L'itinéraire calculé SANS le référentiel (interrupteur éteint) : la référence du comportement actuel. */
async function baseline(activity = 'ski', wishes?: string[]) {
  h.sitesOn = false;
  trip(activity, wishes);
  const res = await launch();
  const out = { titles: titles(), notes: notesOf(res) };
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
  h.sitesOn = true;
  vi.clearAllMocks();
  return out;
}

describe('ski : la base au pied du domaine skiable le plus dense (référentiel geo_sites)', () => {
  it('sans référentiel, la base n’est pas Les Granges (le défaut à corriger)', async () => {
    const before = await baseline();
    expect(before.titles).toHaveLength(3);
    expect(before.titles).not.toContain('Les Granges');
  });

  it('zone couverte : la base est le village le plus proche de la grappe la plus dense, et la note le dit', async () => {
    trip('ski');
    const res = await launch();
    expect(res.success).toBe(true);
    expect(titles()).toEqual(['Les Granges', 'Les Granges', 'Les Granges']);
    expect(vi.mocked(referentialSitesAround)).toHaveBeenCalled();
    expect(
      vi
        .mocked(referentialSitesAround)
        .mock.calls.every((c) => JSON.stringify(c[2]) === '["winter_sports","aerialway_station"]')
    ).toBe(true);
    const notes = notesOf(res);
    expect(
      notes.some(
        (n) =>
          /Granges/.test(n) && /4 domaines skiables et 1 gare de remontée à moins de 5 km/.test(n)
      )
    ).toBe(true);
  });

  it('une gare de remontée n’est jamais une étape de nuit, et des gares seules ne font pas une base', async () => {
    trip('ski');
    await launch();
    for (const t of titles()) expect(STATION_NAMES).not.toContain(t);
    // Seulement des gares (aucun domaine skiable) : l'itinéraire d'avant.
    h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
    const before = await baseline();
    h.sites = LIFTS_ALONE;
    trip('ski');
    const res = await launch();
    expect(titles()).toEqual(before.titles);
    expect(notesOf(res)).toEqual(before.notes);
    for (const t of titles()) expect(STATION_NAMES).not.toContain(t);
  });

  it('zone non couverte (covered:false) : exactement l’itinéraire d’avant', async () => {
    const before = await baseline();
    h.sitesCovered = false;
    trip('ski');
    const res = await launch();
    expect(titles()).toEqual(before.titles);
    expect(notesOf(res)).toEqual(before.notes);
    expect(vi.mocked(referentialSitesAround)).toHaveBeenCalled();
  });

  it('aucun lieu habité au pied du domaine : itinéraire d’avant', async () => {
    h.places = PLACES.filter((p) => p.name !== 'Les Granges' && p.name !== 'Le Planay');
    const before = await baseline();
    trip('ski');
    const res = await launch();
    expect(titles()).toEqual(before.titles);
    expect(notesOf(res)).toEqual(before.notes);
  });

  it('interrupteur éteint : le référentiel n’est jamais appelé', async () => {
    h.sitesOn = false;
    trip('ski');
    const res = await launch();
    expect(res.success).toBe(true);
    expect(vi.mocked(referentialSitesAround)).not.toHaveBeenCalled();
    expect(titles()).not.toContain('Les Granges');
  });

  it('randonnée : aucun appel ; escalade : pas de logique ski (aucune nature de ski demandée)', async () => {
    const before = await baseline('hiking');
    trip('hiking');
    const res = await launch();
    expect(vi.mocked(referentialSitesAround)).not.toHaveBeenCalled();
    expect(titles()).toEqual(before.titles);
    expect(notesOf(res)).toEqual(before.notes);

    // Escalade dans la même vallée (aucune falaise au référentiel) : l'itinéraire d'avant.
    h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
    const climbBefore = await baseline('climbing');
    trip('climbing');
    const climb = await launch();
    expect(titles()).toEqual(climbBefore.titles);
    expect(notesOf(climb)).toEqual(climbBefore.notes);
    const asked = vi.mocked(referentialSitesAround).mock.calls.flatMap((c) => [...(c[2] ?? [])]);
    expect(asked).not.toContain('winter_sports');
    expect(asked).not.toContain('aerialway_station');
  });

  it('lieu dit par la personne : le référentiel n’est pas consulté pour la base', async () => {
    MAP.Villard = { lat: 45.505, lon: 6.855 };
    const before = await baseline('ski', ['Villard']);
    trip('ski', ['Villard']);
    const res = await launch();
    expect(titles()).toEqual(before.titles);
    expect(notesOf(res)).toEqual(before.notes);
    expect(vi.mocked(referentialSitesAround)).not.toHaveBeenCalled();
  });
});
