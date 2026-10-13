import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../server/sharedCache', () => ({
  readShared: async () => undefined,
  cached: async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
  coordKey: (lat: number, lon: number) => `${lat},${lon}`,
}));
const rpc = vi.fn();
let client: { rpc: typeof rpc } | null = { rpc };
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: () => client }));

import {
  buildGeoPoisQuery,
  estimateRowBytes,
  estimateTableBytes,
  GEO_POI_CATEGORIES,
  GEO_POI_ZONES,
  geoPoiTiles,
  geoPoiToElement,
  parseCount,
  parseElevationM,
  parseGeoPois,
  summarizeGeoPois,
  type GeoPoiRow,
} from '../engine/geoPois';
import { buildOverpassQuery, parseOverpass } from '../engine/stagePois';
import { referentialPoisAround } from '../server/geoPois';
import { lookupStagePois } from '../server/stagePoiLookup';
import { resetOverpassQueue } from '@/lib/overpass';

const VILLARD = { lat: 45.07156, lon: 5.55637 };

function row(over: Partial<GeoPoiRow>): GeoPoiRow {
  return {
    osm_id: 'n1',
    subtype: 'alpine_hut',
    name: 'Refuge du Pas de la Ville',
    lat: 45.075,
    lon: 5.56,
    ele_m: 1700,
    staffed: null,
    capacity: null,
    potable: null,
    ...over,
  };
}

