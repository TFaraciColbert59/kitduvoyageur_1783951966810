import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN-100 3.7 et 4.5, de bout en bout sur `compasAutofillAction` : un grand itinéraire nommé dans les
 * envies (« GR20 ») est suivi sur son tracé OpenStreetMap (simulé à la frontière de la carte) : une
 * longueur de tracé par jour, un lieu réel par soir à moins de 3 km du tracé, jamais un nom inventé.
 * Tracé introuvable : le calcul d'avant, et la note le dit.
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  /** Le tracé que « la carte » rend (null : introuvable). */
  trail: null as null | { line: Array<[number, number]>; ref: string | null; name: string | null },
  places: [] as Array<Record<string, unknown>>,
  trailAsks: [] as unknown[],
  /** IA allumée (sinon éteinte, comme avant), et sa réponse aux étapes (null : muette). */
  ai: false,
  aiStages: null as unknown,
  stageAsks: 0,
}));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => undefined }));
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
  lookupIslandContour: vi.fn(async () => null),
  // Les lieux simulés, retrouvés par leur nom (étapes proposées par l'IA).
  stageCandidates: vi.fn(async (name: string) => {
    const p = h.places.find((x) => x.name === name);
    return p
      ? [{ name, lat: p.lat, lon: p.lon, countryCode: 'FR', country: 'France', kind: 'village', settlement: true, settlementRank: 3, extent: null }]
      : [];
  }),
  // Sentiers qui portent le nom d'un lieu dit, à pied (PR #108) : la carte simulée n'en connaît aucun.
  pathCandidates: vi.fn(async () => []),
  stageAliasCandidates: vi.fn(async () => []),
}));
vi.mock('../server/stagePoiLookup', async () => {
  const { distanceKm } = await import('../engine/places');
  return {
    lookupAreaPlaces: vi.fn(async (q: { center: { lat: number; lon: number }; radiusKm: number }) =>
      h.places.filter((p) => distanceKm(q.center, p as { lat: number; lon: number }) <= q.radiusKm * 1.05)
    ),
    lookupTrailLine: vi.fn(async (input: unknown) => {
      h.trailAsks.push(input);
      return h.trail;
    }),
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
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  readShared: vi.fn(async () => undefined),
  writeShared: vi.fn(async () => undefined),
}));
vi.mock('../server/elevation', () => ({
  routeAscentM: vi.fn(async () => 640),
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
    if (h.ai && req.system === buildCompasStagesSystem()) {
      h.stageAsks += 1;
      if (h.aiStages) return { text: JSON.stringify(h.aiStages), model: 'x', degraded: false, cached: false, provider: 'nvidia' };
    }
    return { text: '{}', model: 'x', degraded: true, cached: false, provider: 'fallback' };
  }),
}));

import { compasAutofillAction } from '../server/autofillActions';
import { lookupAreaPlaces } from '../server/stagePoiLookup';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const TRIP = '99999999-9999-4999-8999-999999999999';
const launch = () => compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'all' });

const KM_DEG = 1 / 111.19;
/** Un « GR » plein nord de 80 km, un point par km, à 9° E. */
const LINE: Array<[number, number]> = Array.from({ length: 81 }, (_, i) => [9, 42 + i * KM_DEG]);
const gp = (id: string, name: string, km: number, kind: 'village' | 'hut' = 'village', offLon = 0) => ({
  id,
  name,
  lat: 42 + km * KM_DEG,
  lon: 9 + offLon,
  kind,
  population: null,
  eleM: null,
  countryCode: 'FR',
});
const PLACES = [
  gp('1', 'Alpha', 0),
  gp('2', 'Bravo', 21),
  gp('3', 'Charlie', 40, 'hut'),
  gp('4', 'Delta', 61),
  gp('5', 'Echo', 80),
  gp('6', 'Loin', 42, 'village', 0.2),
];
// Un massif entier (rayon 100 km) : plus grand que la porte de taille des zones calculées.
const ZONE = { name: 'Massif', lat: 42.36, lon: 9, countryCode: 'FR', country: 'France', radiusKm: 100, kind: 'other', extent: [8.5, 42.9, 9.5, 41.9] };

