/**
 * P3.3 - Zero position fabriquee.
 *
 * Mesure live du 2026-09-28 (Chamonix -> Argentiere, 3 jours) : le schema de
 * sortie contenait `lat` / `lon`, et le modele les produisait. Jour 3 a alors
 * propose TROIS etapes a la MEME position (Argentiere) : chaine de trois points
 * identiques, OSRM repond 503 (NoSegment sur zero longueur), `perDay[2] = null`,
 * et le total retombe a « a verifier » sur les trois tuiles. Jours 1 et 2
 *etaient absurdes (62 km puis 115 km) parce que des sommets non routables en
 * voiture entraient dans la chaine.
 *
 * Ces tests verrouillent les trois garde-fous qui remplacent cette confiance :
 *   1. le schema ne peut pas TRANSPORTER de coordonnees ;
 *   2. la position vient de l'inventaire REEL, par le nom que l'IA a cite ;
 *   3. une chaine de points identiques donne 0 km PROUVE, jamais « a verifier ».
 */
import { describe, expect, it, vi } from 'vitest';
import {
  buildItineraryPrompt,
  itineraryOutputSchema,
  strictItineraryOutputSchema,
} from '@/lib/ai/features/itinerary';
import { assignPlaces, type PlaceCandidate } from '../engine/places';
import { materializeSteps, type DraftedStep } from '../engine/itineraryEngine';
import { routeItinerary, type GeoPoint, type RouteLeg } from '../engine/routing';
import {
  PRICE_TO_CHECK,
  type ItineraryModel,
  type ItineraryStep,
} from '../types';
import { ARGENTIERE, CHAMONIX } from './fixtures';

/* ------------------------------------------------------------------ */
/* Outils                                                             */
/* ------------------------------------------------------------------ */

const EMPTY = {
  distanceKm: null,
  movingMin: null,
  activityMin: null,
  elevGainM: null,
  elevLossM: null,
} as const;

function model(steps: readonly ItineraryStep[], days = 1, notes: ItineraryModel['notes'] = []): ItineraryModel {
  return {
    days,
    steps,
    notes,
    totals: { ...EMPTY },
    perDay: Array.from({ length: days }, () => ({ ...EMPTY })),
    weather: Array.from({ length: days }, () => null),
    metricsContext: 'terrain',
    budgetPerPerson: { amount: null, currency: 'EUR', state: 'a_reserver' },
    activityCount: 1,
    contingencies: [],
  };
}

function step(overrides: Partial<ItineraryStep> & { id: string; day: number; order: number }): ItineraryStep {
  return {
    kind: 'arret',
    title: 'Etape',
    placeName: null,
    startTime: null,
    durationMin: 60,
    reason: null,
    price: { ...PRICE_TO_CHECK },
    state: 'propose',
    kept: false,
    icon: 'map',
    lat: null,
    lon: null,
    mealSlot: null,
    ...overrides,
  };
}

function candidate(
  id: string,
  name: string,
  category: string,
  lat: number,
  lon: number,
): PlaceCandidate {
  return {
    id,
    name,
    category,
    lat,
    lon,
    description: null,
    region: null,
    country: 'France',
    pricePerNight: null,
    phone: null,
    website: null,
    isVerifiable: true,
  };
}

/** Les lieux REELS du corridor Chamonix - Argentiere, lus dans /api/pois. */
const CORRIDOR: PlaceCandidate[] = [
  candidate('o-mont-blanc', 'Mont Blanc', 'summit', 45.8326, 6.8652),
  candidate('o-gouter', 'Refuge du Gouter', 'refuge', 45.8447, 6.8427),
  candidate('o-midi', 'Aiguille du Midi', 'viewpoint', 45.879, 6.8873),
  candidate('o-plan', 'Refuge du Plan de l Aiguille', 'refuge', 45.8934, 6.8756),
  candidate('o-lac-blanc', 'Lac Blanc', 'water', 45.9123, 6.9012),
  candidate('o-charpoua', 'Refuge de la Charpoua', 'refuge', 45.9012, 6.9234),
];

