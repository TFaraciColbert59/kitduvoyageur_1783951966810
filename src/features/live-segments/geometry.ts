import type { GeoPoint, GhostProfile, SegmentPoint } from './types';

const EARTH_RADIUS_M = 6_371_000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function haversineDistanceM(
  a: Pick<GeoPoint, 'lat' | 'lon'>,
  b: Pick<GeoPoint, 'lat' | 'lon'>,
): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function computeBearingDeg(
  a: Pick<GeoPoint, 'lat' | 'lon'>,
  b: Pick<GeoPoint, 'lat' | 'lon'>,
): number {
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const deg = Math.atan2(y, x) * RAD_TO_DEG;
  return (deg + 360) % 360;
}

export function angleDiffDeg(a: number, b: number): number {
  const diff = Math.abs(((a - b) % 360 + 540) % 360 - 180);
  return diff;
}

export interface TraceProjection {
  distanceToTraceM: number;
  distanceAlongM: number;
  segmentIndex: number;
  localBearingDeg: number;
}

/**
 * Projects a GPS point onto a polyline trace using a local equirectangular tangent plane.
 * Deterministic and fast for real-time segment tracking.
 */
export function projectPointOntoTrace(
  point: Pick<GeoPoint, 'lat' | 'lon'>,
  trace: readonly SegmentPoint[],
): TraceProjection {
  if (trace.length === 0) {
    return {
      distanceToTraceM: Infinity,
      distanceAlongM: 0,
      segmentIndex: 0,
      localBearingDeg: 0,
    };
  }
  if (trace.length === 1) {
    return {
      distanceToTraceM: haversineDistanceM(point, trace[0]),
      distanceAlongM: trace[0].cumulativeDistanceM,
      segmentIndex: 0,
      localBearingDeg: 0,
    };
  }

  const refLatRad = point.lat * DEG_TO_RAD;
  const cosRef = Math.cos(refLatRad);
  const toXY = (p: Pick<GeoPoint, 'lat' | 'lon'>) => ({
    x: (p.lon - point.lon) * DEG_TO_RAD * EARTH_RADIUS_M * cosRef,
    y: (p.lat - point.lat) * DEG_TO_RAD * EARTH_RADIUS_M,
  });

  let bestDistSq = Infinity;
  let bestDistanceAlongM = 0;
  let bestIndex = 0;
  let bestBearing = 0;

  for (let i = 0; i < trace.length - 1; i++) {
    const p1 = trace[i];
    const p2 = trace[i + 1];
    const a = toXY(p1);
    const b = toXY(p2);

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, (-a.x * dx - a.y * dy) / lenSq));
    }

    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    const distSq = projX * projX + projY * projY;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i;
      const segLenM = p2.cumulativeDistanceM - p1.cumulativeDistanceM;
      bestDistanceAlongM = p1.cumulativeDistanceM + t * segLenM;
      bestBearing = computeBearingDeg(p1, p2);
    }
  }

  return {
    distanceToTraceM: Math.sqrt(bestDistSq),
    distanceAlongM: bestDistanceAlongM,
    segmentIndex: bestIndex,
    localBearingDeg: bestBearing,
  };
}

/**
 * Reverses a segment trace's points and cumulative distances for `reverse` direction matching.
 */
export function buildDirectedTrace(
  points: readonly SegmentPoint[],
  direction: 'forward' | 'reverse',
): SegmentPoint[] {
  if (direction === 'forward' || points.length === 0) {
    return [...points];
  }
  const total = points[points.length - 1].cumulativeDistanceM;
  const reversed: SegmentPoint[] = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    reversed.push({
      lat: p.lat,
      lon: p.lon,
      ele: p.ele,
      cumulativeDistanceM: Math.max(0, total - p.cumulativeDistanceM),
    });
  }
  return reversed;
}

/**
 * Deterministic linear interpolation of ghost elapsed time (ms) at a given distance along segment.
 */
export function interpolateGhostElapsedMs(
  ghost: GhostProfile,
  distanceM: number,
): number {
  const cps = ghost.checkpoints;
  if (cps.length === 0) {
    return 0;
  }
  if (distanceM <= cps[0].distanceM) {
    return cps[0].elapsedMs;
  }
  const last = cps[cps.length - 1];
  if (distanceM >= last.distanceM) {
    return last.elapsedMs;
  }

  for (let i = 0; i < cps.length - 1; i++) {
    const c1 = cps[i];
    const c2 = cps[i + 1];
    if (distanceM >= c1.distanceM && distanceM <= c2.distanceM) {
      const spanM = c2.distanceM - c1.distanceM;
      if (spanM <= 0) {
        return c1.elapsedMs;
      }
      const ratio = (distanceM - c1.distanceM) / spanM;
      return Math.round(c1.elapsedMs + ratio * (c2.elapsedMs - c1.elapsedMs));
    }
  }

  return last.elapsedMs;
}

/**
 * Deterministic linear interpolation of ghost distance (meters) at a given elapsed time.
 */
export function interpolateGhostDistanceAtTime(
  ghost: GhostProfile,
  elapsedMs: number,
): number {
  const cps = ghost.checkpoints;
  if (cps.length === 0) {
    return 0;
  }
  if (elapsedMs <= cps[0].elapsedMs) {
    return cps[0].distanceM;
  }
  const last = cps[cps.length - 1];
  if (elapsedMs >= last.elapsedMs) {
    return last.distanceM;
  }

  for (let i = 0; i < cps.length - 1; i++) {
    const c1 = cps[i];
    const c2 = cps[i + 1];
    if (elapsedMs >= c1.elapsedMs && elapsedMs <= c2.elapsedMs) {
      const spanMs = c2.elapsedMs - c1.elapsedMs;
      if (spanMs <= 0) {
        return c1.distanceM;
      }
      const ratio = (elapsedMs - c1.elapsedMs) / spanMs;
      return c1.distanceM + ratio * (c2.distanceM - c1.distanceM);
    }
  }

  return last.distanceM;
}

export interface LiveDeltaResult {
  /** Negative = ahead of ghost, Positive = behind ghost. */
  deltaMs: number;
  /** Positive = ahead of ghost in meters, Negative = behind. */
  deltaDistanceM: number;
  projectedFinishMs: number;
}

/**
 * Computes deterministic time delta, distance delta, and projected finish time vs ghost.
 */
export function computeLiveDelta(
  athleteElapsedMs: number,
  distanceCoveredM: number,
  ghost: GhostProfile,
  totalDistanceM: number,
): LiveDeltaResult {
  const ghostElapsedAtDist = interpolateGhostElapsedMs(ghost, distanceCoveredM);
  const deltaMs = Math.round(athleteElapsedMs - ghostElapsedAtDist);

  const ghostDistAtTime = interpolateGhostDistanceAtTime(ghost, athleteElapsedMs);
  const deltaDistanceM = Number((distanceCoveredM - ghostDistAtTime).toFixed(2));

  let projectedFinishMs = ghost.totalTimeMs + deltaMs;
  if (distanceCoveredM > 0 && athleteElapsedMs > 0 && totalDistanceM > 0) {
    const paceRatio = athleteElapsedMs / Math.max(1, ghostElapsedAtDist);
    if (Number.isFinite(paceRatio) && paceRatio > 0 && ghostElapsedAtDist > 0) {
      projectedFinishMs = Math.round(ghost.totalTimeMs * paceRatio);
    }
  }

  return {
    deltaMs,
    deltaDistanceM,
    projectedFinishMs: Math.max(0, projectedFinishMs),
  };
}
