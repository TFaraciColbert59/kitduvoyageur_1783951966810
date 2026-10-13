import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Répulsif du kit préparé (PLAN-100 4.8), de bout en bout sur `compasAutofillAction` : le point le plus BAS des
 * étapes décide, pas le plus haut. Un trek tropical dont un seul lieu atteint 2 500 m garde son répulsif ; un
 * séjour tout entier en altitude (Cusco) n'en a pas. Frontières simulées : base en mémoire, relief, normales.
 */
const h = vi.hoisted(() => ({ db: null as unknown as MemorySupabase, altitudes: [] as Array<number | null> }));

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
}));
vi.mock('@/lib/geo/terrainElevation', async (orig) => ({
  ...(await orig<typeof import('@/lib/geo/terrainElevation')>()),
  terrainElevations: vi.fn((points: unknown[]) => Promise.resolve(points.map((_, i) => h.altitudes[i] ?? null))),
}));
vi.mock('@/features/adventure-prep/routingService', async (orig) => ({
  ...(await orig<typeof import('@/features/adventure-prep/routingService')>()),
  routeAttempt: vi.fn(async () => ({ legs: null, reason: 'provider_unavailable' })),
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
vi.mock('../server/weather', async (orig) => ({
  ...(await orig<typeof import('../server/weather')>()),
  getClimateNormals: vi.fn(async () => null),
}));
vi.mock('@/lib/ai/askAI', () => ({
  aiEnabled: () => false,
  askAI: vi.fn(async () => ({ text: '{}', model: 'x', degraded: true, cached: false, provider: 'fallback' })),
}));

import { compasAutofillAction } from '../server/autofillActions';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const TRIP = '55555555-5555-4555-8555-555555555555';
const launch = () => compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'all' });
const items = () => h.db.rows('trip_items').map((r) => String(r.item_name));

beforeEach(() => {
  vi.clearAllMocks();
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
  // Quatre jours de trek à Cusco (13,5° S), sans étape détaillée : une étape par jour sur le lieu.
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: 'Trek · Cusco',
    start_date: '2026-11-10',
    end_date: '2026-11-13',
    destination_name: 'Cusco',
    destination_country_code: 'PE',
    party_size: 2,
    budget_currency: 'EUR',
    primary_activity: 'trekking',
    estimated_budget: null,
    metadata: { compas: { anchor: { name: 'Cusco', lat: -13.53, lon: -71.97, countryCode: 'PE', country: 'Pérou', kind: 'city' } } },
    updated_at: '2026-10-09T09:00:00.000000+00:00',
  });
});

describe('répulsif du kit préparé : l’étape la plus basse décide', () => {
  it('toutes les étapes à 3 400 m : pas de répulsif', async () => {
    h.altitudes = [3400, 3400, 3400, 3400];
    expect((await launch()).success).toBe(true);
    expect(items().some((n) => /r[ée]pulsif/i.test(n))).toBe(false);
  });

  it('une étape descend à 190 m (forêt de Puerto Maldonado) : répulsif, malgré le haut col', async () => {
    h.altitudes = [3400, 4300, 2040, 190];
    expect((await launch()).success).toBe(true);
    expect(items().some((n) => /r[ée]pulsif/i.test(n))).toBe(true);
  });
});