describe('Refuges, campings et points d’eau : lecture d’OpenStreetMap (plan 3.4)', () => {
  it('une requête par tuile, dans l’ordre sud-ouest-nord-est d’Overpass, sans abri de bus', () => {
    const q = buildGeoPoisQuery([5, 44.5, 5.5, 45]);
    expect(q).toContain('[out:json]');
    expect(q).toContain('nwr["tourism"~"^(alpine_hut|wilderness_hut|camp_site)$"](44.5000,5.0000,45.0000,5.5000);');
    expect(q).toContain('nwr["amenity"="drinking_water"]');
    expect(q).toContain('["shelter_type"!~"^(public_transport|picnic_shelter)$"]');
    expect(q).toContain('nwr["natural"="spring"]["name"]');
    expect(q).toContain('nwr["natural"="spring"]["drinking_water"="yes"]');
    expect(q.endsWith('out center tags;')).toBe(true);
  });

  it('un refuge garde ce qu’OSM dit, jamais plus : « gardé », places, altitude restent null sans la balise', () => {
    const { rows, dropped } = parseGeoPois({
      elements: [
        { type: 'node', id: 11, lat: 45.1, lon: 5.6, tags: { tourism: 'alpine_hut', name: 'Refuge des Écrins', ele: '2100', staffed: 'yes', beds: '40', capacity: '60' } },
        { type: 'way', id: 12, center: { lat: 45.2, lon: 5.7 }, tags: { tourism: 'wilderness_hut' } },
        { type: 'node', id: 13, lat: 45.3, lon: 5.8, tags: { tourism: 'alpine_hut', name: 'Refuge', staffed: 'seasonal' } },
      ],
    });
    expect(dropped).toEqual({});
    expect(rows.map((r) => r.osm_id)).toEqual(['n11', 'n13', 'w12']);
    expect(rows[0]).toEqual({
      osm_id: 'n11',
      subtype: 'alpine_hut',
      name: 'Refuge des Écrins',
      lat: 45.1,
      lon: 5.6,
      ele_m: 2100,
      staffed: 'yes',
      capacity: 40, // `beds` d’abord
      potable: null,
    });
    // Cabane sans aucune balise : tout reste null (« gardé » n’est pas déduit du type).
    expect(rows[2]).toMatchObject({ osm_id: 'w12', name: null, ele_m: null, staffed: null, capacity: null, lat: 45.2 });
    // Un nom commun n’est pas un nom ; la ligne reste (un refuge sans nom est un refuge).
    expect(rows[1]).toMatchObject({ name: null, staffed: 'seasonal' });
  });

  it('écarte et compte ce qui est privé, abandonné, hors sujet ou en double', () => {
    const { rows, dropped } = parseGeoPois({
      elements: [
        { type: 'node', id: 1, lat: 45, lon: 5, tags: { tourism: 'camp_site', name: 'Camping privé', access: 'private' } },
        { type: 'node', id: 2, lat: 45, lon: 5, tags: { tourism: 'alpine_hut', name: 'Ruine', abandoned: 'yes' } },
        { type: 'node', id: 3, lat: 45, lon: 5, tags: { amenity: 'shelter', shelter_type: 'picnic_shelter' } },
        { type: 'node', id: 4, lat: 45, lon: 5, tags: { amenity: 'shelter' } },
        { type: 'node', id: 5, lat: 45, lon: 5, tags: { natural: 'spring' } },
        { type: 'node', id: 6, lat: 45, lon: 5, tags: { amenity: 'bench' } },
        { type: 'node', id: 7, tags: { tourism: 'camp_site' } },
        { type: 'node', id: 8, lat: 45, lon: 5, tags: { tourism: 'camp_site', name: 'Camping du lac', capacity: '24 places' } },
        { type: 'node', id: 8, lat: 45, lon: 5, tags: { tourism: 'camp_site', name: 'Camping du lac' } },
      ],
    });
    expect(dropped).toEqual({
      prive: 1,
      abandonne: 1,
      abri_non_montagne: 2,
      source_sans_nom_ni_potabilite: 1,
      sans_nature: 1,
      sans_position: 1,
      doublon: 1,
    });
    expect(rows).toHaveLength(1);
    // « 24 places » n’est pas un nombre : null, jamais 24 deviné.
    expect(rows[0]).toMatchObject({ osm_id: 'n8', capacity: null });
  });

  it('abris : les formes de montagne passent, un abri sans forme seulement s’il a un nom ou une altitude', () => {
    const { rows } = parseGeoPois({
      elements: [
        { type: 'node', id: 21, lat: 45, lon: 5, tags: { amenity: 'shelter', shelter_type: 'basic_hut' } },
        { type: 'node', id: 22, lat: 45, lon: 5, tags: { amenity: 'shelter', name: 'Abri du Berger' } },
        { type: 'node', id: 23, lat: 45, lon: 5, tags: { amenity: 'shelter', ele: '1800' } },
      ],
    });
    expect(rows.map((r) => r.osm_id)).toEqual(['n21', 'n22', 'n23']);
  });

  it('eau : potable seulement si OSM le dit (point d’eau potable par défaut, source seulement avec drinking_water)', () => {
    const { rows, dropped } = parseGeoPois({
      elements: [
        { type: 'node', id: 31, lat: 45, lon: 5, tags: { amenity: 'drinking_water' } },
        { type: 'node', id: 32, lat: 45, lon: 5, tags: { amenity: 'drinking_water', drinking_water: 'no' } },
        { type: 'node', id: 33, lat: 45, lon: 5, tags: { natural: 'spring', name: 'Source Sainte-Anne' } },
        { type: 'node', id: 34, lat: 45, lon: 5, tags: { natural: 'spring', drinking_water: 'yes' } },
        { type: 'node', id: 35, lat: 45, lon: 5, tags: { natural: 'spring', drinking_water: 'no' } },
      ],
    });
    const potable = Object.fromEntries(rows.map((r) => [r.osm_id, r.potable]));
    expect(potable).toEqual({ n31: true, n32: false, n33: null, n34: true });
    expect(dropped.source_sans_nom_ni_potabilite).toBe(1);
  });

  it('altitude et nombre : unités lues, tout le reste est illisible (null)', () => {
    expect(parseElevationM('2100')).toBe(2100);
    expect(parseElevationM('1234.6')).toBe(1235);
    expect(parseElevationM('1234,5 m')).toBe(1235);
    expect(parseElevationM('3000 ft')).toBe(914);
    expect(parseElevationM('-12')).toBe(-12);
    expect(parseElevationM('12000')).toBeNull();
    expect(parseElevationM('haut')).toBeNull();
    expect(parseElevationM(undefined)).toBeNull();
    expect(parseCount('40')).toBe(40);
    expect(parseCount('0')).toBeNull();
    expect(parseCount('10-12')).toBeNull();
    expect(parseCount('24 places')).toBeNull();
    expect(parseCount('12345')).toBeNull();
  });

  it('une réponse sans éléments ne donne rien', () => {
    expect(parseGeoPois(null)).toEqual({ rows: [], dropped: {}, elements: 0 });
    expect(parseGeoPois({ elements: 'x' }).rows).toEqual([]);
  });

  it('résumé : par nature, noms, altitudes, gardé, potable', () => {
    const s = summarizeGeoPois([
      row({ osm_id: 'n1', staffed: 'yes', capacity: 20 }),
      row({ osm_id: 'n2', subtype: 'camp_site', name: null, ele_m: null }),
      row({ osm_id: 'n3', subtype: 'drinking_water', name: null, ele_m: null, potable: true }),
      row({ osm_id: 'n4', subtype: 'spring', potable: null }),
    ]);
    expect(s.bySubtype).toEqual({ alpine_hut: 1, camp_site: 1, drinking_water: 1, spring: 1 });
    expect(s.named).toBe(2);
    expect(s.withEle).toBe(2);
    expect(s.withCapacity).toBe(1);
    expect(s.staffed).toEqual({ yes: 1, no: 0, seasonal: 0, inconnu: 1 });
    expect(s.potable).toEqual({ oui: 1, non: 0, inconnu: 1 });
  });
});

