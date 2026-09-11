/**
 * A13 (S5) — Domaine pur du cockpit live (client-safe, zéro I/O).
 *
 * Partagé entre l'assemblage serveur (`server/cockpitData.ts`) et le hook
 * client (`ui/useAdventureCockpit.ts`) : état de recalcul froid, validation
 * bornée des positions GPS et allure mesurée sur tracé réel. Aucune valeur
 * inventée : une donnée absente reste `null`.
 */
import { haversineM } from './geo';
import type { RecalcState } from './recalcTriggers';

/** État de recalcul froid : aucune donnée, aucun déclencheur. */
export const EMPTY_RECALC_STATE: RecalcState = {
  lastRecalcAt: null,
  lastPositionAt: null,
  lastPosition: null,
  lastPaceMinPerKm: null,
  lastReportsVersion: 0,
  lastOffRouteAt: null,
  batteryLevel: null,
  routeVersion: 0,
};

export interface CockpitPosition {
  lat: number;
  lng: number;
  timestamp: string;
}

/** Borne des positions GPS acceptées (transport et assemblage bornés). */
export const COCKPIT_MAX_TRACKING_POSITIONS = 120;
/** Distance minimale (m) pour tirer une allure d'un tracé GPS réel. */
export const COCKPIT_MIN_PACE_DISTANCE_M = 50;

/** Positions valides uniquement, bornées aux plus récentes (jamais devinées). */
export function validCockpitPositions(
  positions: readonly CockpitPosition[] | undefined
): CockpitPosition[] {
  if (!Array.isArray(positions)) return [];
  return positions
    .filter(
      (position) =>
        Number.isFinite(position?.lat) &&
        Number.isFinite(position?.lng) &&
        typeof position?.timestamp === 'string' &&
        Number.isFinite(Date.parse(position.timestamp))
    )
    .slice(-COCKPIT_MAX_TRACKING_POSITIONS);
}

/** Allure mesurée (min/km) le long d'un tracé GPS réel, jamais inventée. */
export function paceFromPositions(positions: readonly CockpitPosition[]): number | null {
  if (positions.length < 2) return null;
  const first = positions[0];
  const last = positions[positions.length - 1];
  const durationMin = (Date.parse(last.timestamp) - Date.parse(first.timestamp)) / 60_000;
  if (!(durationMin > 0)) return null;
  let distanceM = 0;
  for (let index = 1; index < positions.length; index += 1) {
    distanceM += haversineM(positions[index - 1], positions[index]);
  }
  if (distanceM < COCKPIT_MIN_PACE_DISTANCE_M) return null;
  return durationMin / (distanceM / 1000);
}
