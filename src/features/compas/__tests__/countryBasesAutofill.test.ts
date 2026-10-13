import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN-100 4.5, de bout en bout sur `compasAutofillAction` (client Supabase en mémoire, accès à la
 * carte simulé à sa frontière, garde réseau actif) :
 *
 *  - un pays entier sans IA (éteinte, ou muette, ou dont aucun lieu n'est retrouvé sur la carte) :
 *    des BASES multiples choisies parmi les lieux de la carte (`planBase` → `pickCountryBases`), pas
 *    « une étape par jour sur le lieu » ; l'IA qui répond avec des étapes retrouvées garde sa place ;
 *  - une grande île à pied ou à vélo : le massif (ou la zone) de l'île, jamais la voiture d'étape en
 *    étape, et l'IA n'est pas consultée.
 *
 * Les lieux sont simulés (coordonnées approchées, noms de fantaisie pour l'île) : le moteur ne
 * contient aucune liste de lieux, il ne lit que ce que la carte rend.
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  /** `AI_MODE` simulé. */
  ai: true,
  /** Réponse de l'IA à l'itinéraire (le reste de ses appels est « dégradé »). */
  stages: null as unknown,
  /** Les lieux que « la carte » rend pour une zone (filtrés par la zone demandée). */
  places: [] as Array<Record<string, unknown>>,
  /** Carte muette : `lookupAreaPlaces` ne rend rien. */
  mapDown: false,
  /** Le contour GeoJSON de l'île que « la carte » rend (null : contour introuvable). */
  contour: null as unknown,
  /** Appels de `lookupIslandContour`. */
  contourAsks: 0,
  /** Appels de l'IA à l'itinéraire. */
  stageAsks: 0,
}));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));

/** Lieux que la carte connaît par leur nom (étapes proposées par l'IA). */
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
    lookupAreaPlaces: vi.fn(async (q: { center: { lat: number; lon: number }; radiusKm: number }) =>
      h.mapDown ? null : h.places.filter((p) => distanceKm(q.center, p as { lat: number; lon: number }) <= Math.min(q.radiusKm, 400) * 1.05)
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
      if (h.ai && h.stages) return { text: JSON.stringify(h.stages), model: 'x', degraded: false, cached: false, provider: 'nvidia' };
    }
    return { text: '{}', model: 'x', degraded: true, cached: false, provider: 'fallback' };
  }),
}));

import { compasAutofillAction } from '../server/autofillActions';
import { readAiProposed } from '../engine/aiNotice';
import { backtrackShare } from '../engine/autofill';
import { transferLegs } from '../engine/countryBases';
import { distanceKm } from '../engine/places';
import { lookupAreaPlaces } from '../server/stagePoiLookup';
import { getClimateNormals } from '../server/weather';
import { planItinerary } from '../engine/itinerary';
import { onIslandContour, parseIslandContour } from '../engine/islands';
import { lookupDestination } from '../server/placeLookup';
import { generateTripContextualKit } from '@/features/trips/engine/contextualKitEngine';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const TRIP = '88888888-8888-4888-8888-888888888888';
const launch = () => compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'all' });

const PORTUGAL = {
  name: 'Portugal',
  lat: 39.4,
  lon: -8.2,
  countryCode: 'PT',
  country: 'Portugal',
  kind: 'country',
  extent: [-9.5, 42.15, -6.19, 36.96],
};
// Sardaigne : 154 km de demi-diagonale d'emprise (≈ 184 km de rayon avec la marge de la carte).
const SARDAIGNE = {
  name: 'Sardaigne',
  lat: 40,
  lon: 9,
  countryCode: 'IT',
  country: 'Italie',
  kind: 'island',
  extent: [8.13, 41.31, 9.83, 38.86],
};

/** Le contour de la Sardaigne du jeu d'essai : un rectangle qui porte tous ses lieux (l'anneau côtier est à ~125 km du centre). */
const SARDAIGNE_CONTOUR = {
  type: 'Polygon',
  coordinates: [[[7.0, 38.0], [11.0, 38.0], [11.0, 41.15], [7.0, 41.15], [7.0, 38.0]]],
};

function trip(anchor: Record<string, unknown>, opts: { activity: string; end: string }) {
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: `Séjour · ${anchor.name}`,
    start_date: '2026-11-10',
    end_date: opts.end,
    destination_name: anchor.name,
    destination_country_code: anchor.countryCode,
    party_size: 2,
    budget_currency: 'EUR',
    primary_activity: opts.activity,
    estimated_budget: null,
    metadata: { compas: { anchor } },
    updated_at: '2026-10-09T09:00:00.000000+00:00',
  });
}
const steps = () => h.db.rows('trip_steps');
const titleOf = (s: Record<string, unknown>) => String(s.title).replace(/^Jour \d+ · /, '');
const dayOf = (s: Record<string, unknown>) => Number(s.day_number);
const byDay = () => [...steps()].sort((a, b) => dayOf(a) - dayOf(b));
const point = (s: Record<string, unknown>) => ({ lat: Number(s.latitude), lon: Number(s.longitude) });
/** Une étape par base (jours consécutifs au même lieu regroupés). */
const basesOf = () => {
  const out: Array<{ name: string; days: number; lat: number; lon: number }> = [];
  for (const s of byDay()) {
    const last = out[out.length - 1];
    if (last && last.name === titleOf(s)) last.days += 1;
    else out.push({ name: titleOf(s), days: 1, ...point(s) });
  }
  return out;
};
const notesOf = (res: Awaited<ReturnType<typeof launch>>) => (res.success && 'summary' in res ? res.summary.notes : []);
const usedAi = (res: Awaited<ReturnType<typeof launch>>) => (res.success && 'summary' in res ? res.summary.usedAi : null);

