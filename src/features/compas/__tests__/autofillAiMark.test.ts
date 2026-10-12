import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN-100 5.3 (lot Z2) : le moteur sait quelles étapes viennent de l'IA et le range avec
 * l'étape (`trip_steps.metadata.aiProposed`), de bout en bout sur `compasAutofillAction`
 * (client Supabase en mémoire, services tiers simulés, garde réseau actif).
 *
 *  - un pays entier : l'itinéraire de base est proposé par l'IA (lieux ensuite retrouvés sur la
 *    carte) → chaque étape écrite porte la marque, et `usedAi` le dit même si les conseils
 *    n'ont rien donné ;
 *  - une ville : séjour calculé par le Compas → aucune marque ;
 *  - IA éteinte : une étape par jour sur le lieu, aucune marque.
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  /** `AI_MODE` simulé. */
  ai: true,
  /** Réponse de l'IA à l'itinéraire (le reste de ses appels est « dégradé »). */
  stages: null as unknown,
  /** La fonction est coupée à l'altitude des étapes (première chose après l'itinéraire). */
  cut: false,
  reachedCut: null as null | (() => void),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));

/** Lieux que « la carte » connaît : le nom cherché, en ville. */
const MAP: Record<string, { lat: number; lon: number }> = {
  Lisbonne: { lat: 38.72, lon: -9.14 },
  Sintra: { lat: 38.8, lon: -9.38 },
};
const place = (name: string) => ({
  name,
  ...MAP[name],
  countryCode: 'PT',
  country: 'Portugal',
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
  stageCandidates: vi.fn(async (name: string) => (MAP[name] ? [place(name)] : [])),
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
  terrainElevations: vi.fn((points: unknown[]) => {
    if (!h.cut) return Promise.resolve(points.map(() => null));
    h.reachedCut?.();
    // Jamais résolue : la fonction s'arrête ici (limite de 300 s).
    return new Promise(() => undefined);
  }),
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
  aiEnabled: () => h.ai,
  askAI: vi.fn(async (req: { system?: string }) => {
    const { buildCompasStagesSystem } = await import('@/lib/ai/features/compasAutofill');
    if (h.ai && h.stages && req.system === buildCompasStagesSystem())
      return { text: JSON.stringify(h.stages), model: 'x', degraded: false, cached: false, provider: 'nvidia' };
    // Conseils, budget : l'IA ne donne rien (repli par règles).
    return { text: '{}', model: 'x', degraded: true, cached: false, provider: 'fallback' };
  }),
}));

import { compasAutofillAction } from '../server/autofillActions';
import { readAiProposed } from '../engine/aiNotice';
import { CLAIM_MS } from '../server/autofillState';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const TRIP = '77777777-7777-4777-8777-777777777777';
const launch = () => compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'all' });

const PORTUGAL = { name: 'Portugal', lat: 39.4, lon: -8.2, countryCode: 'PT', country: 'Portugal', kind: 'country', radiusKm: 300 };
const GRENOBLE = { name: 'Grenoble', lat: 45.19, lon: 5.72, countryCode: 'FR', country: 'France', kind: 'city', radiusKm: 12 };

function trip(anchor: typeof PORTUGAL | typeof GRENOBLE, end: string) {
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: `Séjour · ${anchor.name}`,
    start_date: '2026-11-10',
    end_date: end,
    destination_name: anchor.name,
    destination_country_code: anchor.countryCode,
    party_size: 2,
    budget_currency: 'EUR',
    primary_activity: 'cultural',
    estimated_budget: null,
    metadata: { compas: { anchor } },
    updated_at: '2026-10-09T09:00:00.000000+00:00',
  });
}
const steps = () => h.db.rows('trip_steps');
const usedAi = (res: Awaited<ReturnType<typeof launch>>) => (res.success && 'summary' in res ? res.summary.usedAi : null);

beforeEach(() => {
  vi.clearAllMocks();
  h.ai = true;
  h.stages = null;
  h.cut = false;
  h.reachedCut = null;
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
});
afterEach(() => vi.useRealTimers());

