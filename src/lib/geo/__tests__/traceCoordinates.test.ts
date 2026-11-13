import { describe, expect, it } from 'vitest';
import {
  extractSegments,
  geometrySegments,
  segmentsLengthKm,
  simplifySegments,
  toTraceGeometry,
  unwrapAntimeridian,
  projectSegmentsToSvg,
  extractLngLat,
  lngLatBounds,
  lngLatLengthKm,
  projectLngLatToSvg,
  simplifyLngLat,
  toLineString,
  type LngLat,
} from '../traceCoordinates';

const LINE = {
  type: 'LineString',
  coordinates: [
    [6.86, 45.83],
    [6.87, 45.84],
    [6.88, 45.85],
  ],
};

describe('extractLngLat', () => {
  it('lit une LineString en [lng, lat]', () => {
    expect(extractLngLat(LINE)).toEqual([
      [6.86, 45.83],
      [6.87, 45.84],
      [6.88, 45.85],
    ]);
  });

  it('ignore l’altitude en 3e position', () => {
    expect(extractLngLat({ type: 'LineString', coordinates: [[6.1, 45.1, 1500], [6.2, 45.2, 1600]] })).toEqual([
      [6.1, 45.1],
      [6.2, 45.2],
    ]);
  });

  it('met les segments d’une MultiLineString bout à bout', () => {
    const multi = {
      type: 'MultiLineString',
      coordinates: [
        [[6.1, 45.1], [6.2, 45.2]],
        [[6.2, 45.2], [6.3, 45.3]],
      ],
    };
    expect(extractLngLat(multi)).toEqual([[6.1, 45.1], [6.2, 45.2], [6.2, 45.2], [6.3, 45.3]]);
  });

  it('lit une Feature et une FeatureCollection (lignes seulement, pas les points d’intérêt)', () => {
    expect(extractLngLat({ type: 'Feature', geometry: LINE, properties: {} })).toHaveLength(3);
    const collection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [2.35, 48.85] } },
        { type: 'Feature', geometry: LINE },
      ],
    };
    expect(extractLngLat(collection)).toEqual(LINE.coordinates);
  });

  it('lit une chaîne JSON (colonne geometry stockée en texte) et rend [] si elle est illisible', () => {
    expect(extractLngLat(JSON.stringify(LINE))).toEqual(LINE.coordinates);
    expect(extractLngLat('{pas du json')).toEqual([]);
    expect(extractLngLat('LINESTRING(1 2, 3 4)')).toEqual([]);
  });

  it('lit une GeometryCollection', () => {
    expect(extractLngLat({ type: 'GeometryCollection', geometries: [LINE] })).toHaveLength(3);
  });

  it('lit un tableau de [lng, lat] et de {lat, lng | lon | longitude}', () => {
    expect(extractLngLat([[6.1, 45.1], [6.2, 45.2]])).toEqual([[6.1, 45.1], [6.2, 45.2]]);
    expect(extractLngLat([{ lat: 45.1, lng: 6.1 }, { latitude: 45.2, lon: 6.2 }, { lat: '45.3', longitude: '6.3' }])).toEqual([
      [6.1, 45.1],
      [6.2, 45.2],
      [6.3, 45.3],
    ]);
  });

  it('lit un objet sans type : { geojson }, { geometry }, { coordinates }', () => {
    expect(extractLngLat({ geojson: LINE })).toHaveLength(3);
    expect(extractLngLat({ geometry: LINE })).toHaveLength(3);
    expect(extractLngLat({ coordinates: LINE.coordinates })).toHaveLength(3);
  });

  it('ne fabrique aucun point : null, vide, texte, non finis, hors bornes', () => {
    expect(extractLngLat(null)).toEqual([]);
    expect(extractLngLat(undefined)).toEqual([]);
    expect(extractLngLat('')).toEqual([]);
    expect(extractLngLat(42)).toEqual([]);
    expect(extractLngLat({})).toEqual([]);
    expect(extractLngLat([])).toEqual([]);
    // `Number(null)` vaut 0 et `isFinite(null)` vaut true : ces points ne doivent pas devenir (0, 0).
    expect(extractLngLat([[null, null], [6.1, null], [null, 45.1], ['', ''], [Number.NaN, 1], [Infinity, 1]])).toEqual([]);
    expect(extractLngLat([{ lat: null, lng: null }, { lat: undefined, lng: 6.1 }])).toEqual([]);
    expect(extractLngLat([[6.1, 95], [190, 45.1]])).toEqual([]);
  });

  it('garde les points valides d’une liste qui en contient de mauvais', () => {
    expect(extractLngLat([[null, 1], [6.1, 45.1], 'x', [6.2, 45.2]])).toEqual([[6.1, 45.1], [6.2, 45.2]]);
  });

  it('un point isolé n’est pas une trace', () => {
    expect(extractLngLat({ type: 'Point', coordinates: [6.1, 45.1] })).toEqual([]);
    expect(toLineString({ type: 'Point', coordinates: [6.1, 45.1] })).toBeNull();
  });

  it('résiste à une imbrication excessive', () => {
    let deep: unknown = [[6.1, 45.1], [6.2, 45.2]];
    for (let i = 0; i < 40; i += 1) deep = [deep];
    expect(extractLngLat(deep)).toEqual([]);
  });
});