/** Le Portugal tel que la carte le rend : villes et bourgs, du plus peuplé au moins (coordonnées approchées), et trois villes d'Espagne voisines. */
const pt = (id: string, name: string, lat: number, lon: number, kind: 'city' | 'town', population: number, countryCode = 'PT') => ({
  id: `g${id}`,
  name,
  lat,
  lon,
  kind,
  population,
  eleM: null,
  countryCode,
});
const PORTUGAL_PLACES = [
  pt('1', 'Lisboa', 38.72, -9.14, 'city', 545_000),
  pt('2', 'Porto', 41.15, -8.61, 'city', 232_000),
  pt('3', 'Braga', 41.55, -8.43, 'city', 193_000),
  pt('4', 'Coimbra', 40.2, -8.41, 'city', 143_000),
  pt('5', 'Faro', 37.02, -7.93, 'city', 64_000),
  pt('6', 'Évora', 38.57, -7.91, 'town', 56_000),
  pt('7', 'Viseu', 40.66, -7.91, 'town', 99_000),
  pt('8', 'Aveiro', 40.64, -8.65, 'town', 80_000),
  pt('9', 'Leiria', 39.74, -8.81, 'town', 126_000),
  pt('10', 'Beja', 38.02, -7.86, 'town', 35_000),
  pt('11', 'Castelo Branco', 39.82, -7.49, 'town', 56_000),
  pt('12', 'Guarda', 40.54, -7.27, 'town', 42_000),
  pt('13', 'Bragança', 41.81, -6.76, 'town', 34_000),
  pt('14', 'Portimão', 37.14, -8.54, 'town', 59_000),
  pt('15', 'Tomar', 39.6, -8.41, 'town', 40_000),
  pt('16', 'Santarém', 39.24, -8.69, 'town', 62_000),
  pt('17', 'Viana do Castelo', 41.69, -8.83, 'town', 88_000),
  pt('18', 'Setúbal', 38.52, -8.89, 'town', 123_000),
  pt('19', 'Vila Real', 41.3, -7.74, 'town', 51_000),
  pt('20', 'Sines', 37.96, -8.87, 'town', 13_000),
  // Voisines : dans le carré du pays, mais pas au Portugal. Assez nombreuses (plus de 30 %) pour qu'un
  // filtre « le pays de la zone quand elle y est presque entière » (massifs frontaliers) les garde toutes.
  pt('30', 'Badajoz', 38.88, -6.97, 'city', 150_000, 'ES'),
  pt('31', 'Vigo', 42.24, -8.72, 'city', 293_000, 'ES'),
  pt('32', 'Salamanca', 40.97, -5.66, 'city', 144_000, 'ES'),
  pt('33', 'Sevilla', 37.39, -5.98, 'city', 690_000, 'ES'),
  pt('34', 'Huelva', 37.26, -6.95, 'city', 143_000, 'ES'),
  pt('35', 'Cáceres', 39.47, -6.37, 'town', 96_000, 'ES'),
  pt('36', 'Ourense', 42.34, -7.86, 'town', 105_000, 'ES'),
  pt('37', 'Pontevedra', 42.43, -8.64, 'town', 83_000, 'ES'),
  pt('38', 'Zamora', 41.5, -5.75, 'town', 61_000, 'ES'),
  pt('39', 'Mérida', 38.92, -6.34, 'town', 59_000, 'ES'),
];
const PORTUGAL_NAMES = new Set(PORTUGAL_PLACES.filter((p) => p.countryCode === 'PT').map((p) => p.name));

beforeEach(() => {
  vi.clearAllMocks();
  h.ai = true;
  h.stages = null;
  h.places = [];
  h.mapDown = false;
  h.stageAsks = 0;
  h.contourAsks = 0;
  h.contour = SARDAIGNE_CONTOUR;
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
});
afterEach(() => vi.useRealTimers());