describe('étapes proposées par l’IA : la marque suit l’étape', () => {
  it('pays entier, IA allumée : chaque étape écrite porte `aiProposed`, et `usedAi` le dit', async () => {
    h.stages = {
      stages: [
        [1, 'Lisbonne', 'aucun', 'Arrivée'],
        [2, 'Sintra', 'voiture', ''],
        [3, 'Sintra', 'aucun', ''],
        [4, 'Lisbonne', 'voiture', ''],
      ],
    };
    trip(PORTUGAL, '2026-11-13');
    const res = await launch();
    expect(res.success).toBe(true);
    expect(steps()).toHaveLength(4);
    // Les noms viennent de la carte (Lisbonne, Sintra) : l'IA a proposé, la carte a vérifié.
    expect(new Set(steps().map((s) => String(s.title).replace(/^Jour \d+ · /, '')))).toEqual(new Set(['Lisbonne', 'Sintra']));
    for (const s of steps()) expect(readAiProposed(s.metadata), String(s.title)).toBe(true);
    // Les conseils n'ont rien donné, mais l'itinéraire vient de l'IA : la préparation a bien « utilisé l'IA ».
    expect(usedAi(res)).toBe(true);
  });

  it('la marque cohabite avec la source de la distance (estimation)', async () => {
    h.stages = { stages: [[1, 'Lisbonne', 'aucun', ''], [2, 'Sintra', 'voiture', ''], [3, 'Sintra', 'aucun', ''], [4, 'Lisbonne', 'voiture', '']] };
    trip(PORTUGAL, '2026-11-13');
    await launch();
    const second = steps().find((s) => s.day_number === 2);
    expect(second?.metadata).toMatchObject({ aiProposed: true, distance: { source: 'estimation' } });
  });

  it('une ville : séjour calculé par le Compas, aucune marque, `usedAi` faux', async () => {
    trip(GRENOBLE, '2026-11-12');
    const res = await launch();
    expect(res.success).toBe(true);
    expect(steps().length).toBeGreaterThan(0);
    for (const s of steps()) expect(readAiProposed(s.metadata), String(s.title)).toBe(false);
    expect(usedAi(res)).toBe(false);
  });

  it('IA éteinte (AI_MODE=off), pays entier : une étape par jour sur le lieu, aucune marque', async () => {
    h.ai = false;
    h.stages = { stages: [[1, 'Lisbonne', 'aucun', ''], [2, 'Sintra', 'voiture', '']] };
    trip(PORTUGAL, '2026-11-13');
    const res = await launch();
    expect(res.success).toBe(true);
    expect(steps().length).toBeGreaterThan(0);
    for (const s of steps()) expect(readAiProposed(s.metadata), String(s.title)).toBe(false);
    expect(usedAi(res)).toBe(false);
  });

  it('préparation coupée après l’itinéraire puis reprise : `usedAi` relit les étapes déjà écrites', async () => {
    const T0 = Date.parse('2026-10-09T10:00:00.000Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    h.stages = { stages: [[1, 'Lisbonne', 'aucun', ''], [2, 'Sintra', 'voiture', ''], [3, 'Sintra', 'aucun', ''], [4, 'Lisbonne', 'voiture', '']] };
    trip(PORTUGAL, '2026-11-13');
    h.cut = true;
    const reached = new Promise<void>((resolve) => (h.reachedCut = resolve));
    void launch();
    await reached;
    h.cut = false;
    // L'itinéraire de l'IA est écrit, marqué ; la préparation attend son reste.
    expect(steps()).toHaveLength(4);
    for (const s of steps()) expect(readAiProposed(s.metadata)).toBe(true);
    // Prise expirée : la relance reprend CET itinéraire (aucune étape neuve → `stagePlaces` vide).
    vi.setSystemTime(T0 + CLAIM_MS + 1_000);
    const res = await launch();
    expect(res).toMatchObject({ success: true, summary: { stepsCreated: 4 } });
    expect(usedAi(res)).toBe(true);
  });
});
