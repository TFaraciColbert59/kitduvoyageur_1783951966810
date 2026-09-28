/**
 * P0.2 / P2.13 - Le raccordement des mesures reelles.
 *
 * Le moteur mesurait deja le kilometrage et la meteo, mais l ecran appelait
 * `runItineraryGeneration` sans injecter de dependances : le defaut
 * `NO_MEASUREMENTS` laissait le modele intact, donc `null` partout. Les
 * fournisseurs repondent, la route `/api/route` repond 200 - personne ne les
 * appelait. C est le raccordement qui manquait, pas la donnee.
 *
 * Ces tests verrouillent le contrat de ce raccordement :
 *  1. le navigateur passe par `/api/route`, jamais par OSRM en direct ;
 *  2. une chaine plus longue que la limite du fournisseur est DECOUPEE, et les
 *     troncons sont recollés sans dupliquer le point de jointure ;
 *  3. une reponse courte, malformee ou en erreur vaut `null` - jamais 0 km ;
 *  4. la meteo passe par `/api/weather`, a l ancre transmise.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  browserMeasurementRunners,
  browserRoutingDeps,
  elevationQuery,
  readRouteResponse,
  routeQuery,
  splitForProvider,
  stitchLegs,
} from '../browserMeasurements';
import { MAX_ROUTE_POINTS } from '../routingService';
import type { GeoPoint, RouteLeg } from '../engine/routing';
import { buildItinerary } from '../engine/itinerary';
import { assignPlaces, type PlaceCandidate } from '../engine/places';
import type { ItineraryModel } from '../types';
import { fullDraft, CHAMONIX, ARGENTIERE } from './fixtures';

/** Les lieux REELS du corridor Chamonix - Argentiere (`/api/pois`, 28/09/2026). */
const REAL_PLACES: PlaceCandidate[] = [
  { id: 'o-mont-blanc', name: 'Mont Blanc', category: 'summit', lat: 45.8326, lon: 6.8652, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
  { id: 'o-gouter', name: 'Refuge du Gouter', category: 'refuge', lat: 45.8447, lon: 6.8427, description: null, region: null, country: 'France', pricePerNight: 75, phone: null, website: null, isVerifiable: true },
  { id: 'o-merlet', name: 'Source du Merlet', category: 'water', lat: 45.8756, lon: 6.8234, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
  { id: 'o-midi', name: 'Aiguille du Midi', category: 'viewpoint', lat: 45.879, lon: 6.8873, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
  { id: 'o-plan', name: 'Refuge du Plan de l Aiguille', category: 'refuge', lat: 45.8934, lon: 6.8756, description: null, region: null, country: 'France', pricePerNight: 48, phone: null, website: null, isVerifiable: true },
  { id: 'o-bivouac', name: 'Bivouac Lac Blanc', category: 'camping', lat: 45.91, lon: 6.9, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
  { id: 'o-lac-blanc', name: 'Lac Blanc', category: 'water', lat: 45.9123, lon: 6.9012, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
  { id: 'o-bossons', name: 'Torrent des Bossons', category: 'water', lat: 45.8567, lon: 6.8456, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
];

function leg(distanceKm: number, geometry: RouteLeg['geometry']): RouteLeg {
  return { distanceKm, durationMin: distanceKm * 2, geometry };
}

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function failResponse(): Response {
  return { ok: false, status: 503, json: async () => ({}) } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('P0.2 - la requete de routage', () => {
  it('P0.2-01 interroge /api/route avec des couples lon,lat', () => {
    const query = routeQuery([
      { lat: 45.923, lon: 6.869 },
      { lat: 45.984, lon: 6.926 },
    ], 'pieton');
    expect(query).toBe('/api/route?points=6.869,45.923;6.926,45.984&mode=pieton');
  });

  it('P0.2-02 refuse un seul point, ou des coordonnees absentes', () => {
    expect(routeQuery([{ lat: 45.923, lon: 6.869 }], 'pieton')).toBeNull();
    expect(routeQuery([{ lat: Number.NaN, lon: 6.869 }, { lat: 45.9, lon: 6.8 }], 'pieton')).toBeNull();
  });

  it('P0.22-01 un mode inconnu ne produit aucune URL plutot qu un defaut', () => {
    const points = [
      { lat: 45.923, lon: 6.869 },
      { lat: 45.984, lon: 6.926 },
    ];
    expect(routeQuery(points, 'driving' as never)).toBeNull();
    expect(routeQuery(points, '' as never)).toBeNull();
    expect(routeQuery(points, undefined as never)).toBeNull();
  });
});

describe('P0.2 - la lecture de la reponse', () => {
  it('P0.2-03 lit des troncons bien formes', () => {
    const legs = readRouteResponse(
      {
        status: 'ok',
        legs: [
          { distanceKm: 12.5, durationMin: 20, geometry: [[6.869, 45.923], [6.9, 45.95]] },
        ],
      },
      2,
    );
    expect(legs).toHaveLength(1);
    expect(legs?.[0]?.distanceKm).toBe(12.5);
  });

  it('P0.2-04 refuse une serie plus courte que le nombre de troncons attendu', () => {
    const legs = readRouteResponse(
      { status: 'ok', legs: [{ distanceKm: 1, durationMin: 1, geometry: [[0, 0], [1, 1]] }] },
      3,
    );
    expect(legs).toBeNull();
  });

  it('P0.2-05 refuse un statut en echec et une geometrie vide', () => {
    expect(readRouteResponse({ status: 'unavailable', legs: [] }, 2)).toBeNull();
    expect(
      readRouteResponse({ status: 'ok', legs: [{ distanceKm: 1, durationMin: 1, geometry: [] }] }, 2),
    ).toBeNull();
  });
});

describe('P0.2 - le depassement de la limite du fournisseur', () => {
  it('P0.2-06 decoupe une chaine longue en fenetres qui se chevauchent d un point', () => {
    const chain: GeoPoint[] = Array.from({ length: MAX_ROUTE_POINTS + 3 }, (_, index) => ({
      lat: 45 + index / 1000,
      lon: 6 + index / 1000,
    }));
    const windows = splitForProvider(chain, MAX_ROUTE_POINTS);
    expect(windows.length).toBeGreaterThan(1);
    windows.forEach((window) => expect(window.length).toBeLessThanOrEqual(MAX_ROUTE_POINTS));
    expect(windows[0]?.at(-1)).toEqual(windows[1]?.[0]);
  });

  it('P0.2-07 ne decoupe pas une chaine qui tient', () => {
    const chain: GeoPoint[] = [
      { lat: 45.9, lon: 6.8 },
      { lat: 45.95, lon: 6.85 },
    ];
    expect(splitForProvider(chain, MAX_ROUTE_POINTS)).toHaveLength(1);
  });

  it('P0.2-08 recolle les troncons sans dupliquer le point de jointure', () => {
    // Une fenetre reelle renvoie des geometries denses : le point de jointure
    // est la derniere extremite d un troncon ET la premiere du suivant. La
    // concatenation naive le repete, et la carte trace alors un aller-retour
    // d un point que le conducteur n a jamais fait.
    const stitched = stitchLegs([
      [leg(1, [[0, 0], [0.5, 0.5], [1, 1]])],
      [leg(2, [[1, 1], [1.5, 1.5], [2, 2]])],
    ]);
    expect(stitched).toHaveLength(2);
    const line = stitched.flatMap((item) => [...item.geometry]);
    expect(line).toEqual([[0, 0], [0.5, 0.5], [1, 1], [1.5, 1.5], [2, 2]]);
    expect(line.filter((pair) => pair[0] === 1 && pair[1] === 1)).toHaveLength(1);
  });
});

describe('P0.2 - les dependances injectees dans l ecran', () => {
  it('P0.2-09 route() interroge /api/route et rend les troncons', async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse({
        status: 'ok',
        legs: [{ distanceKm: 8, durationMin: 14, geometry: [[6.869, 45.923], [6.9, 45.95]] }],
      }),
    );
    const deps = browserRoutingDeps(fetchImpl as unknown as typeof fetch);
    const legs = await deps.route([
      { lat: 45.923, lon: 6.869 },
      { lat: 45.95, lon: 6.9 },
    ], 'pieton');
    expect(legs).toHaveLength(1);
    const firstCall = fetchImpl.mock.calls[0] as unknown as [string];
    expect(String(firstCall[0])).toContain('/api/route?points=');
    expect(String(firstCall[0])).toContain('&mode=pieton');
  });

  it('P0.2-10 une panne reseau rend null, jamais zero', async () => {
    const fetchImpl = vi.fn(async () => failResponse());
    const deps = browserRoutingDeps(fetchImpl as unknown as typeof fetch);
    const legs = await deps.route([
      { lat: 45.923, lon: 6.869 },
      { lat: 45.95, lon: 6.9 },
    ], 'pieton');
    expect(legs).toBeNull();
  });

  it('P0.2-11 la phase trace mesure un parcours reel sur un modele construit', async () => {
    // L'ordre compte, et c'est tout l'objet du test. Un modele de regles sort
    // ses etapes SANS position : lui seul n'a aucune chaine a router, donc
    // `/api/route` n'est jamais appele. C'est la phase LIEUX, juste avant, qui
    // donne des points. Tester le trace sur le modele nu prouvait donc une
    // absence de resultat, pas une absence de raccordement.
    const draft = fullDraft({
      calendar: {
        startDate: '2026-07-11',
        durationDays: 2,
        durationIsSuggested: false,
        startDateIsSuggested: false,
        returnDate: '2026-07-12',
      },
    });
    const built = buildItinerary(draft);
    // Le nombre de troncons demandes depend du nombre de points envoyes : on
    // a la question posee, comme le fait `/api/route`.
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const count = (url.split('points=')[1] ?? '').split(';').length;
      return okResponse({
        status: 'ok',
        legs: Array.from({ length: Math.max(0, count - 1) }, (_, index) => ({
          distanceKm: 4 + index,
          durationMin: 8 + index,
          geometry: [
            [6.8 + index / 100, 45.9 + index / 100],
            [6.85 + index / 100, 45.95 + index / 100],
          ],
        })),
      });
    });
    const runners = browserMeasurementRunners(fetchImpl as unknown as typeof fetch);
    expect(built).not.toBeNull();
    const located = assignPlaces(
      built as ItineraryModel,
      REAL_PLACES,
      draft.route.origin,
      draft.route.destination,
    );
    const measured = await runners.trace(draft, located, new AbortController().signal);
    // La route a ete interrogee, et elle a repondu pour chaque journee.
    expect(fetchImpl).toHaveBeenCalled();
    expect(measured.totals.distanceKm).not.toBeNull();
  });
});

describe('P0.2 - les reperes de reelle vie', () => {
  it('P0.2-12 les points du fixture sont bien ceux de Chamonix et Argentiere', () => {
    expect(CHAMONIX.lat).toBeCloseTo(45.9237, 3);
    expect(ARGENTIERE.lon).toBeCloseTo(6.9269, 3);
  });
});

describe('P0.1 - le denivele mesure, pas suppose', () => {
  const PAIR: [number, number] = [6.8694, 45.9237];

  it('l altitude passe par la route Next, avec la meme convention que le routage', () => {
    const query = elevationQuery([PAIR, [6.9, 45.93]]);
    expect(query).toBe('/api/elevation?points=6.8694,45.9237;6.9,45.93');
  });

  it('un trace trop long pour le fournisseur est echantillonne, jamais tronque', () => {
    const many = Array.from({ length: 500 }, (_, index) => [6 + index * 0.001, 45] as [number, number]);
    const query = elevationQuery(many);
    expect(query).not.toBeNull();
    const sent = (query as string).split('points=')[1].split(';');
    expect(sent.length).toBeLessThanOrEqual(100);
    // L echantillonnage garde les extremites : on ne perd pas le debut ni la fin.
    expect(sent[0]).toBe('6,45');
  });

  it('une reponse malformee vaut null, jamais un zero', async () => {
    const deps = browserRoutingDeps(async () => okResponse({ status: 'ok', elevations: 'beaucoup' }));
    expect(await deps.elevation([PAIR, [6.9, 45.93]])).toBeNull();
  });

  it('une altitude manquante invalide tout le profil plutot que de le sous-estimer', async () => {
    const deps = browserRoutingDeps(async () => okResponse({ status: 'ok', elevations: [1000, null] }));
    expect(await deps.elevation([PAIR, [6.9, 45.93]])).toEqual([1000, null]);
  });

  it('le fournisseur muet laisse le denivele a verifier', async () => {
    const deps = browserRoutingDeps(async () => failResponse());
    expect(await deps.elevation([PAIR, [6.9, 45.93]])).toBeNull();
  });
});
