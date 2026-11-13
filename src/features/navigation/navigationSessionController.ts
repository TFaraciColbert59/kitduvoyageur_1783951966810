/**
 * Lot N01 — Orchestrateur complet de session de navigation (`NavigationSessionController`).
 *
 * Ce contrôleur unifie l'ensemble des briques du lot N01 (K4.02..K4.12, S1.06,
 * S1.07, S3.11, S3.12) pour que l'interface (`ExplorerV2.tsx`, `SheetContent.tsx`,
 * `useGpsTracker.ts`) et les ponts natifs puissent consommer un état unique,
 * synchrone ou asynchrone, sans couplage ni fuite d'état.
 */

import {
  OFF_ROUTE_SECONDS,
  OFF_ROUTE_WINDOW_MS,
  evaluateOffRoute,
  pruneOffRouteSamples,
} from '../explorer-v2/activity/offRoute';
import { autoPauseConfigForSport, type GpsFix } from '../explorer-v2/activity/tracker';
import { bearingDegrees, isValidLngLat, type LngLat } from '../explorer-v2/geo/track';
import {
  AudioGuidanceController,
  browserSpeechAdapter,
  type SpeechSynthesisAdapter,
} from './audioGuidance';
import { evaluateClimbDescentCard } from './climbDescentCards';
import {
  ScreenWakeLockController,
  browserWakeLockAdapter,
  createInitialDisplayPreferences,
  evaluateCustomFieldValues,
  resolveNavigationZoom,
  updateCustomFields,
  type WakeLockAdapter,
} from './customizableFieldsAndScreen';
import {
  buildAccessGuidancePlan,
  buildExternalNavigationLinks,
  evaluateDepartureState,
  type AccessGuidancePlan,
} from './departureAndExternalNav';
import {
  createRouteBoundNavigationContext,
  swapRouteDuringRecording,
  type LiveRouteSwapResult,
  type RouteBoundNavigationContext,
} from './liveRouteSwap';
import {
  LockScreenBridgeController,
  defaultWebNoopLockScreenBridge,
  type LockScreenActionHandlers,
  type LockScreenNativeBridgeAdapter,
} from './lockScreenLiveActivity';
import { RerouteController } from './rerouteEngine';
import { evaluateTurnByTurn } from './turnByTurn';
import type {
  ActiveRecordingSnapshot,
  ClimbDescentCardState,
  CustomFieldValue,
  CustomizableMetricKey,
  DepartureEvaluation,
  ExternalNavTravelMode,
  ExternalNavigationBundle,
  LockScreenNavigationPayload,
  MapOrientationMode,
  MapOrientationState,
  NavigationDisplayPreferences,
  NavigationUnits,
  NewRouteSelectionInput,
  QueuedAudioAnnouncement,
  RerouteProviderAdapter,
  RerouteState,
  TurnByTurnState,
  UpcomingWaypointItem,
  WakeLockState,
  WaypointAlertEvent,
} from './types';
import {
  closeOrientationSubDrawer,
  compensateDirectionForScreen,
  createInitialOrientationState,
  markUserMapPan,
  openOrientationSubDrawer,
  recenterNavigationCamera,
  setMapOrientationMode,
  updateOrientationFromMovement,
} from './unitsAndOrientation';
import { WaypointAlertController, computeUpcomingWaypoints } from './waypointsAndAlerts';

export interface NavigationSessionControllerOptions {
  recording: ActiveRecordingSnapshot;
  route?: NewRouteSelectionInput | null;
  units?: NavigationUnits;
  northUp?: boolean;
  online?: boolean;
  rerouteProvider?: RerouteProviderAdapter;
  speechAdapter?: SpeechSynthesisAdapter;
  wakeLockAdapter?: WakeLockAdapter;
  lockScreenBridge?: LockScreenNativeBridgeAdapter;
  lockScreenHandlers?: LockScreenActionHandlers;
}