const RAW_STEP = {
  day: 1,
  kind: 'arret',
  title: 'Pause',
  placeName: 'Lac Blanc',
  startTime: null,
  durationMin: 60,
  reason: null,
};

function promptFor(availablePlaces: { name: string; category: string }[]) {
  return buildItineraryPrompt({
    activityLabel: 'Randonnee',
    originLabel: 'Chamonix',
    destinationLabel: 'Argentiere',
    startDateLabel: '2026-07-11',
    durationDays: 3,
    partySize: 2,
    pace: 'normal',
    loop: false,
    preferences: ['paysage'],
    knownPlaces: [{ name: 'Chamonix', lat: 45.9237, lon: 6.8694 }],
    availablePlaces,
    brief: null,
  });
}

/* ------------------------------------------------------------------ */
/* 1. Le schema ne peut pas transporter de coordonnees                */
/* ------------------------------------------------------------------ */

describe('P3.3 - le schema IA ne porte aucune coordonnee', () => {
  it('CO-01 le schema NAIT sans lat ni lon', () => {
    const stepShape = itineraryOutputSchema.shape.steps.element as unknown as {
      shape: Record<string, unknown>;
    };
    expect(Object.keys(stepShape.shape)).not.toContain('lat');
    expect(Object.keys(stepShape.shape)).not.toContain('lon');
  });

  it('CO-02 une reponse qui contient des coordonnees est livree sans elles', () => {
    const parsed = itineraryOutputSchema.parse({
      days: [1],
      steps: [{ ...RAW_STEP, lat: 45.98, lon: 6.92 }],
      hypotheses: [],
    });
    const [out] = parsed.steps;
    expect(out).not.toHaveProperty('lat');
    expect(out).not.toHaveProperty('lon');
  });

  it('CO-03 le schema STRICT fait de meme', () => {
    const parsed = strictItineraryOutputSchema.parse({
      days: [1],
      steps: [{ ...RAW_STEP, kind: 'arret', lat: 45.98, lon: 6.92 }],
      hypotheses: [],
    });
    expect(parsed.steps[0]).not.toHaveProperty('lat');
  });

  it('CO-04 le gabarit de sortie propose au modele ne montre plus de coordonnee', () => {
    const { prompt } = promptFor([{ name: 'Lac Blanc', category: 'water' }]);
    expect(prompt).not.toContain('"lat"');
    expect(prompt).not.toContain('"lon"');
  });

  it('CO-05 une etape materialisee ne porte AUCUNE position', () => {
    const drafted = {
      day: 1,
      kind: 'arret' as const,
      title: 'Pause au lac',
      placeName: 'Lac Blanc',
      startTime: null,
      durationMin: 60,
      reason: null,
    } satisfies Omit<DraftedStep, 'lat' | 'lon'>;
    const out = materializeSteps({ days: 1, steps: [drafted as DraftedStep], hypotheses: [] }, 1);
    expect(out.every((s) => s.lat === null && s.lon === null)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 2. La position vient de l'inventaire REEL                           */
/* ------------------------------------------------------------------ */

describe('P3.3 - assignPlaces suit le lieu CITE, pas le plus proche', () => {
  it('CO-06 le lieu nomme par la proposition est celui qui est retenu', () => {
    const built = model([
      step({ id: 'a', day: 1, order: 1, kind: 'trajet' }),
      step({ id: 'b', day: 1, order: 2, kind: 'arret', placeName: 'Refuge de la Charpoua' }),
    ]);
    const out = assignPlaces(built, CORRIDOR, CHAMONIX, ARGENTIERE);
    const arret = out.steps.find((s) => s.id === 'b');
    // La Charpoua est a 8 km de Chamonix, Mont Blanc a 10 km : le plus proche
    // n'est PAS le lieu demande. Le nom decide, la position suit.
    expect(arret?.lat).toBeCloseTo(45.9012, 4);
    expect(arret?.lon).toBeCloseTo(6.9234, 4);
  });

  it('CO-07 le meme lieu ne peut pas servir deux fois le MEME jour', () => {
    const built = model([
      step({ id: 'a', day: 1, order: 1, kind: 'trajet' }),
      step({ id: 'b', day: 1, order: 2, kind: 'arret', placeName: 'Lac Blanc' }),
      step({ id: 'c', day: 1, order: 3, kind: 'ravitaillement', placeName: 'Lac Blanc' }),
    ]);
    const out = assignPlaces(built, CORRIDOR, CHAMONIX, ARGENTIERE);
    const b = out.steps.find((s) => s.id === 'b');
    const c = out.steps.find((s) => s.id === 'c');
    expect(b?.lat).not.toBeNull();
    // Le deuxieme passage au meme point devient une note : il ne recoit pas une
    // position photocopiee, et la journee ne compte donc pas un aller-retour.
    expect(c?.lat ?? null).toBeNull();
    expect(out.notes?.some((note) => note.title === 'Etape')).toBe(true);
  });

  it('CO-08 un lieu ne sert pas deux fois dans le meme voyage', () => {
    const built = model(
      [
        step({ id: 'a', day: 1, order: 1, kind: 'trajet' }),
        step({ id: 'b', day: 1, order: 2, kind: 'arret', placeName: 'Lac Blanc' }),
        step({ id: 'c', day: 2, order: 1, kind: 'arret', placeName: 'Lac Blanc' }),
      ],
      2,
    );
    const out = assignPlaces(built, CORRIDOR, CHAMONIX, ARGENTIERE);
    // Mesure du 2026-09-28 : le jour 1 et le jour 2 visitaient tous deux Lac
    // Blanc, et le jour 2 rebouclait sur lui-meme. Un lieu ne porte qu une
    // visite par voyage : l intention est donc DEPLACEE vers un autre lieu
    // reel, jamais recopiee sur le meme point.
    const c = out.steps.find((s) => s.id === 'c');
    expect(c?.lat).not.toBeCloseTo(45.9123, 4);
    const coords = out.steps
      .map((s) => `${s.lat},${s.lon}`)
      .filter((k) => k !== 'null,null');
    expect(new Set(coords).size).toBe(coords.length);
  });

  it('CO-09 un lieu absent de l inventaire ne recoit AUCUNE position', () => {
    const built = model([
      step({ id: 'a', day: 1, order: 1, kind: 'trajet' }),
      step({ id: 'b', day: 1, order: 2, kind: 'arret', placeName: 'Refuge inventé' }),
    ]);
    const out = assignPlaces(built, CORRIDOR, CHAMONIX, ARGENTIERE);
    const b = out.steps.find((s) => s.id === 'b');
    expect(b?.lat ?? null).toBeNull();
    expect(b?.lon ?? null).toBeNull();
  });

  it('CO-10 le lieu le plus proche reste le defaut quand rien n est nomme', () => {
    const built = model([
      step({ id: 'a', day: 1, order: 1, kind: 'trajet' }),
      step({ id: 'b', day: 1, order: 2, kind: 'ravitaillement', placeName: null, title: 'Ravitaillement' }),
    ]);
    const out = assignPlaces(built, CORRIDOR, CHAMONIX, ARGENTIERE);
    // Lac Blanc est le seul point d'eau du corridor : c'est lui qui doit etre
    // choisi pour un ravitaillement, meme si le refuge du Gouter est plus proche.
    expect(out.steps.find((s) => s.id === 'b')?.placeName).toBe('Lac Blanc');
  });
});

/* ------------------------------------------------------------------ */
/* 3. Une chaine identique donne 0 km PROUVE                           */
/* ------------------------------------------------------------------ */

function fakeRoute(): { deps: Parameters<typeof routeItinerary>[1]; calls: GeoPoint[][] } {
  const calls: GeoPoint[][] = [];
  const deps = {
    route: async (points: readonly { lat: number; lon: number }[]) => {
      calls.push([...points]);
      const legs: RouteLeg[] = [];
      for (let index = 0; index < points.length - 1; index += 1) {
        const from = points[index];
        const to = points[index + 1];
        legs.push({
          distanceKm: 10,
          durationMin: 20,
          geometry: [
            [from.lon, from.lat],
            [to.lon, to.lat],
          ] as RouteLeg['geometry'],
        });
      }
      return legs;
    },
    elevation: async () => null,
  };
  return { deps, calls };
}

describe('P3.3 - une journee sur un seul point vaut 0 km, pas « a verifier »', () => {
  it('CO-11 trois etapes au meme point : 0 km prouve', async () => {
    const built = model([
      step({ id: 'a', day: 1, order: 1, lat: 45.9819, lon: 6.9269 }),
      step({ id: 'b', day: 1, order: 2, lat: 45.9819, lon: 6.9269 }),
      step({ id: 'c', day: 1, order: 3, lat: 45.9819, lon: 6.9269 }),
    ]);
    const { deps, calls } = fakeRoute();
    const out = await routeItinerary(built, deps);
    expect(calls).toHaveLength(0);
    expect(out.perDay[0].distanceKm).toBe(0);
    expect(out.totals.distanceKm).toBe(0);
    expect(out.perDay[0].elevGainM).toBe(0);
  });

  it('CO-12 le routeur ne recoit jamais deux points identiques a la suite', async () => {
    const built = model([
      step({ id: 'a', day: 1, order: 1, lat: 45.9237, lon: 6.8694 }),
      step({ id: 'b', day: 1, order: 2, lat: 45.9237, lon: 6.8694 }),
      step({ id: 'c', day: 1, order: 3, lat: 45.9819, lon: 6.9269 }),
    ]);
    const { deps, calls } = fakeRoute();
    const out = await routeItinerary(built, deps);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(2);
    expect(out.perDay[0].distanceKm).toBe(10);
  });

  it('CO-13 la duree mesuree est ecrite sur l etape d arrivee du troncon', async () => {
    const built = model([
      step({ id: 'a', day: 1, order: 1, lat: 45.9237, lon: 6.8694 }),
      step({ id: 'b', day: 1, order: 2, lat: 45.9237, lon: 6.8694 }),
      step({ id: 'c', day: 1, order: 3, lat: 45.9819, lon: 6.9269 }),
    ]);
    const { deps } = fakeRoute();
    const out = await routeItinerary(built, deps);
    // Le point double ne consomme pas de troncon : c'est bien l arrivee reelle
    // qui porte la duree routiere mesuree.
    expect(out.steps.find((s) => s.id === 'c')?.durationMin).toBe(20);
  });

  it('CO-14 une intention non rattachee garde la journee a verifier', async () => {
    const built = model(
      [step({ id: 'a', day: 1, order: 1, lat: 45.9819, lon: 6.9269 })],
      1,
      [{ day: 1, kind: 'arret', title: 'Pause non situee', reason: null }],
    );
    const { deps } = fakeRoute();
    const out = await routeItinerary(built, deps);
    expect(out.perDay[0].distanceKm).toBeNull();
    expect(out.totals.distanceKm).toBeNull();
  });

  it('CO-15 un routeur muet ne devient jamais 0 km', async () => {
    const built = model([
      step({ id: 'a', day: 1, order: 1, lat: 45.9237, lon: 6.8694 }),
      step({ id: 'b', day: 1, order: 2, lat: 45.9819, lon: 6.9269 }),
    ]);
    const out = await routeItinerary(built, {
      route: vi.fn(async () => null),
      elevation: async () => null,
    });
    expect(out.perDay[0].distanceKm).toBeNull();
  });
});
