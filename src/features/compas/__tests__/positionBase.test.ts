import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN-100 2.10, de bout en bout sur `compasAutofillAction` (client Supabase en mémoire,
 * services tiers simulés) : la position de l'appareil n'est jamais écrite au mètre sur le
 * voyage, et la base d'un séjour sans lieu dit est la COMMUNE (son nom et son centre sur la
 * carte), pas le point GPS.
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  reverse: null as unknown,
  commune: null as unknown,
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
  lookupReverse: vi.fn(async () => h.reverse),
  lookupCommune: vi.fn(async () => h.commune),
  lookupRiver: vi.fn(async () => null),
  stageCandidates: vi.fn(async () => []),
  stageAliasCandidates: vi.fn(async () => []),
}));
vi.mock('../server/stagePoiLookup', () => ({
  lookupAreaPlaces: vi.fn(async () => null),
  lookupRiverLine: vi.fn(async () => null),
  lookupStagePois: vi.fn(async () => null),
  readCachedStagePois: vi.fn(async () => ({ pois: [], complete: false })),
}));
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
  askAI: vi.fn(async () => ({ text: '{}', model: 'x', degraded: false, cached: false, provider: 'fallback' })),
}));

import { compasAutofillAction } from '../server/autofillActions';
import { lookupCommune, lookupReverse } from '../server/placeLookup';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const TRIP = '55555555-5555-4555-8555-555555555555';

/** Une sortie d'un jour, sans lieu dit ni départ dit : seule la position partagée situe l'aventure. */
function outing() {
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: 'Sortie',
    start_date: '2026-11-10',
    end_date: '2026-11-10',
    destination_name: null,
    destination_country_code: null,
    party_size: 1,
    budget_currency: 'EUR',
    primary_activity: 'hiking',
    estimated_budget: null,
    metadata: {},
    updated_at: '2026-10-09T09:00:00.000000+00:00',
  });
}

/** Le point exact que l'appareil donne : jamais écrit ni envoyé tel quel. */
const EXACT = { lat: 45.923712, lon: 6.869349 };

/** Tout ce que le voyage range (voyage + étapes), sérialisé : ni le point exact ni sa forme arrondie à 4 décimales n'y sont. */
function stored(): string {
  return JSON.stringify({ trips: h.db.rows('trips'), steps: h.db.rows('trip_steps') });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
  h.reverse = null;
  h.commune = null;
});

describe('séjour sans lieu dit : la base est la commune, pas le point GPS (plan 2.10)', () => {
  it('l’étape de chaque jour porte le nom et le centre de la commune ; le point (exact ou arrondi) n’est écrit nulle part', async () => {
    outing();
    // La carte répond par le bâtiment le plus proche (un chantier), dont la commune est Chamonix.
    h.reverse = {
      name: 'Chantier Hôtel de Ville',
      lat: 45.92371,
      lon: 6.86936,
      countryCode: 'FR',
      country: 'France',
      kind: 'building',
      settlement: false,
      extent: null,
      locality: 'Chamonix-Mont-Blanc',
    };
    h.commune = {
      name: 'Chamonix-Mont-Blanc',
      lat: 45.9237,
      lon: 6.8694,
      countryCode: 'FR',
      country: 'France',
      kind: 'town',
      settlement: true,
      extent: null,
    };
    const res = await compasAutofillAction({ tripId: TRIP, tripSlug: 'sortie', from: EXACT, phase: 'all' });
    expect(res.success).toBe(true);

    // La carte n'a reçu que le point arrondi à 0,01° (~1 km).
    expect(lookupReverse).toHaveBeenCalledWith(45.92, 6.87);
    expect(lookupCommune).toHaveBeenCalledTimes(1);
    expect((lookupCommune as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1]).toEqual({ lat: 45.92, lon: 6.87 });

    const steps = h.db.rows('trip_steps');
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) {
      // Le centre de la commune, tel que la carte le donne : pas le point arrondi (45.92 ; 6.87).
      expect(Number(s.latitude)).toBeCloseTo(45.9237, 4);
      expect(Number(s.longitude)).toBeCloseTo(6.8694, 4);
      expect(String(s.title ?? s.name ?? '')).not.toBe('');
    }
    // Aucune trace du point exact sur le voyage.
    expect(stored()).not.toContain('45.923712');
    expect(stored()).not.toContain('6.869349');
    // Ni le bâtiment que la carte a nommé.
    expect(stored()).not.toContain('Chantier');
  });

  it('aucune commune sur la carte : la base garde le point arrondi à ~1 km (jamais plus fin), nommé « Autour de toi »', async () => {
    outing();
    h.reverse = null;
    h.commune = null;
    const res = await compasAutofillAction({ tripId: TRIP, tripSlug: 'sortie', from: EXACT, phase: 'all' });
    expect(res.success).toBe(true);
    const steps = h.db.rows('trip_steps');
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) {
      expect(Number(s.latitude)).toBe(45.92);
      expect(Number(s.longitude)).toBe(6.87);
    }
    expect(stored()).not.toContain('45.923712');
    expect(stored()).not.toContain('6.869349');
  });
});
