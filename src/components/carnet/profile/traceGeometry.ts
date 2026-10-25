/**
 * Géométrie de trace partagée par la fiche carnet : extraction des points,
 * projection dans un `viewBox` (mini tracé 66 × 66) et centre du parcours
 * (recentrage de la carte du bas). Aucune coordonnée n'est inventée : sans
 * point réel, ces fonctions rendent `''` ou `null`.
 */

export type TracePoint = [number, number];

/** Un `null` ou une chaîne vide ne devient jamais 0 : ce serait un lieu inventé. */
function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** Points `[lat, lng]` réels de la trace, quel que soit le format stocké. */
export function extractCoords(trace: unknown): TracePoint[] {
  const raw =
    (trace as { geometry?: { coordinates?: unknown } })?.geometry?.coordinates ??
    (trace as { coordinates?: unknown })?.coordinates ??
    trace;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((point: unknown) => {
      if (Array.isArray(point)) return [toNumber(point[1]), toNumber(point[0])] as TracePoint;
      if (point && typeof point === 'object') {
        const { lat, lng } = point as { lat?: unknown; lng?: unknown };
        return [toNumber(lat), toNumber(lng)] as TracePoint;
      }
      return null;
    })
    .filter(
      (point): point is TracePoint =>
        point !== null && Number.isFinite(point[0]) && Number.isFinite(point[1]),
    );
}

export interface TraceBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function boundsOf(coords: TracePoint[]): TraceBounds | null {
  if (coords.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Projette la trace dans un carré `size` (viewBox), avec `pad` de marge,
 * en conservant les proportions (longitude corrigée par le cos de la latitude
 * moyenne). Rend `''` si la trace n'a pas de point.
 */
export function projectToViewBox(coords: TracePoint[], size = 66, pad = 9): string {
  const bounds = boundsOf(coords);
  if (!bounds) return '';
  const { minLat, maxLat, minLng, maxLng } = bounds;
  const midLat = (minLat + maxLat) / 2;
  const cos = Math.cos((midLat * Math.PI) / 180) || 1;
  const spanX = (maxLng - minLng) * cos;
  const spanY = maxLat - minLat;
  const inner = Math.max(size - pad * 2, 1);
  /* Trace dégénérée (un seul point, ou points identiques) : point au centre. */
  const scale =
    spanX <= 0 && spanY <= 0
      ? 0
      : Math.min(inner / Math.max(spanX, 1e-9), inner / Math.max(spanY, 1e-9));
  const offsetX = (size - spanX * scale) / 2;
  const offsetY = (size - spanY * scale) / 2;
  return coords
    .map(([lat, lng]) => {
      const x = offsetX + (lng - minLng) * cos * scale;
      const y = offsetY + (maxLat - lat) * scale;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export interface TraceCenter {
  lat: number;
  lng: number;
}

/** Centre du rectangle englobant réel de la trace, `null` sans point. */
export function traceCenter(coords: TracePoint[]): TraceCenter | null {
  const bounds = boundsOf(coords);
  if (!bounds) return null;
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}
