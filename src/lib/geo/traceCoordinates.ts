/**
 * Coordonnées d'une trace (randonnée, GPX) : lecture tolérante, simplification
 * et projection SVG. Module pur, partagé par la messagerie et la fiche carnet.
 *
 * Règle : aucune coordonnée n'est jamais inventée. Une entrée illisible rend
 * `[]` (ou `null`), jamais un point par défaut. `null`, `''` et `undefined` ne
 * valent pas 0 (`Number(null) === 0`, `isFinite(null) === true`).
 */

/** Point `[longitude, latitude]` (ordre GeoJSON). */
export type LngLat = [number, number];

export interface TraceLineString {
  type: 'LineString';
  coordinates: LngLat[];
}

const MAX_DEPTH = 6;

/** Nombre fini ou NaN : `null`, `''`, tableaux et objets ne deviennent jamais 0. */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

function isCoordinateScalar(value: unknown): boolean {
  return Number.isFinite(toNumber(value));
}

/** Un point isolé : `[lng, lat(, alt)]` ou `{ lat, lng | lon | longitude }`. */
function readPoint(raw: unknown): LngLat | null {
  let lng = Number.NaN;
  let lat = Number.NaN;
  if (Array.isArray(raw)) {
    lng = toNumber(raw[0]);
    lat = toNumber(raw[1]);
  } else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    lat = toNumber(o.lat ?? o.latitude);
    lng = toNumber(o.lng ?? o.lon ?? o.longitude);
  }
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lng, lat];
}

function looksLikePoint(raw: unknown): boolean {
  if (Array.isArray(raw)) return raw.length >= 2 && isCoordinateScalar(raw[0]) && isCoordinateScalar(raw[1]);
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return (
      (o.lat !== undefined || o.latitude !== undefined) &&
      (o.lng !== undefined || o.lon !== undefined || o.longitude !== undefined)
    );
  }
  return false;
}

function collect(input: unknown, depth: number, out: LngLat[][]): void {
  if (input === null || input === undefined || depth > MAX_DEPTH) return;

  if (typeof input === 'string') {
    const text = input.trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        collect(JSON.parse(text), depth + 1, out);
      } catch {
        /* chaîne illisible : aucune coordonnée */
      }
    }
    return;
  }

  if (Array.isArray(input)) {
    if (input.some(looksLikePoint)) {
      const segment: LngLat[] = [];
      for (const item of input) {
        const point = readPoint(item);
        if (point) segment.push(point);
      }
      if (segment.length > 0) out.push(segment);
      return;
    }
    // Liste de segments (MultiLineString) ou de géométries : un segment par membre.
    for (const item of input) collect(item, depth + 1, out);
    return;
  }

  if (typeof input !== 'object') return;
  const o = input as Record<string, unknown>;
  switch (o.type) {
    case 'FeatureCollection':
      if (Array.isArray(o.features)) for (const feature of o.features) collect(feature, depth + 1, out);
      return;
    case 'Feature':
      collect(o.geometry, depth + 1, out);
      return;
    case 'GeometryCollection':
      if (Array.isArray(o.geometries)) for (const geometry of o.geometries) collect(geometry, depth + 1, out);
      return;
    case 'LineString':
    case 'MultiLineString':
      collect(o.coordinates, depth + 1, out);
      return;
    case 'Point':
    case 'MultiPoint':
    case 'Polygon':
    case 'MultiPolygon':
      // Un point d'intérêt ou une surface ne sont pas une trace.
      return;
    default:
      break;
  }
  // Objet sans `type` : `{ geometry }`, `{ geojson }`, `{ coordinates }`.
  if (o.geometry !== undefined) collect(o.geometry, depth + 1, out);
  else if (o.geojson !== undefined) collect(o.geojson, depth + 1, out);
  else if (o.coordinates !== undefined) collect(o.coordinates, depth + 1, out);
}

/**
 * Segments `[lng, lat][]` d'une trace : une LineString donne un segment, une
 * MultiLineString un segment par membre, une liste de points un segment. Les
 * segments restent SÉPARÉS (aucune droite n'est tracée entre deux segments
 * éloignés). Un segment peut compter un seul point : voir `geometrySegments`.
 */
export function extractSegments(input: unknown): LngLat[][] {
  const out: LngLat[][] = [];
  collect(input, 0, out);
  return out;
}

/**
 * Points `[lng, lat]` réels d'une trace, à plat, quel que soit le format stocké :
 * LineString, MultiLineString (segments mis bout à bout), Feature,
 * FeatureCollection (lignes seulement), GeometryCollection, chaîne JSON,
 * tableau de `[lng, lat]` ou de `{ lat, lng }`. Les points non finis ou hors
 * des bornes terrestres sont écartés ; rien n'est inventé. Pour dessiner ou
 * mesurer une trace à segments, préférer `extractSegments`.
 */
export function extractLngLat(input: unknown): LngLat[] {
  return extractSegments(input).flat();
}

/** Segments tracés : au moins deux points chacun. */
export function geometrySegments(input: unknown): LngLat[][] {
  return extractSegments(input).filter((segment) => segment.length >= 2);
}

export interface TraceMultiLineString {
  type: 'MultiLineString';
  coordinates: LngLat[][];
}

/** Géométrie d'une trace : un seul segment, ou plusieurs segments disjoints. */
export type TraceGeometry = TraceLineString | TraceMultiLineString;

/** `LineString` (un segment) ou `MultiLineString` (plusieurs), `null` sans segment d'au moins deux points. */
export function toTraceGeometry(input: unknown): TraceGeometry | null {
  const segments = geometrySegments(input);
  if (segments.length === 0) return null;
  return segments.length === 1
    ? { type: 'LineString', coordinates: segments[0] }
    : { type: 'MultiLineString', coordinates: segments };
}

