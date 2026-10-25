/**
 * A7 — Déclencheurs de recalcul live (pur).
 *
 * Un recalcul est proposé sur signaux : déplacement ≥ 250 m, reprise après
 * pause ≥ 2 min, écart d'allure ≥ 15 %, hors-trace, changement de version
 * des signalements ou de l'itinéraire, batterie ≤ 20 % (une fois).
 * Anti-rebond : jamais deux recalculs à moins de 60 s.
 */
import { haversineM } from './geo';

export const POSITION_THRESHOLD_M = 250;
export const PAUSE_MIN_MS = 2 * 60_000;
export const PACE_DEVIATION_THRESHOLD = 0.15;
export const BATTERY_THRESHOLD_PCT = 20;
export const RECALC_DEBOUNCE_MS = 60_000;

export const RECALC_REASONS = {
  position: 'position_250m',
  pause: 'pause_reprise_2min',
  pace: 'allure_ecart_15pct',
  offroute: 'hors_trace',
  terrain: 'signalements_modifies',
  battery: 'batterie_faible_20pct',
  route: 'itineraire_modifie',
} as const;

export interface RecalcState {
  lastRecalcAt: string | null;
  lastPositionAt: string | null;
  lastPosition: { lat: number; lng: number } | null;
  lastPaceMinPerKm: number | null;
  lastReportsVersion: number;
  lastOffRouteAt: string | null;
  batteryLevel: number | null;
  routeVersion: number;
}

export interface RecalcSignal {
  kind: 'position' | 'pause' | 'pace' | 'offroute' | 'terrain' | 'battery' | 'route';
  at: string;
  detail?: string;
}

export interface RecalcDecision {
  shouldRecalculate: boolean;
  reasons: string[];
  nextState: RecalcState;
}

export interface RecalcInput {
  state: RecalcState;
  now: string;
  position?: { lat: number; lng: number } | null;
  moving?: boolean;
  paceMinPerKm?: number | null;
  reportsVersion?: number;
  offRoute?: boolean;
  batteryLevel?: number | null;
  routeVersion?: number;
}

function parsedMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

export function evaluateRecalc(input: RecalcInput): RecalcDecision {
  const { state, now } = input;
  const nowMs = Date.parse(now);
  const reasons: string[] = [];
  const lastRecalcMs = parsedMs(state.lastRecalcAt);
  const debounced =
    lastRecalcMs != null && Number.isFinite(nowMs) && nowMs - lastRecalcMs < RECALC_DEBOUNCE_MS;

  if (input.position && state.lastPosition) {
    const distanceM = haversineM(state.lastPosition, input.position);
    if (distanceM >= POSITION_THRESHOLD_M) reasons.push(RECALC_REASONS.position);
  }

  if (input.moving === true && state.lastPositionAt) {
    const lastPositionMs = parsedMs(state.lastPositionAt);
    if (lastPositionMs != null && Number.isFinite(nowMs) && nowMs - lastPositionMs >= PAUSE_MIN_MS) {
      reasons.push(RECALC_REASONS.pause);
    }
  }

  if (
    typeof input.paceMinPerKm === 'number' &&
    Number.isFinite(input.paceMinPerKm) &&
    state.lastPaceMinPerKm != null &&
    state.lastPaceMinPerKm > 0
  ) {
    const deviation =
      Math.abs(input.paceMinPerKm - state.lastPaceMinPerKm) / state.lastPaceMinPerKm;
    if (deviation >= PACE_DEVIATION_THRESHOLD) reasons.push(RECALC_REASONS.pace);
  }

  if (input.offRoute === true && state.lastOffRouteAt == null) {
    reasons.push(RECALC_REASONS.offroute);
  }

  if (typeof input.reportsVersion === 'number' && input.reportsVersion !== state.lastReportsVersion) {
    reasons.push(RECALC_REASONS.terrain);
  }

  if (
    typeof input.batteryLevel === 'number' &&
    Number.isFinite(input.batteryLevel) &&
    input.batteryLevel <= BATTERY_THRESHOLD_PCT &&
    (state.batteryLevel == null || state.batteryLevel > BATTERY_THRESHOLD_PCT)
  ) {
    reasons.push(RECALC_REASONS.battery);
  }

  if (typeof input.routeVersion === 'number' && input.routeVersion !== state.routeVersion) {
    reasons.push(RECALC_REASONS.route);
  }

  if (reasons.length === 0 || debounced) {
    return {
      shouldRecalculate: false,
      reasons,
      nextState:
        input.offRoute === false
          ? { ...state, lastOffRouteAt: null }
          : state,
    };
  }

  return {
    shouldRecalculate: true,
    reasons,
    nextState: {
      lastRecalcAt: now,
      lastPosition: input.position ?? state.lastPosition,
      lastPositionAt: input.position ? now : state.lastPositionAt,
      lastPaceMinPerKm:
        typeof input.paceMinPerKm === 'number' && Number.isFinite(input.paceMinPerKm)
          ? input.paceMinPerKm
          : state.lastPaceMinPerKm,
      lastReportsVersion:
        typeof input.reportsVersion === 'number'
          ? input.reportsVersion
          : state.lastReportsVersion,
      lastOffRouteAt: input.offRoute === true ? now : null,
      batteryLevel:
        typeof input.batteryLevel === 'number' && Number.isFinite(input.batteryLevel)
          ? input.batteryLevel
          : state.batteryLevel,
      routeVersion:
        typeof input.routeVersion === 'number' ? input.routeVersion : state.routeVersion,
    },
  };
}
