import { distanceKm } from './places';

/**
 * Compas — l'aéroport d'un lieu (OurAirports, domaine public, PLAN-100 4.3).
 *
 * Choix PUR : les lignes sont passées en argument. Le fichier des aéroports
 * desservis (`data/airports.json`, environ trois mille lignes, voir
 * `data/airports.meta.json`) n'est lu que côté serveur (`server/airports.ts`) :
 * il n'entre jamais dans le navigateur.
 */

/** [code IATA, nom, latitude, longitude, pays ISO, 'L' grand | 'M' moyen] */
export type AirportRow = readonly [string, string, number, number, string, 'L' | 'M'];

export interface AirportPick {
  iata: string;
  /** Nom tel que dans OurAirports (« Lyon Saint-Exupéry Airport »). */
  name: string;
  /** Vol d'oiseau du lieu à l'aéroport, en km (arrondi). */
  km: number;
  country: string;
  lat: number;
  lon: number;
}

/** Au-delà, un aéroport n'est plus celui du lieu. */
export const AIRPORT_RADIUS_KM = 300;
/** Un aéroport moyen (moins de vols) compte comme 1,6 fois plus loin qu'un grand. */
export const MEDIUM_AIRPORT_FACTOR = 1.6;

export interface NearestAirportOpts {
  /** Rayon de recherche en km (défaut 300). */
  maxKm?: number;
  /**
   * Indice de pays (ISO 3166 alpha-2, majuscules ou minuscules) : le vol
   * d'oiseau traverse les frontières et les mers (Santa Teresa Gallura est
   * plus près de Figari, en Corse, que d'Olbia ; Zermatt de Milan que de
   * Genève). Si au moins un aéroport de ce pays est dans le rayon, seuls ceux
   * de ce pays concourent ; sinon l'indice est ignoré. null, vide : pas d'indice.
   */
  country?: string | null;
}

/**
 * Aéroport retenu pour un lieu : parmi ceux à moins de `maxKm` (300 km), le
 * plus petit score = distance × (grand ? 1 : 1,6) ; à égalité, le premier
 * (les lignes sont triées par code IATA). Avec un indice de pays (voir
 * `NearestAirportOpts`), les aéroports de ce pays passent d'abord s'il y en a
 * dans le rayon. null si aucun.
 */
export function nearestAirportIn(
  rows: readonly AirportRow[],
  lat: number,
  lon: number,
  opts: NearestAirportOpts = {}
): AirportPick | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  // Un rayon qui n'est pas un nombre fini (NaN, ±Infinity) vaut le rayon par
  // défaut : il ne doit jamais supprimer le rayon en silence. Zéro ou négatif : rien.
  const maxKm = typeof opts.maxKm === 'number' && Number.isFinite(opts.maxKm) ? opts.maxKm : AIRPORT_RADIUS_KM;
  if (maxKm <= 0) return null;
  const country = typeof opts.country === 'string' ? opts.country.trim().toUpperCase() || null : null;
  // Un degré de latitude ≈ 111 km : ce qui en est plus loin ne peut pas être dans le rayon.
  const latSpan = maxKm / 111 + 0.1;
  type Candidate = { row: AirportRow; km: number; score: number };
  let best: Candidate | null = null;
  let bestInCountry: Candidate | null = null;
  for (const row of rows) {
    if (Math.abs(row[2] - lat) > latSpan) continue;
    const km = distanceKm({ lat, lon }, { lat: row[2], lon: row[3] });
    if (km > maxKm) continue;
    const candidate = { row, km, score: km * (row[5] === 'L' ? 1 : MEDIUM_AIRPORT_FACTOR) };
    if (!best || candidate.score < best.score) best = candidate;
    if (country && row[4].toUpperCase() === country && (!bestInCountry || candidate.score < bestInCountry.score)) {
      bestInCountry = candidate;
    }
  }
  const pick = bestInCountry ?? best;
  if (!pick) return null;
  const [iata, name, aLat, aLon, aCountry] = pick.row;
  return { iata, name, km: Math.round(pick.km), country: aCountry, lat: aLat, lon: aLon };
}