describe('Tuiles et place prise en base', () => {
  it('une grille alignée sur le pas : 4 tuiles de 0,5° pour le Vercors, 2 de 1°, sans trou', () => {
    const z = GEO_POI_ZONES.vercors;
    const small = geoPoiTiles(z.box, z.tile);
    expect(small).toHaveLength(4);
    expect(small).toContainEqual([5, 44.5, 5.5, 45]);
    expect(small).toContainEqual([5.5, 45, 6, 45.5]);
    for (const [w, s, e, n] of small) {
      expect(e - w).toBeCloseTo(0.5, 6);
      expect(n - s).toBeCloseTo(0.5, 6);
    }
    expect(geoPoiTiles(z.box, 1)).toEqual([
      [5, 44, 6, 45],
      [5, 45, 6, 46],
    ]);
    expect(geoPoiTiles([5, 45, 5, 46], 1)).toEqual([]);
    expect(geoPoiTiles([5, 45, 6, 46], 0)).toEqual([]);
    expect(geoPoiTiles(GEO_POI_ZONES.alpes.box, 1)).toHaveLength(12 * 6);
  });

  it('estimation : de l’ordre de 150 à 300 octets par ligne, plus pour une ligne bavarde', () => {
    const lean = row({ osm_id: 'n5', name: null, ele_m: null });
    const full = row({ osm_id: 'w123456789', name: 'Refuge de la Pra, Chamrousse', staffed: 'yes', capacity: 30 });
    expect(estimateRowBytes(lean)).toBeGreaterThan(120);
    expect(estimateRowBytes(full)).toBeLessThan(400);
    expect(estimateRowBytes(full)).toBeGreaterThan(estimateRowBytes(lean) - 10);
    expect(estimateTableBytes([lean, full])).toBe(estimateRowBytes(lean) + estimateRowBytes(full));
    expect(estimateTableBytes([])).toBe(0);
  });
});

