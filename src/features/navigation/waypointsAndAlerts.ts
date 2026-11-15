/**
 * Lot N01 — À venir : POI, lieux et Highlights avec distance (K4.07)
 * & Alertes audio et visuelles aux waypoints (K4.08).
 *
 * Responsabilités :
 * - Projeter les POI, lieux et Highlights sur le tracé (`projectWaypointsOnRoute`),
 *   filtrer ceux qui sont hors couloir (> `maxLateralOffsetM`), non autorisés
 *   (`authorized === false`) ou non pertinents pour le sport actif.
 * - Calculer la liste ordonnée « À venir » (`computeUpcomingWaypoints`) avec la
 *   distance réelle restante **le long du tracé** (et non à vol d'oiseau).
 * - Gérer l'état temporaire d'alerte à l'approche (`approach` ≤ 150 m) et à
 *   l'atteinte (`arrival` ≤ 30 m) d'un repère (`WaypointAlertController`), avec
 *   retrait automatique dès que le repère est dépassé ou que le signal est perdu.
 */

import { isValidLngLat, routeLines, type RouteLine } from '../explorer-v2/geo/track';
import { MIN_MOVING_SPEED_MS } from '../explorer-v2/activity/tracker';
import { projectPositionOnRoute } from './turnByTurn';
import type {
  NavigationUnits,
  NavigationWaypointInput,
  ProjectedWaypoint,
  Sport,
  UpcomingWaypointItem,
  WaypointAlertEvent,
  WaypointAlertStage,
} from './types';
import { formatNavigationDistance, formatSpokenDistance } from './unitsAndOrientation';

/** Écart latéral maximal par défaut pour rattacher un POI au tracé (m). */
export const DEFAULT_MAX_WAYPOINT_LATERAL_M = 150;
/** Distance d'annonce anticipée d'un waypoint (m). */
export const WAYPOINT_APPROACH_RADIUS_M = 150;
/** Distance d'annonce d'arrivée à un waypoint (m). */
export const WAYPOINT_ARRIVAL_RADIUS_M = 30;
/** Marge au-delà du waypoint après laquelle l'alerte est automatiquement retirée (m). */
export const WAYPOINT_PASSED_CLEAR_MARGIN_M = 20;

export interface ProjectWaypointsOptions {
  sport?: Sport | null;
  maxLateralOffsetM?: number;
}

/**
 * Projette et filtre les waypoints / POI / Highlights le long du tracé (`K4.07`).
 * Trie les points retenus par abscisse curviligne `alongTrackM` croissante.
 */
export function projectWaypointsOnRoute(
  waypoints: readonly NavigationWaypointInput[],
  routeInput: readonly RouteLine[] | unknown,
  options: ProjectWaypointsOptions = {},
): ProjectedWaypoint[] {
  const lines: readonly RouteLine[] =
    Array.isArray(routeInput) &&
    routeInput.length > 0 &&
    Array.isArray(routeInput[0]) &&
    Array.isArray((routeInput[0] as unknown[])[0])
      ? (routeInput as readonly RouteLine[])
      : routeLines(routeInput);

  if (lines.length === 0 || waypoints.length === 0) return [];

  const maxLateral = options.maxLateralOffsetM ?? DEFAULT_MAX_WAYPOINT_LATERAL_M;
  const projected: ProjectedWaypoint[] = [];

  for (const wp of waypoints) {
    if (!wp || !wp.id || !wp.name?.trim()) continue;
    // Règle K4.07 : ne jamais afficher une donnée non autorisée
    if (wp.authorized === false) continue;
    // Règle K4.07 : filtrer par sport si le point est restreint à certains sports
    if (
      options.sport &&
      Array.isArray(wp.sports) &&
      wp.sports.length > 0 &&
      !wp.sports.includes(options.sport)
    ) {
      continue;
    }

    const pos: [number, number] = [wp.lng, wp.lat];
    if (!isValidLngLat(pos)) continue;

    const proj = projectPositionOnRoute(pos, lines);
    if (!proj) continue;
    if (proj.crossTrackM > maxLateral) continue;

    projected.push({
      ...wp,
      name: wp.name.trim(),
      alongTrackM: Math.round(proj.alongTrackM * 10) / 10,
      lateralOffsetM: Math.round(proj.crossTrackM * 10) / 10,
    });
  }

  projected.sort((a, b) => a.alongTrackM - b.alongTrackM || a.id.localeCompare(b.id));
  return projected;
}

