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
 * En cas d'entrée douteuse, le projecteur échoue fermé : il ne rend aucune
 * géométrie plutôt que de risquer de divulguer une portion masquée.
 */

// Réutilise la distance orthodromique déjà testée du domaine Adventure
// Intelligence. Les helpers de `compte/map/geometry` parsent, simplifient et
// bornent une trace, mais ne découpent pas de segments : les réutiliser ici
// n'apporterait pas la primitive manquante.
import { EARTH_RADIUS_M, cumulativeDistancesM } from '../../adventure-intelligence/domain/geo';

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

export type TraceProjectionError = 'invalid_points' | 'invalid_masks' | null;

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

function readZone(value: unknown): PrivacyZone | null {
  if (!isRecord(value)) return null;

  if (value.kind === 'circle') {
    const center = readPoint(value.center);
    const radiusM = value.radiusM;
    if (!center || !isFiniteNumber(radiusM) || radiusM <= 0) return null;
    return { kind: 'circle', center, radiusM };
  }

  if (value.kind === 'bbox') {
    const bounds = value.bounds;
    if (!Array.isArray(bounds) || bounds.length !== 4) return null;
    const southWest = readPoint({ lng: bounds[0], lat: bounds[1] });
    const northEast = readPoint({ lng: bounds[2], lat: bounds[3] });
    if (!southWest || !northEast) return null;
    if (southWest.lng >= northEast.lng || southWest.lat >= northEast.lat) return null;
    return {
      kind: 'bbox',
      bounds: [southWest.lng, southWest.lat, northEast.lng, northEast.lat],
    };
  }

  return null;
}

function readMasks(value: unknown): TraceMask[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const masks: TraceMask[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return null;

    if (raw.kind === 'all') {
      masks.push({ kind: 'all' });
      continue;
    }

    if (raw.kind === 'start' || raw.kind === 'end') {
      const meters = raw.meters;
      if (!isFiniteNumber(meters) || meters < 0) return null;
      masks.push({ kind: raw.kind, meters });
      continue;
    }

    if (raw.kind === 'zone') {
      const zone = readZone(raw.zone);
      if (!zone) return null;
      masks.push({ kind: 'zone', zone });
      continue;
    }

    return null;
  }

  return masks;
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

/** Intervalle du segment [a,b] situé dans un cercle, en projection locale. */
function circleInterval(
  a: TracePoint,
  b: TracePoint,
  zone: Extract<PrivacyZone, { kind: 'circle' }>
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
  const radiusSq = zone.radiusM ** 2;
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

/** Intervalle du segment [a,b] situé dans une boîte alignée sur les axes. */
function bboxInterval(
  a: TracePoint,
  b: TracePoint,
  zone: Extract<PrivacyZone, { kind: 'bbox' }>
): Interval | null {
  const [west, south, east, north] = zone.bounds;
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

function zoneInterval(a: TracePoint, b: TracePoint, zone: PrivacyZone): Interval | null {
  return zone.kind === 'circle' ? circleInterval(a, b, zone) : bboxInterval(a, b, zone);
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
      if (mask.meters <= 0 || startDistance >= mask.meters - EPSILON) continue;
      if (startDistance + segmentLength <= mask.meters + EPSILON) {
        removed.push([0, 1]);
      } else {
        removed.push([0, (mask.meters - startDistance) / segmentLength]);
      }
      continue;
    }

    if (mask.kind === 'end') {
      if (mask.meters <= 0) continue;
      const boundary = totalDistance - mask.meters;
      if (startDistance >= boundary - EPSILON) {
        removed.push([0, 1]);
      } else if (startDistance + segmentLength <= boundary + EPSILON) {
        continue;
      } else {
        removed.push([(boundary - startDistance) / segmentLength, 1]);
      }
      continue;
    }

    const interval = zoneInterval(a, b, mask.zone);
    if (interval) removed.push(interval);
  }

  return removed;
}

interface Piece {
  segmentIndex: number;
  startT: number;
  endT: number;
  points: TracePoint[];
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
 */
export function projectShareableTrace(points: unknown, masks: unknown = []): TraceProjection {
  const inputPointCount = Array.isArray(points) ? points.length : 0;
  const parsedPoints = readPoints(points);
  if (!parsedPoints) {
    return emptyProjection(inputPointCount, 'invalid_points', false);
  }

  const parsedMasks = readMasks(masks);
  if (!parsedMasks) {
    return emptyProjection(inputPointCount, 'invalid_masks', true);
  }

  const cumulative = cumulativeDistancesM(parsedPoints);
  const totalDistance = cumulative[cumulative.length - 1] ?? 0;

  const pieces: Piece[] = [];

  for (let index = 0; index < parsedPoints.length - 1; index += 1) {
    const a = parsedPoints[index];
    const b = parsedPoints[index + 1];
    const startDistance = cumulative[index];
    const segmentLength = cumulative[index + 1] - startDistance;
    if (segmentLength <= EPSILON) continue;

    const visibleIntervals = subtractIntervals(
      [0, 1],
      removedIntervals(startDistance, segmentLength, totalDistance, a, b, parsedMasks)
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
          startT,
          endT,
          points: [startPoint, endPoint],
        });
      }
    }
  }

  const segments = pieces.map((piece) => piece.points);
  const visiblePointCount = segments.reduce((sum, segment) => sum + segment.length, 0);
  const masked = parsedMasks.length > 0;

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
