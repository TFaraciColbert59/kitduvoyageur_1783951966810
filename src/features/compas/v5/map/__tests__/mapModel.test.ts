import { describe, expect, it } from 'vitest';
import {
  MAX_POI_MARKERS,
  boundsKey,
  boundsOf,
  boundsToLngLat,
  buildTripGeometry,
  cameraPadding,
  cleanLatLons,
  cleanStages,
  dayBounds,
  decimate,
  distanceM,
  isLatLon,
  labelWidth,
  lengthKm,
  lodOf,
  mapSummary,
  padBounds,
  placeAlternatives,
  placeCallout,
  placeLabels,
  placeNameOf,
  poiRank,
  selectPoiMarkers,
  trackFromGeojson,
  tripBounds,
  type LatLon,
  type Rect,
  type StageInput,
} from '../mapModel';

/** Points intermédiaires entre des repères : une ligne régulière, sans bruit. */
function through(waypoints: LatLon[], perLeg = 10): LatLon[] {
  const out: LatLon[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [a, b] = [waypoints[i], waypoints[i + 1]];
    for (let k = 0; k < perLeg; k++) out.push([a[0] + ((b[0] - a[0]) * k) / perLeg, a[1] + ((b[1] - a[1]) * k) / perLeg]);
  }
  out.push(waypoints[waypoints.length - 1]);
  return out;
}

const D: LatLon = [45.0, 5.4];
const R: LatLon = [45.07, 5.45];
const C: LatLon = [45.04, 5.55];
const L: LatLon = [45.0, 5.62];
const stages3: StageInput[] = [
  { day: 1, lat: R[0], lon: R[1], title: 'Sainte-Eulalie → Rencurel' },
  { day: 2, lat: C[0], lon: C[1], title: 'Rencurel → Corrençon' },
  { day: 3, lat: L[0], lon: L[1], title: 'Corrençon → La Chapelle' },
];
const geojsonOf = (pts: LatLon[]) => ({ type: 'LineString', coordinates: pts.map(([lat, lon]) => [lon, lat]) });

describe('isLatLon', () => {
  it('accepte des coordonnées du globe', () => {
    expect(isLatLon(45, 5)).toBe(true);
    expect(isLatLon(-90, 180)).toBe(true);
  });
  it('refuse null, chaînes, NaN, Infinity et valeurs hors du globe', () => {
    expect(isLatLon(null, 5)).toBe(false);
    expect(isLatLon(45, undefined)).toBe(false);
    expect(isLatLon('45', 5)).toBe(false);
    expect(isLatLon(Number.NaN, 5)).toBe(false);
    expect(isLatLon(Infinity, 5)).toBe(false);
    expect(isLatLon(91, 5)).toBe(false);
    expect(isLatLon(45, 181)).toBe(false);
  });
  it('refuse (0, 0), valeur de remplissage d’une coordonnée absente', () => {
    expect(isLatLon(0, 0)).toBe(false);
    expect(isLatLon(0, 5)).toBe(true);
  });
});

describe('cleanLatLons / trackFromGeojson', () => {
  it('écarte les points invalides et les doublons consécutifs', () => {
    expect(
      cleanLatLons([
        [45, 5],
        [45, 5],
        [null, 5],
        ['x', 'y'],
        [46, 6],
      ])
    ).toEqual([
      [45, 5],
      [46, 6],
    ]);
    expect(cleanLatLons(null)).toEqual([]);
  });
  it('lit LineString, MultiLineString, Feature, FeatureCollection et GeometryCollection ([lon, lat] → [lat, lon])', () => {
    const ls = { type: 'LineString', coordinates: [[5, 45], [6, 46, 1200]] };
    expect(trackFromGeojson(ls)).toEqual([[45, 5], [46, 6]]);
    expect(trackFromGeojson({ type: 'Feature', properties: {}, geometry: ls })).toEqual([[45, 5], [46, 6]]);
    expect(trackFromGeojson({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: ls }] })).toEqual([[45, 5], [46, 6]]);
    expect(trackFromGeojson({ type: 'GeometryCollection', geometries: [ls] })).toEqual([[45, 5], [46, 6]]);
    expect(trackFromGeojson({ type: 'MultiLineString', coordinates: [[[5, 45]], [[6, 46]]] })).toEqual([[45, 5], [46, 6]]);
  });
  it('ignore points, polygones, positions invalides et entrées non GeoJSON', () => {
    expect(trackFromGeojson({ type: 'Point', coordinates: [5, 45] })).toEqual([]);
    expect(trackFromGeojson({ type: 'Polygon', coordinates: [[[5, 45], [6, 46], [5, 46]]] })).toEqual([]);
    expect(trackFromGeojson({ type: 'LineString', coordinates: [[5, 45], [null, null], [200, 45], [6, 46]] })).toEqual([[45, 5], [46, 6]]);
    expect(trackFromGeojson(null)).toEqual([]);
    expect(trackFromGeojson('{"type":"LineString"}')).toEqual([]);
    expect(trackFromGeojson({ type: 'LineString', coordinates: 'nope' })).toEqual([]);
  });
  it('borne la profondeur (pas de boucle sans fin sur une structure cyclique)', () => {
    const a: Record<string, unknown> = { type: 'Feature' };
    a.geometry = a;
    expect(trackFromGeojson(a)).toEqual([]);
  });
});

