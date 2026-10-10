import 'server-only';
import AIRPORTS from '../data/airports.json';
import { nearestAirportIn, type AirportPick, type AirportRow } from '../engine/airports';

/**
 * Aéroports desservis (OurAirports, domaine public), lus côté serveur
 * seulement : le fichier (≈ 200 Ko) ne part jamais dans le navigateur.
 * Généré par `scripts/compas/build-airports.mjs` (voir `data/airports.meta.json`).
 */
const ROWS = AIRPORTS as unknown as readonly AirportRow[];

/** Aéroport retenu pour un lieu (à moins de 300 km, les grands d'abord), sinon null. */
export function nearestAirport(lat: number, lon: number, opts?: { maxKm?: number }): AirportPick | null {
  return nearestAirportIn(ROWS, lat, lon, opts);
}
