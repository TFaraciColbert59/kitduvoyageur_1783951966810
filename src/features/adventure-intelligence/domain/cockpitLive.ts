/**
 * A13 (S5) — Domaine pur du cockpit live (client-safe, zéro I/O).
 *
 * Partagé entre l'assemblage serveur (`server/cockpitData.ts`) et le hook
 * client (`ui/useAdventureCockpit.ts`) : état de recalcul froid, validation
 * bornée des positions GPS et allure mesurée sur tracé réel. Aucune valeur
 * inventée : une donnée absente reste `null`.
 */
import { haversineM } from './geo';
import { computeFatigue } from './fatigue';
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
  /** Altitude GPS réelle (m) quand disponible — jamais extrapolée. */
  altitudeM?: number | null;
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

/**
 * Recalcul live de l'écart à l'ETA planifiée, sur les fixes GPS réels :
 * `projection = maintenant + distance restante × allure mesurée` ;
 * `avance = ETA planifiée − projection`. Positif = en avance, négatif = retard.
 * Retourne `null` dès qu'une donnée manque (jamais de valeur inventée).
 */
export function computeAheadBehindMinutes(input: {
  plannedEtaIso: string | null | undefined;
  paceMinPerKm: number | null | undefined;
  remainingDistanceKm: number | null | undefined;
  nowIso: string;
}): number | null {
  const plannedMs = input.plannedEtaIso ? Date.parse(input.plannedEtaIso) : Number.NaN;
  const nowMs = Date.parse(input.nowIso);
  const pace = input.paceMinPerKm;
  const remainingKm = input.remainingDistanceKm;
  if (!Number.isFinite(plannedMs) || !Number.isFinite(nowMs)) return null;
  if (typeof pace !== 'number' || !Number.isFinite(pace) || pace <= 0) return null;
  if (typeof remainingKm !== 'number' || !Number.isFinite(remainingKm) || remainingKm < 0) {
    return null;
  }
  const projectedArrivalMs = nowMs + remainingKm * pace * 60_000;
  return Math.round((plannedMs - projectedArrivalMs) / 60_000);
}

/** Charge consommée recalculée sur les fixes réels (durée active + D+). */
export interface CockpitLiveConsumption {
  activeDurationS: number;
  elevationGainM: number;
  /** Score de charge A3 (`fatigue.ts`) borné 0..100, jamais une donnée santé. */
  loadScore: number;
}

/**
 * Consommation live (charge) dérivée des seuls fixes GPS réels : durée active
 * entre le premier et le dernier fix, dénivelé positif cumulé des altitudes
 * valides, puis score de fatigue A3. `null` si le tracé réel est insuffisant.
 */
export function consumptionFromPositions(
  positions: readonly CockpitPosition[]
): CockpitLiveConsumption | null {
  if (positions.length < 2) return null;
  const first = positions[0];
  const last = positions[positions.length - 1];
  const activeDurationS = (Date.parse(last.timestamp) - Date.parse(first.timestamp)) / 1000;
  if (!(activeDurationS > 0)) return null;

  let gainM = 0;
  for (let index = 1; index < positions.length; index += 1) {
    const previous = positions[index - 1].altitudeM;
    const current = positions[index].altitudeM;
    if (
      typeof previous !== 'number' ||
      typeof current !== 'number' ||
      !Number.isFinite(previous) ||
      !Number.isFinite(current)
    ) {
      continue;
    }
    const delta = current - previous;
    if (delta > 0) gainM += delta;
  }

  const fatigue = computeFatigue({ activeDurationS, gainM, lossM: 0 });
  return {
    activeDurationS: Math.round(activeDurationS),
    elevationGainM: Math.round(gainM),
    loadScore: fatigue.score,
  };
}
