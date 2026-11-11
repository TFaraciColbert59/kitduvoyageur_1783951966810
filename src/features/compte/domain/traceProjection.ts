/**
 * Projecteur de trace partageable.
 *
 * Le domaine ne connaît ni la carte, ni le GPX, ni la base : il reçoit une
 * géométrie et des masques, puis rend uniquement les morceaux visibles. Un
 * masque retire un intervalle le long de la trace ; deux morceaux séparés par
 * cet intervalle ne sont jamais recollés, même si la zone masquée ne contient
 * aucun sommet d'origine (segment traversant).
 *
 * Les coordonnées sont synthétiques et exprimées en WGS84 (lng/lat). Les
 * distances de début/fin sont mesurées le long de la trace (haversine) ; les
 * zones sont des disques ou des boîtes en degrés. Aucun appel réseau, aucune
 * lecture de base et aucune donnée réelle n'est nécessaire.
 *
 * Défense en profondeur : une trace ou une zone hors du domaine de calcul sûr
 * (pôle, antiméridien, trop grande) échoue fermée. Les zones et les masques
 * début/fin sont élargis de 50 m, les points publiés sont arrondis à 5
 * décimales, puis chaque morceau est vérifié avant publication : il doit rester
 * assez long et hors des zones élargies, y compris en son milieu. Une coupure
 * n'est jamais recollée.
 *
 * En cas d'entrée douteuse, le projecteur échoue fermé : il ne rend aucune
 * géométrie plutôt que de risquer de divulguer une portion masquée.
 */

// Réutilise la distance orthodromique déjà testée du domaine Adventure
// Intelligence. Les helpers de `compte/map/geometry` parsent, simplifient et
// bornent une trace, mais ne découpent pas de segments : les réutiliser ici
// n'apporterait pas la primitive manquante.
import {
  EARTH_RADIUS_M,
  cumulativeDistancesM,
  haversineM,
} from '../../adventure-intelligence/domain/geo';

export interface TracePoint {
  lng: number;
  lat: number;
}

/** [ouest, sud, est, nord], en degrés WGS84. */
export type TraceBounds = readonly [west: number, south: number, east: number, north: number];

export type PrivacyZone =
  { kind: 'circle'; center: TracePoint; radiusM: number } | { kind: 'bbox'; bounds: TraceBounds };

export type TraceMask =
  | { kind: 'start'; meters: number }
  | { kind: 'end'; meters: number }
  | { kind: 'all' }
  | { kind: 'zone'; zone: PrivacyZone };

export type TraceProjectionError =
  'invalid_points' | 'invalid_masks' | 'unsafe_geometry' | 'unpublishable_geometry' | null;

export interface TraceProjection {
  /** Morceaux visibles, dans l'ordre de la trace. Jamais reliés à travers un masque. */
  segments: TracePoint[][];
  /** Vrai dès qu'un masque a été demandé, même s'il ne coupe rien. */
  masked: boolean;
  /** Vrai si des masques valides ne laissent plus aucun morceau visible. */
  fullyMasked: boolean;
  /** `null` si l'entrée est exploitable ; sinon la trace n'est jamais rendue. */
  error: TraceProjectionError;
  inputPointCount: number;
  visiblePointCount: number;
}

const DEG_TO_RAD = Math.PI / 180;
const EPSILON = 1e-9;
const MIN_INTERVAL = 1e-10;

/** Au-delà, la projection locale et la lecture de zone ne sont plus sûres. */
const MAX_SAFE_ABS_LAT = 85;
const MAX_SAFE_ANTIMERIDIAN_SPAN_DEG = 180;
const MAX_SAFE_ZONE_RADIUS_M = 100_000;