describe('distanceM / lengthKm / decimate', () => {
  it('mesure un degré de latitude à environ 111 km', () => {
    expect(distanceM([45, 5], [46, 5]) / 1000).toBeCloseTo(111.2, 0);
    expect(lengthKm([[45, 5], [46, 5], [47, 5]])).toBeCloseTo(222.4, 0);
    expect(lengthKm([])).toBe(0);
  });
  it('réduit en gardant le premier et le dernier point', () => {
    const list = Array.from({ length: 1000 }, (_, i) => i);
    const out = decimate(list, 50);
    expect(out).toHaveLength(50);
    expect(out[0]).toBe(0);
    expect(out[49]).toBe(999);
    expect(decimate([1, 2, 3], 10)).toEqual([1, 2, 3]);
    expect(decimate(list, 1)).toHaveLength(1000);
  });
});

describe('cleanStages', () => {
  it('garde les étapes valides, une par jour (la première gagne), triées', () => {
    const out = cleanStages([
      { day: 3, lat: 45, lon: 5, title: 'c' },
      { day: 1, lat: 45.1, lon: 5.1, title: 'a' },
      { day: 1, lat: 46, lon: 6, title: 'doublon' },
      { day: 2, lat: Number.NaN, lon: 5, title: 'sans coordonnées' },
      { day: 4, lat: 0, lon: 0, title: 'zéro' },
      { day: Number.NaN, lat: 45, lon: 5, title: 'sans jour' },
    ]);
    expect(out.map((s) => s.title)).toEqual(['a', 'c']);
  });
  it('accepte une entrée absente', () => {
    expect(cleanStages(null)).toEqual([]);
    expect(cleanStages(undefined)).toEqual([]);
  });
});