export interface NavigationTickResult {
  recording: ActiveRecordingSnapshot & {
    offRoute: boolean;
    offRouteM?: number;
    offRouteBearing?: number | null;
  };
  turnByTurn: TurnByTurnState;
  reroute: RerouteState;
  orientation: MapOrientationState;
  upcomingWaypoints: readonly UpcomingWaypointItem[];
  activeWaypointAlert: WaypointAlertEvent | null;
  climbDescentCard: ClimbDescentCardState;
  customFields: readonly CustomFieldValue[];
  targetZoom: number;
  wakeLock: WakeLockState;
  lockScreenPayload: LockScreenNavigationPayload;
  spokenAnnouncements: readonly QueuedAudioAnnouncement[];
}

export class NavigationSessionController {
  private recording: ActiveRecordingSnapshot;
  private navContext: RouteBoundNavigationContext;
  private units: NavigationUnits;
  private online: boolean;
  private orientationState: MapOrientationState;
  private displayPrefs: NavigationDisplayPreferences;
  private rerouteController: RerouteController;
  private waypointAlertController: WaypointAlertController;
  public readonly audioController: AudioGuidanceController;
  public readonly wakeLockController: ScreenWakeLockController;
  public readonly lockScreenController: LockScreenBridgeController;
  private rerouteProvider?: RerouteProviderAdapter;
  private lastFix: GpsFix | null = null;

  constructor(options: NavigationSessionControllerOptions) {
    this.recording = { ...options.recording };
    this.units = options.units ?? 'metric';
    this.online = options.online ?? true;
    this.rerouteProvider = options.rerouteProvider;

    this.orientationState = createInitialOrientationState(options.northUp ?? false, 0);
    this.displayPrefs = createInitialDisplayPreferences(
      options.recording.sport,
      options.recording.selection,
    );
    this.rerouteController = new RerouteController();
    this.waypointAlertController = new WaypointAlertController();
    this.audioController = new AudioGuidanceController(
      options.speechAdapter ?? browserSpeechAdapter,
    );
    this.wakeLockController = new ScreenWakeLockController(
      options.wakeLockAdapter ?? browserWakeLockAdapter,
    );
    this.lockScreenController = new LockScreenBridgeController(
      options.lockScreenBridge ?? defaultWebNoopLockScreenBridge,
      options.lockScreenHandlers ?? {},
    );

    this.navContext = createRouteBoundNavigationContext(options.route ?? null, {
      sport: options.recording.sport,
      units: this.units,
    });
  }

  public get currentRecording(): ActiveRecordingSnapshot {
    return { ...this.recording };
  }

  public get currentNavigationContext(): RouteBoundNavigationContext {
    return this.navContext;
  }

  public get currentOrientation(): MapOrientationState {
    return { ...this.orientationState };
  }

  public get currentDisplayPreferences(): NavigationDisplayPreferences {
    return {
      ...this.displayPrefs,
      fields: [...this.displayPrefs.fields],
    };
  }

  /** Évalue les options de départ (`K4.03`) depuis la position donnée. */
  public evaluateDeparture(userPosition: LngLat | null | undefined): DepartureEvaluation {
    return evaluateDepartureState(userPosition, this.navContext.lines);
  }

  /** Construit un plan d'accès vers le départ ou le point de reprise (`K4.03`). */
  public async planAccessToRoute(
    userPosition: LngLat,
    choice: 'guide_to_start' | 'guide_to_nearest_point',
    signal?: AbortSignal,
  ): Promise<AccessGuidancePlan> {
    const evalState = this.evaluateDeparture(userPosition);
    return buildAccessGuidancePlan(evalState, userPosition, choice, {
      online: this.online,
      sport: this.recording.sport,
      providerAdapter: this.rerouteProvider,
      signal,
    });
  }

  /** Génère les liens de navigation routière externe jusqu'au départ (`S3.12`). */
  public getExternalRoadNavigationLinks(
    mode: ExternalNavTravelMode = 'driving',
  ): ExternalNavigationBundle {
    const evalState = this.evaluateDeparture(null);
    if (!evalState.startPosition) {
      return buildExternalNavigationLinks(null);
    }
    return buildExternalNavigationLinks({
      lng: evalState.startPosition[0],
      lat: evalState.startPosition[1],
      label: this.navContext.route?.name ?? 'Départ du parcours',
      mode,
    });
  }

  /** Change les unités utilisateur (`metric` | `imperial`) à la volée. */
  public setUnits(units: NavigationUnits): void {
    this.units = units;
  }

