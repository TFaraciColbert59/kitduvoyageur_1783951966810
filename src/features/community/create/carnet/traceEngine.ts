/**
 * Moteur pur du tracé de carnet : géométrie, simplification, nettoyage des
 * allers-retours laissés par le routage, lissage, distance et dénivelé.
 * Aucune dépendance au DOM ni à la carte : tout est testé à part.
 */

export type LngLat = [number, number];

const EARTH_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distance orthodromique entre deux points, en kilomètres. */
export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Longueur d'une ligne, en kilomètres. */
export function lengthKm(points: readonly LngLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += haversineKm(points[i - 1], points[i]);
  return total;
}

/** Vrai si deux points sont à moins de `meters` l'un de l'autre. */
export function near(a: LngLat, b: LngLat, meters: number): boolean {
  return haversineKm(a, b) * 1000 <= meters;
}

/** Coordonnées valides et bornées ; tout le reste est écarté. */
export function isValidPoint(point: unknown): point is LngLat {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    point[0] >= -180 &&
    point[0] <= 180 &&
    point[1] >= -90 &&
    point[1] <= 90
  );
}

/** Met bout à bout deux lignes sans dupliquer le point de jonction. */
export function joinLines(a: readonly LngLat[], b: readonly LngLat[], joinMeters = 1): LngLat[] {
  if (a.length === 0) return [...b];
  if (b.length === 0) return [...a];
  const last = a[a.length - 1];
  return near(last, b[0], joinMeters) ? [...a, ...b.slice(1)] : [...a, ...b];
}

/** Concatène des segments successifs en une seule ligne, bornée à `max` points. */
export function joinSegments(segments: ReadonlyArray<readonly LngLat[]>, max = 2000): LngLat[] {
  let out: LngLat[] = [];
  for (const segment of segments) out = joinLines(out, segment.filter(isValidPoint));
  return out.slice(0, max);
}

function sqSegDist(p: LngLat, a: LngLat, b: LngLat): number {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Douglas-Peucker (tolérance dans l'unité des coordonnées), extrémités conservées. */
export function simplify(points: readonly LngLat[], tolerance: number): LngLat[] {
  if (points.length <= 2) return [...points];
  const sq = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let maxSq = sq;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const dist = sqSegDist(points[i], points[first], points[last]);
      if (dist > maxSq) {
        maxSq = dist;
        index = i;
      }
    }
    if (index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/**
 * Points de passage d'un morceau de tracé pour le routeur : la forme du geste
 * avec le moins de points possible (au plus `max`, extrémités comprises).
 * `tolerance` part de la précision du doigt et grandit tant qu'il y a trop de points.
 */
export function pickWaypoints(points: readonly LngLat[], max: number, tolerance: number): LngLat[] {
  const clean = points.filter(isValidPoint);
  if (clean.length <= 2) return clean;
  let tol = Math.max(tolerance, 1e-9);
  let picked = simplify(clean, tol);
  for (let guard = 0; picked.length > max && guard < 24; guard += 1) {
    tol *= 1.6;
    picked = simplify(clean, tol);
  }
  if (picked.length <= max) return picked;
  // Dernier recours : échantillonnage régulier, extrémités gardées.
  const step = (picked.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => picked[Math.round(i * step)]);
}

/**
 * Retire les allers-retours (« épines ») que laisse un routeur quand un point
 * de passage tombe à côté du chemin : A → B → A devient A.
 */
export function removeSpurs(points: readonly LngLat[], meters = 18): LngLat[] {
  const out: LngLat[] = [];
  for (const point of points) {
    if (!isValidPoint(point)) continue;
    if (out.length > 0 && near(out[out.length - 1], point, 2)) continue;
    // Tant que le nouveau point revient sur l'avant-dernier, le dernier était une pointe.
    while (out.length >= 2 && near(out[out.length - 2], point, meters)) out.pop();
    if (out.length > 0 && near(out[out.length - 1], point, 2)) continue;
    out.push(point);
  }
  return out;
}

/** Lissage de Chaikin (tracé libre, sans chemin) ; extrémités conservées. */
export function smooth(points: readonly LngLat[], iterations = 2): LngLat[] {
  let current = points.filter(isValidPoint);
  for (let n = 0; n < iterations && current.length > 2; n += 1) {
    const next: LngLat[] = [current[0]];
    for (let i = 0; i < current.length - 1; i += 1) {
      const [ax, ay] = current[i];
      const [bx, by] = current[i + 1];
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

/** `count` points répartis à distance égale le long de la ligne (extrémités comprises). */
export function sampleAlong(points: readonly LngLat[], count: number): LngLat[] {
  const clean = points.filter(isValidPoint);
  if (clean.length < 2 || count < 2) return clean.slice(0, Math.max(0, count));
  const total = lengthKm(clean);
  if (total === 0) return [clean[0], clean[clean.length - 1]];
  const out: LngLat[] = [clean[0]];
  const step = total / (count - 1);
  let target = step;
  let walked = 0;
  for (let i = 1; i < clean.length && out.length < count - 1; i += 1) {
    const a = clean[i - 1];
    const b = clean[i];
    const seg = haversineKm(a, b);
    while (seg > 0 && walked + seg >= target && out.length < count - 1) {
      const t = (target - walked) / seg;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      target += step;
    }
    walked += seg;
  }
  out.push(clean[clean.length - 1]);
  return out;
}

/**
 * Dénivelés positif et négatif avec hystérésis : une variation n'est comptée
 * qu'au-delà de `threshold` mètres, pour ne pas additionner le bruit du relief.
 */
export function elevationGain(elevations: ReadonlyArray<number | null>, threshold = 5): { gain: number; loss: number } {
  const values = elevations.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  let gain = 0;
  let loss = 0;
  if (values.length < 2) return { gain, loss };
  let ref = values[0];
  for (let i = 1; i < values.length; i += 1) {
    const delta = values[i] - ref;
    if (delta >= threshold) {
      gain += delta;
      ref = values[i];
    } else if (delta <= -threshold) {
      loss -= delta;
      ref = values[i];
    }
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
}

/** « 850 m », « 12,4 km », « 128 km ». */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return '0 km';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}
