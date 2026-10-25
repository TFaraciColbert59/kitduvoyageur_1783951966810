import { describe, expect, it } from 'vitest';
import {
  bboxAreaKm2,
  buildGeoAreasQuery,
  normalizeAreaName,
  parseGeoAreas,
  pickArea,
  type GeoAreaRow,
} from '../engine/geoAreas';

/** Emprise de la Vanoise (≈ 6,6–7,2 E, 45,2–45,6 N), centre au milieu. */
const VANOISE_BOUNDS = { minlat: 45.2, minlon: 6.6, maxlat: 45.6, maxlon: 7.2 };
const VANOISE_CENTER = { lat: 45.4, lon: 6.9 };

const el = (
  type: 'relation' | 'way',
  id: number,
  tags: Record<string, string>,
  bounds: Record<string, number> = VANOISE_BOUNDS,
  center: Record<string, number> = VANOISE_CENTER
) => ({ type, id, tags, bounds, center });

describe('normalizeAreaName', () => {
  it('« Parc national de la Vanoise » et « Vanoise » ont la même clé', () => {
    expect(normalizeAreaName('Parc national de la Vanoise')).toBe('vanoise');
    expect(normalizeAreaName('Vanoise')).toBe('vanoise');
    expect(normalizeAreaName('la Vanoise')).toBe('vanoise');
    expect(normalizeAreaName('Vanoise National Park')).toBe('vanoise');
  });
  it('« Parc national des Calanques » et « les Calanques » ont la même clé', () => {
    expect(normalizeAreaName('Parc national des Calanques')).toBe('calanques');
    expect(normalizeAreaName('les Calanques')).toBe('calanques');
  });
  it('« Massif de la Chartreuse » et le parc naturel régional de Chartreuse se rejoignent', () => {
    expect(normalizeAreaName('Massif de la Chartreuse')).toBe('chartreuse');
    expect(normalizeAreaName('Parc naturel régional de Chartreuse')).toBe('chartreuse');
    expect(normalizeAreaName('Parc naturel régional du Massif des Bauges')).toBe('bauges');
  });
  it('retire les désignations italiennes, allemandes, espagnoles et anglaises', () => {
    expect(normalizeAreaName('Parco Nazionale del Gran Paradiso')).toBe('gran paradiso');
    expect(normalizeAreaName('Nationalpark Berchtesgaden')).toBe('berchtesgaden');
    expect(normalizeAreaName('Parque Nacional Torres del Paine')).toBe('torres del paine');
    expect(normalizeAreaName('Yosemite National Park')).toBe('yosemite');
    expect(normalizeAreaName('Réserve naturelle nationale des Hauts de Chartreuse')).toBe(
      'hauts de chartreuse'
    );
  });
  it('enlève accents et apostrophes : « Écrins », « Parc national des Écrins »', () => {
    expect(normalizeAreaName('Parc national des Écrins')).toBe('ecrins');
    expect(normalizeAreaName("Réserve naturelle de l'Île de la Platière")).toBe(
      'ile de la platiere'
    );
  });
  it('ne coupe pas un nom propre : « Massif central » reste « massif central »', () => {
    expect(normalizeAreaName('Massif central')).toBe('massif central');
    expect(normalizeAreaName('Massif armoricain')).toBe('massif armoricain');
  });
  it('rend null pour une désignation seule ou un texte vide', () => {
    expect(normalizeAreaName('Parc national')).toBeNull();
    expect(normalizeAreaName('Réserve naturelle')).toBeNull();
    expect(normalizeAreaName('')).toBeNull();
    expect(normalizeAreaName(undefined)).toBeNull();
  });
});

describe('bboxAreaKm2', () => {
  it('mesure le rectangle sur la sphère (un degré carré à l’équateur ≈ 12 364 km²)', () => {
    expect(bboxAreaKm2(0, 0, 1, 1)).toBeGreaterThan(12_300);
    expect(bboxAreaKm2(0, 0, 1, 1)).toBeLessThan(12_400);
    // Plus étroit en latitude haute : le même degré carré à 60° N vaut à peu près la moitié.
    expect(bboxAreaKm2(0, 60, 1, 61)).toBeLessThan(6_300);
  });
});

describe('buildGeoAreasQuery', () => {
  it('demande parcs nationaux, aires protégées de classe 1 à 6 et réserves nommées, avec emprise et centre', () => {
    const q = buildGeoAreasQuery([6, 45, 7, 46]);
    const bb = '(45.0000,6.0000,46.0000,7.0000)';
    expect(q).toContain('[out:json]');
    expect(q).toContain(`rel["boundary"="national_park"]${bb};`);
    expect(q).toContain(
      `rel["boundary"="protected_area"]["protect_class"~"^(1a|1b|[1-6])$"]${bb};`
    );
    expect(q).toContain(`wr["leisure"="nature_reserve"]["name"]${bb};`);
    expect(q).toContain('out center bb tags;');
  });
});

