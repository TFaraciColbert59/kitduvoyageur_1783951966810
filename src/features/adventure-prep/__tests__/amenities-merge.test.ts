/**
 * Le corridor Chamonix Argentiere ne contient dans la base projet que 10 lieux
 * uniques, tous outdoors, et ZERO repas, ZERO hebergement, ZERO commerce
 * (mesure live sur /api/pois le 2026-09-28). Trois jours consomment plus de
 * lieux qu il n en existe : le dernier jour se vide donc par ARITHMETIQUE, pas
 * par defaut d affichage.
 *
 * Ces tests verrouillent la couture : les amenites OSM rejoignent les lieux de
 * base, dans le meme vocabulaire, et une panne de cette source ne retire
 * jamais un lieu deja acquis.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  readAmenityResponse,
  searchPlacesNear,
  warmAmenitiesFor,
  loadPlaceInventoryFor,
  __resetAmenityMemo,
} from '../placeSource';
import { CHAMONIX, ARGENTIERE } from './fixtures';

const A = { lat: CHAMONIX.lat, lon: CHAMONIX.lon };
const B = { lat: ARGENTIERE.lat, lon: ARGENTIERE.lon };

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('readAmenityResponse — lecture sans invention', () => {
  it('AM-M1 : convertit les amenites en candidats de la taxonomie existante', () => {
    const rows = readAmenityResponse({
      amenities: [
        { name: 'Albert 1er', category: 'food', lat: 45.924, lon: 6.869 },
        { name: 'Hotel Eden', category: 'stay', lat: 45.91, lon: 6.88 },
        { name: 'Super U', category: 'poi', lat: 45.92, lon: 6.87 },
      ],
    });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => ['food', 'stay', 'poi'].includes(r.category))).toBe(true);
  });

  it('AM-M2 : refuse une amenite sans nom ou sans position', () => {
    const rows = readAmenityResponse({
      amenities: [
        { name: 'Sans position', category: 'food', lat: null, lon: null },
        { category: 'cafe', lat: 45.9, lon: 6.87 },
      ],
    });
    expect(rows).toEqual([]);
  });

  it('AM-M3 : une reponse illisible rend une liste vide, jamais une exception', () => {
    expect(readAmenityResponse(null)).toEqual([]);
    expect(readAmenityResponse({})).toEqual([]);
    expect(readAmenityResponse({ amenities: 'oups' })).toEqual([]);
  });
});

describe('searchPlacesNear — fusion des deux sources', () => {
  // Le memo des amenites vit 120 s : sans remise a zero entre les tests, un
  // test warmed le suivant et le comptage de faux deviendrait aleatoire.
  beforeEach(() => __resetAmenityMemo());

  it('AM-M4 : les amenites rejoignent les lieux de base', async () => {
    const fake = (async (url: string) => {
      if (url.startsWith('/api/amenities')) {
        return jsonResponse({
          amenities: [{ name: 'Albert 1er', category: 'food', lat: 45.924, lon: 6.869 }],
        });
      }
      return jsonResponse([{ name: 'Refuge du Gouter', category: 'refuge', lat: 45.9, lng: 6.86 }]);
    }) as unknown as typeof fetch;

    const rows = await searchPlacesNear([A, B], fake);
    expect(rows.map((r) => r.name).sort()).toEqual(['Albert 1er', 'Refuge du Gouter']);
  });

  it('AM-M5 : une panne des amenites ne retire pas les lieux de base', async () => {
    const fake = (async (url: string) => {
      if (url.startsWith('/api/amenities')) throw new Error('overpass muet');
      return jsonResponse([{ name: 'Refuge du Gouter', category: 'refuge', lat: 45.9, lng: 6.86 }]);
    }) as unknown as typeof fetch;

    const rows = await searchPlacesNear([A, B], fake);
    expect(rows.map((r) => r.name)).toEqual(['Refuge du Gouter']);
  });

  it('AM-M6 : chaque source est interrogee une seule fois', async () => {
    const vues: string[] = [];
    const fake = (async (url: string) => {
      vues.push(url.startsWith('/api/amenities') ? 'amenities' : 'pois');
      return jsonResponse(url.startsWith('/api/amenities') ? { amenities: [] } : []);
    }) as unknown as typeof fetch;

    await searchPlacesNear([A, B], fake);
    expect(vues.sort()).toEqual(['amenities', 'pois']);
  });
});

// AM-M7 : Overpass met 5 a 25 s. L attendre AVANT l appel au modele
// allongerait la generation d autant. Le rechauffement demarre donc la
// requete sans l attendre, et la resolution des lieux vient la consommer.
describe('warmAmenitiesFor — recouvrement avec l appel au modele', () => {
  beforeEach(() => __resetAmenityMemo());

  it('AM-M7 : ne resout pas la requete, il la demarre', async () => {
    let resolu = false;
    const fake = (async (url: string) => {
      if (url.startsWith('/api/amenities')) {
        await new Promise((r) => setTimeout(r, 40));
        resolu = true;
        return jsonResponse({
          amenities: [{ name: 'Bar des Glaciers', category: 'food', lat: 45.923, lon: 6.87 }],
        });
      }
      return jsonResponse([]);
    }) as unknown as typeof fetch;

    const promesse = warmAmenitiesFor([A, B], fake);
    expect(resolu).toBe(false);
    await promesse;
    expect(resolu).toBe(true);
  });

  it('AM-M8 : la resolution reapprofite de la requete deja lancee', async () => {
    let appels = 0;
    const fake = (async (url: string) => {
      if (url.startsWith('/api/amenities')) {
        appels += 1;
        await new Promise((r) => setTimeout(r, 20));
        return jsonResponse({
          amenities: [{ name: 'Le Cairn', category: 'food', lat: 45.92, lon: 6.87 }],
        });
      }
      return jsonResponse([{ name: 'Lac Blanc', category: 'water', lat: 45.93, lng: 6.88 }]);
    }) as unknown as typeof fetch;

    await warmAmenitiesFor([A, B], fake);
    const rows = await searchPlacesNear([A, B], fake);
    expect(appels).toBe(1);
    expect(rows.map((r) => r.name).sort()).toEqual(['Lac Blanc', 'Le Cairn']);
  });
});

// AM-M9 : le rechauffement ne sert a rien si l inventaire du proposeur attend
// la source lente. L inventaire se lit AVANT l appel au modele ; s il
// attendait Overpass, la redaction demarrerait 5 a 25 s plus tard et le
// recouvrement annonce n existerait pas.
describe('loadPlaceInventoryFor - ne jamais attendre la source lente', () => {
  beforeEach(() => __resetAmenityMemo());

  it('AM-M9 : l inventaire rend la main sans attendre les amenites', async () => {
    let amenitiesResolues = false;
    const fake = (async (url: string) => {
      if (url.startsWith('/api/amenities')) {
        await new Promise((r) => setTimeout(r, 50));
        amenitiesResolues = true;
        return jsonResponse({
          amenities: [{ name: 'Albert 1er', category: 'food', lat: 45.924, lon: 6.869 }],
        });
      }
      return jsonResponse([{ name: 'Refuge du Gouter', category: 'refuge', lat: 45.9, lng: 6.86 }]);
    }) as unknown as typeof fetch;

    const draft = {
      route: { origin: CHAMONIX, destination: ARGENTIERE },
    } as never;

    const controller = new AbortController();
    const inventory = await loadPlaceInventoryFor(fake)(draft, controller.signal);

    expect(amenitiesResolues).toBe(false);
    expect(inventory.map((lieu) => lieu.name)).toEqual(['Refuge du Gouter']);
  });
});