/** Marge volontairement perdue autour d'une zone privée (mètres). */
const ZONE_SAFETY_MARGIN_M = 50;
/** Tolérance de quantification : le point reste à ≥ 48,5 m de la zone. */
const QUANTIZATION_TOLERANCE_M = 1.5;
/** 5 décimales ≈ 1,1 m : assez fin, sans exposer une frontière au mètre. */
const COORDINATE_DECIMALS = 5;
/** Un morceau plus court que cette longueur n'est pas publiable. */
const MIN_PUBLISHABLE_SEGMENT_M = 2;

type Interval = [start: number, end: number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidLngLat(lng: unknown, lat: unknown): boolean {
  return (
    isFiniteNumber(lng) &&
    isFiniteNumber(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

function readPoint(value: unknown): TracePoint | null {
  if (!isRecord(value)) return null;
  const { lng, lat } = value;
  if (!isValidLngLat(lng, lat)) return null;
  return { lng: lng as number, lat: lat as number };
}

type ZoneRead =
  { zone: PrivacyZone; error: null } | { zone: null; error: 'invalid_masks' | 'unsafe_geometry' };

type MasksRead =
  { masks: TraceMask[]; error: null } | { masks: []; error: 'invalid_masks' | 'unsafe_geometry' };

function invalidZone(): ZoneRead {
  return { zone: null, error: 'invalid_masks' };
}

function unsafeZone(): ZoneRead {
  return { zone: null, error: 'unsafe_geometry' };
}

function readZone(value: unknown): ZoneRead {
  if (!isRecord(value)) return invalidZone();

  if (value.kind === 'circle') {
    const center = readPoint(value.center);
    const radiusM = value.radiusM;
    if (!center || !isFiniteNumber(radiusM) || radiusM <= 0) return invalidZone();
    if (Math.abs(center.lat) > MAX_SAFE_ABS_LAT || radiusM > MAX_SAFE_ZONE_RADIUS_M) {
      return unsafeZone();
    }
    const radiusDeg =
      (radiusM + ZONE_SAFETY_MARGIN_M) /
      (EARTH_RADIUS_M * DEG_TO_RAD * Math.max(Math.cos(center.lat * DEG_TO_RAD), 1e-6));
    if (Math.abs(center.lng) + radiusDeg > MAX_SAFE_ANTIMERIDIAN_SPAN_DEG) {
      return unsafeZone();
    }
    return { zone: { kind: 'circle', center, radiusM }, error: null };
  }

  if (value.kind === 'bbox') {
    const bounds = value.bounds;
    if (!Array.isArray(bounds) || bounds.length !== 4) return invalidZone();
    const southWest = readPoint({ lng: bounds[0], lat: bounds[1] });
    const northEast = readPoint({ lng: bounds[2], lat: bounds[3] });
    if (!southWest || !northEast) return invalidZone();
    // Une boîte ouest > est traverse l'antiméridien : hors domaine sûr.
    if (southWest.lng > northEast.lng) return unsafeZone();
    if (southWest.lng === northEast.lng || southWest.lat >= northEast.lat) {
      return invalidZone();
    }
    if (
      Math.abs(southWest.lat) > MAX_SAFE_ABS_LAT ||
      Math.abs(northEast.lat) > MAX_SAFE_ABS_LAT ||
      northEast.lng - southWest.lng > MAX_SAFE_ANTIMERIDIAN_SPAN_DEG
    ) {
      return unsafeZone();
    }
    const padding = longitudePaddingDeg(southWest.lat, northEast.lat, ZONE_SAFETY_MARGIN_M);
    if (southWest.lng - padding < -180 || northEast.lng + padding > 180) {
      return unsafeZone();
    }
    return {
      zone: {
        kind: 'bbox',
        bounds: [southWest.lng, southWest.lat, northEast.lng, northEast.lat],
      },
      error: null,
    };
  }

  return invalidZone();
}

function readMasks(value: unknown): MasksRead {
  if (value === undefined) return { masks: [], error: null };
  if (!Array.isArray(value)) return { masks: [], error: 'invalid_masks' };

  const masks: TraceMask[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return { masks: [], error: 'invalid_masks' };

    if (raw.kind === 'all') {
      masks.push({ kind: 'all' });
      continue;
    }

    if (raw.kind === 'start' || raw.kind === 'end') {
      const meters = raw.meters;
      if (!isFiniteNumber(meters) || meters < 0) {
        return { masks: [], error: 'invalid_masks' };
      }
      masks.push({ kind: raw.kind, meters });
      continue;
    }

    if (raw.kind === 'zone') {
      const parsed = readZone(raw.zone);
      if (parsed.error) return { masks: [], error: parsed.error };
      masks.push({ kind: 'zone', zone: parsed.zone });
      continue;
    }

    return { masks: [], error: 'invalid_masks' };
  }

  return { masks, error: null };
}

/**
 * Une seule coordonnée corrompue invalide toute la trace : ignorer un point
 * créerait un segment qui relie deux endroits séparés par une donnée absente.
 * Les doublons strictement consécutifs sont retirés (ils ne portent aucune
 * longueur), sans supprimer un retour sur un point déjà visité.
 */
function readPoints(value: unknown): TracePoint[] | null {
  if (!Array.isArray(value) || value.length < 2) return null;

  const points: TracePoint[] = [];
  for (const raw of value) {
    const point = readPoint(raw);
    if (!point) return null;
    const previous = points[points.length - 1];
    if (previous && previous.lng === point.lng && previous.lat === point.lat) continue;
    points.push(point);
  }

  return points.length >= 2 ? points : null;
}

/**
 * Refuse les géométries où la projection locale n'est plus fiable : pôles et
 * traversée de l'antiméridien. Un segment dont la longitude saute de 180° ou
 * plus est ambigu (le chemin court passe de l'autre côté du globe).
 */
function isSafePointGeometry(points: TracePoint[]): boolean {
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (
      Math.abs(point.lat) > MAX_SAFE_ABS_LAT ||
      Math.abs(point.lng) >= MAX_SAFE_ANTIMERIDIAN_SPAN_DEG
    ) {
      return false;
    }
    if (
      index > 0 &&
      Math.abs(point.lng - points[index - 1].lng) >= MAX_SAFE_ANTIMERIDIAN_SPAN_DEG
    ) {
      return false;
    }
  }
  return true;
}

function interpolate(a: TracePoint, b: TracePoint, t: number): TracePoint {
  if (t <= EPSILON) return { lng: a.lng, lat: a.lat };
  if (t >= 1 - EPSILON) return { lng: b.lng, lat: b.lat };
  return {
    lng: a.lng + (b.lng - a.lng) * t,
    lat: a.lat + (b.lat - a.lat) * t,
  };
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .map(([start, end]): Interval => [
      Math.max(0, Math.min(1, start)),
      Math.max(0, Math.min(1, end)),
    ])
    .filter(([start, end]) => end - start > MIN_INTERVAL)
    .sort((a, b) => a[0] - b[0]);

  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval[0] <= last[1] + EPSILON) {
      last[1] = Math.max(last[1], interval[1]);
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

function subtractIntervals(visible: Interval, removed: Interval[]): Interval[] {
  let current: Interval[] = [visible];

  for (const [removeStart, removeEnd] of mergeIntervals(removed)) {
    const next: Interval[] = [];
    for (const [visibleStart, visibleEnd] of current) {
      if (removeEnd <= visibleStart + EPSILON || removeStart >= visibleEnd - EPSILON) {
        next.push([visibleStart, visibleEnd]);
        continue;
      }
      if (removeStart > visibleStart + EPSILON) {
        next.push([visibleStart, Math.min(removeStart, visibleEnd)]);
      }
      if (removeEnd < visibleEnd - EPSILON) {
        next.push([Math.max(removeEnd, visibleStart), visibleEnd]);
      }
    }
    current = next;
  }

  return current.filter(([start, end]) => end - start > MIN_INTERVAL);
}

/** Marge en longitude pour une marge métrique, à la latitude la plus défavorable. */
function longitudePaddingDeg(southLat: number, northLat: number, meters: number): number {
  const latPad = meters / (EARTH_RADIUS_M * DEG_TO_RAD);
  const cosLat = Math.max(
    Math.cos(Math.max(Math.abs(southLat), Math.abs(northLat)) * DEG_TO_RAD),
    1e-6
  );
  return latPad / cosLat;
}

/** Boîte élargie de la marge de sécurité, bornée au monde connu. */
function expandedBbox(bounds: TraceBounds, marginM: number): TraceBounds {
  const [west, south, east, north] = bounds;
  const latPad = marginM / (EARTH_RADIUS_M * DEG_TO_RAD);
  const lngPad = longitudePaddingDeg(south, north, marginM);
  return [
    Math.max(-180, west - lngPad),
    Math.max(-90, south - latPad),
    Math.min(180, east + lngPad),
    Math.min(90, north + latPad),
  ];
}

/** Intervalle du segment [a,b] situé dans un cercle élargi, en projection locale. */
function circleInterval(
  a: TracePoint,
  b: TracePoint,
  zone: Extract<PrivacyZone, { kind: 'circle' }>,
  marginM: number
): Interval | null {
  const cosLat = Math.cos(zone.center.lat * DEG_TO_RAD);
  const toX = (lng: number) => (lng - zone.center.lng) * DEG_TO_RAD * EARTH_RADIUS_M * cosLat;
  const toY = (lat: number) => (lat - zone.center.lat) * DEG_TO_RAD * EARTH_RADIUS_M;

  const ax = toX(a.lng);
  const ay = toY(a.lat);
  const bx = toX(b.lng);
  const by = toY(b.lat);
  const dx = bx - ax;
  const dy = by - ay;
  const radiusSq = (zone.radiusM + marginM) ** 2;
  const c = ax * ax + ay * ay - radiusSq;
  const aa = dx * dx + dy * dy;

  if (aa <= EPSILON) {
    return c <= 0 ? [0, 1] : null;
  }

  const bb = 2 * (ax * dx + ay * dy);
  const discriminant = bb * bb - 4 * aa * c;
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  let first = (-bb - root) / (2 * aa);
  let second = (-bb + root) / (2 * aa);
  if (first > second) [first, second] = [second, first];

  const start = Math.max(0, first);
  const end = Math.min(1, second);
  if (end - start <= MIN_INTERVAL) return null;
  return [start, end];
}

/** Intervalle du segment [a,b] situé dans une boîte élargie. */
function bboxInterval(
  a: TracePoint,
  b: TracePoint,
  zone: Extract<PrivacyZone, { kind: 'bbox' }>,
  marginM: number
): Interval | null {
  const [west, south, east, north] = expandedBbox(zone.bounds, marginM);
  let start = 0;
  let end = 1;

  const axes = [
    { origin: a.lng, delta: b.lng - a.lng, min: west, max: east },
    { origin: a.lat, delta: b.lat - a.lat, min: south, max: north },
  ];

  for (const axis of axes) {
    if (Math.abs(axis.delta) <= EPSILON) {
      if (axis.origin < axis.min - EPSILON || axis.origin > axis.max + EPSILON) return null;
      continue;
    }

    let first = (axis.min - axis.origin) / axis.delta;
    let second = (axis.max - axis.origin) / axis.delta;
    if (first > second) [first, second] = [second, first];

    start = Math.max(start, first);
    end = Math.min(end, second);
    if (start > end + EPSILON) return null;
  }

  if (end - start <= MIN_INTERVAL) return null;
  return [start, end];
}

function zoneInterval(
  a: TracePoint,
  b: TracePoint,
  zone: PrivacyZone,
  marginM: number
): Interval | null {
  return zone.kind === 'circle'
    ? circleInterval(a, b, zone, marginM)
    : bboxInterval(a, b, zone, marginM);
}

function removedIntervals(
  startDistance: number,
  segmentLength: number,
  totalDistance: number,
  a: TracePoint,
  b: TracePoint,
  masks: TraceMask[]
): Interval[] {
  const removed: Interval[] = [];

  for (const mask of masks) {
    if (mask.kind === 'all') {
      removed.push([0, 1]);
      continue;
    }

    if (mask.kind === 'start') {
      const effectiveMeters = mask.meters > 0 ? mask.meters + ZONE_SAFETY_MARGIN_M : 0;
      if (effectiveMeters <= 0 || startDistance >= effectiveMeters - EPSILON) continue;
      if (startDistance + segmentLength <= effectiveMeters + EPSILON) {
        removed.push([0, 1]);
      } else {
        removed.push([0, (effectiveMeters - startDistance) / segmentLength]);
      }
      continue;
    }

    if (mask.kind === 'end') {
      const effectiveMeters = mask.meters > 0 ? mask.meters + ZONE_SAFETY_MARGIN_M : 0;
      if (effectiveMeters <= 0) continue;
      const boundary = totalDistance - effectiveMeters;
      if (startDistance >= boundary - EPSILON) {
        removed.push([0, 1]);
      } else if (startDistance + segmentLength <= boundary + EPSILON) {
        continue;
      } else {
        removed.push([(boundary - startDistance) / segmentLength, 1]);
      }
      continue;
    }

    const interval = zoneInterval(a, b, mask.zone, ZONE_SAFETY_MARGIN_M);
    if (interval) removed.push(interval);
  }

  return removed;
}

interface Piece {
  segmentIndex: number;
  endT: number;
  points: TracePoint[];
}

function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Réduit la précision sans jamais laisser un point sur une frontière exacte. */
function quantizePiece(points: TracePoint[]): TracePoint[] {
  const quantized: TracePoint[] = [];
  for (const point of points) {
    const next = {
      lng: roundCoordinate(point.lng),
      lat: roundCoordinate(point.lat),
    };
    const last = quantized[quantized.length - 1];
    if (last && last.lng === next.lng && last.lat === next.lat) continue;
    quantized.push(next);
  }
  return quantized;
}

function pieceLengthM(points: TracePoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineM(points[index - 1], points[index]);
  }
  return total;
}

function isOutsideZones(point: TracePoint, masks: TraceMask[]): boolean {
  for (const mask of masks) {
    if (mask.kind !== 'zone') continue;
    const zone = mask.zone;
    if (zone.kind === 'circle') {
      if (
        haversineM(point, zone.center) <
        zone.radiusM + ZONE_SAFETY_MARGIN_M - QUANTIZATION_TOLERANCE_M
      ) {
        return false;
      }
      continue;
    }
    const [west, south, east, north] = expandedBbox(
      zone.bounds,
      ZONE_SAFETY_MARGIN_M - QUANTIZATION_TOLERANCE_M
    );
    if (point.lng > west && point.lng < east && point.lat > south && point.lat < north) {
      return false;
    }
  }
  return true;
}

/**
 * Dernier contrôle avant publication : le morceau quantifié doit rester long
 * assez et rester hors de toutes les zones élargies, y compris en son milieu.
 */
function isPublishablePiece(points: TracePoint[], masks: TraceMask[]): boolean {
  if (points.length < 2 || pieceLengthM(points) < MIN_PUBLISHABLE_SEGMENT_M) return false;
  for (const point of points) {
    if (
      Math.abs(point.lat) > MAX_SAFE_ABS_LAT ||
      Math.abs(point.lng) >= MAX_SAFE_ANTIMERIDIAN_SPAN_DEG
    ) {
      return false;
    }
    if (!isOutsideZones(point, masks)) return false;
  }
  for (let index = 1; index < points.length; index += 1) {
    const midpoint = interpolate(points[index - 1], points[index], 0.5);
    if (!isOutsideZones(midpoint, masks)) return false;
  }
  return true;
}

function emptyProjection(
  inputPointCount: number,
  error: Exclude<TraceProjectionError, null>,
  masked: boolean
): TraceProjection {
  return {
    segments: [],
    masked,
    fullyMasked: false,
    error,
    inputPointCount,
    visiblePointCount: 0,
  };
}

/**
 * Projette une trace pour un partage : seuls les intervalles non masqués sont
 * rendus, sous forme d'un tableau de segments disjoints.
 *
 * `points` et `masks` sont volontairement reçus en `unknown` : ils viennent de
 * la base ou d'une requête et sont validés ici. Un masque invalide ne doit
 * jamais être ignoré (il pourrait divulguer une zone) : la projection échoue
 * alors entièrement.
 *
 * Invariants d'erreur : si `error !== null`, `segments` est vide,
 * `visiblePointCount` vaut 0 et `fullyMasked` reste faux. `fullyMasked` n'est
 * vrai que pour une entrée valide, masquée, sans aucun morceau publiable.
 */
export function projectShareableTrace(points: unknown, masks: unknown = []): TraceProjection {
  const inputPointCount = Array.isArray(points) ? points.length : 0;
  const parsedPoints = readPoints(points);
  if (!parsedPoints) {
    return emptyProjection(inputPointCount, 'invalid_points', false);
  }
  if (!isSafePointGeometry(parsedPoints)) {
    return emptyProjection(inputPointCount, 'unsafe_geometry', false);
  }

  const parsedMasks = readMasks(masks);
  if (parsedMasks.error) {
    return emptyProjection(inputPointCount, parsedMasks.error, true);
  }

  const cumulative = cumulativeDistancesM(parsedPoints);
  const totalDistance = cumulative[cumulative.length - 1] ?? 0;
  if (!Number.isFinite(totalDistance) || totalDistance <= EPSILON) {
    return emptyProjection(inputPointCount, 'unsafe_geometry', false);
  }

  const pieces: Piece[] = [];

  for (let index = 0; index < parsedPoints.length - 1; index += 1) {
    const a = parsedPoints[index];
    const b = parsedPoints[index + 1];
    const startDistance = cumulative[index];
    const segmentLength = cumulative[index + 1] - startDistance;
    if (segmentLength <= EPSILON) continue;

    const visibleIntervals = subtractIntervals(
      [0, 1],
      removedIntervals(startDistance, segmentLength, totalDistance, a, b, parsedMasks.masks)
    );

    for (const [startT, endT] of visibleIntervals) {
      const startPoint = interpolate(a, b, startT);
      const endPoint = interpolate(a, b, endT);
      const previous = pieces[pieces.length - 1];

      const canMerge =
        previous &&
        previous.segmentIndex === index - 1 &&
        previous.endT >= 1 - EPSILON &&
        startT <= EPSILON;

      if (canMerge) {
        previous.points.push(endPoint);
        previous.endT = endT;
        previous.segmentIndex = index;
      } else {
        pieces.push({
          segmentIndex: index,
          endT,
          points: [startPoint, endPoint],
        });
      }
    }
  }

  // La quantification se fait pièce par pièce : deux pièces séparées ne sont
  // jamais fusionnées, même si leurs extrémités arrondies coïncident.
  const masked = parsedMasks.masks.length > 0;
  const segments = pieces
    .map((piece) => quantizePiece(piece.points))
    .filter((piece) => isPublishablePiece(piece, parsedMasks.masks));

  if (segments.length === 0 && !masked) {
    return emptyProjection(inputPointCount, 'unpublishable_geometry', false);
  }

  const visiblePointCount = segments.reduce((sum, segment) => sum + segment.length, 0);
  return {
    segments,
    masked,
    fullyMasked: masked && segments.length === 0,
    error: null,
    inputPointCount,
    visiblePointCount,
  };
}

/** Alias court, pour les appels internes au domaine. */
export const projectTrace = projectShareableTrace;
