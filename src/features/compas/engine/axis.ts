/**
 * Compas — axe principal d'un ensemble de lieux. Module PUR : aucune I/O.
 *
 * Sorti de `itinerary.ts` pour que le choix des bases d'un pays (`countryBases.ts`)
 * et le planificateur partagent le même axe sans dépendre l'un de l'autre.
 */
import { lonDelta, meanLon } from './longitude';

/** Axe principal de la zone (vers l'est par défaut) : direction d'une traversée. */
export function mainAxis(points: ReadonlyArray<{ lat: number; lon: number }>): { lat: number; lon: number; dx: number; dy: number } {
  const n = points.length || 1;
  const lat0 = points.reduce((t, p) => t + p.lat, 0) / n;
  const lon0 = meanLon(points.map((p) => p.lon));
  const k = Math.cos((lat0 * Math.PI) / 180);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    const x = lonDelta(lon0, p.lon) * k;
    const y = p.lat - lat0;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let dx = Math.cos(theta);
  let dy = Math.sin(theta);
  // Sens fixé (ouest → est, sinon sud → nord) : déterministe.
  if (dx < -1e-9 || (Math.abs(dx) <= 1e-9 && dy < 0)) {
    dx = -dx;
    dy = -dy;
  }
  return { lat: lat0, lon: lon0, dx, dy };
}

/** Position d'un lieu le long de l'axe (km, depuis le centre des lieux). */
export function along(axis: ReturnType<typeof mainAxis>, p: { lat: number; lon: number }): number {
  const k = Math.cos((axis.lat * Math.PI) / 180);
  // En km (1° de latitude ≈ 111 km).
  return (lonDelta(axis.lon, p.lon) * k * axis.dx + (p.lat - axis.lat) * axis.dy) * 111;
}