describe('buildTripGeometry : tracé réel', () => {
  const track = through([D, R, C, L], 20);
  const g = buildTripGeometry({ routeGeojson: geojsonOf(track), coords: [], stages: stages3 });

  it('découpe en un segment par jour, sans coupure entre deux jours', () => {
    expect(g.source).toBe('track');
    expect(g.segments.map((s) => s.day)).toEqual([1, 2, 3]);
    for (let i = 0; i < g.segments.length - 1; i++) {
      const a = g.segments[i].coords;
      const b = g.segments[i + 1].coords;
      expect(a[a.length - 1]).toEqual(b[0]);
    }
  });
  it('coupe au plus près de chaque arrivée', () => {
    const endOf = (i: number) => {
      const c = g.segments[i].coords;
      const [lon, lat] = c[c.length - 1];
      return [lat, lon] as LatLon;
    };
    expect(distanceM(endOf(0), R)).toBeLessThan(50);
    expect(distanceM(endOf(1), C)).toBeLessThan(50);
    expect(endOf(2)).toEqual(L);
  });
  it('couvre tout le tracé sans en perdre ni en ajouter', () => {
    const total = g.segments.reduce((n, s) => n + s.coords.length, 0) - (g.segments.length - 1);
    expect(total).toBe(track.length);
    expect(g.segments.every((s) => !s.approximate)).toBe(true);
    expect(g.approximate).toBe(false);
  });
  it('donne le départ du tracé comme origine, et la longueur réelle', () => {
    expect(g.origin).toEqual({ lat: D[0], lon: D[1], title: '' });
    expect(g.trackKm).toBeCloseTo(lengthKm(track), 6);
  });
  it('préfère l’origine donnée au début du tracé', () => {
    const g2 = buildTripGeometry({
      routeGeojson: geojsonOf(track),
      coords: [],
      stages: stages3,
      origin: { lat: 44.99, lon: 5.39, title: 'Sainte-Eulalie-en-Royans' },
    });
    expect(g2.origin).toEqual({ lat: 44.99, lon: 5.39, title: 'Sainte-Eulalie-en-Royans' });
  });
  it('ignore une origine donnée invalide', () => {
    const g2 = buildTripGeometry({ routeGeojson: geojsonOf(track), coords: [], stages: stages3, origin: { lat: Number.NaN, lon: 5, title: 'x' } });
    expect(g2.origin?.lat).toBe(D[0]);
  });
  it('ne recule jamais : une ligne qui repasse près d’une étape plus tard ne mange pas les jours suivants', () => {
    // Boucle : l’étape 1 est visitée au jour 1, puis la ligne y repasse presque à la fin.
    const loop = through([D, R, C, [R[0] + 0.0004, R[1]], L], 20);
    const gl = buildTripGeometry({ routeGeojson: geojsonOf(loop), coords: [], stages: stages3 });
    expect(gl.segments.map((s) => s.day)).toEqual([1, 2, 3]);
    const end1 = gl.segments[0].coords.length;
    expect(end1).toBeLessThan(loop.length / 2);
  });
  it('garde l’ordre des jours même si les étapes arrivent dans le désordre', () => {
    const g2 = buildTripGeometry({ routeGeojson: geojsonOf(track), coords: [], stages: [stages3[2], stages3[0], stages3[1]] });
    expect(g2.segments.map((s) => s.day)).toEqual([1, 2, 3]);
  });
  it('un seul jour : tout le tracé appartient à ce jour', () => {
    const g1 = buildTripGeometry({ routeGeojson: geojsonOf(through([D, R], 12)), coords: [], stages: [stages3[0]] });
    expect(g1.segments).toHaveLength(1);
    expect(g1.segments[0].day).toBe(1);
    expect(g1.segments[0].coords).toHaveLength(13);
  });
  it('sans aucune étape géolocalisée, le tracé se dessine d’un trait (jour 0)', () => {
    const g0 = buildTripGeometry({ routeGeojson: geojsonOf(track), coords: [], stages: [{ day: 1, lat: Number.NaN, lon: 0, title: 'x' }] });
    expect(g0.segments).toHaveLength(1);
    expect(g0.segments[0].day).toBe(0);
    expect(g0.stages).toEqual([]);
  });
  it('étapes partiellement géolocalisées : le jour sans coordonnées est absorbé par le suivant', () => {
    const partial = [stages3[0], { ...stages3[1], lat: Number.NaN }, stages3[2]];
    const gp = buildTripGeometry({ routeGeojson: geojsonOf(track), coords: [], stages: partial });
    expect(gp.stages.map((s) => s.day)).toEqual([1, 3]);
    expect(gp.segments.map((s) => s.day)).toEqual([1, 3]);
    const total = gp.segments.reduce((n, s) => n + s.coords.length, 0) - 1;
    expect(total).toBe(track.length);
  });
  it('une étape loin du tracé reçoit une droite approximative, le reste garde le vrai tracé', () => {
    const far: StageInput[] = [stages3[0], { day: 2, lat: 46.5, lon: 7.5, title: 'loin' }, stages3[2]];
    const gf = buildTripGeometry({ routeGeojson: geojsonOf(track), coords: [], stages: far });
    const byDay = new Map(gf.segments.map((s) => [s.day, s]));
    expect(byDay.get(1)?.approximate).toBe(false);
    expect(byDay.get(2)?.approximate).toBe(true);
    expect(byDay.get(2)?.coords).toHaveLength(2);
    expect(gf.approximate).toBe(true);
  });
  it('décime un segment trop long', () => {
    const dense = through([D, R, C, L], 3000);
    const gd = buildTripGeometry({ routeGeojson: geojsonOf(dense), coords: [], stages: stages3, maxPoints: 100 });
    expect(gd.segments.every((s) => s.coords.length <= 100)).toBe(true);
  });
});