export interface ComputeUpcomingWaypointsOptions {
  units?: NavigationUnits;
  currentSpeedMs?: number | null;
  limit?: number;
  /** Tolérance en mètres derrière la position courante pour garder un POI tout juste atteint. */
  passedToleranceM?: number;
}

/**
 * Calcule les prochains POI, lieux et Highlights le long du tracé (`K4.07`)
 * avec la distance restante et le temps estimé (si en mouvement).
 */
export function computeUpcomingWaypoints(
  projectedWaypoints: readonly ProjectedWaypoint[],
  currentAlongTrackM: number | null | undefined,
  options: ComputeUpcomingWaypointsOptions = {},
): UpcomingWaypointItem[] {
  if (
    typeof currentAlongTrackM !== 'number' ||
    !Number.isFinite(currentAlongTrackM) ||
    projectedWaypoints.length === 0
  ) {
    return [];
  }

  const units = options.units ?? 'metric';
  const passedToleranceM = options.passedToleranceM ?? 15;
  const speedMs =
    typeof options.currentSpeedMs === 'number' &&
    Number.isFinite(options.currentSpeedMs) &&
    options.currentSpeedMs >= MIN_MOVING_SPEED_MS
      ? options.currentSpeedMs
      : null;

  const items: UpcomingWaypointItem[] = [];
  for (const wp of projectedWaypoints) {
    if (wp.authorized === false) continue;
    const rawDelta = wp.alongTrackM - currentAlongTrackM;
    if (rawDelta < -passedToleranceM) continue;

    const distanceRemainingM = Math.max(0, Math.round(rawDelta));
    const etaSeconds =
      speedMs !== null && distanceRemainingM > 0
        ? Math.round(distanceRemainingM / speedMs)
        : distanceRemainingM === 0
          ? 0
          : null;

    items.push({
      waypoint: wp,
      distanceRemainingM,
      formattedDistance: formatNavigationDistance(distanceRemainingM, units),
      etaSeconds,
    });

    if (options.limit && items.length >= options.limit) {
      break;
    }
  }

  return items;
}

export interface WaypointAlertEvaluationOptions {
  currentAlongTrackM: number | null;
  crossTrackM?: number | null;
  signalLost?: boolean;
  audioEnabled?: boolean;
  units?: NavigationUnits;
  nowMs?: number;
  approachRadiusM?: number;
  arrivalRadiusM?: number;
}

export interface WaypointAlertStateSnapshot {
  /** Alerte visuelle temporaire courante dans le bandeau (retirée à sa résolution). */
  activeAlert: WaypointAlertEvent | null;
  /** Nouvelles alertes déclenchées sur ce tick (à envoyer au TTS/haptique si activés). */
  newlyTriggered: readonly WaypointAlertEvent[];
}

/**
 * Contrôleur d'alertes audio et visuelles aux waypoints (`K4.08`).
 *
 * - Déclenche `approach` (≤ 150 m) puis `arrival` (≤ 30 m) une seule fois par
 *   waypoint.
 * - Retire automatiquement `activeAlert` dès que le waypoint est dépassé de plus
 *   de `WAYPOINT_PASSED_CLEAR_MARGIN_M`, que l'utilisateur s'écarte fortement du
 *   tracé, ou que le signal GPS est perdu (`signalLost: true`).
 */
export class WaypointAlertController {
  private firedKeys = new Set<string>();
  private activeAlert: WaypointAlertEvent | null = null;

  public get currentAlert(): WaypointAlertEvent | null {
    return this.activeAlert ? { ...this.activeAlert } : null;
  }

  public reset(): void {
    this.firedKeys.clear();
    this.activeAlert = null;
  }