  /** Met à jour l'état de connectivité réseau (`online`). */
  public setOnline(online: boolean): void {
    this.online = online;
  }

  /** Change le mode d'orientation (`K4.06` : `'north-up'` vs `'course-up'`). */
  public setOrientationMode(mode: MapOrientationMode): MapOrientationState {
    this.orientationState = setMapOrientationMode(this.orientationState, mode);
    return this.currentOrientation;
  }

  public openOrientationSettings(parentContext: {
    sheet: string;
    detent: string;
    tab: number;
  }): MapOrientationState {
    this.orientationState = openOrientationSubDrawer(this.orientationState, parentContext);
    return this.currentOrientation;
  }

  public closeOrientationSettings(): {
    state: MapOrientationState;
    restoredContext: { sheet: string; detent: string; tab: number } | null;
  } {
    const res = closeOrientationSubDrawer(this.orientationState);
    this.orientationState = res.state;
    return res;
  }

  public onUserMapPan(currentMapBearingDeg?: number | null): MapOrientationState {
    this.orientationState = markUserMapPan(this.orientationState, currentMapBearingDeg);
    return this.currentOrientation;
  }

  public recenterCamera(): MapOrientationState {
    this.orientationState = recenterNavigationCamera(this.orientationState);
    return this.currentOrientation;
  }

  /** Met à jour les champs personnalisables (`K4.11`). */
  public setCustomFields(fields: readonly CustomizableMetricKey[]): NavigationDisplayPreferences {
    this.displayPrefs = updateCustomFields(this.displayPrefs, fields);
    return this.currentDisplayPreferences;
  }

  public setAutoZoom(enabled: boolean, manualZoomOverride: number | null = null): void {
    this.displayPrefs = {
      ...this.displayPrefs,
      autoZoomEnabled: enabled,
      manualZoomOverride,
    };
  }

  /**
   * Remplace ou modifie le parcours en cours d'enregistrement (`K4.10`) :
   * conserve la séance GPS et purge intégralement l'état de l'ancien tracé.
   */
  public changeRouteDuringRecording(
    newRoute: NewRouteSelectionInput | null,
  ): LiveRouteSwapResult {
    this.rerouteController.reset();
    this.waypointAlertController.reset();
    this.audioController.resetRouteAnnouncements();

    const currentPos: LngLat | null =
      this.lastFix && isValidLngLat([this.lastFix.lng, this.lastFix.lat])
        ? [this.lastFix.lng, this.lastFix.lat]
        : null;

    const swapped = swapRouteDuringRecording(this.recording, this.navContext, newRoute, {
      units: this.units,
      currentPosition: currentPos,
      currentSpeedMs: this.lastFix?.speed ?? null,
    });

    this.recording = swapped.recording;
    this.navContext = swapped.navigation;
    return swapped;
  }