describe('Une ligne du référentiel est un point d’étape comme ceux d’Overpass', () => {
  it('même code de lecture (distance, catégorie), nature → catégorie du Compas', () => {
    const rows: GeoPoiRow[] = [
      row({ osm_id: 'n1', subtype: 'alpine_hut', name: 'Refuge A', ele_m: 1700 }),
      row({ osm_id: 'w2', subtype: 'camp_site', name: null, ele_m: null, lat: 45.08 }),
      row({ osm_id: 'n3', subtype: 'drinking_water', name: null, ele_m: null, lat: 45.0721, lon: 5.557 }),
      row({ osm_id: 'n4', subtype: 'spring', name: 'Source', ele_m: 1500, lat: 45.073 }),
      row({ osm_id: 'n5', subtype: 'shelter', name: 'Abri', ele_m: null, lat: 45.074 }),
    ];
    const pois = parseOverpass({ elements: rows.map(geoPoiToElement) }, [VILLARD]);
    expect(Object.fromEntries(pois.map((p) => [p.id, p.category]))).toEqual({ 1: 'refuge', 2: 'camping', 3: 'water', 4: 'water', 5: 'refuge' });
    expect(pois[0].distanceM).toBeLessThan(pois[pois.length - 1].distanceM);
    expect(pois.find((p) => p.id === 1)).toMatchObject({ name: 'Refuge A', elevationM: 1700 });
    expect(pois.find((p) => p.id === 2)?.name).toBeNull();
    expect([...GEO_POI_CATEGORIES].sort()).toEqual(['camping', 'refuge', 'water']);
  });

  it('Overpass ne redemande pas les catégories déjà servies', () => {
    const full = buildOverpassQuery(VILLARD);
    const light = buildOverpassQuery(VILLARD, undefined, undefined, GEO_POI_CATEGORIES);
    for (const word of ['alpine_hut', 'drinking_water', 'camp_site', 'spring']) {
      expect(full).toContain(word);
      expect(light).not.toContain(word);
    }
    expect(light).toContain('restaurant');
    expect(light).toContain('pharmacy');
    // Sans `skip`, la requête n’a pas changé.
    expect(buildOverpassQuery(VILLARD, 1500, 25, new Set())).toBe(full);
  });
});

