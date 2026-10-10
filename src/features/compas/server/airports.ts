import 'server-only';
import AIRPORTS from '../data/airports.json';
import { nearestAirportIn, type AirportPick, type AirportRow, type NearestAirportOpts } from '../engine/airports';

/**
 * Aéroports desservis (OurAirports, domaine public), lus côté serveur
 * seulement : le fichier (environ trois mille lignes) ne part jamais dans le
 * navigateur. Généré par `scripts/compas/build-airports.mjs` (voir
 * `data/airports.meta.json`).
 */
const ROWS = AIRPORTS as unknown as readonly AirportRow[];

/**
 * Aéroport retenu pour un lieu, à moins de 300 km (ou `maxKm`), sinon null.
 * Un aéroport moyen compte 1,6 fois sa distance (un grand un peu plus loin peut
 * donc l'emporter). `country` (ISO alpha-2) : voir `NearestAirportOpts`.
 */
export function nearestAirport(lat: number, lon: number, opts?: NearestAirportOpts): AirportPick | null {
  return nearestAirportIn(ROWS, lat, lon, opts);
}