describe('toLineString', () => {
  it('exige au moins deux points réels', () => {
    expect(toLineString(LINE)).toEqual({ type: 'LineString', coordinates: LINE.coordinates });
    expect(toLineString([[6.1, 45.1]])).toBeNull();
    expect(toLineString(null)).toBeNull();
  });
});

describe('simplifyLngLat', () => {
  const many: LngLat[] = Array.from({ length: 1000 }, (_, i) => [6 + i / 1000, 45 + i / 2000]);

  it('borne le nombre de points et garde le départ et l’arrivée', () => {
    const light = simplifyLngLat(many, 200);
    expect(light).toHaveLength(200);
    expect(light[0]).toEqual(many[0]);
    expect(light[light.length - 1]).toEqual(many[many.length - 1]);
  });

  it('ne touche pas une trace déjà courte, ne duplique pas, ne crée pas de point', () => {
    const short = many.slice(0, 50);
    expect(simplifyLngLat(short, 200)).toEqual(short);
    const light = simplifyLngLat(many, 60);
    for (const point of light) expect(many).toContainEqual(point);
  });

  it('garde au moins deux points', () => {
    expect(simplifyLngLat(many, 0)).toHaveLength(2);
  });
});

describe('lngLatBounds et longueur', () => {
  it('donne l’emprise réelle, null sans point', () => {
    expect(lngLatBounds(LINE.coordinates as LngLat[])).toEqual({ west: 6.86, south: 45.83, east: 6.88, north: 45.85 });
    expect(lngLatBounds([])).toBeNull();
  });

  it('mesure la distance (0,01° de latitude ≈ 1,11 km)', () => {
    expect(lngLatLengthKm([[6, 45], [6, 45.01]])).toBeCloseTo(1.112, 2);
    expect(lngLatLengthKm([[6, 45]])).toBe(0);
  });
});

describe('projectLngLatToSvg', () => {
  const parse = (polyline: string) => polyline.split(' ').map((pair) => pair.split(',').map(Number));

  it('reste dans le cadre, marge comprise', () => {
    const projected = projectLngLatToSvg(LINE.coordinates as LngLat[], 240, 90, 10);
    expect(projected).not.toBeNull();
    for (const [x, y] of parse(projected!.polyline)) {
      expect(x).toBeGreaterThanOrEqual(10 - 0.06);
      expect(x).toBeLessThanOrEqual(230 + 0.06);
      expect(y).toBeGreaterThanOrEqual(10 - 0.06);
      expect(y).toBeLessThanOrEqual(80 + 0.06);
    }
  });

  it('corrige la longitude par cos(latitude) : un carré de 1 km de côté reste carré', () => {
    // À 60° N, 1° de longitude vaut la moitié de 1° de latitude.
    const lat = 60;
    const dLat = 0.01;
    const dLng = 0.01 / Math.cos((lat * Math.PI) / 180);
    const square: LngLat[] = [
      [10, lat],
      [10 + dLng, lat],
      [10 + dLng, lat + dLat],
      [10, lat + dLat],
    ];
    const projected = projectLngLatToSvg(square, 200, 200, 10)!;
    const pts = parse(projected.polyline);
    const width = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    const height = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
    expect(width / height).toBeCloseTo(1, 1);
    // Sans correction, le tracé serait deux fois trop large.
    const naive = (dLng / dLat) * 1;
    expect(naive).toBeCloseTo(2, 1);
  });

  it('conserve le rapport sur un cadre large et centre le tracé', () => {
    // 0,02° vers l'est à l'équateur, 0,01° vers le nord : rapport 2:1.
    const projected = projectLngLatToSvg([[0, 0], [0.02, 0.01]], 300, 100, 10)!;
    const [a, b] = parse(projected.polyline);
    expect(Math.abs(b[0] - a[0]) / Math.abs(b[1] - a[1])).toBeCloseTo(2, 1);
    expect((a[0] + b[0]) / 2).toBeCloseTo(150, 0);
    expect((a[1] + b[1]) / 2).toBeCloseTo(50, 0);
  });

  it('le nord est en haut (y décroît quand la latitude croît)', () => {
    const projected = projectLngLatToSvg([[6, 45], [6, 45.1]], 100, 100, 5)!;
    expect(projected.start.y).toBeGreaterThan(projected.end.y);
  });

  it('expose départ et arrivée', () => {
    const projected = projectLngLatToSvg(LINE.coordinates as LngLat[], 240, 90, 10)!;
    const pts = parse(projected.polyline);
    expect([projected.start.x, projected.start.y].map((v) => Number(v.toFixed(1)))).toEqual(pts[0]);
    expect([projected.end.x, projected.end.y].map((v) => Number(v.toFixed(1)))).toEqual(pts[pts.length - 1]);
  });

  it('rend null sans point et centre un point unique ou des points confondus', () => {
    expect(projectLngLatToSvg([], 100, 100)).toBeNull();
    const single = projectLngLatToSvg([[6, 45]], 100, 60)!;
    expect(single.polyline).toBe('50.0,30.0');
    const same = projectLngLatToSvg([[6, 45], [6, 45]], 100, 60)!;
    expect(same.polyline).toBe('50.0,30.0 50.0,30.0');
  });
});

