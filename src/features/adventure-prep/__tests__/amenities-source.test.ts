import { describe, expect, it } from 'vitest';
import {
  buildOverpassQuery,
  normalizeOverpass,
  fetchAmenitiesNear,
  __resetAmenityCache,
  MAX_AMENITY_SPAN_DEG,
} from '@/lib/queries/amenities';

// AM-01 : le corridor Chamonix Argentiere ne contient dans la base projet que
// 10 lieux uniques, tous outdoors, et ZERO repas, ZERO hebergement, ZERO
// commerce (mesure live sur /api/pois le 2026-09-28). Trois jours consomment
// plus de lieux qu il n en existe : le Jour 3 se vide donc par arithmetique,
// pas par defaut d affichage.
//
// La seule source REELLE, libre et sans clef pour completer ce spectre est
// OpenStreetMap via Overpass. Ce module ne fabrique rien : il normalise ce
// que l OSM repond et ecarte tout ce qui n est pas nommable.
describe('normalizeOverpass — amenites OSM', () => {
  const node = (tags: Record<string, string>, lat = 45.9, lon = 6.87) => ({
    type: 'node',
    lat,
    lon,
    tags,
  });

  it('AM-01 : classe restaurants, cafes et bars en food', () => {
    const out = normalizeOverpass({
      elements: [
        node({ name: 'Albert 1er', amenity: 'restaurant' }),
        node({ name: 'Bar des Glaciers', amenity: 'cafe' }),
        node({ name: 'Le Zinc', amenity: 'bar' }),
      ],
    });
    expect(out.map((r) => [r.name, r.category])).toEqual([
      ['Albert 1er', 'food'],
      ['Bar des Glaciers', 'food'],
      ['Le Zinc', 'food'],
    ]);
  });

  it('AM-02 : classe hebergement et campings en stay', () => {
    const out = normalizeOverpass({
      elements: [
        node({ name: 'Hotel Mont-Blanc', tourism: 'hotel' }),
        node({ name: 'Auberge', tourism: 'guest_house' }),
        node({ name: 'Camping Argentiere', tourism: 'camp_site' }),
      ],
    });
    expect(out.every((r) => r.category === 'stay')).toBe(true);
  });

  it('AM-03 : classe les commerces en poi', () => {
    const out = normalizeOverpass({
      elements: [
        node({ name: 'Le Fournil Chamoniard', shop: 'bakery' }),
        node({ name: 'Super U', shop: 'supermarket' }),
      ],
    });
    expect(out.every((r) => r.category === 'poi')).toBe(true);
  });

  it('AM-04 : ecarte un element sans nom (non verifiable, donc non affichable)', () => {
    const out = normalizeOverpass({
      elements: [node({ amenity: 'restaurant' }), node({ name: '   ', amenity: 'cafe' })],
    });
    expect(out).toEqual([]);
  });

  it('AM-05 : ecarte un element hors des categories utiles', () => {
    const out = normalizeOverpass({
      elements: [node({ name: 'Bornes de recharge', amenity: 'charging_station' })],
    });
    expect(out).toEqual([]);
  });

  it('AM-06 : lit un point avec centre (ways et relations), pas seulement un noeud', () => {
    const out = normalizeOverpass({
      elements: [
        {
          type: 'way',
          center: { lat: 45.91, lon: 6.88 },
          tags: { name: 'Grand Hotel', tourism: 'hotel' },
        },
      ],
    });
    expect(out[0]).toMatchObject({ name: 'Grand Hotel', lat: 45.91, lon: 6.88 });
  });

  it('AM-07 : refuse une position absente plutot que de la deviner', () => {
    const out = normalizeOverpass({
      elements: [{ type: 'node', tags: { name: 'Sans position', amenity: 'restaurant' } }],
    });
    expect(out).toEqual([]);
  });

  it('AM-08 : dedoublonne deux amenites de meme nom et meme position', () => {
    const out = normalizeOverpass({
      elements: [
        node({ name: 'Le Fournil', shop: 'bakery' }, 45.9, 6.87),
        node({ name: 'Le Fournil', amenity: 'cafe' }, 45.9, 6.87),
      ],
    });
    expect(out).toHaveLength(1);
  });
});

describe('buildOverpassQuery — garde-fous de la requete', () => {
  it('AM-09 : interroge uniquement la boite demandee', () => {
    const q = buildOverpassQuery({ minLat: 45.8, maxLat: 46, minLng: 6.7, maxLng: 7.2 });
    expect(q).toContain('45.8,6.7,46,7.2');
  });

  it('AM-10 : refuse une boite de plusieurs continents (cout et timeout)', () => {
    const tropGrand = { minLat: -80, maxLat: 80, minLng: -170, maxLng: 170 };
    expect(MAX_AMENITY_SPAN_DEG).toBeGreaterThan(0);
    expect(() => buildOverpassQuery(tropGrand)).toThrow();
  });

  // Regression observee le 2026-09-28 : quatre selecteurs sortaient
  // `((bbox))`. Overpass repondait 400 « Unknown query clause » et la totalite
  // des amenites disparut. Le test compte les doubles parentheses.
  it('AM-15 : aucun selecteur ne porte de double parenthesis', () => {
    const q = buildOverpassQuery({ minLat: 45.8, maxLat: 46.12, minLng: 6.74, maxLng: 7.18 });
    expect(q).not.toContain('((');
    expect(q).not.toContain('))');
  });
});

