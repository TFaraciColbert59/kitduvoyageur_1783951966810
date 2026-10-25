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
/**
 * Avec un indice de pays, un aéroport d'un AUTRE pays compte comme 1,25 fois plus
 * loin (en plus du facteur des aéroports moyens). Doux, pas une exclusion : Genève
 * reste l'aéroport de Chamonix et de Morzine (il faudrait moins de 1,40 pour cela),
 * alors qu'un aéroport du pays à peu près aussi près passe devant (Courmayeur → Turin).
 */
export const FOREIGN_AIRPORT_FACTOR = 1.25;

export interface NearestAirportOpts {
  /** Rayon de recherche en km (défaut 300). */
  maxKm?: number;
  /**
   * Indice de pays (ISO 3166 alpha-2, majuscules ou minuscules), par exemple celui
   * du lieu géocodé. Le vol d'oiseau traverse frontières et mers : avec l'indice,
   * un aéroport d'un autre pays voit son score multiplié par
   * `FOREIGN_AIRPORT_FACTOR` (1,25), ceux du pays ne changent pas. Tous les
   * aéroports du rayon restent candidats : l'indice ne retire personne, et sans
   * aéroport du pays à portée il ne change rien. null, undefined, vide : pas d'indice.
   * Limites connues : il ne voit ni les Alpes (Zermatt reste Milan) ni la mer
   * (Santa Teresa Gallura reste Figari).
   */
  country?: string | null;
}

/**
 * Aéroport retenu pour un lieu : parmi ceux à moins de `maxKm` (300 km), le
 * plus petit score = distance × (grand ? 1 : 1,6) × (autre pays que l'indice ?
 * 1,25 : 1) ; à égalité, le premier (les lignes sont triées par code IATA).
 * null si aucun.
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
  let best: { row: AirportRow; km: number; score: number } | null = null;
  for (const row of rows) {
    if (Math.abs(row[2] - lat) > latSpan) continue;
    const km = distanceKm({ lat, lon }, { lat: row[2], lon: row[3] });
    if (km > maxKm) continue;
    const foreign = country !== null && row[4].toUpperCase() !== country;
    const score = km * (row[5] === 'L' ? 1 : MEDIUM_AIRPORT_FACTOR) * (foreign ? FOREIGN_AIRPORT_FACTOR : 1);
    if (!best || score < best.score) best = { row, km, score };
  }
  if (!best) return null;
  const [iata, name, aLat, aLon, aCountry] = best.row;
  return { iata, name, km: Math.round(best.km), country: aCountry, lat: aLat, lon: aLon };
}
