import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN-100 3.5 (a), de bout en bout sur `compasAutofillAction` : « escalade à Kalymnos ». Sans le
 * référentiel des sites, la base est choisie près du centre de l'île ; avec lui (interrupteur
 * `COMPAS_GEO_SITES` allumé, zone couverte), elle est posée au lieu habité de la carte le plus proche
 * de la grappe de falaises la plus dense (`densestSite`, 2 km). Zone non couverte, interrupteur éteint,
 * autre activité : exactement l'itinéraire d'avant.
 *
 * Données simulées (coordonnées approchées de Kalymnos, noms de secteurs pour l'essai) : le moteur ne
 * contient aucun lieu, il lit ce que la carte et le référentiel rendent.
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
  countryCode: 'GR',
  country: 'Grèce',
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

const TRIP = '77777777-7777-4777-8777-777777777777';
const launch = () =>
  compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'all' });

// Kalymnos : environ 14 km de demi-diagonale d'emprise, rangée comme une île par la carte.
const KALYMNOS = {
  name: 'Kalymnos',
  lat: 36.98,
  lon: 26.98,
  countryCode: 'GR',
  country: 'Grèce',
  kind: 'island',
  osmTag: 'place=island',
  extent: [26.85, 37.08, 27.08, 36.9],
};

function trip(activity: string) {
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: 'Séjour · Kalymnos',
    start_date: '2026-11-10',
    end_date: '2026-11-12',
    destination_name: 'Kalymnos',
    destination_country_code: 'GR',
    party_size: 2,
    budget_currency: 'EUR',
    primary_activity: activity,
    estimated_budget: null,
    metadata: { compas: { anchor: KALYMNOS } },
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
  countryCode: 'GR',
});
const KALYMNOS_PLACES = [
  village('1', 'Pothia', 36.95, 26.985, 'town', 10_000),
  village('2', 'Vathýs', 36.975, 27.025),
  village('3', 'Masouri', 36.995, 26.945),
  village('4', 'Myrties', 36.984, 26.94),
  village('5', 'Panormos', 36.965, 26.955),
  // Le village isolé du nord, loin des deux grappes.
  village('6', 'Palionisos', 37.03, 27.02, 'village', 100),
];
const crag = (id: string, name: string, lat: number, lon: number, ele: number | null = null) => ({
  osm_id: `n${id}`,
  kind: 'crag',
  name,
  lat,
  lon,
  ele_m: ele,
});
const KALYMNOS_SITES = [
  // Grappe des falaises au-dessus de Masouri : six secteurs à moins de 2 km les uns des autres.
  crag('101', 'Grande Grotta', 36.9985, 26.948, 120),
  crag('102', 'Odyssey', 37.0005, 26.945),
  crag('103', 'Spartacus', 36.999, 26.9505),
  crag('104', 'Afternoon', 36.996, 26.95),
  crag('105', 'Poets', 37.001, 26.9485),
  crag('106', 'Ghost Kitchen', 37.002, 26.946),
  // Seconde grappe, plus petite, au nord-ouest.
  crag('201', 'Arginonta Valley', 37.02, 26.935),
  crag('202', 'Galatiani', 37.022, 26.937),
  crag('203', 'Kastri', 37.019, 26.938),
  // Un secteur seul près de Vathýs.
  crag('301', 'Vathy Sector', 36.977, 27.03),
];

beforeEach(() => {
  vi.clearAllMocks();
  h.ai = false;
  h.stages = null;
  h.places = KALYMNOS_PLACES;
  h.mapDown = false;
  h.contour = null;
  h.contourAsks = 0;
  h.stageAsks = 0;
  h.sitesOn = true;
  h.sitesCovered = true;
  h.sites = KALYMNOS_SITES;
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
});

/** L'itinéraire calculé SANS le référentiel (interrupteur éteint) : la référence du comportement actuel. */
async function baseline(activity = 'climbing') {
  h.sitesOn = false;
  trip(activity);
  const res = await launch();
  const out = { titles: titles(), notes: notesOf(res) };
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
  h.sitesOn = true;
  vi.clearAllMocks();
  return out;
}

describe('escalade à Kalymnos : la base au cœur des falaises (référentiel geo_sites)', () => {
  it('sans référentiel, la base n’est pas Masouri (le défaut à corriger)', async () => {
    const before = await baseline();
    expect(before.titles).toHaveLength(3);
    expect(before.titles).not.toContain('Masouri');
  });

  it('zone couverte : la base est le lieu habité au pied de la grappe la plus dense (Masouri), et la note le dit', async () => {
    trip('climbing');
    const res = await launch();
    expect(res.success).toBe(true);
    expect(titles()).toEqual(['Masouri', 'Masouri', 'Masouri']);
    expect(vi.mocked(referentialSitesAround)).toHaveBeenCalled();
    const notes = notesOf(res);
    expect(
      notes.some((n) => /Masouri/.test(n) && /6 sites d’escalade à moins de 2 km/.test(n))
    ).toBe(true);
  });

  it('zone non couverte (covered:false) : exactement l’itinéraire d’avant', async () => {
    const before = await baseline();
    h.sitesCovered = false;
    trip('climbing');
    const res = await launch();
    expect(titles()).toEqual(before.titles);
    expect(notesOf(res)).toEqual(before.notes);
    expect(vi.mocked(referentialSitesAround)).toHaveBeenCalled();
  });

  it('couverte mais sans aucun site d’escalade : itinéraire d’avant', async () => {
    const before = await baseline();
    h.sites = [];
    trip('climbing');
    const res = await launch();
    expect(titles()).toEqual(before.titles);
    expect(notesOf(res)).toEqual(before.notes);
  });

  it('interrupteur éteint : le référentiel n’est jamais appelé', async () => {
    h.sitesOn = false;
    trip('climbing');
    const res = await launch();
    expect(res.success).toBe(true);
    expect(vi.mocked(referentialSitesAround)).not.toHaveBeenCalled();
    expect(titles()).not.toContain('Masouri');
  });

  it('une autre activité (randonnée) : aucun appel, itinéraire d’avant', async () => {
    const before = await baseline('hiking');
    trip('hiking');
    const res = await launch();
    expect(vi.mocked(referentialSitesAround)).not.toHaveBeenCalled();
    expect(titles()).toEqual(before.titles);
    expect(notesOf(res)).toEqual(before.notes);
  });
});