/** `LineString` à plat (segments mis bout à bout) si la trace compte au moins deux points réels, sinon `null`. */
export function toLineString(input: unknown): TraceLineString | null {
  const coordinates = extractLngLat(input);
  return coordinates.length >= 2 ? { type: 'LineString', coordinates } : null;
}

/**
 * Réduit une trace à `maxPoints` points au plus (premier et dernier points
 * toujours conservés, échantillonnage régulier). Sert à joindre une version
 * légère du tracé à un message.
 */
export function simplifyLngLat(coords: LngLat[], maxPoints = 200): LngLat[] {
  const limit = Math.max(2, Math.floor(maxPoints));
  if (coords.length <= limit) return coords.slice();
  const out: LngLat[] = [];
  const step = (coords.length - 1) / (limit - 1);
  for (let i = 0; i < limit - 1; i += 1) out.push(coords[Math.round(i * step)]);
  out.push(coords[coords.length - 1]);
  return out;
}

export interface LngLatBoundsTuple {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function lngLatBounds(coords: LngLat[]): LngLatBoundsTuple | null {
  if (coords.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { west, south, east, north };
}

const EARTH_RADIUS_KM = 6371.0088;

/** Longueur cumulée (haversine) en km ; 0 sous deux points. */
export function lngLatLengthKm(coords: LngLat[]): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    total += 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return total;
}

/**
 * Réduit des segments à `maxPoints` points au total (budget réparti au prorata
 * du nombre de points de chaque segment, 2 points au moins ; premier et dernier
 * point de chaque segment toujours conservés).
 */
export function simplifySegments(segments: LngLat[][], maxPoints = 200): LngLat[][] {
  const total = segments.reduce((n, segment) => n + segment.length, 0);
  if (total <= maxPoints) return segments.map((segment) => segment.slice());
  return segments.map((segment) =>
    simplifyLngLat(segment, Math.max(2, Math.floor((maxPoints * segment.length) / total))),
  );
}

/** Longueur cumulée de plusieurs segments, SANS compter l'écart entre deux segments. */
export function segmentsLengthKm(segments: LngLat[][]): number {
  return segments.reduce((sum, segment) => sum + lngLatLengthKm(segment), 0);
}

/**
 * Traces qui traversent l'antiméridien (étendue en longitude > 180°) : les
 * longitudes négatives sont décalées de +360° pour que la trace reste d'un seul
 * tenant (cadrage et projection ne dézooment pas sur le monde entier).
 */
export function unwrapAntimeridian(segments: LngLat[][]): LngLat[][] {
  const flat = segments.flat();
  const bounds = lngLatBounds(flat);
  if (!bounds || bounds.east - bounds.west <= 180) return segments;
  return segments.map((segment) => segment.map(([lng, lat]): LngLat => [lng < 0 ? lng + 360 : lng, lat]));
}

export interface SvgPoint {
  x: number;
  y: number;
}

export interface ProjectedSegments {
  /** Une valeur d'attribut `points` de `<polyline>` par segment. */
  polylines: string[];
  /** Premier point du premier segment. */
  start: SvgPoint;
  /** Dernier point du dernier segment. */
  end: SvgPoint;
  width: number;
  height: number;
}

export interface ProjectedTrace {
  /** Valeur de l'attribut `points` d'un `<polyline>`. */
  polyline: string;
  start: SvgPoint;
  end: SvgPoint;
  width: number;
  height: number;
}

/**
 * Projette des segments dans un rectangle `width × height` avec `pad` de marge.
 * La longitude est multipliée par le cosinus de la latitude moyenne et le
 * rapport est conservé (même échelle en x et en y) : la trace n'est pas
 * déformée, elle est centrée. Un seul cadre pour tous les segments. `null` sans point.
 */
export function projectSegmentsToSvg(
  segments: LngLat[][],
  width: number,
  height: number,
  pad = 8,
): ProjectedSegments | null {
  const wrapped = unwrapAntimeridian(segments.filter((segment) => segment.length > 0));
  const flat = wrapped.flat();
  const bounds = lngLatBounds(flat);
  if (!bounds) return null;
  const midLat = (bounds.south + bounds.north) / 2;
  const cos = Math.cos((midLat * Math.PI) / 180) || 1;
  const spanX = (bounds.east - bounds.west) * cos;
  const spanY = bounds.north - bounds.south;
  const innerW = Math.max(width - pad * 2, 1);
  const innerH = Math.max(height - pad * 2, 1);
  // Trace dégénérée (points confondus) : échelle nulle, point au centre.
  const scale = spanX <= 0 && spanY <= 0 ? 0 : Math.min(innerW / Math.max(spanX, 1e-9), innerH / Math.max(spanY, 1e-9));
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  const project = ([lng, lat]: LngLat): SvgPoint => ({
    x: offsetX + (lng - bounds.west) * cos * scale,
    y: offsetY + (bounds.north - lat) * scale,
  });
  const polylines = wrapped.map((segment) =>
    segment
      .map(project)
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' '),
  );
  const first = wrapped[0];
  const last = wrapped[wrapped.length - 1];
  return { polylines, start: project(first[0]), end: project(last[last.length - 1]), width, height };
}

/** Projection d'une trace d'un seul tenant (voir `projectSegmentsToSvg`). */
export function projectLngLatToSvg(coords: LngLat[], width: number, height: number, pad = 8): ProjectedTrace | null {
  const projected = projectSegmentsToSvg([coords], width, height, pad);
  if (!projected) return null;
  return { polyline: projected.polylines[0], start: projected.start, end: projected.end, width, height };
}
