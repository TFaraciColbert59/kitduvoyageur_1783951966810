import type { GeoPoint } from '../types';

const EARTH_RADIUS_M = 6_371_000;
const DEG = Math.PI / 180;

export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const lat1 = a.lat * DEG;
  const lat2 = b.lat * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(from: GeoPoint, to: GeoPoint): number {
  const lat1 = from.lat * DEG;
  const lat2 = to.lat * DEG;
  const dLng = (to.lng - from.lng) * DEG;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

export function pointInBbox(point: GeoPoint, bbox: [number, number, number, number]): boolean {
  const [west, south, east, north] = bbox;
  const inLng =
    west <= east ? point.lng >= west && point.lng <= east : point.lng >= west || point.lng <= east;
  return inLng && point.lat >= south && point.lat <= north;
}

export function bboxCenter(bbox: [number, number, number, number]): GeoPoint {
  return { lat: (bbox[1] + bbox[3]) / 2, lng: (bbox[0] + bbox[2]) / 2 };
}

export interface PolylineProjection {
  distanceM: number;
  alongM: number;
  point: GeoPoint;
  segmentIndex: number;
  t: number;
}

/**
 * Projette un point sur une polyligne. Calcul en mètres locaux
 * (équirectangulaire) : suffisant à l'échelle d'un itinéraire, sans PostGIS.
 */
export function projectOnPolyline(
  target: GeoPoint,
  points: readonly GeoPoint[]
): PolylineProjection | null {
  if (points.length === 0) return null;
  if (points.length === 1) {
    return {
      distanceM: haversineM(target, points[0]),
      alongM: 0,
      point: points[0],
      segmentIndex: 0,
      t: 0,
    };
  }

  const lat0 = target.lat * DEG;
  const mPerDegLat = 111_132;
  const mPerDegLng = 111_320 * Math.cos(lat0);
  const toXY = (point: GeoPoint) => ({
    x: (point.lng - target.lng) * mPerDegLng,
    y: (point.lat - target.lat) * mPerDegLat,
  });

  let along = 0;
  let best: PolylineProjection | null = null;

  for (let index = 0; index < points.length - 1; index += 1) {
    const a = toXY(points[index]);
    const b = toXY(points[index + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const segmentM = haversineM(points[index], points[index + 1]);
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSq));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const distance = Math.hypot(px, py);
    if (!best || distance < best.distanceM) {
      best = {
        distanceM: distance,
        alongM: along + t * segmentM,
        point: {
          lat: target.lat + py / mPerDegLat,
          lng: target.lng + px / mPerDegLng,
        },
        segmentIndex: index,
        t,
      };
    }
    along += segmentM;
  }

  return best;
}

export function polylineLengthM(points: readonly GeoPoint[]): number {
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1)
    total += haversineM(points[index], points[index + 1]);
  return total;
}

export function directionFromHeading(
  headingDeg: number,
  deltaDeg: number
): 'front' | 'left' | 'right' | 'back' {
  const delta = ((deltaDeg - headingDeg + 540) % 360) - 180;
  const absolute = Math.abs(delta);
  if (absolute <= 45) return 'front';
  if (absolute >= 135) return 'back';
  return delta > 0 ? 'right' : 'left';
}
