import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Sentier nommé (décision de Tony du 14 oct. : « utilise l'IA au maximum »), de bout en bout sur
 * `compasAutofillAction` (client Supabase en mémoire, carte simulée à sa frontière) :
 *
 *  - « le chemin de Stevenson en 4 jours » : les étapes d'un sentier ne se calculent pas sur les lieux
 *    de la zone. Avec l'IA, le spécialiste les propose d'abord (le sentier est dit dans sa demande),
 *    chaque lieu vérifié sur la carte, et le calcul n'est pas lancé ;
 *  - IA muette ou lieux introuvables : le calcul habituel sur les lieux réels de la zone (jamais
 *    « une étape par jour sur le lieu »), et la note le dit ;
 *  - IA éteinte : le calcul, sans rien demander ;
 *  - un parcours du catalogue qui ne porte pas le nom du sentier n'est pas pris.
 *
 * Les lieux sont simulés (coordonnées approchées) : le moteur ne contient aucune liste d'étapes.
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  ai: true,
  /** Réponse de l'IA à l'itinéraire (le reste de ses appels est « dégradé »). */
  stages: null as unknown,
  /** Consignes reçues par l'IA pour l'itinéraire. */
  stagePrompts: [] as string[],
  places: [] as Array<Record<string, unknown>>,
  /** Parcours du catalogue rendus près de la destination. */
  catalog: [] as Array<Record<string, unknown>>,
  /** La carte ne répond pas pour le couloir d'un « de X à Y » (fenêtres hors du centre des Cévennes), mais répond pour la zone. */
  corridorDown: false,
  /** Recherches de lieux d'une zone en cours, et le plus grand nombre en même temps. */
  areaInFlight: 0,
  areaMaxInFlight: 0,
  areaCalls: 0,
  /**
   * Horloge virtuelle (`Date.now` décalé) : chaque recherche du couloir dure `cost` ms au plus (jamais
   * au-delà de l'échéance qu'elle reçoit) ; sous 4 s, elle ne part pas (« plus de temps »), comme
   * `lookupAreaPlaces`.
   */
  clock: { on: false, offset: 0, cost: 0 },
  /** Ce que chaque fenêtre du couloir a rendu (sa latitude) ou « plus de temps ». */
  windows: [] as string[],
}));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));

