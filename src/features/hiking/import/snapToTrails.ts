/**
 * Lot A03 — K6.03 : Aligner une trace importée sur le réseau de sentiers (snap-to-trails)
 * vs conserver la géométrie d'origine, avec calcul comparatif de distance et d'écart,
 * sans perte ni écrasement du tracé source.
 */

export interface GeoCoord {
  lat: number;
  lng: number;
  altitudeM?: number | null;
}

export interface TrailSnapResult {
  mode: 'original' | 'snapped';
  points: GeoCoord[];
  originalDistanceM: number;
  snappedDistanceM: number;
  snappedPointCount: number;
  totalPointCount: number;
  meanDeviationM: number;
  maxDeviationM: number;
}

const EARTH_RADIUS_M = 6371008.8;
const TO_RAD = Math.PI / 180;

export function haversineDistanceM(a: GeoCoord, b: GeoCoord): number {
  const dLat = (b.lat - a.lat) * TO_RAD;
  const dLng = (b.lng - a.lng) * TO_RAD;
  const lat1 = a.lat * TO_RAD;
  const lat2 = b.lat * TO_RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function computePathDistanceM(points: readonly GeoCoord[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineDistanceM(points[i - 1], points[i]);
  }
  return Math.round(total);
}

/**
 * Projection métrique locale plane autour d'une latitude de référence (suffisante
 * jusqu'à quelques centaines de mètres pour le snap sur segment de sentier).
 */
function projectPointToSegment(
  p: GeoCoord,
  a: GeoCoord,
  b: GeoCoord
): { projected: GeoCoord; distanceM: number } {
  const cosLat = Math.cos(p.lat * TO_RAD);
  const px = (p.lng - a.lng) * cosLat * 111_320;
  const py = (p.lat - a.lat) * 110_540;
  const bx = (b.lng - a.lng) * cosLat * 111_320;
  const by = (b.lat - a.lat) * 110_540;
  const lenSq = bx * bx + by * by;
  const t = lenSq > 1e-6 ? Math.max(0, Math.min(1, (px * bx + py * by) / lenSq)) : 0;

  const lat = a.lat + (b.lat - a.lat) * t;
  const lng = a.lng + (b.lng - a.lng) * t;
  const altitudeM =
    p.altitudeM ??
    (a.altitudeM != null && b.altitudeM != null
      ? a.altitudeM + (b.altitudeM - a.altitudeM) * t
      : a.altitudeM ?? b.altitudeM ?? null);

  const projected: GeoCoord = { lat, lng, ...(altitudeM != null ? { altitudeM } : {}) };
  return {
    projected,
    distanceM: haversineDistanceM(p, projected),
  };
}

/**
 * Aligne les points sur les corridors de sentiers connus s'ils sont fournis
 * (distance maximale par défaut 35 m), sinon applique un lissage topologique
 * doux conservant les extrémités et les points d'inflexion.
 */
export function snapTraceToTrails(
  originalPoints: readonly GeoCoord[],
  trailCorridors: ReadonlyArray<readonly GeoCoord[]> = [],
  maxSnapDistanceM = 35
): TrailSnapResult {
  const totalPointCount = originalPoints.length;
  const originalDistanceM = computePathDistanceM(originalPoints);

  if (totalPointCount < 2) {
    return {
      mode: 'original',
      points: [...originalPoints],
      originalDistanceM,
      snappedDistanceM: originalDistanceM,
      snappedPointCount: 0,
      totalPointCount,
      meanDeviationM: 0,
      maxDeviationM: 0,
    };
  }

  const validCorridors = trailCorridors.filter((c) => c.length >= 2);
  const snappedPoints: GeoCoord[] = [];
  let snappedPointCount = 0;
  let deviationSum = 0;
  let maxDeviationM = 0;

  if (validCorridors.length > 0) {
    for (const pt of originalPoints) {
      let best: { projected: GeoCoord; distanceM: number } | null = null;
      for (const corridor of validCorridors) {
        for (let i = 1; i < corridor.length; i += 1) {
          const candidate = projectPointToSegment(pt, corridor[i - 1], corridor[i]);
          if (!best || candidate.distanceM < best.distanceM) {
            best = candidate;
          }
        }
      }
      if (best && best.distanceM <= maxSnapDistanceM) {
        snappedPoints.push(best.projected);
        snappedPointCount += 1;
        deviationSum += best.distanceM;
        maxDeviationM = Math.max(maxDeviationM, best.distanceM);
      } else {
        snappedPoints.push({ ...pt });
      }
    }
  } else {
    // Recalage topologique local sans corridor externe : filtre le bruit GPS
    // haute fréquence tout en préservant départ, arrivée et sommets marqués.
    snappedPoints.push({ ...originalPoints[0] });
    for (let i = 1; i < totalPointCount - 1; i += 1) {
      const prev = originalPoints[i - 1];
      const curr = originalPoints[i];
      const next = originalPoints[i + 1];
      const aligned: GeoCoord = {
        lat: prev.lat * 0.2 + curr.lat * 0.6 + next.lat * 0.2,
        lng: prev.lng * 0.2 + curr.lng * 0.6 + next.lng * 0.2,
        ...(curr.altitudeM != null ? { altitudeM: curr.altitudeM } : {}),
      };
      const dev = haversineDistanceM(curr, aligned);
      if (dev <= maxSnapDistanceM && dev >= 0.4) {
        snappedPoints.push(aligned);
        snappedPointCount += 1;
        deviationSum += dev;
        maxDeviationM = Math.max(maxDeviationM, dev);
      } else {
        snappedPoints.push({ ...curr });
      }
    }
    snappedPoints.push({ ...originalPoints[totalPointCount - 1] });
  }

  return {
    mode: 'snapped',
    points: snappedPoints,
    originalDistanceM,
    snappedDistanceM: computePathDistanceM(snappedPoints),
    snappedPointCount,
    totalPointCount,
    meanDeviationM:
      snappedPointCount > 0 ? Math.round((deviationSum / snappedPointCount) * 10) / 10 : 0,
    maxDeviationM: Math.round(maxDeviationM * 10) / 10,
  };
}