describe('Lecture côté Compas : le référentiel d’abord, Overpass en secours (plan 1.4)', () => {
  const COVERED = {
    covered: true,
    rows: [
      row({ osm_id: 'n1', subtype: 'alpine_hut', name: 'Refuge A', staffed: 'yes' }),
      row({ osm_id: 'n3', subtype: 'drinking_water', name: null, ele_m: null, potable: true }),
    ],
  };

  beforeEach(() => {
    rpc.mockReset();
    client = { rpc };
    resetOverpassQueue();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('interrupteur éteint (défaut) : aucun appel à la base, aucun changement', async () => {
    expect(await referentialPoisAround(VILLARD)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
    vi.stubEnv('COMPAS_GEO_POIS', '0');
    expect(await referentialPoisAround(VILLARD)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('allumé et zone couverte : les points du référentiel, au format du Compas', async () => {
    vi.stubEnv('COMPAS_GEO_POIS', '1');
    rpc.mockResolvedValue({ data: COVERED, error: null });
    const pois = await referentialPoisAround(VILLARD);
    expect(rpc).toHaveBeenCalledWith('geo_pois_around', { p_lat: VILLARD.lat, p_lon: VILLARD.lon, p_radius_m: 1500, p_subtypes: null, p_limit: 300 });
    expect(pois?.map((p) => [p.id, p.category, p.name])).toEqual(
      expect.arrayContaining([
        [1, 'refuge', 'Refuge A'],
        [3, 'water', null],
      ])
    );
  });

  it('zone couverte mais vide : liste vide (rien ici), pas un repli', async () => {
    vi.stubEnv('COMPAS_GEO_POIS', '1');
    rpc.mockResolvedValue({ data: { covered: true, rows: [] }, error: null });
    expect(await referentialPoisAround(VILLARD)).toEqual([]);
  });

  it('zone absente, base muette, réponse de forme inattendue : null (Overpass reprend)', async () => {
    vi.stubEnv('COMPAS_GEO_POIS', '1');
    rpc.mockResolvedValue({ data: { covered: false, rows: [] }, error: null });
    expect(await referentialPoisAround(VILLARD)).toBeNull();
    rpc.mockResolvedValue({ data: null, error: { code: '42883' } });
    expect(await referentialPoisAround(VILLARD)).toBeNull();
    rpc.mockResolvedValue({ data: 'n’importe quoi', error: null });
    expect(await referentialPoisAround(VILLARD)).toBeNull();
    rpc.mockRejectedValue(new Error('réseau'));
    expect(await referentialPoisAround(VILLARD)).toBeNull();
    client = null;
    expect(await referentialPoisAround(VILLARD)).toBeNull();
  });

  it('une ligne mal formée est ignorée, les autres passent', async () => {
    vi.stubEnv('COMPAS_GEO_POIS', '1');
    rpc.mockResolvedValue({ data: { covered: true, rows: [...COVERED.rows, { osm_id: 'x', subtype: 'bar' }, null] }, error: null });
    expect(await referentialPoisAround(VILLARD)).toHaveLength(2);
  });

  describe('lookupStagePois', () => {
    const overpassBodies: string[] = [];
    const RESTO = {
      elements: [{ type: 'node', id: 900, lat: 45.0716, lon: 5.5565, tags: { amenity: 'restaurant', name: 'Chez Rémi' } }],
    };
    const HUT_FROM_OVERPASS = {
      elements: [
        ...RESTO.elements,
        { type: 'node', id: 901, lat: 45.0717, lon: 5.5566, tags: { tourism: 'alpine_hut', name: 'Refuge d’Overpass' } },
      ],
    };

    function mockOverpass(payload: unknown, status = 200) {
      overpassBodies.length = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
        overpassBodies.push(decodeURIComponent(String(init?.body ?? '').replace(/^data=/, '')));
        return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
      });
    }

    it('éteint : une requête Overpass complète, la base n’est pas consultée', async () => {
      mockOverpass(HUT_FROM_OVERPASS);
      const { pois } = await lookupStagePois([VILLARD]);
      expect(rpc).not.toHaveBeenCalled();
      expect(overpassBodies).toHaveLength(1);
      expect(overpassBodies[0]).toContain('alpine_hut');
      expect(pois.map((p) => p.name).sort()).toEqual(['Chez Rémi', 'Refuge d’Overpass']);
    });

    it('allumé et couvert : Overpass ne redemande ni refuges, ni campings, ni eau ; les deux sources se complètent', async () => {
      vi.stubEnv('COMPAS_GEO_POIS', '1');
      rpc.mockResolvedValue({ data: COVERED, error: null });
      mockOverpass(HUT_FROM_OVERPASS); // un refuge « en trop » dans la réponse : ignoré, le référentiel fait foi
      const { pois } = await lookupStagePois([VILLARD]);
      expect(overpassBodies).toHaveLength(1);
      expect(overpassBodies[0]).toContain('restaurant');
      for (const word of ['alpine_hut', 'drinking_water', 'camp_site', 'spring']) expect(overpassBodies[0]).not.toContain(word);
      expect(pois.map((p) => p.name ?? '(sans nom)').sort()).toEqual(['(sans nom)', 'Chez Rémi', 'Refuge A']);
    });

    it('allumé mais zone non importée : comme avant, Overpass donne tout', async () => {
      vi.stubEnv('COMPAS_GEO_POIS', '1');
      rpc.mockResolvedValue({ data: { covered: false, rows: [] }, error: null });
      mockOverpass(HUT_FROM_OVERPASS);
      const { pois } = await lookupStagePois([VILLARD]);
      expect(overpassBodies[0]).toContain('alpine_hut');
      expect(pois.map((p) => p.name).sort()).toEqual(['Chez Rémi', 'Refuge d’Overpass']);
    });

    it('allumé, couvert, Overpass en panne : rien n’est gardé (on réessaiera), comme avant', async () => {
      vi.stubEnv('COMPAS_GEO_POIS', '1');
      rpc.mockResolvedValue({ data: COVERED, error: null });
      mockOverpass({ elements: [] }, 504);
      const res = await lookupStagePois([VILLARD]);
      expect(res).toEqual({ pois: [], partial: true });
    });
  });
});