describe('parseGeoAreas', () => {
  it('lit un parc national : nature, nom, clé de recherche, classe, centre, emprise, surface', () => {
    const { rows, elements } = parseGeoAreas({
      elements: [
        el('relation', 1, {
          boundary: 'national_park',
          protect_class: '2',
          name: 'Parc national de la Vanoise',
        }),
      ],
    });
    expect(elements).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      osm_id: 'r1',
      kind: 'national_park',
      name: 'Parc national de la Vanoise',
      name_plain: 'vanoise',
      protect_class: '2',
      lat: 45.4,
      lon: 6.9,
      west: 6.6,
      south: 45.2,
      east: 7.2,
      north: 45.6,
    });
    // Rectangle 0,6° × 0,4° à 45° N : ≈ 2 100 km² (majorant de la surface réelle).
    expect(rows[0].area_km2).toBeGreaterThan(2_000);
    expect(rows[0].area_km2).toBeLessThan(2_200);
  });
  it('garde la nature telle qu’OSM la donne : parc régional (classe 5), réserve sur un chemin', () => {
    const { rows } = parseGeoAreas({
      elements: [
        el('relation', 2, {
          boundary: 'protected_area',
          protect_class: '5',
          name: 'Parc naturel régional de Chartreuse',
        }),
        el('way', 3, { leisure: 'nature_reserve', name: 'Réserve naturelle du Lac Luitel' }),
      ],
    });
    expect(rows.map((r) => [r.osm_id, r.kind, r.protect_class, r.name_plain])).toEqual([
      ['r2', 'protected_area', '5', 'chartreuse'],
      ['w3', 'nature_reserve', null, 'lac luitel'],
    ]);
  });
  it('écarte et compte : sans nom, sans emprise, doublon, minuscule, démesuré, hors classe', () => {
    const { rows, dropped } = parseGeoAreas({
      elements: [
        el('relation', 1, { boundary: 'national_park', name: 'Parc national des Calanques' }),
        el('relation', 1, { boundary: 'national_park', name: 'Parc national des Calanques' }),
        el('relation', 2, { boundary: 'national_park' }),
        el('relation', 3, { boundary: 'national_park', name: 'Parc national' }),
        { type: 'relation', id: 4, tags: { boundary: 'national_park', name: 'Ecrins' } },
        el(
          'way',
          5,
          { leisure: 'nature_reserve', name: 'Mare aux grenouilles' },
          { minlat: 45.0, minlon: 6.0, maxlat: 45.001, maxlon: 6.001 }
        ),
        el(
          'relation',
          6,
          { boundary: 'national_park', name: 'Groenland' },
          { minlat: 59, minlon: -73, maxlat: 84, maxlon: -11 }
        ),
        el('relation', 7, {
          boundary: 'protected_area',
          protect_class: '97',
          name: 'Natura 2000 Vanoise',
        }),
      ],
    });
    expect(rows.map((r) => r.osm_id)).toEqual(['r1']);
    expect(dropped).toEqual({
      doublon: 1,
      sans_nom: 2,
      sans_emprise: 1,
      trop_petit: 1,
      demesure: 1,
      hors_classe: 1,
    });
  });
  it('ne devine pas la surface d’une emprise éclatée (au-delà de 3° d’écart) : area_km2 null', () => {
    const { rows } = parseGeoAreas({
      elements: [
        el(
          'relation',
          9,
          { boundary: 'national_park', name: 'Parc national de Port-Cros' },
          { minlat: 42.9, minlon: 3.0, maxlat: 43.1, maxlon: 6.6 },
          { lat: 43, lon: 4.8 }
        ),
      ],
    });
    expect(rows[0].area_km2).toBeNull();
  });
  it('rend un résultat vide pour une réponse sans éléments', () => {
    expect(parseGeoAreas(null)).toEqual({ rows: [], dropped: {}, elements: 0 });
    expect(parseGeoAreas({})).toEqual({ rows: [], dropped: {}, elements: 0 });
  });
});

describe('pickArea', () => {
  const row = (
    osm_id: string,
    name: string,
    west: number,
    east: number,
    kind: GeoAreaRow['kind'] = 'protected_area'
  ): GeoAreaRow => ({
    osm_id,
    kind,
    name,
    name_plain: normalizeAreaName(name) as string,
    protect_class: null,
    lat: 45.4,
    lon: (west + east) / 2,
    west,
    south: 45.2,
    east,
    north: 45.6,
    area_km2: null,
  });
  it('retrouve le parc depuis « Vanoise » ou « Massif de la Chartreuse »', () => {
    const rows = [
      row('r1', 'Parc national de la Vanoise', 6.6, 7.2, 'national_park'),
      row('r2', 'Parc naturel régional de Chartreuse', 5.6, 6.0),
    ];
    expect(pickArea(rows, 'Vanoise')?.osm_id).toBe('r1');
    expect(pickArea(rows, 'Massif de la Chartreuse')?.osm_id).toBe('r2');
  });
  it('entre homonymes, prend le plus étendu', () => {
    const rows = [
      row('w5', 'Réserve naturelle des Calanques', 5.4, 5.5, 'nature_reserve'),
      row('r9', 'Parc national des Calanques', 5.3, 5.7, 'national_park'),
    ];
    expect(pickArea(rows, 'Calanques')?.osm_id).toBe('r9');
  });
  it('à emprise égale, le résultat est stable (identifiant le plus petit)', () => {
    const rows = [row('r9', 'Vercors', 5, 6), row('r2', 'Parc naturel régional du Vercors', 5, 6)];
    expect(pickArea(rows, 'Vercors')?.osm_id).toBe('r2');
    expect(pickArea([...rows].reverse(), 'Vercors')?.osm_id).toBe('r2');
  });
  it('ne rend rien sans nom exact : « Chartreuse » ne retrouve pas « Hauts de Chartreuse »', () => {
    const rows = [row('r3', 'Réserve naturelle nationale des Hauts de Chartreuse', 5.7, 5.9)];
    expect(pickArea(rows, 'Chartreuse')).toBeNull();
    expect(pickArea([], 'Vanoise')).toBeNull();
    expect(pickArea(rows, 'Parc national')).toBeNull();
  });
});
