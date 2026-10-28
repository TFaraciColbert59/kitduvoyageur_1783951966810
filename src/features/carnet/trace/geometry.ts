/**
 * Géométrie pure des tracés de carnet (aucun accès réseau, aucun DOM).
 *
 * Convention unique : un point est `[lon, lat]` (GeoJSON). Le tracé dessiné au
 * doigt compte des centaines de points ; le routeur n'en accepte que
 * `MAX_ROUTE_POINTS` (12) : on le simplifie (Douglas-Peucker) puis on le
 * réduit en gardant toujours le départ et l'arrivée.
 */

export type LonLat = readonly [number, number];

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineM(a: LonLat, b: LonLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLengthKm(points: readonly LonLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineM(points[i - 1] as LonLat, points[i] as LonLat);
  return total / 1000;
}

/** Projection locale en mètres autour d'une latitude de référence (assez exact à l'échelle d'un jour de marche). */
function toLocalMeters(point: LonLat, refLat: number): [number, number] {
  const kx = Math.cos(toRad(refLat)) * (Math.PI / 180) * EARTH_RADIUS_M;
  const ky = (Math.PI / 180) * EARTH_RADIUS_M;
  return [point[0] * kx, point[1] * ky];
}

function distanceToSegmentM(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas-Peucker itératif : garde les extrémités, supprime les points à moins de `toleranceM` de la corde. */
export function simplifyPath(points: readonly LonLat[], toleranceM: number): LonLat[] {
  if (points.length <= 2) return [...points];
  const refLat = (points[0] as LonLat)[1];
  const projected = points.map((point) => toLocalMeters(point, refLat));
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    let farthest = -1;
    let farthestDistance = 0;
    for (let i = start + 1; i < end; i++) {
      const distance = distanceToSegmentM(projected[i] as [number, number], projected[start] as [number, number], projected[end] as [number, number]);
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthest = i;
      }
    }
    if (farthest !== -1 && farthestDistance > toleranceM) {
      keep[farthest] = true;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

/**
 * Réduit un tracé à au plus `max` points d'appui en augmentant la tolérance
 * jusqu'à y tenir. Garantit : premier et dernier points conservés, ordre inchangé.
 */
export function capWaypoints(points: readonly LonLat[], max: number, startToleranceM = 15): LonLat[] {
  if (max < 2) throw new RangeError('capWaypoints : max doit valoir au moins 2');
  let tolerance = startToleranceM;
  let result = simplifyPath(points, tolerance);
  let guard = 0;
  while (result.length > max && guard < 40) {
    tolerance *= 1.6;
    result = simplifyPath(points, tolerance);
    guard += 1;
  }
  if (result.length <= max) return result;
  // Dernier recours (tracé pathologique) : échantillonnage régulier, extrémités gardées.
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)] as LonLat);
}

/** Retire les points consécutifs confondus (doigt immobile). */
export function dedupeConsecutive(points: readonly LonLat[], minM = 1): LonLat[] {
  const out: LonLat[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (!last || haversineM(last, point) >= minM) out.push(point);
  }
  return out;
}

/** Remplace le premier et/ou le dernier appui (adresse saisie pour « refixer » le tracé). */
export function replaceEndpoints(
  waypoints: readonly LonLat[],
  { start, end }: { start?: LonLat | null; end?: LonLat | null },
): LonLat[] {
  if (waypoints.length === 0) return [...(start ? [start] : []), ...(end ? [end] : [])];
  const copy = [...waypoints];
  if (start) copy[0] = start;
  if (end) copy[copy.length - 1] = end;
  return copy;
}