/** Les étapes du chemin de Stevenson que la carte connaît par leur nom. */
const MAP: Record<string, { lat: number; lon: number }> = {
  'Le Monastier-sur-Gazeille': { lat: 44.94, lon: 3.99 },
  'Le Bouchet-Saint-Nicolas': { lat: 44.89, lon: 3.79 },
  Langogne: { lat: 44.73, lon: 3.86 },
  Chasseradès: { lat: 44.55, lon: 3.83 },
  'Le Bleymard': { lat: 44.48, lon: 3.73 },
};
const place = (name: string) => ({
  name,
  ...MAP[name],
  countryCode: 'FR',
  country: 'France',
  kind: 'village',
  settlement: true,
  settlementRank: 3,
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
  lookupIslandContour: vi.fn(async () => null),
  stageCandidates: vi.fn(async (name: string) => (MAP[name] ? [place(name)] : [])),
  pathCandidates: vi.fn(async () => []),
  stageAliasCandidates: vi.fn(async () => []),
}));
vi.mock('../server/stagePoiLookup', async () => {
  const { distanceKm } = await import('../engine/places');
  return {
    lookupAreaPlaces: vi.fn(async (q: { center: { lat: number; lon: number }; radiusKm: number }, _deadline?: number, diag?: string[]) => {
      h.areaCalls += 1;
      if (h.clock.on && diag) {
        const left = (_deadline ?? Infinity) - Date.now();
        if (left < 4000) {
          h.windows.push('plus de temps');
          return null;
        }
        h.clock.offset += Math.min(h.clock.cost, left);
        h.windows.push(q.center.lat.toFixed(2));
      }
      h.areaInFlight += 1;
      h.areaMaxInFlight = Math.max(h.areaMaxInFlight, h.areaInFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      h.areaInFlight -= 1;
      return h.corridorDown && diag && q.center.lat !== 44.62
        ? null
        : h.places.filter((p) => distanceKm(q.center, p as { lat: number; lon: number }) <= q.radiusKm * 1.05);
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
vi.mock('@/lib/ai/askAI', () => ({
  aiEnabled: () => h.ai,
  askAI: vi.fn(async (req: { system?: string; prompt?: string }) => {
    const { buildCompasStagesSystem } = await import('@/lib/ai/features/compasAutofill');
    if (req.system === buildCompasStagesSystem()) {
      h.stagePrompts.push(String(req.prompt));
      if (h.ai && h.stages) return { text: JSON.stringify(h.stages), model: 'x', degraded: false, cached: false, provider: 'nvidia' };
    }
    return { text: '{}', model: 'x', degraded: true, cached: false, provider: 'fallback' };
  }),
}));

import { compasAutofillAction } from '../server/autofillActions';
import { planItinerary } from '../engine/itinerary';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const TRIP = '77777777-7777-4777-8777-777777777777';
const launch = () => compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'all' });

const CEVENNES = {
  name: 'Cévennes',
  lat: 44.62,
  lon: 3.84,
  countryCode: 'FR',
  country: 'France',
  kind: 'other',
  extent: [3.5, 44.95, 4.15, 44.3],
};

function trip(wishes: string[]) {
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: 'Trek · Cévennes',
    start_date: '2026-11-10',
    end_date: '2026-11-13',
    destination_name: 'Cévennes',
    destination_country_code: 'FR',
    party_size: 2,
    budget_currency: 'EUR',
    primary_activity: 'trekking',
    estimated_budget: null,
    metadata: { compas: { anchor: CEVENNES, prefs: { pace: 'normal', nights: null, avoid: [], wishes } } },
    updated_at: '2026-10-14T09:00:00.000000+00:00',
  });
}
const steps = () => [...h.db.rows('trip_steps')].sort((a, b) => Number(a.day_number) - Number(b.day_number));
const titles = () => steps().map((s) => String(s.title).replace(/^Jour \d+ · /, ''));
const notesOf = (res: Awaited<ReturnType<typeof launch>>) => (res.success && 'summary' in res ? res.summary.notes : []);

/** Villages de la zone (grille de ~12 km autour du centre), que le calcul sait choisir. */
const ZONE_VILLAGES = Array.from({ length: 25 }, (_, i) => {
  const r = Math.floor(i / 5) - 2;
  const c = (i % 5) - 2;
  return {
    id: `v${i}`,
    name: `Village ${String.fromCharCode(65 + i)}`,
    lat: CEVENNES.lat + r * 0.11,
    lon: CEVENNES.lon + c * 0.15,
    kind: 'village',
    population: 300 + i * 20,
    eleM: 900 + ((i * 37) % 400),
    countryCode: 'FR',
  };
});
const ZONE_NAMES = new Set(ZONE_VILLAGES.map((v) => v.name));

const STEVENSON_STAGES = {
  stages: [
    [1, 'Le Bouchet-Saint-Nicolas', 'marche', 'départ du Monastier'],
    [2, 'Langogne', 'marche', ''],
    [3, 'Chasseradès', 'marche', ''],
    [4, 'Le Bleymard', 'marche', 'mont Lozère'],
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.ai = true;
  h.stages = null;
  h.stagePrompts = [];
  h.places = ZONE_VILLAGES;
  h.catalog = [];
  h.corridorDown = false;
  h.areaInFlight = 0;
  h.areaMaxInFlight = 0;
  h.areaCalls = 0;
  h.clock = { on: false, offset: 0, cost: 0 };
  h.windows = [];
  h.db = memorySupabase({
    user: () => ({ id: 'u1' }),
    rpc: (fn) => (fn === 'compas_search_routes' ? { data: h.catalog, error: null } : undefined),
  });
});

describe('sentier nommé : l’IA propose ses étapes, la carte les vérifie', () => {
  it('IA allumée : les étapes du sentier, dans l’ordre, retrouvées sur la carte ; le calcul de zone n’est pas lancé', async () => {
    h.stages = STEVENSON_STAGES;
    trip(['Chemin de Stevenson']);
    const res = await launch();
    expect(res.success).toBe(true);
    expect(titles()).toEqual(['Le Bouchet-Saint-Nicolas', 'Langogne', 'Chasseradès', 'Le Bleymard']);
    // Chaque étape est posée sur le lieu de la carte, pas sur le centre des Cévennes.
    for (const s of steps()) {
      const want = MAP[String(s.title).replace(/^Jour \d+ · /, '')];
      expect(Number(s.latitude)).toBeCloseTo(want.lat, 2);
      expect(Number(s.longitude)).toBeCloseTo(want.lon, 2);
    }
    // Le sentier est dit au spécialiste, et le calcul sur les lieux de la zone n'a pas tourné.
    expect(h.stagePrompts.length).toBeGreaterThan(0);
    expect(h.stagePrompts[0]).toContain('Sentier a suivre : Chemin de Stevenson');
    expect(planItinerary).not.toHaveBeenCalled();
  });

  it('IA muette : le calcul sur les lieux réels de la zone, annoncé, jamais « une étape par jour sur le lieu »', async () => {
    trip(['Chemin de Stevenson']);
    const res = await launch();
    expect(res.success).toBe(true);
    expect(h.stagePrompts.length).toBeGreaterThan(0);
    expect(planItinerary).toHaveBeenCalled();
    expect(steps()).toHaveLength(4);
    for (const name of titles()) expect(ZONE_NAMES.has(name), name).toBe(true);
    const notes = notesOf(res);
    expect(notes.some((n) => n.includes('Étapes du sentier « Chemin de Stevenson » non retrouvées sur la carte'))).toBe(true);
    expect(notes.some((n) => n.includes('une étape par jour sur le lieu'))).toBe(false);
  });

  it('IA qui répond avec des lieux introuvables sur la carte : le calcul aussi', async () => {
    h.stages = { stages: [[1, 'Nullepart', 'marche', ''], [2, 'Ailleurs', 'marche', ''], [3, 'Inconnu', 'marche', ''], [4, 'Fantôme', 'marche', '']] };
    trip(['Chemin de Stevenson']);
    const res = await launch();
    expect(res.success).toBe(true);
    expect(planItinerary).toHaveBeenCalled();
    for (const name of titles()) expect(ZONE_NAMES.has(name), name).toBe(true);
    const notes = notesOf(res);
    expect(notes.some((n) => n.includes('Étapes du sentier « Chemin de Stevenson » non retrouvées sur la carte'))).toBe(true);
    // Les notes de la tentative (lieux introuvables, « je le redemande ») ne restent pas : le calcul les remplace.
    expect(notes.some((n) => n.includes('n’existent pas sur la carte'))).toBe(false);
  });

  it('IA éteinte : le calcul directement, sans rien demander', async () => {
    h.ai = false;
    trip(['Chemin de Stevenson']);
    const res = await launch();
    expect(res.success).toBe(true);
    expect(h.stagePrompts).toHaveLength(0);
    expect(planItinerary).toHaveBeenCalled();
    for (const name of titles()) expect(ZONE_NAMES.has(name), name).toBe(true);
  });

  it('sans sentier nommé, rien ne change : le calcul d’abord, l’IA n’est pas consultée', async () => {
    h.stages = STEVENSON_STAGES;
    trip(['lac']);
    const res = await launch();
    expect(res.success).toBe(true);
    expect(planItinerary).toHaveBeenCalled();
    expect(h.stagePrompts).toHaveLength(0);
  });

  it('un parcours du catalogue qui ne porte pas le nom du sentier n’est pas pris', async () => {
    h.stages = STEVENSON_STAGES;
    h.catalog = [{ route_id: 42, name: 'Boucle du lac de Naussac', distance_km: 60, distance_from_m: 800 }];
    trip(['Chemin de Stevenson']);
    const res = await launch();
    expect(res.success).toBe(true);
    const meta = h.db.rows('trips')[0].metadata as Record<string, unknown>;
    expect(meta.route_id).toBeUndefined();
    expect(titles()).toEqual(['Le Bouchet-Saint-Nicolas', 'Langogne', 'Chasseradès', 'Le Bleymard']);
  });
});

describe('sentier nommé : les notes du calcul de repli survivent', () => {
  /** « Itinéraire de X à Y impossible » : écrite par le calcul lui-même (`plannedStages`), pas par la tentative de l'IA. */
  // Note traduite (main, `compas.server.autofill.plan.pointToPointFailed`) : « du Monastier », plus « de Le Monastier ».
  const NOTE_DE_X_A_Y = 'Itinéraire du Monastier à Cévennes impossible (lieux entre les deux indisponibles)';

  it('IA muette : la note du calcul de repli (« de X à Y » impossible) est gardée, celles de la tentative non', async () => {
    h.corridorDown = true;
    trip(['Chemin de Stevenson', 'de Le Monastier à Cévennes']);
    (h.db.rows('trips')[0].metadata as { compas: Record<string, unknown> }).compas.origin = {
      name: 'Le Monastier',
      lat: 44.94,
      lon: 3.99,
      countryCode: 'FR',
      source: 'dit',
    };
    const res = await launch();
    expect(res.success).toBe(true);
    const notes = notesOf(res);
    // Le calcul de repli a bien tourné et l'annonce.
    expect(notes.some((n) => n.includes('Étapes du sentier « Chemin de Stevenson » non retrouvées sur la carte'))).toBe(true);
    // Sa propre note (le trajet de X à Y n'a pas pu être construit) n'est plus effacée par la troncature.
    expect(notes.some((n) => n.includes(NOTE_DE_X_A_Y))).toBe(true);
    // Les notes de la tentative de l'IA, elles, restent remplacées.
    expect(notes.some((n) => n.includes('Itinéraire détaillé indisponible'))).toBe(false);
  });

  it('IA muette et calcul sans lieu : les notes de la tentative sont gardées, avec celle du calcul', async () => {
    h.places = [];
    h.corridorDown = true;
    trip(['Chemin de Stevenson', 'de Le Monastier à Cévennes']);
    (h.db.rows('trips')[0].metadata as { compas: Record<string, unknown> }).compas.origin = {
      name: 'Le Monastier',
      lat: 44.94,
      lon: 3.99,
      countryCode: 'FR',
      source: 'dit',
    };
    const res = await launch();
    expect(res.success).toBe(true);
    const notes = notesOf(res);
    expect(notes.some((n) => n.includes('non retrouvées sur la carte : itinéraire calculé'))).toBe(false);
    const attempt = notes.findIndex((n) => n.includes('Itinéraire détaillé indisponible'));
    const calc = notes.findIndex((n) => n.includes(NOTE_DE_X_A_Y));
    expect(attempt).toBeGreaterThanOrEqual(0);
    expect(calc).toBeGreaterThan(attempt);
  });
});

// Relecture #108 (2) : le couloir d'un « de X à Y » ne lance plus ses fenêtres toutes ensemble (quota gratuit).
describe('couloir « de X à Y » : les fenêtres l’une après l’autre', () => {
  it('à vélo de Clermont aux Cévennes (≈ 140 km, trois fenêtres) : jamais deux recherches de zone en même temps', async () => {
    h.ai = false;
    trip(['de Clermont à Cévennes']);
    const row = h.db.rows('trips')[0];
    row.primary_activity = 'cycling';
    (row.metadata as { compas: Record<string, unknown> }).compas.origin = {
      name: 'Clermont',
      lat: 45.78,
      lon: 3.08,
      countryCode: 'FR',
      source: 'dit',
    };
    const res = await launch();
    expect(res.success).toBe(true);
    expect(h.areaCalls).toBeGreaterThanOrEqual(3);
    expect(h.areaMaxInFlight).toBe(1);
  });
});

// Relecture 3 de la PR #108 : en série, une fenêtre lente consommait tout le temps ; les dernières rendaient
// « plus de temps » et l'itinéraire revenait en arrière avant de sauter jusqu'à Nice le dernier jour.
describe('couloir « de X à Y » : chaque fenêtre a sa part du temps qui reste', () => {
  const GENEVA = { lat: 46.2, lon: 6.14 };
  const NICE = { name: 'Nice', lat: 43.7, lon: 7.27, countryCode: 'FR', country: 'France', kind: 'city', radiusKm: 15, extent: null };
  const CORRIDOR = Array.from({ length: 40 }, (_, i) => {
    const f = i / 39;
    return {
      id: `c${i}`,
      name: `Bourg ${i}`,
      lat: GENEVA.lat + (NICE.lat - GENEVA.lat) * f + (i % 2 ? 0.05 : -0.05),
      lon: GENEVA.lon + (NICE.lon - GENEVA.lon) * f,
      kind: 'town',
      population: 3000,
      eleM: 500,
      countryCode: 'FR',
    };
  });
  const realNow = Date.now.bind(Date);

  // Phase « étapes » : 30 s pour l'itinéraire (le cas « 70 s déjà écoulées sur 120 » de la relecture, en
  // plus serré) ; chaque fenêtre prendrait 20 s (carte lente, Overpass bloqué, Geoapify qui répond).
  it('Genève → Nice à vélo (5 fenêtres), 30 s pour l’itinéraire, 20 s par fenêtre : aucune fenêtre perdue, itinéraire vers le sud', async () => {
    h.ai = false;
    h.places = CORRIDOR;
    h.clock = { on: true, offset: 0, cost: 20_000 };
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + h.clock.offset);
    try {
      h.db.rows('trips').push({
        id: TRIP,
        user_id: 'u1',
        title: 'Vélo · Nice',
        start_date: '2026-11-10',
        end_date: '2026-11-17',
        destination_name: 'Nice',
        destination_country_code: 'FR',
        party_size: 2,
        budget_currency: 'EUR',
        primary_activity: 'cycling',
        estimated_budget: null,
        metadata: {
          compas: {
            anchor: NICE,
            origin: { name: 'Genève', lat: GENEVA.lat, lon: GENEVA.lon, countryCode: 'CH', source: 'dit' },
            prefs: { pace: 'normal', nights: null, avoid: [], wishes: ['de Genève à Nice'] },
          },
        },
        updated_at: '2026-10-14T09:00:00.000000+00:00',
      });
      const res = await compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'steps' });
      expect(res.success).toBe(true);
      expect(h.windows).toHaveLength(5);
      expect(h.windows).not.toContain('plus de temps');
      // Vers le sud, soir après soir (à 0,15° près : les bourgs alternent de part et d'autre de l'axe).
      const lats = steps().map((s) => Number(s.latitude));
      expect(lats.length).toBeGreaterThan(3);
      for (let i = 1; i < lats.length; i += 1) expect(lats[i], `jour ${i + 1}`).toBeLessThanOrEqual(lats[i - 1] + 0.15);
    } finally {
      spy.mockRestore();
    }
  });
});
