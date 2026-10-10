import { distanceKm } from './places';

/**
 * Compas — l'aéroport d'un lieu (OurAirports, domaine public, PLAN-100 4.3).
 *
 * Choix PUR : les lignes sont passées en argument. Le fichier des 3 244
 * aéroports desservis (`data/airports.json`, ≈ 200 Ko) n'est lu que côté
 * serveur (`server/airports.ts`) : il n'entre jamais dans le navigateur.
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

/**
 * Aéroport retenu pour un lieu : parmi ceux à moins de `maxKm` (300 km), le
 * plus petit score = distance × (grand ? 1 : 1,6) ; à égalité, le premier
 * code IATA. null si aucun.
 */
export function nearestAirportIn(
  rows: readonly AirportRow[],
  lat: number,
  lon: number,
  opts: { maxKm?: number } = {}
): AirportPick | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const maxKm = opts.maxKm ?? AIRPORT_RADIUS_KM;
  // Un degré de latitude ≈ 111 km : ce qui en est plus loin ne peut pas être dans le rayon.
  const latSpan = maxKm / 111 + 0.1;
  let best: { row: AirportRow; km: number; score: number } | null = null;
  for (const row of rows) {
    if (Math.abs(row[2] - lat) > latSpan) continue;
    const km = distanceKm({ lat, lon }, { lat: row[2], lon: row[3] });
    if (km > maxKm) continue;
    const score = km * (row[5] === 'L' ? 1 : MEDIUM_AIRPORT_FACTOR);
    if (!best || score < best.score) best = { row, km, score };
  }
  if (!best) return null;
  const [iata, name, aLat, aLon, country] = best.row;
  return { iata, name, km: Math.round(best.km), country, lat: aLat, lon: aLon };
}
