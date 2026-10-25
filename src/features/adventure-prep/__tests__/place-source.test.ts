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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bboxForTrip,
  keepMeasuredFrom,
  keepWalkableFrom,
  PAUSE_FOURNISSEUR_MS,
  placeQuery,
  readPlaceResponse,
  searchPlacesNear,
  __resetWalkabilityMemo,
} from '../placeSource';
import type { PlaceBbox } from '../placeSource';
import { CHAMONIX, ARGENTIERE } from './fixtures';
import { toCandidate } from '../engine/places';
import type { PlaceCandidate } from '../engine/places';

/**
 * La memoire de panne du fournisseur est un etat de MODULE, pas de test.
 *
 * `P025-05` se termine sur un `provider_unavailable`, donc la fenetre de
 * 30 s reste armee. Sans ce reset global, `P023-01` verrait son
 * `off_network` ignore et passerait a tort : un 503 de panne serait lu
 * comme un silence du fournisseur. Le test passerait, la garantie non.
 */
beforeEach(() => {
  __resetWalkabilityMemo();
});

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

function un503(reason: string): Response {
  return { ok: false, status: 503, json: async () => ({ status: 'unavailable', legs: [], reason }) } as Response;
}

const GOUTER = { lat: 45.8447, lon: 6.8427 };

/** Un candidat construit par le VRAI lecteur de la base, jamais a la main. */
function lieu(id: string, name: string, category: string, lat: number, lon: number): PlaceCandidate {
  const candidat = toCandidate({ id, name, category, lat, lng: lon });
  if (!candidat) throw new Error('fixture refusee par toCandidate: ' + name);
  return candidat;
}



