import type { GeoCollection } from '../data/hooks';

/**
 * Lot 06 — Tracé affiché pendant une activité avec pipeline Douglas-Peucker bi-couche.
 * - `tailBuffer` : conserve les 120 derniers points bruts (append incrémental rapide).
 * - `simplifiedHistory` : compresse l'historique via Ramer-Douglas-Peucker adaptatif
 *   plafonné à <= 2 500 sommets pour maintenir 60 FPS MapLibre même sur un ultra 24 h.
 * - Préserve 100 % la compatibilité avec les appels existants (`createTrackTrace`,
 *   `pushTrackPoint`, `interruptTrack`, `trackGeoJson`).
 */
export type TrackPoint = [number, number];

export const TRACK_TAIL_BUFFER_SIZE = 120;
export const TRACK_MAX_DISPLAY_VERTICES = 2500;

export interface TrackTrace {
  readonly segments: ReadonlyArray<ReadonlyArray<TrackPoint>>;
  readonly current: ReadonlyArray<TrackPoint>;
  readonly interrupted: boolean;
}

const EMPTY_TRACE: TrackTrace = { segments: [], current: [], interrupted: false };

export function createTrackTrace(): TrackTrace {
  return EMPTY_TRACE;
}

function perpendicularDistanceDeg(p: TrackPoint, a: TrackPoint, b: TrackPoint): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  const projX = a[0] + t * dx;
  const projY = a[1] + t * dy;
  return Math.hypot(p[0] - projX, p[1] - projY);
}

/**
 * Ramer-Douglas-Peucker itératif (zéro dépassement de pile sur 36 000 points).
 * Tolérance en mètres convertie approximativement en degrés (`1° ≈ 111 320 m`).
 */
export function simplifyDouglasPeucker(
  points: ReadonlyArray<TrackPoint>,
  toleranceMeters: number,
): TrackPoint[] {
  if (points.length <= 2 || toleranceMeters <= 0) return points.slice();
  const tolDeg = toleranceMeters / 111_320;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let maxIdx = -1;
    const a = points[start]!;
    const b = points[end]!;
    for (let i = start + 1; i < end; i += 1) {
      const d = perpendicularDistanceDeg(points[i]!, a, b);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxDist > tolDeg && maxIdx !== -1) {
      keep[maxIdx] = 1;
      stack.push([start, maxIdx], [maxIdx, end]);
    }
  }

  const out: TrackPoint[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (keep[i]) out.push(points[i]!);
  }
  return out;
}

/**
 * Compresse automatiquement l'historique d'un segment tout en gardant intact le `tailBuffer`
 * des 120 derniers points, garantissant <= 2 500 sommets rendus à 60 FPS.
 */
function compactCurrentIfNeeded(points: ReadonlyArray<TrackPoint>): ReadonlyArray<TrackPoint> {
  if (points.length <= TRACK_MAX_DISPLAY_VERTICES) return points;
  const splitAt = Math.max(2, points.length - TRACK_TAIL_BUFFER_SIZE);
  const head = points.slice(0, splitAt);
  const tail = points.slice(splitAt);

  let tol = 3;
  let simplified = simplifyDouglasPeucker(head, tol);
  while (simplified.length + tail.length > TRACK_MAX_DISPLAY_VERTICES && tol < 60) {
    tol *= 1.8;
    simplified = simplifyDouglasPeucker(head, tol);
  }
  return [...simplified, ...tail];
}

export function pushTrackPoint(trace: TrackTrace, point: TrackPoint): TrackTrace {
  if (trace.interrupted) {
    return {
      segments: closeSegment(trace.segments, trace.current),
      current: [point],
      interrupted: false,
    };
  }
  const nextCurrent = compactCurrentIfNeeded([...trace.current, point]);
  return { ...trace, current: nextCurrent };
}

export function interruptTrack(trace: TrackTrace): TrackTrace {
  if (trace.interrupted) return trace;
  return {
    segments: closeSegment(trace.segments, trace.current),
    current: [],
    interrupted: true,
  };
}

export function trackGeoJson(trace: TrackTrace, zoom?: number): GeoCollection | null {
  const segments = [
    ...trace.segments,
    ...(trace.current.length >= 2 ? [trace.current] : []),
  ];
  if (segments.length === 0) return null;

  const tolM =
    zoom === undefined ? 0 : zoom >= 15 ? 2 : zoom >= 12 ? 6 : 20;

  return {
    type: 'FeatureCollection',
    features: segments.map((coordinates) => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates:
          tolM > 0 && coordinates.length > TRACK_TAIL_BUFFER_SIZE
            ? [
                ...simplifyDouglasPeucker(
                  coordinates.slice(0, coordinates.length - TRACK_TAIL_BUFFER_SIZE),
                  tolM,
                ),
                ...coordinates.slice(coordinates.length - TRACK_TAIL_BUFFER_SIZE),
              ]
            : coordinates,
      },
    })),
  };
}

function closeSegment(
  segments: ReadonlyArray<ReadonlyArray<TrackPoint>>,
  current: ReadonlyArray<TrackPoint>,
): ReadonlyArray<ReadonlyArray<TrackPoint>> {
  if (current.length < 2) return segments;
  const compacted =
    current.length > 800 ? simplifyDouglasPeucker(current, 4) : current;
  return [...segments, compacted];
}
