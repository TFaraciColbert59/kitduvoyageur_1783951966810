/**
 * Modifier un point depuis la liste (5.6) : coordonnées écrites à la main, adresse cherchée, nom.
 * Fonctions pures + un appel `/api/geocode` (fetch injectable). Une adresse n'est jamais posée sans que la
 * personne choisisse un résultat : la liste est une proposition, pas un lieu établi (`precision`).
 */
export interface ParsedCoordinates {
  readonly lat: number;
  readonly lon: number;
}

export type CoordinatesParse =
  | { readonly ok: true; readonly value: ParsedCoordinates; readonly swapped: boolean }
  | { readonly ok: false; readonly error: string };

const num = (raw: string): number => Number(raw.trim().replace(',', '.'));

/**
 * « 45.0512, 5.5103 », « 45,0512 ; 5,5103 », « 45.0512 5.5103 ». Latitude d'abord ; si elle dépasse 90, les deux
 * valeurs sont lues dans l'ordre inverse (longitude, latitude) et la lecture le dit (`swapped`).
 */
export function parseCoordinates(input: string): CoordinatesParse {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Saisissez la latitude et la longitude.' };
  let parts: string[];
  if (text.includes(';')) parts = text.split(';');
  else if (/,\s/.test(text) || (text.match(/,/g) ?? []).length === 1 && !/\d,\d+\s+\d/.test(text)) parts = text.split(/,\s*/);
  else parts = text.split(/\s+/);
  parts = parts.map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return { ok: false, error: 'Deux nombres attendus : latitude puis longitude (ex. 45,0512 ; 5,5103).' };
  const a = num(parts[0]);
  const b = num(parts[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { ok: false, error: 'Ces coordonnées ne sont pas des nombres.' };
  let lat = a;
  let lon = b;
  let swapped = false;
  if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
    lat = b;
    lon = a;
    swapped = true;
  }
  if (Math.abs(lat) > 90) return { ok: false, error: 'La latitude doit être comprise entre −90 et 90.' };
  if (Math.abs(lon) > 180) return { ok: false, error: 'La longitude doit être comprise entre −180 et 180.' };
  return { ok: true, value: { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 }, swapped };
}

export function formatCoordinates(p: { lat: number; lon: number }): string {
  return `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
}

export interface AddressMatch {
  readonly id: string;
  readonly name: string;
  readonly context: string;
  readonly lat: number;
  readonly lon: number;
  readonly precision: 'commune' | 'inexact';
}

export type AddressSearch =
  | { readonly status: 'ok'; readonly matches: readonly AddressMatch[] }
  | { readonly status: 'no_result' | 'unavailable' | 'invalid'; readonly matches: readonly [] };

export async function searchAddress(
  query: string,
  fetchFn: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }> = (url) => fetch(url),
): Promise<AddressSearch> {
  const q = query.trim();
  if (q.length < 2) return { status: 'invalid', matches: [] };
  try {
    const res = await fetchFn(`/api/geocode?q=${encodeURIComponent(q.slice(0, 80))}`);
    const data = (await res.json()) as { status?: string; matches?: Array<Record<string, unknown>> };
    if (data.status === 'no_result') return { status: 'no_result', matches: [] };
    if (!res.ok || data.status !== 'ok' || !Array.isArray(data.matches)) return { status: 'unavailable', matches: [] };
    const matches: AddressMatch[] = [];
    for (const m of data.matches) {
      const lat = typeof m.lat === 'number' ? m.lat : NaN;
      const lon = typeof m.lon === 'number' ? m.lon : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      matches.push({
        id: String(m.id ?? `${lat},${lon}`),
        name: typeof m.name === 'string' ? m.name : 'Lieu',
        context: [m.context, m.country].filter((x): x is string => typeof x === 'string' && x !== '').join(', '),
        lat,
        lon,
        precision: m.precision === 'commune' ? 'commune' : 'inexact',
      });
    }
    return matches.length > 0 ? { status: 'ok', matches } : { status: 'no_result', matches: [] };
  } catch {
    return { status: 'unavailable', matches: [] };
  }
}

/** Déplacement trop grand pour être un simple ajustement : la liste le dit avant d'appliquer (km). */
export function moveDistanceKm(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const dy = (to.lat - from.lat) * 110.574;
  const dx = (to.lon - from.lon) * Math.cos((from.lat * Math.PI) / 180) * 111.32;
  return Math.round(Math.sqrt(dx * dx + dy * dy) * 100) / 100;
}