describe('buildTripGeometry : sans tracé', () => {
  it('relie origine et étapes par des segments droits approximatifs', () => {
    const g = buildTripGeometry({
      routeGeojson: null,
      coords: [],
      stages: stages3,
      origin: { lat: D[0], lon: D[1], title: 'Départ' },
    });
    expect(g.source).toBe('stages');
    expect(g.segments.map((s) => s.day)).toEqual([1, 2, 3]);
    expect(g.segments.every((s) => s.approximate && s.coords.length === 2)).toBe(true);
    expect(g.segments[0].coords[0]).toEqual([D[1], D[0]]);
    expect(g.segments[1].coords[0]).toEqual([R[1], R[0]]);
    expect(g.approximate).toBe(true);
    expect(g.trackKm).toBeNull();
  });
  it('sans origine, le premier jour n’a pas de segment et il n’y a pas de départ inventé', () => {
    const g = buildTripGeometry({ routeGeojson: null, coords: [], stages: stages3 });
    expect(g.origin).toBeNull();
    expect(g.segments.map((s) => s.day)).toEqual([2, 3]);
  });
  it('une seule étape sans origine : rien à tracer, mais l’étape reste', () => {
    const g = buildTripGeometry({ routeGeojson: null, coords: [], stages: [stages3[0]] });
    expect(g.segments).toEqual([]);
    expect(g.stages).toHaveLength(1);
    expect(g.approximate).toBe(false);
    expect(g.source).toBe('stages');
  });
  it('aucune donnée : source none, rien de dessiné', () => {
    const g = buildTripGeometry({ routeGeojson: null, coords: [], stages: [] });
    expect(g.source).toBe('none');
    expect(g.segments).toEqual([]);
    expect(g.origin).toBeNull();
    expect(tripBounds(g)).toBeNull();
  });
  it('une liste de points sans GeoJSON sert de ligne, mais reste approximative', () => {
    const g = buildTripGeometry({ routeGeojson: null, coords: through([D, R, C, L], 5), stages: stages3 });
    expect(g.source).toBe('coords');
    expect(g.segments.every((s) => s.approximate)).toBe(true);
    expect(g.trackKm).toBeNull();
    expect(g.segments.map((s) => s.day)).toEqual([1, 2, 3]);
  });
  it('un GeoJSON invalide retombe sur les étapes', () => {
    const g = buildTripGeometry({ routeGeojson: { type: 'LineString', coordinates: [[null, null]] }, coords: [], stages: stages3, origin: { lat: D[0], lon: D[1], title: '' } });
    expect(g.source).toBe('stages');
    expect(g.segments).toHaveLength(3);
  });
  it('des coordonnées toutes invalides ne produisent rien', () => {
    const g = buildTripGeometry({
      routeGeojson: { type: 'LineString', coordinates: [[Number.NaN, 1], [1, Number.NaN]] },
      coords: [[null, null], ['a', 'b']],
      stages: [{ day: 1, lat: 0, lon: 0, title: '' }],
    });
    expect(g.source).toBe('none');
    expect(g.segments).toEqual([]);
  });
});

