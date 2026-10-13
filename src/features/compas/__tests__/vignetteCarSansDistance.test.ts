import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Vignette (Autriche) d'un road trip dont le routage est en panne : les étapes en voiture n'ont aucune
 * `distance_km` (aucun kilomètre mesuré, donc ni carburant ni location chiffrés), mais la voiture roule — les
 * étapes en voiture le prouvent. La vignette est un forfait par voiture, indépendant des kilomètres : elle doit
 * être chiffrée. Bout en bout sur `compasAutofillAction` (client Supabase en mémoire, frontières simulées).
 */
const h = vi.hoisted(() => ({ db: null as unknown as MemorySupabase }));

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
  // Routage en panne : aucune distance mesurée.
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
vi.mock('../server/rates', async (orig) => ({
  ...(await orig<typeof import('../server/rates')>()),
  getEurRate: vi.fn(async () => null),
}));
vi.mock('@/lib/ai/askAI', () => ({
  aiEnabled: () => false,
  askAI: vi.fn(async () => ({ text: '{}', model: 'x', degraded: true, cached: false, provider: 'fallback' })),
}));

import { compasAutofillAction } from '../server/autofillActions';
import { carDrives } from '../engine/tolls';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const TRIP = '66666666-6666-4666-8666-666666666666';
const launch = () => compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'all' });
const expenses = () => h.db.rows('trip_expenses').map((r) => String(r.title ?? r.description ?? ''));

function seed(modes: Array<string | null>) {
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: 'Road trip · Autriche',
    start_date: '2026-11-10',
    end_date: '2026-11-12',
    destination_name: 'Autriche',
    destination_country_code: 'AT',
    party_size: 2,
    budget_currency: 'EUR',
    primary_activity: 'roadtrip',
    estimated_budget: null,
    metadata: { compas: { anchor: { name: 'Autriche', lat: 47.5, lon: 14.1, countryCode: 'AT', country: 'Autriche', kind: 'country' } } },
    updated_at: '2026-10-09T09:00:00.000000+00:00',
  });
  // Trois étapes déjà en place : les déplacements en voiture, sans aucune distance (routage en panne).
  [
    ['Salzbourg', 47.8, 13.04],
    ['Innsbruck', 47.26, 11.39],
    ['Vienne', 48.21, 16.37],
  ].forEach(([name, lat, lon], i) =>
    h.db.rows('trip_steps').push({
      id: `s${i}`,
      trip_id: TRIP,
      day_number: i + 1,
      order_index: 0,
      title: `Jour ${i + 1} · ${name}`,
      latitude: lat,
      longitude: lon,
      distance_km: null,
      transport_mode: modes[i],
      source: 'user',
      metadata: {},
    })
  );
}

beforeEach(() => vi.clearAllMocks());

describe('carDrives : une voiture roule dès qu’une étape l’est, kilomètres mesurés ou non', () => {
  it('trajet d’approche, kilomètres mesurés, ou étapes en voiture : oui ; rien de tout cela : non', () => {
    expect(carDrives({ approach: true, measuredKm: 0, carLegs: 0 })).toBe(true);
    expect(carDrives({ approach: false, measuredKm: 120, carLegs: 0 })).toBe(true);
    expect(carDrives({ approach: false, measuredKm: 0, carLegs: 2 })).toBe(true);
    expect(carDrives({ approach: false, measuredKm: 0, carLegs: 0 })).toBe(false);
  });
});

describe('vignette d’un road trip sans distance mesurée', () => {
  it('étapes en voiture sans distance (routage en panne) : la vignette autrichienne est chiffrée', async () => {
    seed(['car', 'car', 'car']);
    const res = await launch();
    expect(res.success).toBe(true);
    expect(expenses().some((t) => /^Vignette/.test(t))).toBe(true);
    // Aucun kilomètre inventé : ni carburant ni distance chiffrés.
    expect(expenses().some((t) => /Carburant sur place/.test(t))).toBe(false);
  });

  it('sans aucune étape en voiture (à pied) : pas de vignette', async () => {
    seed(['foot', 'foot', 'foot']);
    h.db.rows('trips')[0].primary_activity = 'hiking';
    const res = await launch();
    expect(res.success).toBe(true);
    expect(expenses().some((t) => /^Vignette/.test(t))).toBe(false);
  });
});
