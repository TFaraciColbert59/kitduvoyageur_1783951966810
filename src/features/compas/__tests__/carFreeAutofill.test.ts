import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * « Sans voiture » (PLAN-100 4.4), de bout en bout sur `compasAutofillAction` (client Supabase
 * en mémoire, services tiers simulés) : le trajet d'approche, le budget et les notes suivent la
 * préférence rangée sur le voyage ; sans elle, rien ne change.
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  asked: [] as string[],
  /** Route mesurée en voiture, ou null (service injoignable). */
  road: null as null | { km: number; minutes: number },
  /** Points lus autour des étapes (cache partagé). */
  pois: { pois: [] as unknown[], complete: false },
}));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async () => null),
  lookupLoose: vi.fn(async () => null),
  lookupNatural: vi.fn(async () => null),
  lookupMassif: vi.fn(async () => null),
  lookupReverse: vi.fn(async () => null),
  lookupRiver: vi.fn(async () => null),
  stageCandidates: vi.fn(async () => []),
  pathCandidates: vi.fn(async () => []),
  stageAliasCandidates: vi.fn(async () => []),
}));
vi.mock('../server/stagePoiLookup', () => ({
  lookupAreaPlaces: vi.fn(async () => null),
  lookupRiverLine: vi.fn(async () => null),
  lookupStagePois: vi.fn(async () => null),
  readCachedStagePois: vi.fn(async () => h.pois),
}));
vi.mock('@/lib/geo/terrainElevation', async (orig) => ({
  ...(await orig<typeof import('@/lib/geo/terrainElevation')>()),
  terrainElevations: vi.fn((points: unknown[]) => Promise.resolve(points.map(() => null))),
}));
vi.mock('@/features/adventure-prep/routingService', async (orig) => ({
  ...(await orig<typeof import('@/features/adventure-prep/routingService')>()),
  routeAttempt: vi.fn(async () =>
    h.road
      ? { legs: [{ distanceKm: h.road.km, durationMin: h.road.minutes, geometry: [[4.35, 50.85]] }], provider: 'geoapify' }
      : { legs: null, reason: 'provider_unavailable' }
  ),
}));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  readShared: vi.fn(async () => undefined),
  writeShared: vi.fn(async () => undefined),
}));
vi.mock('../server/elevation', () => ({
  routeAscentM: vi.fn(async () => null),
  pointsMaxAltitudeM: vi.fn(async () => null),
}));
// Normales NASA POWER du kit (plan 4.8) : simulées à la frontière, aucun appel réseau.
vi.mock('../server/weather', async (orig) => ({
  ...(await orig<typeof import('../server/weather')>()),
  getClimateNormals: vi.fn(async () => null),
}));
vi.mock('@/lib/ai/askAI', () => ({
  aiEnabled: () => true,
  askAI: vi.fn(async (req: { system?: string; prompt?: string; messages?: unknown }) => {
    h.asked.push(JSON.stringify(req));
    return { text: '{}', model: 'x', degraded: false, cached: false, provider: 'fallback' };
  }),
}));

import { compasAutofillAction } from '../server/autofillActions';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const TRIP = '55555555-5555-4555-8555-555555555555';
const launch = () => compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'all' });

const LYON = { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR', source: 'dit' };
const GRENOBLE = { name: 'Grenoble', lat: 45.19, lon: 5.72, countryCode: 'FR', country: 'France', kind: 'city' };
const BRUXELLES = { name: 'Bruxelles', lat: 50.85, lon: 4.35, countryCode: 'BE', country: 'Belgique', kind: 'city' };

/** Un séjour en ville depuis Lyon, pour deux personnes. */
function trip(over: { anchor: typeof GRENOBLE; end: string; carFree?: boolean }) {
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: `Séjour · ${over.anchor.name}`,
    start_date: '2026-11-10',
    end_date: over.end,
    destination_name: over.anchor.name,
    destination_country_code: over.anchor.countryCode,
    party_size: 2,
    budget_currency: 'EUR',
    primary_activity: 'citytrip',
    estimated_budget: null,
    metadata: {
      compas: {
        anchor: over.anchor,
        origin: LYON,
        ...(over.carFree ? { prefs: { pace: 'normal', nights: null, avoid: [], wishes: [], carFree: true } } : {}),
      },
    },
    updated_at: '2026-10-09T09:00:00.000000+00:00',
  });
}
const titles = () => h.db.rows('trip_expenses').map((e) => String(e.title));
const notesOf = (res: Awaited<ReturnType<typeof launch>>) => (res.success && 'summary' in res ? res.summary.notes : []);
const transportOf = (res: Awaited<ReturnType<typeof launch>>) => (res.success && 'summary' in res ? res.summary.transport : null);

