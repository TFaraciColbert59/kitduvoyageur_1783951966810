import type { MapBounds, TrackPoint } from './types';

export function isValidPoint(lng: unknown, lat: unknown): boolean {
  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

function pointFromCoordinate(value: unknown): TrackPoint | null {
  if (Array.isArray(value) && value.length >= 2) {
    const [lng, lat] = value;
    return isValidPoint(lng, lat) ? { lng, lat } : null;
  }
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return isValidPoint(row.lng, row.lat)
      ? { lng: row.lng as number, lat: row.lat as number }
      : null;
  }
  return null;
}

export function parsePositions(value: unknown): TrackPoint[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map(pointFromCoordinate)
      .filter((point): point is TrackPoint => point !== null);
  }
  if (typeof value !== 'object') return [];
  const row = value as Record<string, unknown>;
  if (row.type === 'Feature' && row.geometry && typeof row.geometry === 'object') {
    return parsePositions(row.geometry);
  }
  if (row.type === 'LineString' && Array.isArray(row.coordinates)) {
    return row.coordinates
      .map(pointFromCoordinate)
      .filter((point): point is TrackPoint => point !== null);
  }
  return [];
}

function dedupe(points: TrackPoint[]): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (!last || last.lng !== point.lng || last.lat !== point.lat) out.push(point);
  }
  return out;
}

function segmentDistanceSq(p: TrackPoint, a: TrackPoint, b: TrackPoint): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) {
    return (p.lng - a.lng) ** 2 + (p.lat - a.lat) ** 2;
  }
  const t = Math.max(
    0,
    Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy))
  );
  const x = a.lng + t * dx;
  const y = a.lat + t * dy;
  return (p.lng - x) ** 2 + (p.lat - y) ** 2;
}

function douglasPeucker(points: TrackPoint[], toleranceSq: number): TrackPoint[] {
  if (points.length <= 2) return points;
  let index = 0;
  let maxDistance = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = segmentDistanceSq(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance <= toleranceSq) return [points[0], points[points.length - 1]];
  const left = douglasPeucker(points.slice(0, index + 1), toleranceSq);
  const right = douglasPeucker(points.slice(index), toleranceSq);
  return [...left, ...right.slice(1)];
}

function uniform(points: TrackPoint[], maxPoints: number): TrackPoint[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]);
}

export function simplifyTrack(points: TrackPoint[], maxPoints = 120): TrackPoint[] {
  const clean = dedupe(points.filter((point) => isValidPoint(point.lng, point.lat)));
  if (clean.length <= maxPoints) return clean;
  const bounds = boundsOf(clean);
  const diagonal = bounds
    ? Math.hypot(bounds[2] - bounds[0], bounds[3] - bounds[1])
    : 0.01;
  let tolerance = Math.max(diagonal / 2000, 1e-7);
  let simplified = douglasPeucker(clean, tolerance ** 2);
  while (simplified.length > maxPoints && tolerance < 1) {
    tolerance *= 2;
    simplified = douglasPeucker(clean, tolerance ** 2);
  }
  return simplified.length <= maxPoints ? simplified : uniform(simplified, maxPoints);
}

export function boundsOf(points: TrackPoint[]): MapBounds | null {
  if (points.length === 0) return null;
  let west = points[0].lng;
  let south = points[0].lat;
  let east = points[0].lng;
  let north = points[0].lat;
  for (const point of points) {
    if (point.lng < west) west = point.lng;
    if (point.lng > east) east = point.lng;
    if (point.lat < south) south = point.lat;
    if (point.lat > north) north = point.lat;
  }
  return [west, south, east, north];
}

export function mergeBounds(bounds: Array<MapBounds | null>): MapBounds | null {
  const valid = bounds.filter((entry): entry is MapBounds => Array.isArray(entry));
  if (valid.length === 0) return null;
  return valid.reduce<MapBounds>(
    (acc, entry) => [
      Math.min(acc[0], entry[0]),
      Math.min(acc[1], entry[1]),
      Math.max(acc[2], entry[2]),
      Math.max(acc[3], entry[3]),
    ],
    [...valid[0]]
  );
}
