/**
 * P0.1 (suite) - La source des LIEUX, sans lesquels le routage n existe pas.
 *
 * Le moteur assemble des etapes, puis `assignPlaces` doit y accrocher de VRAIES
 * coordonnees. Cette fonction etait ecrite, testee, et jamais appelee : les
 * 17 etapes du moteur de regles sortaient toutes en `lat: null`. Sans point, pas
 * de chaine, pas de kilometres, pas de carte - les trois symptomes a la fois.
 *
 * Ces tests verrouillent le contrat de la source :
 *  1. la boite englobe le depart ET l arrivee, avec une marge autour ;
 *  2. les cles de la route sont en SNAKE_CASE - en camelCase elles sont
 *     silencieusement ignorees et la route renvoie le monde entier ;
 *  3. un point sans nom ou sans position est refuse, jamais invente ;
 *  4. une panne reseau rend une liste vide : aucun lieu n est invente.
 */
import { describe, expect, it, vi } from 'vitest';
import { bboxForTrip, placeQuery, readPlaceResponse, searchPlacesNear } from '../placeSource';
import type { PlaceBbox } from '../placeSource';
import { CHAMONIX, ARGENTIERE } from './fixtures';

const A = { lat: CHAMONIX.lat, lon: CHAMONIX.lon };
const B = { lat: ARGENTIERE.lat, lon: ARGENTIERE.lon };

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('P0.1 - la boite englobante', () => {
  it('PS-01 contient le depart et l arrivee', () => {
    const box = bboxForTrip([A, B]);
    expect(box).not.toBeNull();
    expect(box?.minLat).toBeLessThanOrEqual(Math.min(A.lat, B.lat));
    expect(box?.maxLat).toBeGreaterThanOrEqual(Math.max(A.lat, B.lat));
    expect(box?.minLng).toBeLessThanOrEqual(Math.min(A.lon, B.lon));
    expect(box?.maxLng).toBeGreaterThanOrEqual(Math.max(A.lon, B.lon));
  });

  it('PS-02 elargit la boite pour couvrir les etapes intermediaires', () => {
    const box = bboxForTrip([A, B]);
    expect(box!.minLat).toBeLessThan(A.lat);
    expect(box!.maxLng).toBeGreaterThan(B.lon);
  });

  it('PS-03 refuse une liste vide ou un point hors de la Terre', () => {
    expect(bboxForTrip([])).toBeNull();
    expect(bboxForTrip([{ lat: 200, lon: 0 }])).toBeNull();
  });
});

describe('P0.1 - la requete', () => {
  it('PS-04 utilise les cles SNAKE_CASE de /api/pois', () => {
    const box = bboxForTrip([A, B]) as PlaceBbox;
    const query = placeQuery(box);
    expect(query).toContain('min_lat=');
    expect(query).toContain('max_lat=');
    expect(query).toContain('min_lng=');
    expect(query).toContain('max_lng=');
    expect(query).not.toContain('minLat=');
  });

  it('PS-05 refuse une boite absente', () => {
    expect(placeQuery(null)).toBeNull();
  });
});

describe('P0.1 - la lecture de la reponse', () => {
  it('PS-06 transforme des points reels en candidats', () => {
    const candidates = readPlaceResponse([
      {
        id: 'refuge-1',
        name: 'Refuge du Plan de l Aiguille',
        category: 'refuge',
        lat: 45.89,
        lng: 6.88,
        is_verified: true,
      },
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates?.[0]?.category).toBe('refuge');
    expect(candidates?.[0]?.lon).toBeCloseTo(6.88, 5);
  });

  it('PS-07 refuse un point sans nom ou sans position', () => {
    expect(readPlaceResponse([{ id: 'x', name: 'Sans coordonnees', category: 'refuge' }])).toEqual([]);
  });

  it('PS-08 refuse une reponse qui n est pas un tableau', () => {
    expect(readPlaceResponse({ pois: [] })).toEqual([]);
    expect(readPlaceResponse(null)).toEqual([]);
  });

  it('PS-12 un meme lieu venu de deux tables n est propose qu une fois', () => {
    // `/api/pois` fusionne `outdoor_points` et `map_refuges` : le meme refuge
    // y revient sous deux identifiants differents. Sans deduplication, le
    // moteur les consomme comme deux lieux distincts et pose DEUX etapes sur
    // le meme point - un ravitaillement et un arret a l identique, avec un
    // troncon de zero kilometre. Sur le corridor Chamonix, 8 des 18 lignes
    // etaient des doublons.
    const raw = [
      { id: 'outdoor-1', name: 'Lac Blanc', category: 'water', lat: 45.9123, lng: 6.9012 },
      { id: 'map-1', name: 'Lac Blanc', category: 'water', lat: 45.9123, lng: 6.9012 },
    ];
    expect(readPlaceResponse(raw)).toHaveLength(1);
  });

  it('PS-13 deux lieux voisins aux noms differents restent deux lieux', () => {
    const raw = [
      { id: 'a', name: 'Refuge du Gouter', category: 'refuge', lat: 45.8447, lng: 6.8427 },
      { id: 'b', name: 'Refuge des Aiguilles', category: 'refuge', lat: 45.935, lng: 6.887 },
    ];
    expect(readPlaceResponse(raw)).toHaveLength(2);
  });
});

describe('P0.1 - la recherche', () => {
  it('PS-09 rend les candidats quand la route repond', async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse([
        { id: 'a', name: 'Aiguille du Midi', category: 'viewpoint', lat: 45.88, lng: 6.89 },
      ]),
    );
    const found = await searchPlacesNear([A], fetchImpl as unknown as typeof fetch);
    expect(found).toHaveLength(1);
  });

  it('PS-10 une panne reseau rend une liste vide, jamais un lieu invente', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response);
    expect(await searchPlacesNear([A], fetchImpl as unknown as typeof fetch)).toEqual([]);
  });
});