beforeEach(() => {
  vi.clearAllMocks();
  h.asked = [];
  h.road = null;
  h.pois = { pois: [], complete: false };
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
});

describe('Lyon → Grenoble (moins de 150 km)', () => {
  it('avec la voiture : le carburant est compté', async () => {
    trip({ anchor: GRENOBLE, end: '2026-11-12' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(titles().some((t) => t.startsWith('Carburant aller-retour'))).toBe(true);
    expect(notesOf(res).some((n) => n.startsWith('Sans voiture'))).toBe(false);
  });

  it('sans voiture : ni carburant ni location, le trajet non chiffré est dit, transports en commun non évalués', async () => {
    trip({ anchor: GRENOBLE, end: '2026-11-12', carFree: true });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(titles().some((t) => /Carburant|Location de voiture/.test(t))).toBe(false);
    expect(transportOf(res)).toBeNull();
    const notes = notesOf(res);
    expect(notes.some((n) => n.startsWith('Sans voiture : le trajet d’approche') && /pas chiffré/.test(n))).toBe(true);
    expect(notes.some((n) => /^Transports en commun non évalués/.test(n))).toBe(true);
    // Rien d'inventé : aucune note ne parle de train ou de bus qui existerait.
    expect(notes.join(' ')).not.toMatch(/Transports en commun : /);
    // L'IA est prévenue de ne pas conseiller de voiture.
    expect(h.asked.length).toBeGreaterThan(0);
    expect(JSON.parse(h.asked[0]).prompt).toMatch(/sans voiture/);
  });

  it('une gare lue autour des étapes : « transports en commun » se dit, avec son nom', async () => {
    h.pois = { pois: [{ id: 1, name: 'Gare de Grenoble', category: 'transport', lat: 45.19, lon: 5.71, distanceM: 350, elevationM: null }], complete: true };
    trip({ anchor: GRENOBLE, end: '2026-11-12', carFree: true });
    const notes = notesOf(await launch());
    expect(notes.some((n) => n.startsWith('Transports en commun : Gare de Grenoble'))).toBe(true);
    expect(notes.some((n) => /^Transports en commun non évalués/.test(n))).toBe(false);
  });
});

describe('Lyon → Bruxelles en 6 jours, 680 km de route mesurés', () => {
  it('avec la voiture : la route', async () => {
    h.road = { km: 680, minutes: 430 };
    trip({ anchor: BRUXELLES, end: '2026-11-15' });
    const res = await launch();
    expect(transportOf(res)).toMatchObject({ mode: 'voiture', departure: 'Lyon' });
    expect(titles().some((t) => t.startsWith('Carburant aller-retour'))).toBe(true);
  });

  it('sans voiture : le train au barème, jamais de carburant', async () => {
    h.road = { km: 680, minutes: 430 };
    trip({ anchor: BRUXELLES, end: '2026-11-15', carFree: true });
    const res = await launch();
    expect(transportOf(res)).toMatchObject({ mode: 'train', departure: 'Lyon' });
    expect(titles().some((t) => t.startsWith('Train aller-retour × 2'))).toBe(true);
    expect(titles().some((t) => /Carburant|Location de voiture/.test(t))).toBe(false);
    const line = h.db.rows('trip_expenses').find((e) => String(e.title).startsWith('Train aller-retour'));
    expect((line?.metadata as { basis?: string }).basis).toMatch(/estimation/);
  });
});
