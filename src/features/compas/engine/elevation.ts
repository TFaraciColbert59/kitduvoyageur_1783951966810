/**
 * Profil d'altitude du tracé (maquette finale : accessoire au-dessus de la
 * barre d'onglets). Fonctions pures : échantillonnage régulier du tracé et
 * lecture des altitudes renvoyées par le modèle numérique de terrain.
 * Aucune altitude n'est interpolée ni inventée : un point sans valeur sort.
 */

export interface ElevationPoint {
  km: number;
  m: number;
}

export interface ElevationProfile {
  points: ElevationPoint[];
  maxM: number;
  minM: number;
  /** Distance (km) du point le plus haut. */
  maxAtKm: number;
  source: string;
}

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * `n` points régulièrement espacés le long du tracé ([lat, lon]), avec leur
 * distance cumulée. Moins de deux points valides : rien.
 */
export function sampleRoute(
  coords: ReadonlyArray<[number, number]>,
  n = 80
): Array<{ lat: number; lon: number; km: number }> {
  const pts = coords.filter(
    ([lat, lon]) =>
      Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
  if (pts.length < 2 || n < 2) return [];
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + haversineKm(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1];
  if (total <= 0) return [];
  const out: Array<{ lat: number; lon: number; km: number }> = [];
  let j = 1;
  for (let k = 0; k < n; k += 1) {
    const target = (total * k) / (n - 1);
    while (j < pts.length - 1 && cum[j] < target) j += 1;
    const span = cum[j] - cum[j - 1];
    const t = span > 0 ? Math.min(1, Math.max(0, (target - cum[j - 1]) / span)) : 0;
    const [aLat, aLon] = pts[j - 1];
    const [bLat, bLon] = pts[j];
    out.push({
      lat: Math.round((aLat + (bLat - aLat) * t) * 1e5) / 1e5,
      lon: Math.round((aLon + (bLon - aLon) * t) * 1e5) / 1e5,
      km: Math.round(target * 100) / 100,
    });
  }
  return out;
}

/** Associe les altitudes reçues aux échantillons ; null si moins de deux valeurs. */
export function buildProfile(
  samples: ReadonlyArray<{ km: number }>,
  elevations: unknown,
  source: string
): ElevationProfile | null {
  if (!Array.isArray(elevations) || elevations.length !== samples.length) return null;
  const points: ElevationPoint[] = [];
  samples.forEach((s, i) => {
    const v = elevations[i];
    if (typeof v === 'number' && Number.isFinite(v) && v > -500 && v < 9000)
      points.push({ km: s.km, m: Math.round(v) });
  });
  if (points.length < 2) return null;
  let max = points[0];
  let minM = points[0].m;
  for (const p of points) {
    if (p.m > max.m) max = p;
    if (p.m < minM) minM = p.m;
  }
  return { points, maxM: max.m, minM, maxAtKm: max.km, source };
}

/** Le point du profil le plus proche d'une position 0..1 le long du tracé. */
export function pointAt(profile: ElevationProfile, t: number): ElevationPoint {
  const pts = profile.points;
  const total = pts[pts.length - 1].km;
  const target = Math.min(1, Math.max(0, t)) * total;
  let best = pts[0];
  for (const p of pts) if (Math.abs(p.km - target) < Math.abs(best.km - target)) best = p;
  return best;
}

/** Tracé SVG (viewBox 100 × 28) du profil. */
export function sparkPath(profile: ElevationProfile, w = 100, h = 28): string {
  const pts = profile.points;
  const total = pts[pts.length - 1].km || 1;
  const range = profile.maxM - profile.minM || 1;
  return pts
    .map((p, i) => {
      const x = (p.km / total) * w;
      const y = h - 2 - ((p.m - profile.minM) / range) * (h - 4);
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}
