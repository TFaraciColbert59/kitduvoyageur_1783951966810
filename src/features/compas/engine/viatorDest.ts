/**
 * Compas — la destination Viator d'un voyage, choisie par la carte (pur, testé).
 *
 * Viator cherche par identifiant de destination. Le nom tapé (« Vercors »,
 * « Rome ») ne suffit pas, et le code pays non plus (France → Paris) : on
 * prend la destination Viator la plus proche du lieu du voyage, une ville ou
 * une région plutôt qu'un pays entier, à distance plausible. Rien à moins de
 * 120 km : aucune destination, jamais des activités à Paris pour le Vercors.
 */

import { distanceKm } from './places';

export interface ViatorDestination {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
}

const NEAR_KM = 120;
const BROAD = new Set(['COUNTRY', 'CONTINENT', 'STATE', 'PROVINCE']);

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Réponse `GET /destinations` (API partenaire v2) → liste compacte. */
export function parseViatorDestinations(payload: unknown): ViatorDestination[] {
  const rows =
    payload && typeof payload === 'object' && Array.isArray((payload as { destinations?: unknown }).destinations)
      ? ((payload as { destinations: unknown[] }).destinations as Array<Record<string, unknown>>)
      : [];
  const out: ViatorDestination[] = [];
  for (const r of rows) {
    const id = num(r.destinationId);
    const center = (r.center && typeof r.center === 'object' ? r.center : {}) as Record<string, unknown>;
    const lat = num(center.latitude);
    const lon = num(center.longitude);
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (id == null || lat == null || lon == null || !name) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    out.push({ id: String(Math.trunc(id)), name, type: String(r.type ?? '').toUpperCase(), lat, lon });
  }
  return out;
}

/**
 * La destination la plus proche du lieu : ville, région ou parc d'abord ; un
 * pays seulement si le voyage EST le pays (`broad`) et qu'aucune ville n'est
 * à portée.
 */
export function nearestViatorDestination(
  list: readonly ViatorDestination[],
  at: { lat: number; lon: number },
  opts: { broad?: boolean } = {}
): ViatorDestination | null {
  let best: { d: ViatorDestination; km: number } | null = null;
  for (const d of list) {
    if (BROAD.has(d.type)) continue;
    const km = distanceKm(at, d);
    if (km <= NEAR_KM && (!best || km < best.km)) best = { d, km };
  }
  if (best) return best.d;
  if (!opts.broad) return null;
  let country: { d: ViatorDestination; km: number } | null = null;
  for (const d of list) {
    if (d.type !== 'COUNTRY') continue;
    const km = distanceKm(at, d);
    if (!country || km < country.km) country = { d, km };
  }
  return country && country.km <= 1500 ? country.d : null;
}