describe('emprises', () => {
  const g = buildTripGeometry({ routeGeojson: geojsonOf(through([D, R, C, L], 10)), coords: [], stages: stages3 });

  it('boundsOf ignore les points invalides', () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([[45, 5], [Number.NaN, 5], [46, 7]])).toEqual({ south: 45, west: 5, north: 46, east: 7 });
  });
  it('padBounds ajoute une marge et garantit une étendue minimale autour d’un point', () => {
    const b = padBounds({ south: 45, west: 5, north: 46, east: 6 }, 0.1);
    expect(b.south).toBeCloseTo(44.9);
    expect(b.north).toBeCloseTo(46.1);
    const point = padBounds({ south: 45, west: 5, north: 45, east: 5 });
    expect(point.north - point.south).toBeGreaterThanOrEqual(0.012);
    expect(point.east - point.west).toBeGreaterThanOrEqual(0.012);
  });
  it('padBounds reste dans le globe', () => {
    const b = padBounds({ south: 84.99, west: 179.99, north: 85, east: 180 });
    expect(b.north).toBeLessThanOrEqual(85);
    expect(b.east).toBeLessThanOrEqual(180);
  });
  it('tripBounds contient le tracé, le départ, les étapes et les points supplémentaires', () => {
    const b = tripBounds(g, [[45.2, 5.7]])!;
    for (const [lat, lon] of [D, R, C, L, [45.2, 5.7]] as LatLon[]) {
      expect(lat).toBeGreaterThanOrEqual(b.south);
      expect(lat).toBeLessThanOrEqual(b.north);
      expect(lon).toBeGreaterThanOrEqual(b.west);
      expect(lon).toBeLessThanOrEqual(b.east);
    }
  });
  it('dayBounds ne contient que le jour demandé', () => {
    const b2 = dayBounds(g, 2)!;
    expect(b2.west).toBeGreaterThan(D[1]);
    expect(b2.east).toBeLessThan(L[1] + 0.2);
    expect(R[1]).toBeGreaterThanOrEqual(b2.west);
    expect(C[1]).toBeLessThanOrEqual(b2.east);
    const all = tripBounds(g)!;
    expect(b2.east - b2.west).toBeLessThan(all.east - all.west);
  });
  it('dayBounds : un jour sans étape géolocalisée n’a pas d’emprise', () => {
    expect(dayBounds(g, 9)).toBeNull();
  });
  it('dayBounds inclut les nuits possibles passées en supplément', () => {
    const base = dayBounds(g, 1)!;
    const wide = dayBounds(g, 1, [[45.3, 5.9]])!;
    expect(wide.north).toBeGreaterThan(base.north);
    expect(wide.east).toBeGreaterThan(base.east);
  });
  it('un jour dont le segment manque garde son étape, avec une vue lisible', () => {
    const sans = buildTripGeometry({ routeGeojson: null, coords: [], stages: stages3 });
    const b = dayBounds(sans, 1)!;
    expect(b.east - b.west).toBeGreaterThanOrEqual(0.012);
  });
  it('boundsKey est stable et distingue deux emprises', () => {
    const a = tripBounds(g);
    expect(boundsKey(a)).toBe(boundsKey(tripBounds(g)));
    expect(boundsKey(a)).not.toBe(boundsKey(dayBounds(g, 1)));
    expect(boundsKey(null)).toBe('none');
  });
  it('boundsToLngLat donne [[ouest, sud], [est, nord]]', () => {
    expect(boundsToLngLat({ south: 1, west: 2, north: 3, east: 4 })).toEqual([[2, 1], [4, 3]]);
  });
});

describe('cameraPadding', () => {
  it('ajoute la marge de base à la zone masquée', () => {
    const p = cameraPadding({ top: 0, bottom: 200, left: 0, right: 0 }, { width: 400, height: 900 });
    expect(p.bottom).toBe(236);
    expect(p.top).toBe(76);
  });
  it('rabote les marges pour garder une zone visible', () => {
    const p = cameraPadding({ top: 0, bottom: 800, left: 0, right: 0 }, { width: 400, height: 900 });
    expect(p.top + p.bottom).toBeLessThanOrEqual(900 - 80);
    expect(p.top).toBeGreaterThan(0);
  });
  it('une carte minuscule n’a plus de marge (jamais négative)', () => {
    const p = cameraPadding({ top: 0, bottom: 0, left: 0, right: 0 }, { width: 50, height: 50 });
    expect(p).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });
  it('ignore les valeurs non numériques', () => {
    const p = cameraPadding({ top: Number.NaN, bottom: -5, left: Infinity, right: 0 }, { width: 400, height: 900 });
    expect(p.top).toBe(76);
    expect(p.bottom).toBe(36);
  });
});