  public dismissActiveAlert(): void {
    this.activeAlert = null;
  }

  public evaluate(
    projectedWaypoints: readonly ProjectedWaypoint[],
    options: WaypointAlertEvaluationOptions,
  ): WaypointAlertStateSnapshot {
    const {
      currentAlongTrackM,
      crossTrackM = 0,
      signalLost = false,
      units = 'metric',
      nowMs = Date.now(),
      approachRadiusM = WAYPOINT_APPROACH_RADIUS_M,
      arrivalRadiusM = WAYPOINT_ARRIVAL_RADIUS_M,
    } = options;

    // Disparition du signal ou absence de progression : l'état temporaire disparaît (recette K4.08)
    if (
      signalLost ||
      currentAlongTrackM === null ||
      !Number.isFinite(currentAlongTrackM) ||
      (typeof crossTrackM === 'number' && crossTrackM > 80)
    ) {
      this.activeAlert = null;
      return { activeAlert: null, newlyTriggered: [] };
    }

    // Vérifier si l'alerte active est résolue (waypoint dépassé ou trop loin)
    if (this.activeAlert) {
      const activeWp = projectedWaypoints.find((w) => w.id === this.activeAlert?.waypointId);
      if (
        !activeWp ||
        currentAlongTrackM > activeWp.alongTrackM + WAYPOINT_PASSED_CLEAR_MARGIN_M ||
        activeWp.alongTrackM - currentAlongTrackM > approachRadiusM + 20
      ) {
        this.activeAlert = null;
      }
    }

    const newlyTriggered: WaypointAlertEvent[] = [];

    for (const wp of projectedWaypoints) {
      if (wp.authorized === false) continue;
      const deltaM = wp.alongTrackM - currentAlongTrackM;

      // Waypoint déjà dépassé
      if (deltaM < -WAYPOINT_PASSED_CLEAR_MARGIN_M) continue;
      // Trop loin devant
      if (deltaM > approachRadiusM) break;

      const distanceRemainingM = Math.max(0, Math.round(deltaM));
      const stage: WaypointAlertStage | null =
        deltaM <= arrivalRadiusM
          ? 'arrival'
          : deltaM <= approachRadiusM
            ? 'approach'
            : null;

      if (!stage) continue;

      const key = `${wp.id}:${stage}`;
      if (!this.firedKeys.has(key)) {
        this.firedKeys.add(key);
        // Si on déclenche directement `arrival`, marquer aussi `approach` comme consommé
        if (stage === 'arrival') {
          this.firedKeys.add(`${wp.id}:approach`);
        }

        const spokenDist = formatSpokenDistance(distanceRemainingM, units);
        const event: WaypointAlertEvent = {
          id: `wp-alert-${wp.id}-${stage}-${nowMs}`,
          waypointId: wp.id,
          waypointName: wp.name,
          waypointKind: wp.kind,
          stage,
          distanceRemainingM,
          title:
            stage === 'arrival'
              ? `${wp.name} atteint`
              : `${wp.name} · ${formatNavigationDistance(distanceRemainingM, units)}`,
          spokenMessage:
            stage === 'arrival'
              ? `Repère atteint : ${wp.name}.`
              : `${wp.name} dans ${spokenDist}.`,
          triggeredAtMs: nowMs,
          hapticPattern: stage === 'arrival' ? 'waypoint-arrival' : 'waypoint-approach',
        };

        newlyTriggered.push(event);
        this.activeAlert = event;
      } else if (this.activeAlert && this.activeAlert.waypointId === wp.id) {
        // Mettre à jour la distance restante de l'alerte active
        this.activeAlert = {
          ...this.activeAlert,
          distanceRemainingM,
          title:
            this.activeAlert.stage === 'arrival'
              ? `${wp.name} atteint`
              : `${wp.name} · ${formatNavigationDistance(distanceRemainingM, units)}`,
        };
      }
    }

    return {
      activeAlert: this.activeAlert ? { ...this.activeAlert } : null,
      newlyTriggered,
    };
  }
}
