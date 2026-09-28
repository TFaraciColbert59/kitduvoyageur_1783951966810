import { describe, expect, it } from 'vitest';
import {
  buildOverpassQuery,
  normalizeOverpass,
  normalizePhoton,
  fetchAmenitiesNear,
  __resetAmenityCache,
  MAX_AMENITY_SPAN_DEG,
  PHOTON_QUERIES,
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
    // Les deux sources courent EN PARALLELE : le premier appel sollicite les
    // trois miroirs ET les trois familles du repli, soit 6 requetes ; le
    // second ZERO. Ce qui compte est que rien ne repart au fournisseur, pas
    // le nombre d appels du premier.
    expect(appels).toBe(6);
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
    // Trois miroirs + les trois requetes du repli concurrent.
    expect(vues.length).toBe(6);
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

function featureHotel() {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [6.8694, 45.9237] },
    properties: {
      name: 'Hotel Mont-Blanc',
      osm_key: 'tourism',
      osm_value: 'hotel',
      city: 'Chamonix-Mont-Blanc',
      country: 'France',
    },
  };
}

// AM-20 a AM-26 : REPLI PHOTON. Mesure live du 2026-09-28, depuis cette
// machine : les TROIS miroirs Overpass du banc sont injoignables (2 x
// ConnectTimeoutError a 10,7 s, 1 timeout a 60 s). Promise.any laisse donc
// la requete attendre le plein delai de 45 s avant de rendre [], et le
// parcours se vide de tous ses repas, hebergements et commerces.
//
// Photon (komoot), DEJA utilise par le geocodage du projet, repond en 1,5 a
// 2,5 s depuis cette machine et rend de vrais lieux francais nommes. Il ne
// remplace pas Overpass : il bouche le trou quand Overpass est muet, et
// Overpass garde la main quand il repond.
describe('normalizePhoton - repli amenites', () => {
  const feature = (props: Record<string, unknown>, coords: [number, number]) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coords },
    properties: props,
  });

  it('AM-20 : classe restaurant et cafe en food', () => {
    const out = normalizePhoton({
      features: [
        feature({ name: 'Albert 1er', osm_key: 'amenity', osm_value: 'restaurant', city: 'Chamonix-Mont-Blanc' }, [6.8694, 45.9237]),
        feature({ name: 'Bar des Glaciers', osm_key: 'amenity', osm_value: 'cafe' }, [6.87, 45.924]),
      ],
    });
    expect(out.map((r) => [r.name, r.category])).toEqual([
      ['Albert 1er', 'food'],
      ['Bar des Glaciers', 'food'],
    ]);
  });

  it('AM-21 : classe hotel et gite en stay', () => {
    const out = normalizePhoton({
      features: [
        feature({ name: 'Hotel Mont-Blanc', osm_key: 'tourism', osm_value: 'hotel' }, [6.87, 45.92]),
        feature({ name: 'Refuge du Gouter', osm_key: 'tourism', osm_value: 'alpine_hut' }, [6.84, 45.84]),
      ],
    });
    expect(out.every((r) => r.category === 'stay')).toBe(true);
  });

  it('AM-22 : classe les commerces en poi', () => {
    const out = normalizePhoton({
      features: [feature({ name: 'Le Fournil', osm_key: 'shop', osm_value: 'bakery' }, [6.87, 45.92])],
    });
    expect(out[0].category).toBe('poi');
  });

  it('AM-23 : ecarte un lieu sans nom, non verifiable donc non affichable', () => {
    const out = normalizePhoton({
      features: [
        feature({ osm_key: 'amenity', osm_value: 'restaurant' }, [6.87, 45.92]),
        feature({ name: '   ', osm_key: 'amenity', osm_value: 'cafe' }, [6.87, 45.92]),
      ],
    });
    expect(out).toEqual([]);
  });

  it('AM-24 : refuse une position absente plutot que de la deviner', () => {
    const out = normalizePhoton({
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [] }, properties: { name: 'Sans position', osm_key: 'amenity', osm_value: 'restaurant' } }],
    });
    expect(out).toEqual([]);
  });

  it('AM-25 : dedoublonne par nom et position', () => {
    const out = normalizePhoton({
      features: [
        feature({ name: 'Le Fournil', osm_key: 'shop', osm_value: 'bakery' }, [6.87, 45.92]),
        feature({ name: 'Le Fournil', osm_key: 'amenity', osm_value: 'cafe' }, [6.87, 45.92]),
      ],
    });
    expect(out).toHaveLength(1);
  });

  it('AM-26 : un corps sans features est vide, pas une exception', () => {
    expect(normalizePhoton({})).toEqual([]);
    expect(normalizePhoton(null)).toEqual([]);
    expect(normalizePhoton({ features: 'nope' })).toEqual([]);
  });
});

// AM-27 : le VRAI contrat de P0.24. Les trois miroirs Overpass sont morts,
// donc le repli doit produire de vrais lieux. Sans ce test, le parcours peut
// repasser a [] et personne ne le voit : les 503 de l etape 2 seraient
// alors interpretes comme un probleme de routage.
describe('fetchAmenitiesNear - repli quand Overpass est muet', () => {
  const box = { minLat: 45.8, maxLat: 46.05, minLng: 6.7, maxLng: 7.2 };

  it('AM-27 : Overpass muet, Photon prend le relais et rend des lieux', async () => {
    __resetAmenityCache();
    const fake = (async (url: string) => {
      if (url.includes('overpass')) throw new Error('miroir muet');
      return new Response(JSON.stringify({ features: [featureHotel()] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const rows = await fetchAmenitiesNear(box, fake);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].name).toBe('Hotel Mont-Blanc');
  });

  it('AM-28 : quand Overpass repond, il garde la main meme si Photon repond aussi', async () => {
    __resetAmenityCache();
    const fake = (async (url: string) => {
      if (url.includes('photon')) {
        return new Response(JSON.stringify({ features: [featureHotel()] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({ elements: [{ lat: 45.9, lon: 6.87, tags: { name: 'Via Overpass', amenity: 'bar' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;
    const rows = await fetchAmenitiesNear(box, fake);
    // Le repli court en parallele, donc il EST sollicite, mais sa reponse
    // est ecartee : Overpass est la source la plus complete, donc c'est elle
    // qui doit gagner quand les deux repondent.
    expect(rows.map((r) => r.name)).toEqual(['Via Overpass']);
  });

  it('AM-29 : si les DEUX sources sont muettes, la liste reste vide sans lever', async () => {
    __resetAmenityCache();
    const fake = (async () => { throw new Error('reseau mort'); }) as unknown as typeof fetch;
    await expect(fetchAmenitiesNear(box, fake)).resolves.toEqual([]);
  });

  it('AM-30 : le repli interroge bien les trois familles attendues', () => {
    expect(PHOTON_QUERIES.length).toBeGreaterThanOrEqual(3);
    expect(PHOTON_QUERIES.some((q) => q.includes('restaurant'))).toBe(true);
    expect(PHOTON_QUERIES.some((q) => q.includes('hotel'))).toBe(true);
    expect(PHOTON_QUERIES.some((q) => q.includes('shop') || q.includes('supermarket'))).toBe(true);
  });
});