// AM-11 : Overpass repond 406 avec un CORPS HTML quand la requete n a pas de
// User-Agent. Le client JSON echoue alors, la liste revient vide, et les
// amenites disparaissent SANS AUCUNE ERREUR VISIBLE. Ce test verrouille le
// comportement observe, pas une intention.
describe('fetchAmenitiesNear — contrat reseau', () => {
  const box = { minLat: 45.8, maxLat: 46.12, minLng: 6.74, maxLng: 7.18 };

  it('AM-11 : envoie un User-Agent (sans lui, Overpass repond 406 HTML)', async () => {
    __resetAmenityCache();
    let vu: Headers | undefined;
    const fake = (async (_url: string, init?: RequestInit) => {
      vu = new Headers(init?.headers);
      return new Response(
        JSON.stringify({ elements: [{ lat: 45.9, lon: 6.87, tags: { name: 'Test', amenity: 'cafe' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const rows = await fetchAmenitiesNear(box, fake);
    expect(rows).toHaveLength(1);
    expect(vu?.get('User-Agent')).toBeTruthy();
  });

  it('AM-12 : un 406 rend une liste vide au lieu de lever', async () => {
    __resetAmenityCache();
    const fake = (async () =>
      new Response('<html>406</html>', { status: 406 })) as unknown as typeof fetch;
    await expect(fetchAmenitiesNear(box, fake)).resolves.toEqual([]);
  });

  it('AM-13 : une panne reseau rend une liste vide, jamais une exception', async () => {
    __resetAmenityCache();
    const fake = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    await expect(fetchAmenitiesNear(box, fake)).resolves.toEqual([]);
  });

  it('AM-14 : met en cache : le second appel ne redemande rien au fournisseur', async () => {
    __resetAmenityCache();
    let appels = 0;
    const fake = (async () => {
      appels += 1;
      return new Response(
        JSON.stringify({ elements: [{ lat: 45.9, lon: 6.87, tags: { name: 'Cache', amenity: 'bar' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    await fetchAmenitiesNear(box, fake);
    await fetchAmenitiesNear(box, fake);
    // Les miroirs courent en parallele : le premier appel en sollicite les
    // trois, le second ZERO. Ce qui compte est que rien ne repart au
    // fournisseur, pas le nombre d appels du premier.
    expect(appels).toBe(3);
  });

  // AM-16 : mesure live du 2026-09-28. Le miroir principal a repondu 504
  // pendant que deux miroirs secondaires repondaient 200 en 23 et 32 s.
  // Un seul point d entree transforme cette surcharge momentanie en liste
  // VIDE, donc en Jour 3 vide, sans jamais lever la moindre erreur.
  it('AM-16 : un miroir en 504 bascule sur un autre miroir', async () => {
    __resetAmenityCache();
    const vues: string[] = [];
    const fake = (async (url: string) => {
      vues.push(url);
      if (url.includes('private.coffee')) {
        return new Response('<html>gateway timeout</html>', { status: 504 });
      }
      return new Response(
        JSON.stringify({ elements: [{ lat: 45.9, lon: 6.87, tags: { name: 'Miroir', amenity: 'bar' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const rows = await fetchAmenitiesNear(box, fake);
    expect(rows.map((r) => r.name)).toEqual(['Miroir']);
    expect(vues.length).toBe(3);
  });

  it('AM-17 : si tous les miroirs tombent, la liste reste vide sans lever', async () => {
    __resetAmenityCache();
    let appels = 0;
    const fake = (async () => {
      appels += 1;
      return new Response('nope', { status: 504 });
    }) as unknown as typeof fetch;

    await expect(fetchAmenitiesNear(box, fake)).resolves.toEqual([]);
    expect(appels).toBeGreaterThan(1);
  });

  // AM-18 : mesure live du 2026-09-28. Overpass repond 200 avec un corps
  // d ERREUR quand sa requete depasse son propre budget. `elements` est alors
  // absent, et le normaliseur rendait une liste vide indistinguishable d une
  // zone reellement sans amenite. Le parcours affichait donc « aucun lieu »
  // la ou la source avait simplement echoue.
  it('AM-18 : un 200 sans tableau elements est un echec, pas une zone vide', async () => {
    __resetAmenityCache();
    const vues: string[] = [];
    const fake = (async (url: string) => {
      vues.push(url);
      if (url.includes('lz4')) {
        return new Response(
          JSON.stringify({ remark: 'runtime error: Query timed out' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ elements: [{ lat: 45.9, lon: 6.87, tags: { name: 'Vrai', amenity: 'bar' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const rows = await fetchAmenitiesNear(box, fake);
    expect(rows.map((r) => r.name)).toEqual(['Vrai']);
  });

  it('AM-19 : une zone reellement vide reste une reponse valide', async () => {
    __resetAmenityCache();
    const fake = (async () =>
      new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch;

    await expect(fetchAmenitiesNear(box, fake)).resolves.toEqual([]);
  });
});