describe(`P0.25 - un lieu NON MESURE ne recoit pas de position`, () => {
  it(`P025-01 un fournisseur tombe ne fait pas entrer de sommet dans le parcours`, async () => {
    // Le filtre d INVENTAIRE echoue OUVERT, et c est voulu : une panne de
    // Valhalla ne doit pas effacer les noms. Mais une POSITION, elle, ne peut
    // etre que MESUREE. Un sommet non verifie ne doit donc jamais atteindre
    // `assignPlaces`, sinon l ecran affiche une distance mesuree vers un lieu
    // que personne ne peut rejoindre a pied.
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/api/pois')) {
        return okResponse([
          { id: 'a', name: 'Mont Blanc', category: 'summit', lat: 45.8326, lng: 6.8652 },
        ]);
      }
      if (url.includes('/api/amenities')) return okResponse({ amenities: [] });
      // Le fournisseur de routage est TOMBE : aucune mesure n est possible.
      return un503('provider_unavailable');
    });
    const found = await searchPlacesNear([A], fetchImpl as unknown as typeof fetch);
    expect(found).toEqual([]);
  });

  it(`P025-02 l inventaire, lui, continue d echouer ouvert`, async () => {
    // Le contrat de P023-02 ne bouge pas : le proposeur doit toujours voir des
    // noms. C est la POSITION qui exige une mesure, pas l inventaire.
    const candidates = [lieu('b', 'Refuge du Gouter', 'refuge', GOUTER.lat, GOUTER.lon)];
    const kept = await keepWalkableFrom(
      A,
      candidates,
      (async () => un503('provider_unavailable')) as unknown as typeof fetch
    );
    expect(kept).toHaveLength(1);
  });

  it(`P025-03 apres une panne connue, la sonde suivante ne touche plus le reseau`, async () => {
    // 36 sondes x 8 s = 61 s d attente pour un resultat qui ne peut pas
    // changer. Une panne connue doit etre servie sans appel.
    const candidates = [
      lieu('a', 'A', 'poi', 45.92, 6.86),
      lieu('b', 'B', 'poi', 45.93, 6.87),
    ];
    const fetchImpl = vi.fn(async () => un503('provider_unavailable'));
    const first = await keepMeasuredFrom(A, candidates, fetchImpl as unknown as typeof fetch);
    expect(first).toEqual([]);
    const appelsApresLaPanne = fetchImpl.mock.calls.length;
    expect(appelsApresLaPanne).toBe(2);
    const second = await keepMeasuredFrom(A, candidates, fetchImpl as unknown as typeof fetch);
    expect(second).toEqual([]);
    expect(fetchImpl.mock.calls.length).toBe(appelsApresLaPanne);
  });

  it(`P025-04 la memoire de panne n est pas eternalelle`, async () => {
    // Un cache sans expiration servirait une panne de mars pendant des mois.
    //
    // L horloge est posee AVANT la premiere sonde : c est elle qui arme la
    // fenetre, donc c est elle qu il faut maitriser. Avancer une horloge
    // installee apres coup ne prouverait rien de ce que je pretends prouver.
    const T0 = 1_800_000_000_000;
    const candidates = [lieu('a', 'A', 'poi', 45.92, 6.86)];
    const fetchImpl = vi.fn(async () => un503('provider_unavailable'));
    vi.useFakeTimers();
    try {
      vi.setSystemTime(T0);
      await keepMeasuredFrom(A, candidates, fetchImpl as unknown as typeof fetch);
      // PENDANT la fenetre : aucune sonde de plus, sinon 8 s par ecran.
      vi.setSystemTime(T0 + PAUSE_FOURNISSEUR_MS - 1);
      await keepMeasuredFrom(A, candidates, fetchImpl as unknown as typeof fetch);
      expect(fetchImpl.mock.calls.length).toBe(1);
      // APRES la fenetre : on reprobe, sinon la panne serait eternelle.
      vi.setSystemTime(T0 + PAUSE_FOURNISSEUR_MS + 1);
      await keepMeasuredFrom(A, candidates, fetchImpl as unknown as typeof fetch);
      expect(fetchImpl.mock.calls.length).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it(`P025-05 un lieu MESURE reste accepte malgre la panne qui suit`, async () => {
    // Un 200 est une reelle mesure : elle doit survivre a la panne qui suit,
    // sinon une micro-coupure effacerait des lieux deja verifies.
    //
    // Chamonix est l ANCRE : on peut marcher du point de depart jusqu a lui,
    // donc `/api/route` repond 200 et le lieu vaut `mesuree`. Le Gouter, lui,
    // est a 3 000 m : le fournisseur tombe, il ne doit PAS entrer.
    const candidates = [
      lieu('a', 'Chamonix', 'poi', A.lat, A.lon),
      lieu('b', 'Refuge du Gouter', 'refuge', GOUTER.lat, GOUTER.lon),
    ];
    // L URL est percent-encodee par `URLSearchParams` (`%2C`, `%3B`) : comparer
    // une chaine de coordonnees brute ne matche donc jamais. On DECODE, et on lit
    // le PREMIER point, qui est le candidat - le second est l ancre, identique
    // pour les deux. Un fragment brut designerait donc le mauvais lieu.
    const fetchImpl = vi.fn(async (url: string) => {
      const params = new URL(url, 'http://test.local').searchParams;
      const candidat = (params.get('points') ?? '').split(';')[0];
      return candidat === `${A.lon},${A.lat}` ? okResponse({}) : un503('provider_unavailable');
    });
    const kept = await keepMeasuredFrom(A, candidates, fetchImpl as unknown as typeof fetch);
    expect(kept.map((c) => c.name)).toEqual(['Chamonix']);
  });
});
describe(`P0.23 - un lieu hors reseau pieton ne peut pas etre propose`, () => {
  it(`P023-01 un 503 off_network retire le lieu`, async () => {
    // C est la seule mesure qui autorise a ecarter : le fournisseur a repondu,
    // et sa trace n arrive pas au lieu demande.
    const candidates = [
      lieu('a', 'Chamonix', 'poi', A.lat, A.lon),
      lieu('b', 'Refuge du Gouter', 'refuge', GOUTER.lat, GOUTER.lon),
    ];
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('6.8427') || url.includes('6.8426')
        ? un503('off_network')
        : okResponse({}),
    );
    const kept = await keepWalkableFrom(A, candidates, fetchImpl as unknown as typeof fetch);
    expect(kept.map((c) => c.name)).toEqual(['Chamonix']);
  });

  it(`P023-02 une panne du fournisseur ne retire AUCUN lieu`, async () => {
    // Echoue ouvert : provider_unavailable ne dit rien du lieu. Le contraire
    // viderait l inventaire d une region entiere sur un incident Valhalla.
    const candidates = [
      lieu('b', 'Refuge du Gouter', 'refuge', GOUTER.lat, GOUTER.lon),
    ];
    const fetchImpl = vi.fn(async () => un503('provider_unavailable'));
    const kept = await keepWalkableFrom(A, candidates, fetchImpl as unknown as typeof fetch);
    expect(kept).toHaveLength(1);
  });

  it(`P023-03 une erreur reseau, un 500, un 400 ne retirent rien non plus`, async () => {
    const candidates = [
      lieu('b', 'Refuge du Gouter', 'refuge', GOUTER.lat, GOUTER.lon),
    ];
    for (const failure of [
      async () => { throw new Error('reseau'); },
      async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response,
      async () => ({ ok: false, status: 400, json: async () => ({}) }) as Response,
    ]) {
      const kept = await keepWalkableFrom(A, candidates, failure as unknown as typeof fetch);
      expect(kept).toHaveLength(1);
    }
  });

  it(`P023-04 la verification se fait bien en mode pieton`, async () => {
    // En voiture, le refuge du Gouter serait parfaitement joignable. Le
    // verifier en voiture laisserait passer exactement les lieux a ecarter.
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      return okResponse({});
    });
    await keepWalkableFrom(A, [lieu('x', 'X', 'poi', A.lat, A.lon)], fetchImpl as unknown as typeof fetch);
    expect(urls[0]).toContain('mode=pieton');
    expect(urls[0]).toContain('/api/route?');
  });

  it(`P023-05 le filtre ne modifie pas l ordre de ce qu il garde`, async () => {
    const candidates = [
      lieu('a', 'A', 'poi', 45.92, 6.86),
      lieu('b', 'B', 'poi', 45.93, 6.87),
      lieu('c', 'C', 'poi', 45.94, 6.88),
    ];
    const kept = await keepWalkableFrom(A, candidates, (async () => okResponse({})) as unknown as typeof fetch);
    expect(kept.map((c) => c.name)).toEqual(['A', 'B', 'C']);
  });

  it(`P023-06 la recherche complete ecarte les sommets hors reseau`, async () => {
    // Le cas reel du corridor Chamonix : 18 lignes, toutes en altitude.
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/api/pois')) {
        return okResponse([
          { id: 'a', name: 'Depart centre-ville', category: 'ville', lat: 45.9237, lng: 6.8694 },
          { id: 'b', name: 'Aiguille du Midi', category: 'summit', lat: 45.8789, lng: 6.8873 },
        ]);
      }
      if (url.includes('/api/amenities')) return okResponse({ amenities: [] });
      // L aiguille est hors reseau pieton, le centre-ville non.
      return url.includes('6.8873') ? un503('off_network') : okResponse({});
    });
    const found = await searchPlacesNear([A], fetchImpl as unknown as typeof fetch);
    expect(found.map((c) => c.name)).toEqual(['Depart centre-ville']);
  });
});