describe('niveau de détail', () => {
  it('lodOf suit le zoom', () => {
    expect(lodOf(3)).toBe('low');
    expect(lodOf(8.49)).toBe('low');
    expect(lodOf(8.5)).toBe('mid');
    expect(lodOf(10.99)).toBe('mid');
    expect(lodOf(11)).toBe('high');
    expect(lodOf(Number.NaN)).toBe('low');
  });
  it('poiRank classe l’eau avant les sommets, et ferme la marche aux inconnus', () => {
    expect(poiRank('water')).toBeLessThan(poiRank('peak'));
    expect(poiRank('inconnu')).toBe(99);
    expect(poiRank(null)).toBe(99);
  });
});

describe('selectPoiMarkers', () => {
  const project = (lat: number, lon: number) => ({ x: (lon - 5) * 10000, y: (46 - lat) * 10000 });
  const mk = (id: string, lat: number, lon: number, category: string | null, label = id) => ({ id, lat, lon, label, category });
  const wide = { south: 44, west: 4, north: 47, east: 7 };

  it('low : aucun point (sauf celui qui est ouvert)', () => {
    const pts = [mk('a', 45, 5.5, 'water'), mk('b', 45.1, 5.6, 'peak')];
    expect(selectPoiMarkers(pts, { lod: 'low', viewport: wide, project })).toEqual([]);
    expect(selectPoiMarkers(pts, { lod: 'low', viewport: wide, project, keep: new Set(['b']) }).map((p) => p.id)).toEqual(['b']);
  });
  it('mid : l’essentiel seulement ; high : tout', () => {
    const pts = [mk('eau', 45, 5.5, 'water'), mk('resto', 45.1, 5.6, 'resto'), mk('toilettes', 45.2, 5.7, 'toilets'), mk('x', 45.3, 5.8, null)];
    expect(selectPoiMarkers(pts, { lod: 'mid', viewport: wide, project }).map((p) => p.id)).toEqual(['eau']);
    expect(selectPoiMarkers(pts, { lod: 'high', viewport: wide, project }).map((p) => p.id).sort()).toEqual(['eau', 'resto', 'toilettes', 'x']);
  });
  it('écarte les points hors de la zone visible et les coordonnées invalides', () => {
    const pts = [mk('in', 45, 5.5, 'water'), mk('out', 10, 5.5, 'water'), mk('bad', Number.NaN, 5.5, 'water'), mk('zero', 0, 0, 'water')];
    expect(selectPoiMarkers(pts, { lod: 'high', viewport: wide, project }).map((p) => p.id)).toEqual(['in']);
  });
  it('éclaircit : un seul point par case, le plus important d’abord', () => {
    const pts = [mk('resto', 45.0001, 5.5001, 'resto'), mk('eau', 45.0002, 5.5002, 'water'), mk('loin', 45.5, 5.9, 'resto')];
    const out = selectPoiMarkers(pts, { lod: 'high', viewport: wide, project, cellPx: 44 });
    expect(out.map((p) => p.id).sort()).toEqual(['eau', 'loin']);
  });
  it('plafonne à max marqueurs', () => {
    const pts = Array.from({ length: 300 }, (_, i) => mk(`p${i}`, 45 + (i % 20) * 0.01, 5 + Math.floor(i / 20) * 0.01, 'water'));
    expect(selectPoiMarkers(pts, { lod: 'high', viewport: wide, project }).length).toBeLessThanOrEqual(MAX_POI_MARKERS);
    expect(selectPoiMarkers(pts, { lod: 'high', viewport: wide, project, max: 5 })).toHaveLength(5);
  });
  it('garde toujours le point ouvert, même au-delà du plafond ou hors zone', () => {
    const pts = [mk('ouvert', 10, 5.5, 'toilets'), mk('a', 45, 5.5, 'water')];
    const out = selectPoiMarkers(pts, { lod: 'mid', viewport: wide, project, max: 1, keep: new Set(['ouvert']) });
    expect(out.map((p) => p.id)).toContain('ouvert');
  });
  it('ne pose pas un point sous un obstacle (une pastille d’étape)', () => {
    const pts = [mk('sous', 45, 5.5, 'water')];
    const p = project(45, 5.5);
    const obstacle: Rect = { x: p.x - 14, y: p.y - 14, w: 28, h: 28 };
    expect(selectPoiMarkers(pts, { lod: 'high', viewport: wide, project, obstacles: [obstacle] })).toEqual([]);
  });
  it('ignore les identifiants en double', () => {
    const pts = [mk('a', 45, 5.5, 'water'), mk('a', 45.2, 5.9, 'water')];
    expect(selectPoiMarkers(pts, { lod: 'high', viewport: wide, project })).toHaveLength(1);
  });
  it('est déterministe', () => {
    const pts = Array.from({ length: 60 }, (_, i) => mk(`p${i}`, 45 + (i % 8) * 0.004, 5 + Math.floor(i / 8) * 0.004, i % 2 ? 'water' : 'peak'));
    const a = selectPoiMarkers(pts, { lod: 'high', viewport: wide, project }).map((p) => p.id);
    const b = selectPoiMarkers([...pts].reverse(), { lod: 'high', viewport: wide, project }).map((p) => p.id);
    expect(a).toEqual(b);
  });
});

