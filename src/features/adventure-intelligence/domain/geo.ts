/**
 * Géométrie pure — distances, caps, distance cumulée et lissage d'altitude.
 *
 * Domaine Adventure Intelligence : moteur sans I/O (ADR-AI-005).
 * Sphère WGS84 moyenne : précision suffisante à l'échelle des traces GPS.
 */

/** Rayon terrestre moyen en mètres. */
export const EARTH_RADIUS_M = 6_371_000;

const DEG_TO_RAD = Math.PI / 180;

function toRad(deg: number): number {
  return deg * DEG_TO_RAD;
}

/** Distance orthodromique (mètres) entre deux points { lat, lng }. */
export function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cap initial (degrés, 0 = nord, sens horaire) de `a` vers `b`. */
export function bearingDeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) / DEG_TO_RAD + 360) % 360;
}

/** Distances cumulées (mètres) le long d'une polyligne ; premier élément = 0. */
export function cumulativeDistancesM(points: { lat: number; lng: number }[]): number[] {
  const result: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    if (i > 0) total += haversineM(points[i - 1], points[i]);
    result.push(total);
  }
  return result;
}

/**
 * Lissage d'altitude par moyenne glissante centrée.
 * Seules les valeurs définies et finies comptent ; une fenêtre sans valeur
 * définie retourne `undefined` (aucune invention de donnée).
 */
export function smoothAltitude(
  values: (number | undefined)[],
  window: number
): (number | undefined)[] {
  const size = Math.max(1, Math.trunc(window));
  const half = Math.floor(size / 2);
  return values.map((_, index) => {
    let sum = 0;
    let count = 0;
    const from = Math.max(0, index - half);
    const to = Math.min(values.length - 1, index + half);
    for (let i = from; i <= to; i += 1) {
      const value = values[i];
      if (typeof value === 'number' && Number.isFinite(value)) {
        sum += value;
        count += 1;
      }
    }
    return count === 0 ? undefined : sum / count;
  });
}