describe('un pays entier sans les noms de l’IA : des bases multiples sur des lieux réels', () => {
  it('IA éteinte (AI_MODE=off), road trip de 10 jours : cinq bases de la carte, à une journée de route, sans retour en arrière', async () => {
    h.ai = false;
    h.places = PORTUGAL_PLACES;
    trip(PORTUGAL, { activity: 'roadtrip', end: '2026-11-19' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(steps()).toHaveLength(10);

    const bases = basesOf();
    expect(bases).toHaveLength(5);
    // Chaque base est un lieu rendu par la carte, du Portugal (jamais l'Espagne voisine, jamais le centre du pays).
    for (const b of bases) expect(PORTUGAL_NAMES.has(b.name), b.name).toBe(true);
    expect(new Set(bases.map((b) => b.name)).size).toBe(5);
    // Deux jours par base.
    expect(bases.map((b) => b.days)).toEqual([2, 2, 2, 2, 2]);
    // Une journée de route entre deux bases (barème du road trip), et l'on avance d'un bout à l'autre du pays.
    const { minKm, maxKm } = transferLegs('roadtrip');
    for (let i = 1; i < bases.length; i += 1) {
      const km = distanceKm(bases[i - 1], bases[i]);
      expect(km).toBeGreaterThanOrEqual(minKm);
      expect(km).toBeLessThanOrEqual(maxKm);
    }
    expect(backtrackShare(bases)).toBeLessThan(0.1);
    // Les villes les plus peuplées passent devant les bourgs.
    expect(bases.map((b) => b.name)).toEqual(expect.arrayContaining(['Lisboa']));
    // Le moyen du changement de base : la voiture, le premier jour de chaque base seulement.
    expect(byDay().map((s) => s.transport_mode)).toEqual(['foot', 'foot', 'car', 'foot', 'car', 'foot', 'car', 'foot', 'car', 'foot']);
    // Calculé par le Compas, pas proposé par l'IA : aucune marque, aucun « rédigé par l'IA ».
    for (const s of steps()) expect(readAiProposed(s.metadata), titleOf(s)).toBe(false);
    expect(usedAi(res)).toBe(false);
    // La note dit ce qui a été fait, pas « une étape par jour sur le lieu ».
    const notes = notesOf(res);
    expect(notes.some((n) => /Itinéraire en 5 bases calculé sans l’IA/.test(n))).toBe(true);
    expect(notes.some((n) => /une étape par jour sur le lieu/.test(n))).toBe(false);
    // La carte a été lue à l'échelle du pays : l'emprise du pays, des lieux habités seulement.
    const asked = vi.mocked(lookupAreaPlaces).mock.calls.map((c) => c[0]);
    expect(asked.some((q) => q.extent != null && q.radiusKm > 150)).toBe(true);
  });

  it('IA allumée mais dont aucun lieu n’existe sur la carte : les mêmes bases calculées', async () => {
    h.places = PORTUGAL_PLACES;
    h.stages = { stages: [[1, 'Atlantis', 'aucun', ''], [2, 'Eldorado', 'voiture', ''], [3, 'Shangri-La', 'voiture', ''], [4, 'Eldorado', 'voiture', '']] };
    trip(PORTUGAL, { activity: 'roadtrip', end: '2026-11-19' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(h.stageAsks).toBeGreaterThan(0);
    const bases = basesOf();
    expect(bases).toHaveLength(5);
    for (const b of bases) expect(PORTUGAL_NAMES.has(b.name), b.name).toBe(true);
    for (const s of steps()) expect(readAiProposed(s.metadata)).toBe(false);
    expect(usedAi(res)).toBe(false);
  });

  it('IA allumée mais muette : les bases calculées aussi, et rien n’est redemandé à la prochaine visite', async () => {
    h.places = PORTUGAL_PLACES;
    h.stages = null;
    trip(PORTUGAL, { activity: 'roadtrip', end: '2026-11-19' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(basesOf()).toHaveLength(5);
    expect(notesOf(res).some((n) => /Je réessaie à ta prochaine visite/.test(n))).toBe(false);
    const meta = h.db.rows('trips')[0].metadata as { compas?: { autofill_carry?: { stagesFallback?: number } } };
    expect(meta.compas?.autofill_carry?.stagesFallback ?? 0).toBe(0);
  });

  it('IA allumée qui répond avec des étapes retrouvées sur la carte : son chemin reste, les bases ne la remplacent pas', async () => {
    h.places = PORTUGAL_PLACES;
    h.stages = { stages: [[1, 'Lisbonne', 'aucun', ''], [2, 'Sintra', 'voiture', ''], [3, 'Sintra', 'aucun', ''], [4, 'Lisbonne', 'voiture', '']] };
    trip(PORTUGAL, { activity: 'cultural', end: '2026-11-13' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(new Set(steps().map(titleOf))).toEqual(new Set(['Lisbonne', 'Sintra']));
    for (const s of steps()) expect(readAiProposed(s.metadata)).toBe(true);
    expect(usedAi(res)).toBe(true);
    // La carte du pays n'a même pas été lue.
    expect(vi.mocked(lookupAreaPlaces).mock.calls.some((c) => c[0].radiusKm > 150)).toBe(false);
  });

  it('à pied, IA éteinte : le changement de base se fait en voiture (on ne marche pas d’une base à l’autre), et la note le dit', async () => {
    h.ai = false;
    h.places = PORTUGAL_PLACES;
    trip(PORTUGAL, { activity: 'hiking', end: '2026-11-21' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(steps()).toHaveLength(12);
    const bases = basesOf();
    expect(bases).toHaveLength(3);
    expect(bases.map((b) => b.days)).toEqual([4, 4, 4]);
    expect(steps().some((s) => s.transport_mode === 'car')).toBe(true);
    expect(steps().filter((s) => s.transport_mode === 'car')).toHaveLength(2);
    const { minKm, maxKm } = transferLegs('hiking');
    for (let i = 1; i < bases.length; i += 1) {
      const km = distanceKm(bases[i - 1], bases[i]);
      expect(km).toBeGreaterThanOrEqual(minKm);
      expect(km).toBeLessThanOrEqual(maxKm);
    }
    expect(notesOf(res).some((n) => /changements de base se font en véhicule/.test(n))).toBe(true);
  });

  it('une envie dite (« Tomar ») entre dans la chaîne des bases', async () => {
    h.ai = false;
    h.places = PORTUGAL_PLACES;
    trip(PORTUGAL, { activity: 'roadtrip', end: '2026-11-19' });
    h.db.rows('trips')[0].metadata = { compas: { anchor: PORTUGAL, prefs: { wishes: ['Tomar'] } } };
    const { stageCandidates } = await import('../server/placeLookup');
    vi.mocked(stageCandidates).mockImplementation(async (name: string) =>
      name === 'Tomar'
        ? [{ name: 'Tomar', lat: 39.6, lon: -8.41, countryCode: 'PT', country: 'Portugal', kind: 'town', settlement: true, settlementRank: 4, extent: null }]
        : []
    );
    const res = await launch();
    expect(res.success).toBe(true);
    expect(basesOf().map((b) => b.name)).toContain('Tomar');
  });

  it('IA éteinte et carte muette : une étape par jour sur le lieu, comme avant, et la cause est dite', async () => {
    h.ai = false;
    h.mapDown = true;
    trip(PORTUGAL, { activity: 'roadtrip', end: '2026-11-19' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(steps()).toHaveLength(10);
    expect(new Set(steps().map(titleOf))).toEqual(new Set(['Portugal']));
    const notes = notesOf(res);
    expect(notes.some((n) => /Bases multiples du pays impossibles : lieux du pays indisponibles/.test(n))).toBe(true);
    expect(notes.some((n) => /Sans IA, pas d’étapes détaillées/.test(n))).toBe(true);
  });

  describe('réadaptation : l’ancien itinéraire du préremplissage', () => {
    const OLD = ['aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000003'];
    function withOldItinerary() {
      trip(PORTUGAL, { activity: 'roadtrip', end: '2026-11-19' });
      OLD.forEach((id, i) =>
        h.db.rows('trip_steps').push({
          id,
          trip_id: TRIP,
          day_number: i + 1,
          order_index: 0,
          title: `Jour ${i + 1} · Ancienne étape`,
          latitude: 39.4,
          longitude: -8.2,
          source: 'compas',
          updated_at: '2026-10-09T08:00:00.000000+00:00',
        })
      );
      h.db.rows('trips')[0].metadata = {
        compas: {
          anchor: PORTUGAL,
          autofill_carry: { replaceStepIds: OLD, replaceRoute: false, stepIds: [], routeSet: false, itemIds: [], expenseIds: [], expenseTitles: [], stays: [], stagesFallback: 0 },
        },
      };
    }
    const oldLeft = () => steps().filter((s) => OLD.includes(String(s.id))).length;

    it('IA éteinte : rien ne viendra, l’ancien itinéraire est remplacé par les bases calculées', async () => {
      h.ai = false;
      h.places = PORTUGAL_PLACES;
      withOldItinerary();
      const res = await launch();
      expect(res.success).toBe(true);
      expect(oldLeft()).toBe(0);
      expect(basesOf()).toHaveLength(5);
    });

    it('IA allumée mais en retard : l’ancien itinéraire est gardé, la prochaine visite redemande à l’IA', async () => {
      h.places = PORTUGAL_PLACES;
      h.stages = null;
      withOldItinerary();
      const res = await launch();
      expect(res.success).toBe(true);
      expect(oldLeft()).toBe(3);
      expect(notesOf(res).some((n) => /Itinéraire gardé tel quel/.test(n))).toBe(true);
      // La carte du pays n'a pas été lue pour rien.
      expect(vi.mocked(lookupAreaPlaces).mock.calls.some((c) => c[0].radiusKm > 150)).toBe(false);
    });
  });

  it('un pays presque vide de lieux : une seule base (la plus importante), jamais un point inventé', async () => {
    h.ai = false;
    h.places = [PORTUGAL_PLACES[1]];
    trip(PORTUGAL, { activity: 'roadtrip', end: '2026-11-19' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(new Set(steps().map(titleOf))).toEqual(new Set(['Porto']));
  });
});

/** Une grande île à pied : des bourgs côtiers au ras de l'eau, un massif de villages hauts à l'intérieur. */
const sd = (id: string, name: string, lat: number, lon: number, kind: 'city' | 'town' | 'village', eleM: number, population: number | null = null) => ({
  id: `s${id}`,
  name,
  lat,
  lon,
  kind,
  population,
  eleM,
  countryCode: 'IT',
});
function sardinia() {
  const out: ReturnType<typeof sd>[] = [];
  // Anneau côtier : 36 bourgs à ~125 km du centre, au ras de l'eau.
  for (let i = 0; i < 36; i += 1) {
    const a = (2 * Math.PI * i) / 36;
    out.push(sd(`c${i}`, `Cala ${i + 1}`, 40 + (125 * Math.cos(a)) / 111, 9 + (125 * Math.sin(a)) / (111 * Math.cos((40 * Math.PI) / 180)), 'town', 5 + (i % 6) * 15, 8_000 + i * 150));
  }
  // Intérieur bas : 20 villages entre 150 et 400 m.
  for (let i = 0; i < 20; i += 1)
    out.push(sd(`i${i}`, `Bourg ${i + 1}`, 40 + (((i * 37) % 100) - 50) / 111, 9 + (((i * 53) % 90) - 45) / 85, 'village', 150 + (i % 5) * 60));
  // Le massif, à l'est : 14 villages entre 600 et 1000 m dans 20 km.
  for (let i = 0; i < 14; i += 1) {
    const a = (2 * Math.PI * i) / 14;
    const r = 6 + (i % 3) * 6;
    out.push(sd(`g${i}`, `Haut-village ${i + 1}`, 40.05 + (r * Math.cos(a)) / 111, 9.3 + (r * Math.sin(a)) / 85, 'village', 600 + i * 30, 900));
  }
  return out;
}
const MASSIF = { lat: 40.05, lon: 9.3 };
/** Le centre géométrique de l'île (l'ancre du voyage). */
const ISLAND_CENTER = { lat: SARDAIGNE.lat, lon: SARDAIGNE.lon };
/** Un massif tout au nord de l'île, à ~120 km de son centre : l'ancre et le massif ne sont pas dans le même climat. */
const FAR_MASSIF = { lat: 41.1, lon: 9.2 };
function sardiniaFarMassif() {
  const out = sardinia().filter((p) => !/^Haut-village/.test(p.name));
  for (let i = 0; i < 14; i += 1) {
    const a = (2 * Math.PI * i) / 14;
    const r = 6 + (i % 3) * 6;
    out.push(sd(`n${i}`, `Haut-village ${i + 1}`, FAR_MASSIF.lat + (r * Math.cos(a)) / 111, FAR_MASSIF.lon + (r * Math.sin(a)) / 85, 'village', 600 + i * 30, 900));
  }
  return out;
}

describe('une grande île à pied : le massif de l’île, jamais la voiture d’étape en étape', () => {
  it('Sardaigne à pied, IA allumée : la zone est le massif (48 km au plus), les étapes y sont, à pied, sans appeler l’IA', async () => {
    h.places = sardinia();
    h.stages = { stages: [[1, 'Lisbonne', 'aucun', ''], [2, 'Sintra', 'voiture', '']] };
    trip(SARDAIGNE, { activity: 'hiking', end: '2026-11-14' });
    const res = await launch();
    expect(res.success).toBe(true);
    // L'île n'est pas « un pays » : l'IA n'a pas été consultée pour l'itinéraire.
    expect(h.stageAsks).toBe(0);
    expect(steps()).toHaveLength(5);
    // Toutes les étapes sont dans la zone du massif, à moins de 48 km de son centre, des lieux de la carte.
    const names = new Set(sardinia().map((p) => p.name));
    for (const s of steps()) {
      expect(names.has(titleOf(s)), titleOf(s)).toBe(true);
      expect(distanceKm(point(s), MASSIF), titleOf(s)).toBeLessThanOrEqual(48);
    }
    // Pas une seule étape au ras de l'eau : on est dans les hauteurs.
    expect(steps().every((s) => /^Haut-village|^Bourg/.test(titleOf(s)))).toBe(true);
    // À pied d'un soir à l'autre : jamais de voiture.
    expect(steps().some((s) => s.transport_mode === 'car')).toBe(false);
    expect(steps().filter((s) => dayOf(s) > 1).every((s) => s.transport_mode === 'foot')).toBe(true);
    for (const s of steps()) expect(readAiProposed(s.metadata)).toBe(false);
    expect(usedAi(res)).toBe(false);
    // La note dit le choix, sans nom de massif inventé.
    const note = notesOf(res).find((n) => /^Grande île/.test(n));
    expect(note).toMatch(/zone de \d+ km autour de Haut-village/);
    expect(note).toMatch(/jusqu’à 990 m/);
  });

  it('même chose quand l’île arrive sous « other » avec son étiquette OSM (Photon)', async () => {
    h.places = sardinia();
    trip({ ...SARDAIGNE, kind: 'other', osmTag: 'place=island' }, { activity: 'trekking', end: '2026-11-14' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(h.stageAsks).toBe(0);
    for (const s of steps()) expect(distanceKm(point(s), MASSIF)).toBeLessThanOrEqual(48);
    expect(steps().some((s) => s.transport_mode === 'car')).toBe(false);
  });

  it('un lieu dit sur l’île centre la zone, même hors du massif', async () => {
    h.ai = false;
    const west = sd('w', 'Haut-village ouest', 40.1, 8.55, 'village', 450);
    h.places = [...sardinia(), west, ...[1, 2, 3, 4, 5, 6].map((i) => sd(`w${i}`, `Hameau ouest ${i}`, 40.1 + (i - 3.5) * 0.04, 8.55 + (i % 3) * 0.05, 'village', 400 + i * 10))];
    trip(SARDAIGNE, { activity: 'hiking', end: '2026-11-14' });
    h.db.rows('trips')[0].metadata = { compas: { anchor: SARDAIGNE, prefs: { wishes: ['Haut-village ouest'] } } };
    const { stageCandidates } = await import('../server/placeLookup');
    vi.mocked(stageCandidates).mockImplementation(async (name: string) =>
      name === 'Haut-village ouest'
        ? [{ name: 'Haut-village ouest', lat: 40.1, lon: 8.55, countryCode: 'IT', country: 'Italie', kind: 'village', settlement: true, settlementRank: 3, extent: null }]
        : []
    );
    const res = await launch();
    expect(res.success).toBe(true);
    expect(notesOf(res).some((n) => /zone de \d+ km autour de « Haut-village ouest », le lieu que tu as dit/.test(n))).toBe(true);
    for (const s of steps()) expect(distanceKm(point(s), { lat: 40.1, lon: 8.55 })).toBeLessThanOrEqual(48);
  });

  it('à vélo, l’île n’est pas renvoyée à l’IA ni parcourue en voiture : des étapes à vélo sur l’île', async () => {
    h.places = sardinia();
    trip(SARDAIGNE, { activity: 'cycling', end: '2026-11-14' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(h.stageAsks).toBe(0);
    expect(steps()).toHaveLength(5);
    expect(steps().some((s) => s.transport_mode === 'car')).toBe(false);
    for (const s of steps()) expect(readAiProposed(s.metadata)).toBe(false);
  });

  it('relief inconnu (aucune altitude) : la zone reste celle du centre de l’île, et la note le dit', async () => {
    h.places = sardinia().map((p) => ({ ...p, eleM: null as unknown as number }));
    trip(SARDAIGNE, { activity: 'hiking', end: '2026-11-14' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(notesOf(res).some((n) => /Massif de l’île non trouvé \(altitudes des lieux de l’île introuvables\) : zone prise au centre de l’île/.test(n))).toBe(true);
    expect(steps().some((s) => s.transport_mode === 'car')).toBe(false);
  });

  it('escalade ou alpinisme sur la même île : une base dans le massif, pas au centre de l’île', async () => {
    h.places = sardinia();
    trip(SARDAIGNE, { activity: 'climbing', end: '2026-11-13' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(h.stageAsks).toBe(0);
    expect(steps()).toHaveLength(4);
    // Un seul lieu où dormir, dans les hauteurs du massif (les villages à 600 m et plus).
    expect(new Set(steps().map(titleOf)).size).toBe(1);
    expect(titleOf(steps()[0])).toMatch(/^Haut-village/);
    expect(distanceKm(point(steps()[0]), MASSIF)).toBeLessThanOrEqual(35);
    expect(notesOf(res).some((n) => /^Grande île : zone de \d+ km autour de Haut-village/.test(n))).toBe(true);
  });

  it('le kit lit le climat et la latitude du massif où les étapes sont écrites, pas le centre de l’île', async () => {
    h.places = sardiniaFarMassif();
    trip(SARDAIGNE, { activity: 'hiking', end: '2026-11-14' });
    const res = await launch();
    expect(res.success).toBe(true);
    // Les étapes sont dans le massif du nord, loin du centre de l'île (l'ancre du voyage).
    expect(steps()).toHaveLength(5);
    for (const s of steps()) expect(distanceKm(point(s), FAR_MASSIF), titleOf(s)).toBeLessThanOrEqual(48);
    expect(distanceKm(FAR_MASSIF, ISLAND_CENTER)).toBeGreaterThan(100);
    // Normales NASA POWER lues au point des étapes, une seule fois.
    expect(vi.mocked(getClimateNormals)).toHaveBeenCalledTimes(1);
    const [lat, lon] = vi.mocked(getClimateNormals).mock.calls[0];
    expect(distanceKm({ lat, lon }, FAR_MASSIF)).toBeLessThanOrEqual(48);
    expect(distanceKm({ lat, lon }, ISLAND_CENTER)).toBeGreaterThan(100);
    // Même point pour les règles du kit (latitude), qui lisent ce climat.
    const kit = vi.mocked(generateTripContextualKit).mock.calls[0][0];
    expect(kit.latitude).toBeCloseTo(lat, 5);
    expect(kit.latitude).toBeGreaterThan(40.5);
  });

  it('des étapes sans coordonnées : le kit garde le centre de l’île (l’ancre), sans inventer de point', async () => {
    h.places = sardiniaFarMassif();
    trip(SARDAIGNE, { activity: 'hiking', end: '2026-11-14' });
    // L'itinéraire est celui de la personne, sans lieu localisé : rien n'est recalculé ni deviné.
    for (let day = 1; day <= 5; day += 1)
      h.db.rows('trip_steps').push({ id: `p${day}`, trip_id: TRIP, day_number: day, order_index: 0, title: `Jour ${day}`, latitude: null, longitude: null, source: 'user', metadata: {} });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(steps()).toHaveLength(5);
    expect(vi.mocked(getClimateNormals)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getClimateNormals).mock.calls[0]).toEqual([ISLAND_CENTER.lat, ISLAND_CENTER.lon]);
  });

  describe('île proche du continent du même pays : validée contre son contour', () => {
    /** Le continent, au nord, dans le cercle de l'île (à ~140 km du centre) mais hors de son contour : des villages plus hauts que ceux de l'île. */
    const CONTINENT = { lat: 41.25, lon: 8.9 };
    const continent = () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (2 * Math.PI * i) / 14;
        const r = 6 + (i % 3) * 6;
        return sd(`k${i}`, `Monte ${i + 1}`, CONTINENT.lat + (r * Math.cos(a)) / 111, CONTINENT.lon + (r * Math.sin(a)) / 85, 'village', 1200 + i * 25, 900);
      });

    it('les villages hauts du continent ne détournent pas l’itinéraire : les étapes restent dans le massif de l’île', async () => {
      h.places = [...sardinia(), ...continent()];
      trip(SARDAIGNE, { activity: 'hiking', end: '2026-11-14' });
      const res = await launch();
      expect(res.success).toBe(true);
      expect(h.contourAsks).toBe(1);
      expect(steps()).toHaveLength(5);
      for (const s of steps()) {
        expect(titleOf(s), titleOf(s)).not.toMatch(/^Monte /);
        expect(distanceKm(point(s), MASSIF), titleOf(s)).toBeLessThanOrEqual(48);
        expect(distanceKm(point(s), CONTINENT), titleOf(s)).toBeGreaterThan(60);
      }
      expect(notesOf(res).find((n) => /^Grande île/.test(n))).toMatch(/autour de Haut-village/);
    });

    it('contre-épreuve : si le contour englobait le continent (le cercle de l’île), il l’emporterait', async () => {
      h.contour = { type: 'Polygon', coordinates: [[[7.0, 38.0], [11.0, 38.0], [11.0, 41.5], [7.0, 41.5], [7.0, 38.0]]] };
      h.places = [...sardinia(), ...continent()];
      trip(SARDAIGNE, { activity: 'hiking', end: '2026-11-14' });
      const res = await launch();
      expect(res.success).toBe(true);
      for (const s of steps()) expect(distanceKm(point(s), CONTINENT), titleOf(s)).toBeLessThanOrEqual(48);
    });

    it('sans contour (service muet, île non décrite) : le calcul est arrêté pour cette île, la note le dit, aucun lieu du continent', async () => {
      h.contour = null;
      h.places = [...sardinia(), ...continent()];
      trip(SARDAIGNE, { activity: 'hiking', end: '2026-11-14' });
      const res = await launch();
      expect(res.success).toBe(true);
      expect(
        notesOf(res).some((n) => /Itinéraire calculé impossible : contour de l’île introuvable sur la carte, aucun lieu ne peut être prouvé sur l’île/.test(n))
      ).toBe(true);
      expect(notesOf(res).some((n) => /^Grande île|construit sur des lieux réels/.test(n))).toBe(false);
      // Aucun lieu de la carte n'a été lu ni utilisé : une étape par jour au lieu de l'île, jamais la voiture.
      expect(vi.mocked(lookupAreaPlaces)).not.toHaveBeenCalled();
      expect(steps()).toHaveLength(5);
      for (const s of steps()) expect(distanceKm(point(s), CONTINENT), titleOf(s)).toBeGreaterThan(60);
      expect(steps().some((s) => s.transport_mode === 'car')).toBe(false);
    });

    it('un lieu dit qui n’existe que sur le continent est ignoré ; celui de l’île centre la zone', async () => {
      h.ai = false;
      h.places = [...sardinia(), ...continent()];
      const homonym = { name: 'Monte Rosso', lat: CONTINENT.lat, lon: CONTINENT.lon, countryCode: 'IT', country: 'Italie', kind: 'village', settlement: true, settlementRank: 3, extent: null };
      const onIsle = { name: 'Monte Rosso', lat: 40.1, lon: 8.55, countryCode: 'IT', country: 'Italie', kind: 'village', settlement: true, settlementRank: 3, extent: null };
      const west = [1, 2, 3, 4, 5, 6].map((i) => sd(`w${i}`, `Hameau ouest ${i}`, 40.1 + (i - 3.5) * 0.04, 8.55 + (i % 3) * 0.05, 'village', 400 + i * 10));
      h.places = [...sardinia(), ...continent(), sd('w', 'Monte Rosso', 40.1, 8.55, 'village', 450), ...west];
      trip(SARDAIGNE, { activity: 'hiking', end: '2026-11-14' });
      h.db.rows('trips')[0].metadata = { compas: { anchor: SARDAIGNE, prefs: { wishes: ['Monte Rosso'] } } };
      const { stageCandidates } = await import('../server/placeLookup');
      // Le continent est cherché en premier et c'est lui que la carte classe en tête : il n'est pas sur l'île.
      vi.mocked(stageCandidates).mockImplementation(async (name: string) => (name === 'Monte Rosso' ? [homonym, onIsle] : []));
      const res = await launch();
      expect(res.success).toBe(true);
      expect(notesOf(res).some((n) => /zone de \d+ km autour de « Monte Rosso », le lieu que tu as dit/.test(n))).toBe(true);
      for (const s of steps()) expect(distanceKm(point(s), { lat: 40.1, lon: 8.55 })).toBeLessThanOrEqual(48);
    });
  });

  describe('Eubée, collée à la Béotie : le repli lui-même reste sur l’île', () => {
    const EUBEE = {
      name: 'Eubée',
      lat: 38.58,
      lon: 23.8,
      countryCode: 'GR',
      country: 'Grèce',
      kind: 'island',
      extent: [23.0, 39.2, 24.6, 37.95],
    };
    const EUBEE_CONTOUR = {
      type: 'Polygon',
      coordinates: [[[23.0, 39.0], [23.3, 39.2], [23.8, 38.95], [24.1, 38.7], [24.6, 38.05], [24.35, 37.95], [24.0, 38.15], [23.7, 38.35], [23.5, 38.5], [23.2, 38.75], [23.0, 39.0]]],
    };
    // Le massif près de la côte sud-ouest de l'île, la Béotie en face : à ~27 km l'un de l'autre, mais de part et d'autre du détroit.
    const BEOTIE = { lat: 38.27, lon: 23.62 };
    const DIRFYS = { lat: 38.5, lon: 23.72 };
    const ev = (id: string, name: string, lat: number, lon: number, eleM: number | null) => ({
      id: `e${id}`,
      name,
      lat,
      lon,
      kind: 'village' as const,
      population: null,
      eleM,
      countryCode: 'GR',
    });
    /** Un groupe de villages autour d'un point. */
    const around = (prefix: string, c: { lat: number; lon: number }, n: number, low: number | null, high: number | null, spreadKm: number) =>
      Array.from({ length: n }, (_, i) => {
        const a = (2 * Math.PI * i) / n;
        const r = (spreadKm * ((i % 3) + 1)) / 3;
        return ev(
          `${prefix}${i}`,
          `${prefix} ${i + 1}`,
          c.lat + (r * Math.cos(a)) / 111,
          c.lon + (r * Math.sin(a)) / 87,
          low == null || high == null ? null : Math.round(low + ((high - low) * i) / Math.max(1, n - 1))
        );
      });
    /** L'île : des villages le long de sa bande NO-SE, le massif de Dirfys, et la Béotie (continent) à 40 km. */
    function eubee(opts: { relief: boolean; beotieEle: [number, number] | null }) {
      const out = [];
      for (let i = 0; i < 24; i += 1) {
        const t = i / 23;
        out.push(ev(`c${i}`, `Côte ${i + 1}`, 39.0 - t * 0.95, 23.2 + t * 1.0, opts.relief ? 10 + (i % 6) * 15 : null));
      }
      out.push(...around('Dirfys', DIRFYS, 12, opts.relief ? 550 : null, opts.relief ? 900 : null, 8));
      out.push(...around('Béotie', BEOTIE, 20, opts.beotieEle?.[0] ?? null, opts.beotieEle?.[1] ?? null, 5));
      return out;
    }
    const isMainland = (s: Record<string, unknown>) => /^Béotie/.test(titleOf(s));

    it('massif non trouvé (altitudes inconnues) mais contour connu : la zone reste le centre de l’île, sans le moindre lieu de Béotie', async () => {
      h.contour = EUBEE_CONTOUR;
      h.places = eubee({ relief: false, beotieEle: null });
      trip(EUBEE, { activity: 'hiking', end: '2026-11-14' });
      const res = await launch();
      expect(res.success).toBe(true);
      expect(notesOf(res).some((n) => /Massif de l’île non trouvé \(altitudes des lieux de l’île introuvables\) : zone prise au centre de l’île/.test(n))).toBe(true);
      // Le planificateur a bien travaillé (pas de repli sur l'IA) et reste sur l'île.
      expect(h.stageAsks).toBe(0);
      expect(notesOf(res).some((n) => /construit sur des lieux réels de la carte/.test(n))).toBe(true);
      expect(steps()).toHaveLength(5);
      expect(steps().some(isMainland)).toBe(false);
      // Preuve directe : le planificateur n'a reçu aucun lieu du continent (alors que la carte en rend à 30 km du centre).
      const given = vi.mocked(planItinerary).mock.calls[0][0].places;
      expect(given.length).toBeGreaterThan(5);
      expect(given.some((p) => /^Béotie/.test(p.name))).toBe(false);
      expect(h.places.filter((p) => /^Béotie/.test(String(p.name))).some((p) => distanceKm(p as { lat: number; lon: number }, EUBEE) < 45)).toBe(true);
    });

    it('massif trouvé, mais la Béotie est à moins de 48 km de lui : la zone du massif ne prend toujours que des lieux de l’île', async () => {
      h.contour = EUBEE_CONTOUR;
      // Béotie aussi haute que les hauteurs de Dirfys (elle passerait le filtre d'altitude) : seul le contour l'écarte.
      h.places = eubee({ relief: true, beotieEle: [560, 880] });
      trip(EUBEE, { activity: 'hiking', end: '2026-11-14' });
      const res = await launch();
      expect(res.success).toBe(true);
      expect(notesOf(res).find((n) => /^Grande île/.test(n))).toMatch(/^Grande île : zone de \d+ km/);
      expect(distanceKm(DIRFYS, BEOTIE)).toBeLessThan(30);
      expect(steps()).toHaveLength(5);
      expect(steps().some(isMainland)).toBe(false);
      const given = vi.mocked(planItinerary).mock.calls[0][0].places;
      expect(given.length).toBeGreaterThan(5);
      expect(given.some((p) => /^Béotie/.test(p.name))).toBe(false);
    });

    it('repli au centre de l’île : un lieu dit qui n’existe que sur le continent (Béotie) n’est pas retenu comme étape voulue', async () => {
      h.contour = EUBEE_CONTOUR;
      h.places = eubee({ relief: false, beotieEle: null });
      trip(EUBEE, { activity: 'hiking', end: '2026-11-14' });
      h.db.rows('trips')[0].metadata = { compas: { anchor: EUBEE, prefs: { wishes: ['Profitis Ilias'] } } };
      const { stageCandidates } = await import('../server/placeLookup');
      vi.mocked(stageCandidates).mockImplementation(async (name: string) =>
        name === 'Profitis Ilias'
          ? [{ name, lat: BEOTIE.lat, lon: BEOTIE.lon, countryCode: 'GR', country: 'Grèce', kind: 'village', settlement: true, settlementRank: 3, extent: null }]
          : []
      );
      const res = await launch();
      expect(res.success).toBe(true);
      // Le lieu dit est sur le continent, à portée de la zone : il n'est ni une étape voulue ni une étape.
      expect(vi.mocked(planItinerary).mock.calls[0][0].waypoints ?? []).toEqual([]);
      expect(steps().some(isMainland)).toBe(false);
    });

    describe('repli sur l’IA : ses propositions se prouvent elles aussi sur l’île', () => {
      const cand = (name: string, lat: number, lon: number) => ({
        name,
        lat,
        lon,
        countryCode: 'GR',
        country: 'Grèce',
        kind: 'village',
        settlement: true,
        settlementRank: 3,
        extent: null,
      });
      /** Karystos et Dirfys sont sur l'île ; Thèbes est sur le continent du même pays, à portée de la zone. */
      const MAP_GR: Record<string, ReturnType<typeof cand>> = {
        Karystos: cand('Karystos', 38.1, 24.4),
        Dirfys: cand('Dirfys', 38.55, 23.75),
        Thèbes: cand('Thèbes', 38.32, 23.32),
      };
      const AI_STAGES = {
        stages: [
          [1, 'Karystos', 'aucun', ''],
          [2, 'Thèbes', 'voiture', ''],
          [3, 'Dirfys', 'marche', ''],
          [4, 'Thèbes', 'voiture', ''],
          [5, 'Karystos', 'marche', ''],
        ],
      };
      beforeEach(async () => {
        const { stageCandidates } = await import('../server/placeLookup');
        vi.mocked(stageCandidates).mockImplementation(async (name: string) => (MAP_GR[name] ? [MAP_GR[name]] : []));
        // Aucun lieu habité lu : le calcul déterministe retombe, l'IA est consultée.
        h.places = [];
        h.stages = AI_STAGES;
      });

      it('contour prouvé : la proposition de Thèbes (continent) est écartée, celles de l’île sont écrites', async () => {
        h.contour = EUBEE_CONTOUR;
        trip(EUBEE, { activity: 'hiking', end: '2026-11-14' });
        const res = await launch();
        expect(res.success).toBe(true);
        expect(h.stageAsks).toBeGreaterThan(0);
        expect(usedAi(res)).toBe(true);
        expect(steps()).toHaveLength(5);
        const contour = parseIslandContour(EUBEE_CONTOUR)!;
        // L'IA a bien écrit des étapes de l'île, et aucune n'est hors du contour.
        expect(steps().some((s) => /Karystos|Dirfys/.test(titleOf(s)))).toBe(true);
        for (const s of steps()) expect(onIslandContour(contour, point(s)), titleOf(s)).toBe(true);
        expect(notesOf(res).some((n) => /introuvable\(s\) sur la carte/.test(n))).toBe(true);
      });

      it('sans contour prouvé : l’IA n’est pas consultée, aucune étape n’est écrite sur un lieu qu’on ne peut prouver, la note le dit', async () => {
        h.contour = null;
        trip(EUBEE, { activity: 'hiking', end: '2026-11-14' });
        const res = await launch();
        expect(res.success).toBe(true);
        expect(h.stageAsks).toBe(0);
        expect(usedAi(res)).toBe(false);
        // Une étape par jour sur le lieu (l'île), jamais Thèbes ni Karystos.
        expect(steps()).toHaveLength(5);
        for (const s of steps()) expect(distanceKm(point(s), EUBEE), titleOf(s)).toBeLessThan(1);
        expect(notesOf(res).some((n) => /Itinéraire calculé impossible : contour de l’île introuvable/.test(n))).toBe(true);
        expect(notesOf(res).some((n) => /Aucune étape proposée pour « Eubée » : sans le contour de l’île, aucune proposition ne peut être prouvée sur l’île/.test(n))).toBe(true);
        // Pas de promesse trompeuse d'un itinéraire du spécialiste « vérifié sur la carte ».
        expect(notesOf(res).some((n) => /Itinéraire proposé par le spécialiste/.test(n))).toBe(false);
      });

      it('sans contour prouvé : même une proposition gardée au partage (autre voyage) n’est pas écrite', async () => {
        h.contour = null;
        const { readShared } = await import('../server/sharedCache');
        vi.mocked(readShared).mockResolvedValue(
          [1, 2, 3, 4, 5].map((day) => ({ day, place: day % 2 ? 'Karystos' : 'Dirfys', move: 'marche', note: '' }))
        );
        trip(EUBEE, { activity: 'hiking', end: '2026-11-14' });
        const res = await launch();
        vi.mocked(readShared).mockResolvedValue(undefined);
        expect(res.success).toBe(true);
        expect(usedAi(res)).toBe(false);
        for (const s of steps()) expect(distanceKm(point(s), EUBEE), titleOf(s)).toBeLessThan(1);
      });

      it('une destination qui n’est pas une grande île garde le chemin de l’IA tel quel', async () => {
        h.contour = null;
        trip({ ...EUBEE, kind: 'city', extent: null }, { activity: 'hiking', end: '2026-11-14' });
        await launch();
        expect(h.stageAsks).toBeGreaterThan(0);
      });
    });

    it('sans contour : ni repli au centre, ni massif, ni lieu du continent — le calcul est arrêté et la note le dit', async () => {
      h.contour = null;
      h.places = eubee({ relief: true, beotieEle: [800, 1350] });
      trip(EUBEE, { activity: 'hiking', end: '2026-11-14' });
      const res = await launch();
      expect(res.success).toBe(true);
      expect(notesOf(res).some((n) => /Itinéraire calculé impossible : contour de l’île introuvable/.test(n))).toBe(true);
      expect(vi.mocked(lookupAreaPlaces)).not.toHaveBeenCalled();
      expect(steps().some(isMainland)).toBe(false);
    });
  });

  describe('ancre enregistrée avant l’étiquette OSM (Photon : une île sous « other »)', () => {
    const OLD = { ...SARDAIGNE, kind: 'other' };
    const found = (over: Record<string, unknown> = {}) => ({
      name: 'Sardaigne',
      lat: 40.05,
      lon: 9.0,
      countryCode: 'IT',
      country: 'Italie',
      kind: 'other',
      osmTag: 'place=island',
      settlement: false,
      extent: SARDAIGNE.extent,
      ...over,
    });
    const storedAnchor = () => ((h.db.rows('trips')[0].metadata as { compas: { anchor: Record<string, unknown> } }).compas.anchor);
    beforeEach(() => {
      vi.mocked(lookupDestination).mockReset();
      vi.mocked(lookupDestination).mockImplementation(async () => null);
    });

    it('l’ancre est ré-résolue une fois : l’île est reconnue (contour, massif) et l’étiquette est gardée sur le voyage', async () => {
      vi.mocked(lookupDestination).mockImplementation(async () => found() as never);
      h.places = sardinia();
      trip(OLD, { activity: 'hiking', end: '2026-11-14' });
      const res = await launch();
      expect(res.success).toBe(true);
      expect(vi.mocked(lookupDestination)).toHaveBeenCalledTimes(1);
      expect(h.contourAsks).toBe(1);
      expect(notesOf(res).find((n) => /^Grande île/.test(n))).toMatch(/autour de Haut-village/);
      for (const s of steps()) expect(distanceKm(point(s), MASSIF), titleOf(s)).toBeLessThanOrEqual(48);
      expect(storedAnchor().osmTag).toBe('place=island');
      // Le reste de l'ancre n'a pas bougé.
      expect(storedAnchor()).toMatchObject({ name: 'Sardaigne', kind: 'other', countryCode: 'IT' });
    });

    it('déjà étiquetée : aucune requête de plus', async () => {
      h.places = sardinia();
      trip({ ...OLD, osmTag: 'place=island' }, { activity: 'hiking', end: '2026-11-14' });
      const res = await launch();
      expect(res.success).toBe(true);
      expect(vi.mocked(lookupDestination)).not.toHaveBeenCalled();
      expect(notesOf(res).some((n) => /^Grande île/.test(n))).toBe(true);
      expect(storedAnchor().osmTag).toBe('place=island');
    });

    it('la carte ne rend rien (ou un autre lieu, ou un lieu sans étiquette) : l’ancre reste telle quelle, le voyage n’est pas réécrit', async () => {
      for (const answer of [null, found({ lat: 12, lon: 100 }), found({ osmTag: undefined })]) {
        h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
        vi.mocked(lookupDestination).mockImplementation(async () => answer as never);
        h.places = sardinia();
        trip(OLD, { activity: 'hiking', end: '2026-11-14' });
        const res = await launch();
        expect(res.success).toBe(true);
        expect(notesOf(res).some((n) => /^Grande île/.test(n))).toBe(false);
        expect(h.contourAsks).toBe(0);
        expect(storedAnchor().osmTag).toBeUndefined();
        h.contourAsks = 0;
      }
    });

    it('une ancre qui n’est pas « other » (ville, pays, île déjà typée) ne coûte aucune requête', async () => {
      h.places = sardinia();
      trip(SARDAIGNE, { activity: 'hiking', end: '2026-11-14' });
      await launch();
      expect(vi.mocked(lookupDestination)).not.toHaveBeenCalled();
    });
  });

  it('séjour sans activité de marche sur la même île (culturel) : le chemin d’un pays, pas le massif', async () => {
    h.ai = false;
    h.places = sardinia();
    trip(SARDAIGNE, { activity: 'cultural', end: '2026-11-19' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(notesOf(res).some((n) => /^Grande île/.test(n))).toBe(false);
    expect(basesOf().length).toBeGreaterThanOrEqual(2);
  });
});