describe('placeLabels', () => {
  const area = { width: 400, height: 600 };
  it('place un libellé sous son marqueur, centré', () => {
    const [p] = placeLabels([{ id: 'a', x: 200, y: 300, text: 'Rencurel' }], area);
    expect(p.side).toBe('below');
    expect(p.dx).toBe(0);
    expect(p.dy).toBeGreaterThan(14);
  });
  it('change de côté quand le dessous est pris', () => {
    const obstacles: Rect[] = [{ x: 150, y: 310, w: 100, h: 30 }];
    const [p] = placeLabels([{ id: 'a', x: 200, y: 300, text: 'Rencurel' }], { ...area, obstacles });
    expect(p.side).toBe('above');
  });
  it('omet un libellé qui ne tient nulle part', () => {
    const obstacles: Rect[] = [{ x: 0, y: 0, w: 400, h: 600 }];
    expect(placeLabels([{ id: 'a', x: 200, y: 300, text: 'Rencurel' }], { ...area, obstacles })).toEqual([]);
  });
  it('deux libellés voisins ne se chevauchent jamais, le plus prioritaire est servi d’abord', () => {
    const out = placeLabels(
      [
        { id: 'bas', x: 200, y: 300, text: 'Corrençon-en-Vercors', priority: 1 },
        { id: 'haut', x: 210, y: 310, text: 'Villard-de-Lans', priority: 5 },
      ],
      area
    );
    expect(out[0].id).toBe('haut');
    expect(out[0].side).toBe('below');
    const rect = (c: { x: number; y: number }, p: (typeof out)[number]) => ({ x: c.x + p.dx - p.width / 2, y: c.y + p.dy - p.height / 2, w: p.width, h: p.height });
    if (out.length === 2) {
      const a = rect({ x: 210, y: 310 }, out[0]);
      const b = rect({ x: 200, y: 300 }, out[1]);
      const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(hit).toBe(false);
    }
  });
  it('ne déborde pas de la vue', () => {
    const out = placeLabels([{ id: 'a', x: 5, y: 300, text: 'Un libellé assez long pour sortir' }], area);
    for (const p of out) {
      const left = 5 + p.dx - p.width / 2;
      expect(left).toBeGreaterThanOrEqual(0);
    }
  });
  it('ignore les libellés vides ou sans position', () => {
    expect(placeLabels([{ id: 'a', x: 100, y: 100, text: '  ' }, { id: 'b', x: Number.NaN, y: 1, text: 'x' }], area)).toEqual([]);
  });
  it('labelWidth croît avec le texte et plafonne', () => {
    expect(labelWidth('ab')).toBeLessThan(labelWidth('abcdefgh'));
    expect(labelWidth('x'.repeat(200))).toBe(168);
  });
});

describe('placeNameOf', () => {
  it('prend le lieu d’arrivée d’un titre de jour', () => {
    expect(placeNameOf('Sainte-Eulalie-en-Royans → Rencurel')).toBe('Rencurel');
    expect(placeNameOf('A -> B -> C')).toBe('C');
    expect(placeNameOf('  Rencurel ')).toBe('Rencurel');
    expect(placeNameOf('')).toBe('');
    expect(placeNameOf(null)).toBe('');
  });
});

