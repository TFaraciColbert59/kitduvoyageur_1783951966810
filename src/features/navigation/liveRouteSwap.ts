/**
 * Lot N01 — Modifier ou changer le parcours pendant l'enregistrement (K4.10).
 *
 * Invariants critiques :
 * - Conservation intégrale de la séance en cours (`sessionId`, `clientSessionId`,
 *   `startedAt`, `distanceM`, `elevGainM`, `movingS`, `splits`, `mileSplits`,
 *   `laps`, `paused`, `autoPaused`). Aucune deuxième séance n'est créée.
 * - Zéro fuite d'état de l'ancien itinéraire :
 *   - échantillons hors-trace (`offRouteSamples`) vidés ;
 *   - état hors-trace (`offRoute`, `offRouteM`, `offRouteBearing`) remis à zéro ;
 *   - recalcul en cours annulé et `RerouteState` réinitialisé ;
 *   - manœuvres, clés d'annonces vocales, waypoints projetés, alertes de
 *     waypoints et tronçons de montée/descente recalculés uniquement à partir
 *     du nouveau parcours.
 */

import type { OffRouteSample, OffRouteState } from '../explorer-v2/activity/offRoute';
import { cloneSplits } from '../explorer-v2/activity/splits';
import { isValidLngLat, routeLines, type LngLat, type RouteLine } from '../explorer-v2/geo/track';
import type { TrailRouteSnapshot } from '../explorer-v2/state/types';
import { detectClimbDescentSegments, evaluateClimbDescentCard } from './climbDescentCards';
import { createInitialRerouteState } from './rerouteEngine';
import { createInitialTurnByTurnState, evaluateTurnByTurn } from './turnByTurn';
import type {
  ActiveRecordingSnapshot,
  ClimbDescentCardState,
  NavigationUnits,
  NewRouteSelectionInput,
  ProjectedWaypoint,
  RerouteState,
  SlopeSegment,
  TurnByTurnState,
  UpcomingWaypointItem,
  WaypointAlertEvent,
} from './types';
import { computeUpcomingWaypoints, projectWaypointsOnRoute } from './waypointsAndAlerts';

export interface RouteBoundNavigationContext {
  route: TrailRouteSnapshot | null;
  lines: readonly RouteLine[];
  turnByTurn: TurnByTurnState;
  reroute: RerouteState;
  offRouteState: OffRouteState;
  offRouteSamples: OffRouteSample[];
  alongHistory: Array<{ alongTrackM: number; crossTrackM: number }>;
  projectedWaypoints: readonly ProjectedWaypoint[];
  upcomingWaypoints: readonly UpcomingWaypointItem[];
  activeWaypointAlert: WaypointAlertEvent | null;
  slopeSegments: readonly SlopeSegment[];
  climbDescentCard: ClimbDescentCardState;
  swapCount: number;
}

export interface LiveRouteSwapResult {
  /** Séance d'enregistrement intacte (même identité, mêmes cumuls, hors-trace réinitialisé). */
  recording: ActiveRecordingSnapshot & {
    route?: TrailRouteSnapshot;
    offRoute: boolean;
    offRouteM?: number;
    offRouteBearing?: number | null;
  };
  /** Nouvel état de navigation propre au nouveau parcours, sans aucun résidu de l'ancien. */
  navigation: RouteBoundNavigationContext;
}

/**
 * Crée un contexte de navigation vierge ou initialisé sur un parcours.
 */