function trip(wishes: string[], end = '2026-11-13') {
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: 'Séjour · Massif',
    start_date: '2026-11-10',
    end_date: end,
    destination_name: 'Massif',
    destination_country_code: 'FR',
    party_size: 2,
    budget_currency: 'EUR',
    primary_activity: 'hiking',
    estimated_budget: null,
    metadata: { compas: { anchor: ZONE, prefs: { wishes } } },
    updated_at: '2026-10-09T09:00:00.000000+00:00',
  });
}
const steps = () => [...h.db.rows('trip_steps')].sort((a, b) => Number(a.day_number) - Number(b.day_number));
const titleOf = (s: Record<string, unknown>) => String(s.title).replace(/^Jour \d+ · /, '');
const notesOf = (res: Awaited<ReturnType<typeof launch>>) => (res.success && 'summary' in res ? res.summary.notes : []);

beforeEach(() => {
  vi.clearAllMocks();
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
  h.trail = { line: LINE, ref: 'GR20', name: 'GR 20' };
  h.places = PLACES;
  h.trailAsks = [];
  h.ai = false;
  h.aiStages = null;
  h.stageAsks = 0;
});

describe('un grand itinéraire nommé est suivi sur son tracé', () => {
  it('GR20 en 4 jours : le tracé est demandé par sa référence, un lieu réel par soir, dit dans les notes', async () => {
    trip(['GR20']);
    const res = await launch();
    expect(res.success).toBe(true);
    expect(h.trailAsks[0]).toMatchObject({ ref: 'GR20' });
    expect(steps().map(titleOf)).toEqual(['Bravo', 'Charlie', 'Delta', 'Echo']);
    expect(steps().map((s) => s.transport_mode)).toEqual(['foot', 'foot', 'foot', 'foot']);
    const notes = notesOf(res);
    expect(notes.some((n) => /Grand itinéraire GR20 \(GR 20\) suivi sur son tracé OpenStreetMap/.test(n))).toBe(true);
    expect(notes.some((n) => /un lieu réel par soir à moins de 3 km du tracé/.test(n))).toBe(true);
    // La carte a été lue autour du tronçon, pas à l'échelle du pays.
    expect(vi.mocked(lookupAreaPlaces)).toHaveBeenCalled();
  });

  it('un lieu à 16 km du tracé n’est jamais une étape', async () => {
    trip(['GR20']);
    await launch();
    expect(steps().map(titleOf)).not.toContain('Loin');
  });

  it('un tracé sans village à portée : des points calculés sur le tracé, annoncés, jamais un nom inventé', async () => {
    h.places = [];
    trip(['GR20']);
    const res = await launch();
    expect(res.success).toBe(true);
    const titles = steps().map(titleOf);
    expect(titles.length).toBeGreaterThan(0);
    for (const t of titles) expect(t).toMatch(/^GR20 · (km \d+|départ du tracé)/);
    expect(notesOf(res).some((n) => /point calculé sur le tracé, emplacement à choisir sur place/.test(n))).toBe(true);
  });
});

describe('tracé introuvable : le calcul d’avant, et la note le dit', () => {
  it('la note annonce que le tracé n’a pas été suivi', async () => {
    h.trail = null;
    trip(['GR20']);
    const res = await launch();
    expect(res.success).toBe(true);
    expect(notesOf(res).some((n) => /Grand itinéraire « GR20 » introuvable sur la carte/.test(n))).toBe(true);
  });

  it('aucune envie de sentier : le tracé n’est jamais demandé', async () => {
    trip(['lac']);
    await launch();
    expect(h.trailAsks).toHaveLength(0);
  });
});