describe('placeAlternatives', () => {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  it('laisse en place une nuit possible qui a sa place libre', () => {
    const [p] = placeAlternatives([{ x: 100, y: 100 }], [{ id: 'a', x: 300, y: 300 }]);
    expect(p).toEqual({ id: 'a', offsetX: 0, offsetY: 0 });
  });
  it('écarte deux nuits possibles superposées, sans déplacer la nuit retenue', () => {
    const alts = [
      { id: 'a', x: 200, y: 200 },
      { id: 'b', x: 202, y: 201 },
    ];
    const out = placeAlternatives([{ x: 200, y: 200 }], alts);
    const pos = out.map((o, i) => ({ x: alts[i].x + o.offsetX, y: alts[i].y + o.offsetY }));
    expect(dist(pos[0], { x: 200, y: 200 })).toBeGreaterThanOrEqual(44 - 1);
    expect(dist(pos[0], pos[1])).toBeGreaterThanOrEqual(44 - 1);
  });
  it('borne le décalage', () => {
    const alts = Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, x: 200, y: 200 }));
    const out = placeAlternatives([{ x: 200, y: 200 }], alts, { maxShift: 40 });
    for (const o of out) expect(Math.hypot(o.offsetX, o.offsetY)).toBeLessThanOrEqual(40.5);
  });
  it('garde l’ordre reçu et reste déterministe', () => {
    const alts = [{ id: 'a', x: 10, y: 10 }, { id: 'b', x: 12, y: 10 }];
    expect(placeAlternatives([], alts)).toEqual(placeAlternatives([], alts));
    expect(placeAlternatives([], alts).map((o) => o.id)).toEqual(['a', 'b']);
    expect(placeAlternatives([], [])).toEqual([]);
  });
});

describe('placeCallout', () => {
  const base = { boxW: 232, boxH: 100, areaW: 390, areaH: 500 };
  it('se pose au-dessus, centrée sur le point, pointe au milieu', () => {
    const c = placeCallout({ ...base, x: 195, y: 300 });
    expect(c.below).toBe(false);
    expect(c.left).toBe(79);
    expect(c.top).toBe(300 - 100 - 24);
    expect(c.arrowX).toBe(116);
  });
  it('reste dans la zone et la pointe vise toujours le point', () => {
    const left = placeCallout({ ...base, x: 5, y: 300 });
    expect(left.left).toBe(10);
    expect(left.arrowX).toBe(18);
    const right = placeCallout({ ...base, x: 385, y: 300 });
    expect(right.left).toBe(390 - 232 - 10);
    expect(right.arrowX).toBe(232 - 18);
  });
  it('passe dessous quand le haut manque', () => {
    const c = placeCallout({ ...base, x: 195, y: 60 });
    expect(c.below).toBe(true);
    expect(c.top).toBe(84);
  });
  it('reste dans la zone même si elle est plus petite que la bulle', () => {
    const c = placeCallout({ boxW: 232, boxH: 100, areaW: 200, areaH: 90, x: 100, y: 50 });
    expect(c.left).toBeGreaterThanOrEqual(10);
    expect(c.top).toBeGreaterThanOrEqual(10);
  });
});

describe('mapSummary', () => {
  it('arrondit la longueur du tracé réel', () => {
    const g = buildTripGeometry({ routeGeojson: geojsonOf(through([D, R, C, L], 10)), coords: [], stages: stages3 });
    const s = mapSummary(g, 3, 2);
    expect(s.days).toBe(3);
    expect(s.nights).toBe(2);
    expect(s.km).toBe(Math.round(lengthKm(through([D, R, C, L], 10))));
    expect(s.approximate).toBe(false);
  });
  it('sans tracé réel : pas de kilomètres, tracé approximatif', () => {
    const g = buildTripGeometry({ routeGeojson: null, coords: [], stages: stages3, origin: { lat: D[0], lon: D[1], title: '' } });
    const s = mapSummary(g, 3, 2);
    expect(s.km).toBeNull();
    expect(s.approximate).toBe(true);
  });
  it('borne les nombres', () => {
    const g = buildTripGeometry({ routeGeojson: null, coords: [], stages: [] });
    expect(mapSummary(g, -2, 2.9)).toEqual({ days: 0, km: null, nights: 2, approximate: false });
  });
});