describe('segments disjoints : jamais de droite entre deux segments', () => {
  // Deux segments d'environ 3 km, distants d'environ 50 km.
  const A: LngLat[] = [[6.0, 45.0], [6.02, 45.0], [6.04, 45.01]];
  const B: LngLat[] = [[6.6, 45.0], [6.62, 45.0], [6.64, 45.01]];
  const MULTI = { type: 'MultiLineString', coordinates: [A, B] };

  it('extractSegments garde un segment par membre, extractLngLat reste à plat', () => {
    expect(extractSegments(MULTI)).toEqual([A, B]);
    expect(extractLngLat(MULTI)).toEqual([...A, ...B]);
    expect(extractSegments({ type: 'LineString', coordinates: A })).toEqual([A]);
    expect(extractSegments(A)).toEqual([A]);
    expect(extractSegments({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: A } }, { type: 'Feature', geometry: { type: 'LineString', coordinates: B } }] })).toEqual([A, B]);
  });

  it('toTraceGeometry : LineString pour un segment, MultiLineString pour plusieurs, null sans segment tracé', () => {
    expect(toTraceGeometry(A)).toEqual({ type: 'LineString', coordinates: A });
    expect(toTraceGeometry(MULTI)).toEqual({ type: 'MultiLineString', coordinates: [A, B] });
    expect(toTraceGeometry([[A[0]], [B[0]]])).toBeNull();
    expect(geometrySegments({ type: 'MultiLineString', coordinates: [[A[0]], B] })).toEqual([B]);
  });

  it('la longueur somme les segments sans compter l’écart entre eux', () => {
    const joined = lngLatLengthKm([...A, ...B]);
    const separate = segmentsLengthKm([A, B]);
    expect(separate).toBeCloseTo(lngLatLengthKm(A) + lngLatLengthKm(B), 6);
    expect(joined - separate).toBeGreaterThan(40); // la droite fausse ajoutait ~ 47 km
    expect(separate).toBeLessThan(10);
  });

  it('simplifySegments : budget total, départ et arrivée de chaque segment conservés', () => {
    const long: LngLat[] = Array.from({ length: 600 }, (_, i) => [6 + i / 1000, 45 + Math.sin(i / 20) / 100]);
    const other: LngLat[] = Array.from({ length: 300 }, (_, i) => [7 + i / 1000, 46 + Math.cos(i / 20) / 100]);
    const light = simplifySegments([long, other], 200);
    expect(light.flat().length).toBeLessThanOrEqual(200);
    expect(light).toHaveLength(2);
    expect(light[0][0]).toEqual(long[0]);
    expect(light[0][light[0].length - 1]).toEqual(long[long.length - 1]);
    expect(light[1][0]).toEqual(other[0]);
    expect(light[1][light[1].length - 1]).toEqual(other[other.length - 1]);
    expect(simplifySegments([A, B], 200)).toEqual([A, B]);
  });

  it('projectSegmentsToSvg : une polyline par segment, départ du premier et arrivée du dernier', () => {
    const projected = projectSegmentsToSvg([A, B], 300, 120, 10)!;
    expect(projected.polylines).toHaveLength(2);
    const first = projected.polylines[0].split(' ').map((p) => p.split(',').map(Number));
    const second = projected.polylines[1].split(' ').map((p) => p.split(',').map(Number));
    expect(projected.start.x).toBeCloseTo(first[0][0], 0);
    expect(projected.end.x).toBeCloseTo(second[second.length - 1][0], 0);
    // Le second segment est à l'est : il est entièrement à droite du premier.
    expect(Math.min(...second.map((p) => p[0]))).toBeGreaterThan(Math.max(...first.map((p) => p[0])));
  });
});

describe('antiméridien', () => {
  it('décale les longitudes négatives quand l’étendue dépasse 180°', () => {
    const fiji: LngLat[][] = [[[179.9, -17.0], [-179.9, -17.1], [-179.8, -17.2]]];
    const wrapped = unwrapAntimeridian(fiji);
    expect(wrapped[0].map((p) => p[0])).toEqual([179.9, 180.1, 180.2].map((v) => expect.closeTo(v, 6)));
    const projected = projectSegmentsToSvg(fiji, 200, 100, 10)!;
    const xs = projected.polylines[0].split(' ').map((p) => Number(p.split(',')[0]));
    // Sans décalage la trace serait étirée sur toute la largeur du monde ; ici elle reste ordonnée.
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it('laisse une trace ordinaire intacte', () => {
    const normal: LngLat[][] = [[[6.1, 45.1], [6.2, 45.2]]];
    expect(unwrapAntimeridian(normal)).toBe(normal);
  });
});