// Relecture #108 (2) : avec l'IA allumée, un sentier à tracé suivi (« GR20 ») suit son tracé d'abord, comme sur main.
describe('IA allumée : le tracé d’abord pour un sentier qui en a un, l’IA d’abord sinon', () => {
  const AI_STAGES = { stages: [[1, 'Bravo', 'marche', ''], [2, 'Charlie', 'marche', ''], [3, 'Delta', 'marche', ''], [4, 'Echo', 'marche', '']] };
  const NOT_FOUND = /Étapes du sentier « GR20 » non retrouvées sur la carte/;
  const FOLLOWED = /Grand itinéraire GR20 \(GR 20\) suivi sur son tracé OpenStreetMap/;

  it('GR20, IA qui répond : le tracé est suivi, l’IA n’est pas consultée pour les étapes', async () => {
    h.ai = true;
    h.aiStages = AI_STAGES;
    trip(['GR20']);
    const res = await launch();
    expect(res.success).toBe(true);
    expect(h.trailAsks).toHaveLength(1);
    expect(h.stageAsks).toBe(0);
    expect(steps().map(titleOf)).toEqual(['Bravo', 'Charlie', 'Delta', 'Echo']);
    const notes = notesOf(res);
    expect(notes.some((n) => FOLLOWED.test(n))).toBe(true);
    expect(notes.some((n) => NOT_FOUND.test(n))).toBe(false);
    expect(notes.some((n) => /distance estimée \(itinéraire non calculé\)/.test(n))).toBe(false);
  });

  it('GR20, IA muette : une seule note, cohérente (le tracé suivi), jamais « non retrouvées »', async () => {
    h.ai = true;
    trip(['GR20']);
    const res = await launch();
    expect(res.success).toBe(true);
    expect(h.trailAsks).toHaveLength(1);
    const notes = notesOf(res);
    expect(notes.filter((n) => FOLLOWED.test(n))).toHaveLength(1);
    expect(notes.some((n) => NOT_FOUND.test(n))).toBe(false);
  });

  it('GR20 au tracé introuvable, IA qui répond : ses étapes, sans la note d’un calcul qui n’a pas eu lieu', async () => {
    h.ai = true;
    h.trail = null;
    h.aiStages = AI_STAGES;
    trip(['GR20']);
    const res = await launch();
    expect(res.success).toBe(true);
    expect(h.trailAsks).toHaveLength(1);
    expect(h.stageAsks).toBeGreaterThan(0);
    expect(steps().map(titleOf)).toEqual(['Bravo', 'Charlie', 'Delta', 'Echo']);
    expect(notesOf(res).some((n) => /introuvable sur la carte : itinéraire calculé sans suivre son tracé/.test(n))).toBe(false);
  });

  it('GR20 au tracé introuvable, IA muette : le calcul, le tracé demandé une seule fois, les deux notes', async () => {
    h.ai = true;
    h.trail = null;
    trip(['GR20']);
    const res = await launch();
    expect(res.success).toBe(true);
    expect(h.trailAsks).toHaveLength(1);
    const notes = notesOf(res);
    expect(notes.some((n) => /Grand itinéraire « GR20 » introuvable sur la carte/.test(n))).toBe(true);
    expect(notes.some((n) => NOT_FOUND.test(n))).toBe(true);
  });

  it('Laugavegur (sans tracé suivi), IA qui répond : l’IA d’abord, comme avant ; le tracé n’est pas demandé', async () => {
    h.ai = true;
    h.aiStages = AI_STAGES;
    trip(['Laugavegur']);
    const res = await launch();
    expect(res.success).toBe(true);
    expect(h.trailAsks).toHaveLength(0);
    expect(h.stageAsks).toBeGreaterThan(0);
    expect(steps().map(titleOf)).toEqual(['Bravo', 'Charlie', 'Delta', 'Echo']);
  });
});