export function createRouteBoundNavigationContext(
  routeInput: NewRouteSelectionInput | null | undefined,
  options: {
    sport?: ActiveRecordingSnapshot['sport'];
    units?: NavigationUnits;
    currentPosition?: LngLat | null;
    currentSpeedMs?: number | null;
    swapCount?: number;
  } = {},
): RouteBoundNavigationContext {
  const units = options.units ?? 'metric';
  const swapCount = options.swapCount ?? 0;

  if (!routeInput) {
    return {
      route: null,
      lines: [],
      turnByTurn: createInitialTurnByTurnState([], [], 'free-recording'),
      reroute: createInitialRerouteState(),
      offRouteState: { offRoute: false, distanceM: 0, outSinceS: 0 },
      offRouteSamples: [],
      alongHistory: [],
      projectedWaypoints: [],
      upcomingWaypoints: [],
      activeWaypointAlert: null,
      slopeSegments: [],
      climbDescentCard: evaluateClimbDescentCard(null, null, { units }),
      swapCount,
    };
  }

  const routeSnapshot: TrailRouteSnapshot = {
    id: routeInput.id,
    name: routeInput.name,
    geojson: routeInput.status === 'ready' ? routeInput.geojson : null,
    status: routeInput.status,
  };

  const lines = routeInput.status === 'ready' ? routeLines(routeInput.geojson) : [];
  if (routeInput.status !== 'ready' || lines.length === 0) {
    const effectiveStatus = routeInput.status === 'loading' ? 'loading' : 'unavailable';
    return {
      route: { ...routeSnapshot, status: effectiveStatus },
      lines: [],
      turnByTurn: createInitialTurnByTurnState([], [], `${routeInput.id}:${effectiveStatus}`),
      reroute: createInitialRerouteState(),
      offRouteState: { offRoute: false, distanceM: 0, outSinceS: 0 },
      offRouteSamples: [],
      alongHistory: [],
      projectedWaypoints: [],
      upcomingWaypoints: [],
      activeWaypointAlert: null,
      slopeSegments: [],
      climbDescentCard: evaluateClimbDescentCard(null, null, { units }),
      swapCount,
    };
  }

  let turnByTurn = createInitialTurnByTurnState(
    lines,
    routeInput.preloadedManeuvers,
    `${routeInput.id}:rev:${swapCount}`,
  );

  const projectedWaypoints = projectWaypointsOnRoute(routeInput.waypoints ?? [], lines, {
    sport: options.sport ?? null,
  });

  const slopeSegments = routeInput.elevationProfile
    ? detectClimbDescentSegments(routeInput.elevationProfile)
    : [];

  let alongHistory: Array<{ alongTrackM: number; crossTrackM: number }> = [];
  if (options.currentPosition && isValidLngLat(options.currentPosition)) {
    turnByTurn = evaluateTurnByTurn(options.currentPosition, lines, turnByTurn, {
      units,
      alongHistory: [],
      isOffRoute: false,
    });
    if (turnByTurn.progress) {
      alongHistory = [
        {
          alongTrackM: turnByTurn.progress.alongTrackM,
          crossTrackM: turnByTurn.progress.crossTrackM,
        },
      ];
    }
  }

  const currentAlongM = turnByTurn.progress?.alongTrackM ?? 0;
  const upcomingWaypoints = computeUpcomingWaypoints(projectedWaypoints, currentAlongM, {
    units,
    currentSpeedMs: options.currentSpeedMs ?? null,
  });

  const climbDescentCard = routeInput.elevationProfile
    ? evaluateClimbDescentCard(slopeSegments, currentAlongM, { units })
    : evaluateClimbDescentCard(null, null, { units });

  return {
    route: routeSnapshot,
    lines,
    turnByTurn,
    reroute: createInitialRerouteState(),
    offRouteState: {
      offRoute: false,
      distanceM: turnByTurn.progress ? Math.round(turnByTurn.progress.crossTrackM) : 0,
      outSinceS: 0,
    },
    offRouteSamples: [],
    alongHistory,
    projectedWaypoints,
    upcomingWaypoints,
    activeWaypointAlert: null,
    slopeSegments,
    climbDescentCard,
    swapCount,
  };
}

/**
 * Remplace ou modifie le parcours en cours d'enregistrement (`K4.10`) sans
 * interrompre la session GPS ni laisser fuiter le moindre état de l'ancien tracé.
 */
export function swapRouteDuringRecording(
  recording: ActiveRecordingSnapshot,
  previousNavigation: RouteBoundNavigationContext | null | undefined,
  newRouteInput: NewRouteSelectionInput | null,
  options: {
    units?: NavigationUnits;
    currentPosition?: LngLat | null;
    currentSpeedMs?: number | null;
  } = {},
): LiveRouteSwapResult {
  const nextSwapCount = (previousNavigation?.swapCount ?? 0) + 1;

  const navigation = createRouteBoundNavigationContext(newRouteInput, {
    sport: recording.sport,
    units: options.units,
    currentPosition: options.currentPosition,
    currentSpeedMs: options.currentSpeedMs,
    swapCount: nextSwapCount,
  });

  return {
    recording: {
      sessionId: recording.sessionId,
      clientSessionId: recording.clientSessionId,
      sport: recording.sport,
      ...(recording.selection ? { selection: { ...recording.selection } } : {}),
      startedAt: recording.startedAt,
      paused: recording.paused,
      autoPaused: recording.autoPaused,
      distanceM: recording.distanceM,
      elevGainM: recording.elevGainM,
      movingS: recording.movingS,
      splits: cloneSplits(recording.splits),
      mileSplits: cloneSplits(recording.mileSplits),
      laps: cloneSplits(recording.laps),
      ...(navigation.route ? { route: navigation.route } : {}),
      offRoute: false,
      offRouteM: undefined,
      offRouteBearing: null,
    },
    navigation,
  };
}