  /**
   * Traite un nouveau point GPS accepté et synchronise toutes les surfaces N01 :
   * virage par virage, hors-trace/recalcul, waypoints/alertes, montée/descente,
   * orientation de carte, champs personnalisés, audio/TTS et Live Activity.
   */
  public async onAcceptedFix(
    fix: GpsFix,
    updatedMetrics: Partial<
      Pick<
        ActiveRecordingSnapshot,
        'distanceM' | 'elevGainM' | 'movingS' | 'paused' | 'autoPaused' | 'splits' | 'mileSplits' | 'laps'
      >
    > = {},
  ): Promise<NavigationTickResult> {
    const prevFix = this.lastFix;
    this.lastFix = fix;

    this.recording = {
      ...this.recording,
      ...updatedMetrics,
    };

    const position: LngLat = [fix.lng, fix.lat];
    const spokenAnnouncements: QueuedAudioAnnouncement[] = [];
    const nowMs = fix.t;

    // Calcul du cap GPS entre deux fixes si non fourni
    let gpsHeadingDeg: number | null = null;
    if (prevFix) {
      const b = bearingDegrees([prevFix.lng, prevFix.lat], position);
      if (Number.isFinite(b)) gpsHeadingDeg = b;
    }

    // 1. Évaluation de la progression sur le tracé et des instructions virage par virage (K4.02, S3.11)
    let turnByTurn = this.navContext.turnByTurn;
    let offRouteState = this.navContext.offRouteState;
    let offRouteSamples = this.navContext.offRouteSamples;
    let rerouteState = this.navContext.reroute;
    let alongHistory = this.navContext.alongHistory;

    if (this.navContext.lines.length > 0) {
      turnByTurn = evaluateTurnByTurn(position, this.navContext.lines, turnByTurn, {
        units: this.units,
        alongHistory,
        isOffRoute: offRouteState.offRoute,
      });

      if (turnByTurn.progress) {
        alongHistory = [
          ...alongHistory.slice(-10),
          {
            alongTrackM: turnByTurn.progress.alongTrackM,
            crossTrackM: turnByTurn.progress.crossTrackM,
          },
        ];

        // 2. Détection hors-itinéraire avec hystérésis (40 m / 15 s, retour < 25 m)
        offRouteSamples = [
          ...offRouteSamples,
          {
            t: fix.t,
            distanceM: turnByTurn.progress.crossTrackM,
            accuracyM: fix.acc,
          },
        ];
        const maxGapS = autoPauseConfigForSport(this.recording.sport).maxFixGapS;
        const windowMs = Math.max(OFF_ROUTE_WINDOW_MS, (maxGapS + OFF_ROUTE_SECONDS) * 1000);
        offRouteSamples = pruneOffRouteSamples(offRouteSamples, windowMs);
        const wasOffRoute = offRouteState.offRoute;
        offRouteState = evaluateOffRoute(offRouteSamples, offRouteState);

        // Annonce audio de sortie ou retour sur trace
        if (offRouteState.offRoute && !wasOffRoute) {
          const a = this.audioController.dispatchAnnouncement(
            {
              dedupeKey: `offroute:enter:${Math.floor(fix.t / 15000)}`,
              priority: 1,
              category: 'off-route',
              text: 'Hors itinéraire.',
            },
            nowMs,
          );
          if (a) spokenAnnouncements.push(a);
        } else if (!offRouteState.offRoute && wasOffRoute) {
          const a = this.audioController.dispatchAnnouncement(
            {
              dedupeKey: `offroute:back:${Math.floor(fix.t / 15000)}`,
              priority: 1,
              category: 'off-route',
              text: 'De retour sur la trace.',
            },
            nowMs,
          );
          if (a) spokenAnnouncements.push(a);
        }
      }
    }

    // 3. Mise à jour de l'orientation de carte (K4.06)
    this.orientationState = updateOrientationFromMovement(this.orientationState, {
      gpsHeadingDeg,
      routeBearingDeg: turnByTurn.progress?.segmentBearingDeg ?? null,
      speedMs: fix.speed ?? 0,
    });

    // 4. Recalcul en ligne ou indication de retour hors ligne (K4.05)
    if (this.navContext.lines.length > 0) {
      rerouteState = await this.rerouteController.evaluate({
        userPosition: position,
        offRoute: offRouteState.offRoute,
        lines: this.navContext.lines,
        sport: this.recording.sport,
        online: this.online,
        nowMs,
        mapBearingDeg: this.orientationState.cameraBearingDeg,
        units: this.units,
        providerAdapter: this.rerouteProvider,
      });
    }

    // 5. Annonce vocale virage par virage (K4.02, S3.11)
    if (turnByTurn.shouldSpeak && turnByTurn.spokenInstruction) {
      const a = this.audioController.dispatchAnnouncement(
        {
          dedupeKey: `turn:${turnByTurn.nextManeuver?.id ?? 'rev'}:${turnByTurn.stage}`,
          priority: 2,
          category: 'turn-by-turn',
          text: turnByTurn.spokenInstruction,
        },
        nowMs,
      );
      if (a) spokenAnnouncements.push(a);
    }

    // 6. Prochains waypoints « À venir » (K4.07) et alertes aux waypoints (K4.08)
    const currentAlongM = turnByTurn.progress?.alongTrackM ?? null;
    const upcomingWaypoints = computeUpcomingWaypoints(
      this.navContext.projectedWaypoints,
      currentAlongM,
      {
        units: this.units,
        currentSpeedMs: fix.speed ?? null,
      },
    );

    const wpAlertEval = this.waypointAlertController.evaluate(
      this.navContext.projectedWaypoints,
      {
        currentAlongTrackM: currentAlongM,
        crossTrackM: turnByTurn.progress?.crossTrackM ?? 0,
        signalLost: false,
        units: this.units,
        nowMs,
      },
    );

    for (const wpEvent of wpAlertEval.newlyTriggered) {
      const a = this.audioController.dispatchAnnouncement(
        {
          dedupeKey: `wp:${wpEvent.waypointId}:${wpEvent.stage}`,
          priority: 3,
          category: 'waypoint',
          text: wpEvent.spokenMessage,
        },
        nowMs,
      );
      if (a) spokenAnnouncements.push(a);
    }

    // 7. Cartes de montée / descente (K4.09)
    const climbDescentCard =
      this.navContext.slopeSegments.length > 0
        ? evaluateClimbDescentCard(this.navContext.slopeSegments, currentAlongM, {
            units: this.units,
          })
        : this.navContext.climbDescentCard;

    // 8. Annonces audio pendant l'effort (S1.07)
    const effortAudio = this.audioController.evaluateEffortProgress({
      sport: this.recording.sport,
      selection: this.recording.selection,
      distanceM: this.recording.distanceM,
      movingS: this.recording.movingS,
      splits: this.recording.splits,
      mileSplits: this.recording.mileSplits,
      units: this.units,
      nowMs,
    });
    if (effortAudio) spokenAnnouncements.push(effortAudio);

    // 9. Champs personnalisables et zoom (K4.11)
    const completedLapsCount = this.recording.laps.filter((l) => l.completed).length;
    const customFields = evaluateCustomFieldValues(this.displayPrefs.fields, {
      distanceM: this.recording.distanceM,
      movingS: this.recording.movingS,
      elevGainM: this.recording.elevGainM,
      currentSpeedMs: fix.speed ?? null,
      currentAltitudeM: fix.ele ?? null,
      remainingRouteDistanceM: turnByTurn.progress?.remainingDistanceM ?? null,
      completedLapsCount,
      units: this.units,
    });

    const targetZoom = resolveNavigationZoom(this.displayPrefs, fix.speed ?? 0, 3);

    // 10. Mise à jour du contexte interne
    this.navContext = {
      ...this.navContext,
      turnByTurn,
      reroute: rerouteState,
      offRouteState,
      offRouteSamples,
      alongHistory,
      upcomingWaypoints,
      activeWaypointAlert: wpAlertEval.activeAlert,
      climbDescentCard,
    };

    const returnWorldBearing =
      rerouteState.returnBearingDeg ?? turnByTurn.progress?.returnBearingDeg ?? null;

    // 11. Synchronisation écran verrouillé / Live Activity (K4.12, S1.06)
    const lockScreenPayload = await this.lockScreenController.sync({
      clientSessionId: this.recording.clientSessionId,
      sport: this.recording.sport,
      selection: this.recording.selection,
      startedAt: this.recording.startedAt,
      distanceM: this.recording.distanceM,
      elevGainM: this.recording.elevGainM,
      movingS: this.recording.movingS,
      paused: this.recording.paused,
      autoPaused: this.recording.autoPaused,
      offRoute: offRouteState.offRoute,
      offRouteM: offRouteState.distanceM,
      units: this.units,
      nextManeuver: turnByTurn.nextManeuver,
      distanceToNextManeuverM: turnByTurn.distanceToNextM,
      audioMuted: this.audioController.preferences.channel === 'muted',
    });

    return {
      recording: {
        ...this.recording,
        offRoute: offRouteState.offRoute,
        offRouteM: offRouteState.distanceM,
        offRouteBearing: compensateDirectionForScreen(
          returnWorldBearing,
          this.orientationState,
        ),
      },
      turnByTurn,
      reroute: rerouteState,
      orientation: this.currentOrientation,
      upcomingWaypoints,
      activeWaypointAlert: wpAlertEval.activeAlert,
      climbDescentCard,
      customFields,
      targetZoom,
      wakeLock: this.wakeLockController.state,
      lockScreenPayload,
      spokenAnnouncements,
    };
  }
}
