'use client';

/**
 * Pont React/Runtime du lot N01 (guidage, recalcul, boussole, audio, champs,
 * écran maintenu et Live Activity) dans Explorer v2.
 *
 * Ce hook relie `NavigationSessionController` au store `useExplorerStore`,
 * à l'API `/api/route` (K4.05), aux paquets hors ligne vérifiés N02 (K4.02,
 * S3.11, K4.17), à la synthèse vocale navigateur, au Wake Lock API (K4.11) et
 * aux préférences persistantes (K4.06, K4.11).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GpsFix } from '../activity/tracker';
import type { GeoCollection, PoiItem, RouteItem } from '../data/hooks';
import { routeLines, type LngLat } from '../geo/track';
import type { ActivityState, Sport, TrailRouteSnapshot } from '../state/types';
import { getOfflineRuntimeStore } from '@/features/offline/offlineRuntimeStore';
import {
  NavigationSessionController,
  browserSpeechAdapter,
  buildAccessGuidancePlan,
  buildExternalNavigationLinks,
  buildLockScreenNavigationPayload,
  createDefaultAudioPreferences,
  createInitialDisplayPreferences,
  evaluateClimbDescentCard,
  evaluateCustomFieldValues,
  evaluateDepartureState,
  evaluateTurnByTurn,
  createInitialTurnByTurnState,
  computeUpcomingWaypoints,
  projectWaypointsOnRoute,
  createInitialRerouteState,
  resolveNavigationZoom,
  type AccessGuidancePlan,
  type ActiveRecordingSnapshot,
  type AudioGuidancePreferences,
  type ClimbDescentCardState,
  type CustomFieldValue,
  type DepartureActionKind,
  type DepartureEvaluation,
  type ExternalNavigationBundle,
  type LockScreenCapability,
  type LockScreenNavigationPayload,
  type MapOrientationMode,
  type MapOrientationState,
  type NavigationDisplayPreferences,
  type NavigationUnits,
  type NavigationWaypointInput,
  type NewRouteSelectionInput,
  type RerouteProviderAdapter,
  type RerouteState,
  type TurnByTurnState,
  type UpcomingWaypointItem,
  type WakeLockState,
  type WaypointAlertEvent,
} from '@/features/navigation';
import type { SlopeProfilePoint } from '../map/slope';

const PREFS_STORAGE_KEY = 'lkdv.nav.prefs.v1';

interface StoredNavigationPrefs {
  orientationMode?: MapOrientationMode;
  audioPrefs?: Partial<AudioGuidancePreferences>;
  displayPrefs?: Partial<Pick<NavigationDisplayPreferences, 'fields' | 'autoZoomEnabled' | 'keepScreenAwake'>>;
}

function readStoredPrefs(): StoredNavigationPrefs {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredNavigationPrefs;
  } catch {
    return {};
  }
}

function writeStoredPrefs(next: StoredNavigationPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = readStoredPrefs();
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ ...prev, ...next }));
  } catch {
    /* mode privé ou quota */
  }
}

function toApiRouteSport(sport: Sport): 'route' | 'marche' {
  return sport === 'velo' ? 'route' : 'marche';
}

function parseLegGeometry(geometry: unknown): [number, number][] {
  if (Array.isArray(geometry)) {
    return geometry.filter(
      (pt): pt is [number, number] =>
        Array.isArray(pt) &&
        pt.length >= 2 &&
        typeof pt[0] === 'number' &&
        typeof pt[1] === 'number' &&
        Number.isFinite(pt[0]) &&
        Number.isFinite(pt[1]),
    );
  }
  if (geometry && typeof geometry === 'object') {
    const coords = (geometry as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coords)) return parseLegGeometry(coords);
  }
  return [];
}

/** Adaptateur réseau vers `GET /api/route` pour le recalcul connecté (K4.05). */
export const explorerRerouteProvider: RerouteProviderAdapter = async (
  from,
  to,
  sport,
  signal,
) => {
  try {
    const pointsParam = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `/api/route?points=${encodeURIComponent(pointsParam)}&sport=${toApiRouteSport(sport)}`;
    const res = await fetch(url, { signal, cache: 'no-store' });
    if (res.status === 429) {
      return { leg: null, reason: 'rate_limited' };
    }
    const body = (await res.json().catch(() => null)) as {
      status?: string;
      reason?: string;
      provider?: string | null;
      legs?: Array<{
        distanceKm?: number;
        durationMin?: number;
        distanceM?: number;
        durationS?: number;
        geometry?: unknown;
      }>;
    } | null;

    if (!res.ok || !body || body.status !== 'ok' || !Array.isArray(body.legs) || body.legs.length === 0) {
      if (body?.reason === 'off_network') return { leg: null, reason: 'off_network' };
      return { leg: null, reason: 'provider_unavailable' };
    }

    const firstLeg = body.legs[0];
    const coords = parseLegGeometry(firstLeg.geometry);
    if (coords.length < 2) {
      return { leg: null, reason: 'provider_unavailable' };
    }

    const distanceM =
      typeof firstLeg.distanceM === 'number'
        ? firstLeg.distanceM
        : typeof firstLeg.distanceKm === 'number'
          ? firstLeg.distanceKm * 1000
          : 0;
    const durationS =
      typeof firstLeg.durationS === 'number'
        ? firstLeg.durationS
        : typeof firstLeg.durationMin === 'number'
          ? firstLeg.durationMin * 60
          : 0;

    return {
      leg: {
        distanceM,
        durationS,
        geometry: coords,
        provider: body.provider ?? 'geoapify',
      },
      reason: null,
    };
  } catch {
    return { leg: null, reason: 'provider_unavailable' };
  }
};

function toWaypoints(pois: readonly PoiItem[]): NavigationWaypointInput[] {
  return pois.map((poi) => ({
    id: poi.id,
    name: poi.name,
    kind: (poi.kind as NavigationWaypointInput['kind']) || 'waypoint',
    lat: poi.lat,
    lng: poi.lon,
    eleM: poi.ele_m,
    description: poi.subtype || null,
    authorized: true,
  }));
}

function toRecordingSnapshot(activity: ActivityState): ActiveRecordingSnapshot {
  return {
    sessionId: null,
    sport: activity.sport,
    selection: activity.selection,
    clientSessionId: activity.clientSessionId ?? `local-${activity.startedAt}`,
    startedAt: activity.startedAt,
    paused: activity.paused,
    autoPaused: Boolean(activity.autoPaused),
    distanceM: activity.distanceM,
    elevGainM: activity.elevGainM,
    movingS: activity.movingS,
    splits: activity.splits ?? [],
    mileSplits: activity.mileSplits ?? [],
    laps: activity.laps ?? [],
  };
}

function detectWebLockScreenCapability(): LockScreenCapability {
  const cap =
    typeof window !== 'undefined'
      ? (window as unknown as { Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean } }).Capacitor
      : undefined;
  const rawPlatform = cap?.getPlatform?.();
  const platform: LockScreenCapability['platform'] =
    rawPlatform === 'ios' ? 'ios' : rawPlatform === 'android' ? 'android' : 'web';
  return {
    platform,
    supported: platform === 'ios' || platform === 'android',
    liveActivityAvailable: platform === 'ios',
    dynamicIslandAvailable: platform === 'ios',
    ongoingNotificationAvailable: platform === 'android',
    reason: platform === 'web' ? 'web_environment' : null,
  };
}

function buildRouteSelectionInput(
  route: { id: string | number; name?: string | null; geojson?: unknown | null; status?: 'loading' | 'ready' | 'unavailable' } | null | undefined,
  waypoints: readonly NavigationWaypointInput[],
  elevationProfile?: readonly SlopeProfilePoint[],
): NewRouteSelectionInput | null {
  if (!route) return null;
  const routeId = String(route.id);
  const offlineData = getOfflineRuntimeStore().getInstalledRouteNavigationData(routeId);
  const effectiveGeojson = route.geojson ?? offlineData?.geojson ?? null;
  const status =
    route.status ??
    (effectiveGeojson && routeLines(effectiveGeojson).length > 0 ? 'ready' : 'unavailable');
  return {
    id: routeId,
    name: route.name ?? offlineData?.name ?? null,
    geojson: effectiveGeojson,
    status,
    elevationProfile: elevationProfile ?? offlineData?.elevationProfile,
    waypoints,
  };
}

export interface NavigationGuidanceUiState {
  turnByTurn: TurnByTurnState;
  reroute: RerouteState;
  detourGeoJson: GeoCollection | null;
  accessRouteGeoJson: GeoCollection | null;
  orientation: MapOrientationState;
  upcomingWaypoints: readonly UpcomingWaypointItem[];
  activeWaypointAlert: WaypointAlertEvent | null;
  climbCard: ClimbDescentCardState;
  audioPrefs: AudioGuidancePreferences;
  displayPrefs: NavigationDisplayPreferences;
  customFieldValues: readonly CustomFieldValue[];
  wakeLock: WakeLockState;
  targetZoom: number | null;
  lockScreenPayload: LockScreenNavigationPayload | null;
  lockScreenCapability: LockScreenCapability;
  departureEvaluation: DepartureEvaluation;
  externalLinks: ExternalNavigationBundle;
  accessPlan: AccessGuidancePlan | null;
  availableSwapRoutes: readonly NewRouteSelectionInput[];
}

export interface UseNavigationGuidanceParams {
  activity: ActivityState | undefined;
  trailRoute: TrailRouteSnapshot | undefined;
  routes: readonly RouteItem[];
  pois: readonly PoiItem[];
  me: { lat: number; lng: number } | null;
  center: [number, number];
  units: NavigationUnits;
  northUp: boolean;
  online: boolean;
  slopeProfile?: readonly SlopeProfilePoint[];
  onNorthUpSync?: (northUp: boolean) => void;
  onSwapActiveRoute?: (nextRoute: TrailRouteSnapshot) => void;
  onApplyCameraBearing?: (northUp: boolean, bearingDeg?: number) => void;
  onApplyAutoZoom?: (zoom: number) => void;
  onPauseOrResumeActivity?: () => void;
  onMarkLap?: () => void;
}

export function useNavigationGuidance({
  activity,
  trailRoute,
  routes,
  pois,
  me,
  center,
  units,
  northUp,
  online,
  slopeProfile,
  onNorthUpSync,
  onSwapActiveRoute,
  onApplyCameraBearing,
  onApplyAutoZoom,
  onPauseOrResumeActivity,
  onMarkLap,
}: UseNavigationGuidanceParams) {
  const controllerRef = useRef<NavigationSessionController | null>(null);
  const storedPrefsRef = useRef<StoredNavigationPrefs>(readStoredPrefs());
  const sessionKeyRef = useRef<string | null>(null);

  const waypoints = useMemo(() => toWaypoints(pois), [pois]);
  const targetRouteSource = activity?.route ?? trailRoute ?? null;
  const activeRouteInput = useMemo(
    () => buildRouteSelectionInput(targetRouteSource, waypoints, slopeProfile),
    [targetRouteSource, waypoints, slopeProfile],
  );

  const availableSwapRoutes = useMemo<NewRouteSelectionInput[]>(() => {
    const out: NewRouteSelectionInput[] = [];
    for (const r of routes) {
      const converted = buildRouteSelectionInput(r, waypoints);
      if (converted) out.push(converted);
    }
    if (trailRoute && !out.some((item) => item.id === trailRoute.id)) {
      const armed = buildRouteSelectionInput(trailRoute, waypoints, slopeProfile);
      if (armed) out.unshift(armed);
    }
    if (activity?.route && !out.some((item) => item.id === activity.route!.id)) {
      const current = buildRouteSelectionInput(activity.route, waypoints, slopeProfile);
      if (current) out.unshift(current);
    }
    return out;
  }, [routes, trailRoute, activity?.route, waypoints, slopeProfile]);

  const [audioPrefs, setAudioPrefsState] = useState<AudioGuidancePreferences>(() => ({
    ...createDefaultAudioPreferences(),
    ...(storedPrefsRef.current.audioPrefs ?? {}),
  }));

  const [displayPrefs, setDisplayPrefsState] = useState<NavigationDisplayPreferences>(() => ({
    ...createInitialDisplayPreferences(activity?.sport ?? 'rando', activity?.selection),
    ...(storedPrefsRef.current.displayPrefs ?? {}),
  }));

  const [orientation, setOrientationState] = useState<MapOrientationState>(() => {
    const mode: MapOrientationMode =
      storedPrefsRef.current.orientationMode ?? (northUp ? 'north-up' : 'course-up');
    return {
      mode,
      cameraBearingDeg: 0,
      lastValidCourseDeg: 0,
      userPanned: false,
      returnSheetContext: null,
    };
  });

  const [turnByTurn, setTurnByTurn] = useState<TurnByTurnState>(() =>
    createInitialTurnByTurnState([]),
  );
  const [reroute, setReroute] = useState<RerouteState>(() => createInitialRerouteState());
  const [upcomingWaypoints, setUpcomingWaypoints] = useState<readonly UpcomingWaypointItem[]>([]);
  const [activeWaypointAlert, setActiveWaypointAlert] = useState<WaypointAlertEvent | null>(null);
  const [climbCard, setClimbCard] = useState<ClimbDescentCardState>(() =>
    evaluateClimbDescentCard([], null, { units }),
  );
  const [wakeLock, setWakeLock] = useState<WakeLockState>({
    enabled: displayPrefs.keepScreenAwake,
    supported: typeof navigator !== 'undefined' && 'wakeLock' in navigator,
    active: false,
    reason: null,
  });
  const [targetZoom, setTargetZoom] = useState<number | null>(null);
  const [lastSpeedMs, setLastSpeedMs] = useState<number | null>(null);
  const [lastAltitudeM, setLastAltitudeM] = useState<number | null>(null);
  const [accessPlan, setAccessPlan] = useState<AccessGuidancePlan | null>(null);

  const lockScreenCapability = useMemo<LockScreenCapability>(
    () => detectWebLockScreenCapability(),
    [],
  );

  // Restaure l'orientation persistée dans le store au montage (K4.06)
  useEffect(() => {
    const savedMode = storedPrefsRef.current.orientationMode;
    if (savedMode && onNorthUpSync) {
      onNorthUpSync(savedMode === 'north-up');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Instancie ou réinitialise le contrôleur lorsqu'une séance démarre ou change d'ID
  useEffect(() => {
    if (!activity) {
      if (controllerRef.current) {
        void controllerRef.current.wakeLockController.release();
        controllerRef.current = null;
      }
      sessionKeyRef.current = null;
      setAccessPlan(null);
      setReroute(createInitialRerouteState());
      setTurnByTurn(createInitialTurnByTurnState([]));
      return;
    }

    const key = activity.clientSessionId ?? String(activity.startedAt);
    if (sessionKeyRef.current === key && controllerRef.current) {
      controllerRef.current.setUnits(units);
      controllerRef.current.setOnline(online);
      return;
    }

    sessionKeyRef.current = key;
    const ctrl = new NavigationSessionController({
      recording: toRecordingSnapshot(activity),
      route: activeRouteInput,
      units,
      northUp: (storedPrefsRef.current.orientationMode ?? (northUp ? 'north-up' : 'course-up')) === 'north-up',
      online,
      rerouteProvider: explorerRerouteProvider,
      speechAdapter: browserSpeechAdapter,
      lockScreenHandlers: {
        onPause: () => onPauseOrResumeActivity?.(),
        onResume: () => onPauseOrResumeActivity?.(),
        onMarkLap: () => onMarkLap?.(),
        onToggleMute: () => {
          const current = ctrl.audioController.preferences.channel;
          const nextChannel = current === 'muted' ? 'all' : 'muted';
          ctrl.audioController.updatePreferences({ channel: nextChannel });
          setAudioPrefsState(ctrl.audioController.preferences);
          writeStoredPrefs({ audioPrefs: ctrl.audioController.preferences });
        },
      },
    });
    ctrl.audioController.updatePreferences(audioPrefs);
    ctrl.setCustomFields(displayPrefs.fields);
    ctrl.setAutoZoom(displayPrefs.autoZoomEnabled, displayPrefs.manualZoomOverride);
    ctrl.setOrientationMode(orientation.mode);
    controllerRef.current = ctrl;

    const ctx = ctrl.currentNavigationContext;
    setTurnByTurn(ctx.turnByTurn);
    setReroute(ctx.reroute);
    setUpcomingWaypoints(ctx.upcomingWaypoints);
    setClimbCard(ctx.climbDescentCard);

    if (displayPrefs.keepScreenAwake) {
      void ctrl.wakeLockController.acquire().then(setWakeLock).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity?.clientSessionId, activity?.startedAt, units, online]);

  // Met à jour la géométrie/waypoints si l'itinéraire de la séance termine son chargement
  const routeSyncKey = activeRouteInput
    ? `${activeRouteInput.id}:${activeRouteInput.status}:${activeRouteInput.waypoints?.length ?? 0}:${activeRouteInput.elevationProfile?.length ?? 0}`
    : 'none';
  useEffect(() => {
    const ctrl = controllerRef.current;
    if (!ctrl || !activity) return;
    if (activeRouteInput && ctrl.currentNavigationContext.route?.id === activeRouteInput.id) {
      const needsGeometry =
        ctrl.currentNavigationContext.lines.length === 0 && activeRouteInput.status === 'ready';
      if (needsGeometry || (activeRouteInput.waypoints?.length ?? 0) > 0) {
        const res = ctrl.changeRouteDuringRecording(activeRouteInput);
        setTurnByTurn(res.navigation.turnByTurn);
        setUpcomingWaypoints(res.navigation.upcomingWaypoints);
        setClimbCard(res.navigation.climbDescentCard);
      }
    } else if (activeRouteInput && !ctrl.currentNavigationContext.route) {
      const res = ctrl.changeRouteDuringRecording(activeRouteInput);
      setTurnByTurn(res.navigation.turnByTurn);
      setUpcomingWaypoints(res.navigation.upcomingWaypoints);
      setClimbCard(res.navigation.climbDescentCard);
    }
  }, [routeSyncKey, activity, activeRouteInput]);

  // Synchronise les préférences hors séance également (aperçu pré-départ)
  useEffect(() => {
    if (activity || !activeRouteInput?.geojson) return;
    const lines = routeLines(activeRouteInput.geojson);
    if (lines.length === 0) return;
    const refPos: LngLat = me ? [me.lng, me.lat] : center;
    const previewTbt = evaluateTurnByTurn(refPos, lines, createInitialTurnByTurnState(lines), {
      units,
      isOffRoute: false,
    });
    const hasOfflineRoutePack = Boolean(
      getOfflineRuntimeStore().getInstalledRouteNavigationData(activeRouteInput.id),
    );
    setTurnByTurn({
      ...previewTbt,
      offlineReady: hasOfflineRoutePack,
    });
    const projected = projectWaypointsOnRoute(waypoints, lines, { sport: 'rando' });
    setUpcomingWaypoints(
      computeUpcomingWaypoints(projected, previewTbt.progress?.alongTrackM ?? 0, {
        units,
        currentSpeedMs: null,
      }),
    );
  }, [activity, activeRouteInput, me, center, units, waypoints]);

  /** Point d'entrée appelé à chaque nouveau fix GPS accepté. */
  const processAcceptedFix = useCallback(
    async (fix: GpsFix, updatedActivity?: ActivityState) => {
      setLastSpeedMs(fix.speed ?? null);
      setLastAltitudeM(fix.ele ?? null);
      const ctrl = controllerRef.current;
      if (!ctrl || !updatedActivity) return;

      const tick = await ctrl.onAcceptedFix(fix, {
        distanceM: updatedActivity.distanceM,
        elevGainM: updatedActivity.elevGainM,
        movingS: updatedActivity.movingS,
        paused: updatedActivity.paused,
        autoPaused: updatedActivity.autoPaused,
        splits: updatedActivity.splits,
        mileSplits: updatedActivity.mileSplits,
        laps: updatedActivity.laps,
      });

      setTurnByTurn(tick.turnByTurn);
      setReroute(tick.reroute);
      setOrientationState(tick.orientation);
      setUpcomingWaypoints(tick.upcomingWaypoints);
      setActiveWaypointAlert(tick.activeWaypointAlert);
      setClimbCard(tick.climbDescentCard);
      setWakeLock(tick.wakeLock);
      setTargetZoom(tick.targetZoom);

      if (
        tick.orientation.mode === 'course-up' &&
        !tick.orientation.userPanned &&
        onApplyCameraBearing
      ) {
        onApplyCameraBearing(false, tick.orientation.cameraBearingDeg);
      }

      if (ctrl.currentDisplayPreferences.autoZoomEnabled && onApplyAutoZoom) {
        onApplyAutoZoom(tick.targetZoom);
      }
    },
    [onApplyCameraBearing, onApplyAutoZoom],
  );

  const setOrientationMode = useCallback(
    (mode: MapOrientationMode) => {
      writeStoredPrefs({ orientationMode: mode });
      onNorthUpSync?.(mode === 'north-up');
      if (controllerRef.current) {
        const next = controllerRef.current.setOrientationMode(mode);
        setOrientationState(next);
        onApplyCameraBearing?.(mode === 'north-up', next.cameraBearingDeg);
      } else {
        setOrientationState((prev) => ({
          ...prev,
          mode,
          cameraBearingDeg: mode === 'north-up' ? 0 : prev.lastValidCourseDeg,
          userPanned: false,
        }));
        onApplyCameraBearing?.(mode === 'north-up', mode === 'north-up' ? 0 : orientation.lastValidCourseDeg);
      }
    },
    [onNorthUpSync, onApplyCameraBearing, orientation.lastValidCourseDeg],
  );

  const recenter = useCallback(() => {
    if (controllerRef.current) {
      const next = controllerRef.current.recenterCamera();
      setOrientationState(next);
      onApplyCameraBearing?.(next.mode === 'north-up', next.cameraBearingDeg);
    } else {
      setOrientationState((prev) => ({ ...prev, userPanned: false }));
      onApplyCameraBearing?.(orientation.mode === 'north-up', orientation.cameraBearingDeg);
    }
  }, [onApplyCameraBearing, orientation.mode, orientation.cameraBearingDeg]);

  const onUserMapPan = useCallback((bearingDeg?: number | null) => {
    if (controllerRef.current) {
      const next = controllerRef.current.onUserMapPan(bearingDeg);
      setOrientationState(next);
    } else {
      setOrientationState((prev) => ({
        ...prev,
        userPanned: true,
        cameraBearingDeg: typeof bearingDeg === 'number' ? bearingDeg : prev.cameraBearingDeg,
      }));
    }
  }, []);

  const setAudioPrefs = useCallback((next: AudioGuidancePreferences) => {
    setAudioPrefsState(next);
    writeStoredPrefs({ audioPrefs: next });
    if (controllerRef.current) {
      controllerRef.current.audioController.updatePreferences(next);
    }
  }, []);

  const testVoice = useCallback(
    (text: string) => {
      if (controllerRef.current) {
        controllerRef.current.audioController.dispatchAnnouncement(
          {
            dedupeKey: `test:${Date.now()}`,
            priority: 2,
            category: 'turn-by-turn',
            text,
          },
          Date.now(),
        );
      } else {
        browserSpeechAdapter.speak(text, {
          lang: audioPrefs.lang,
          rate: audioPrefs.rate,
          pitch: audioPrefs.pitch,
        });
      }
    },
    [audioPrefs.lang, audioPrefs.rate, audioPrefs.pitch],
  );

  const setDisplayPrefs = useCallback(
    (next: NavigationDisplayPreferences) => {
      setDisplayPrefsState(next);
      writeStoredPrefs({
        displayPrefs: {
          fields: next.fields,
          autoZoomEnabled: next.autoZoomEnabled,
          keepScreenAwake: next.keepScreenAwake,
        },
      });
      if (controllerRef.current) {
        controllerRef.current.setCustomFields(next.fields);
        controllerRef.current.setAutoZoom(next.autoZoomEnabled, next.manualZoomOverride);
        if (next.keepScreenAwake) {
          void controllerRef.current.wakeLockController.acquire().then(setWakeLock).catch(() => {});
        } else {
          void controllerRef.current.wakeLockController.release().then(setWakeLock).catch(() => {});
        }
      }
      setTargetZoom(resolveNavigationZoom(next, lastSpeedMs ?? 0, 3));
    },
    [lastSpeedMs],
  );

  const swapRoute = useCallback(
    (selection: NewRouteSelectionInput) => {
      if (controllerRef.current) {
        const res = controllerRef.current.changeRouteDuringRecording(selection);
        setTurnByTurn(res.navigation.turnByTurn);
        setReroute(res.navigation.reroute);
        setUpcomingWaypoints(res.navigation.upcomingWaypoints);
        setActiveWaypointAlert(res.navigation.activeWaypointAlert);
        setClimbCard(res.navigation.climbDescentCard);
      }
      setAccessPlan(null);
      if (onSwapActiveRoute) {
        onSwapActiveRoute({
          id: selection.id,
          name: selection.name,
          geojson: selection.geojson,
          status: selection.status,
        });
      }
    },
    [onSwapActiveRoute],
  );

  const departureEvaluation = useMemo<DepartureEvaluation>(() => {
    const userPos: LngLat | null = me ? [me.lng, me.lat] : null;
    const lines = activeRouteInput?.geojson ? routeLines(activeRouteInput.geojson) : [];
    return evaluateDepartureState(userPos, lines);
  }, [me, activeRouteInput]);

  const externalLinks = useMemo<ExternalNavigationBundle>(() => {
    const start = departureEvaluation.startPosition;
    if (!start) return buildExternalNavigationLinks(null);
    return buildExternalNavigationLinks({
      lng: start[0],
      lat: start[1],
      label: activeRouteInput?.name ?? 'Départ du parcours',
      mode: activity?.sport === 'velo' ? 'bicycling' : 'driving',
    });
  }, [departureEvaluation.startPosition, activeRouteInput?.name, activity?.sport]);

  useEffect(() => {
    setAccessPlan(null);
  }, [activeRouteInput?.id]);

  const onSelectDepartureAction = useCallback(
    async (action: DepartureActionKind) => {
      if (action === 'start_at_origin' || action === 'start_here_on_route') {
        setAccessPlan(null);
        return;
      }
      if ((action === 'guide_to_start' || action === 'guide_to_nearest_point') && me) {
        const plan = await buildAccessGuidancePlan(departureEvaluation, [me.lng, me.lat], action, {
          online,
          sport: activity?.sport ?? 'rando',
          providerAdapter: explorerRerouteProvider,
        });
        setAccessPlan(plan);
      }
    },
    [me, departureEvaluation, online, activity?.sport],
  );

  const retryReroute = useCallback(async () => {
    if (!controllerRef.current || !me || !activity?.route?.geojson) return;
    await controllerRef.current.onAcceptedFix(
      {
        lat: me.lat,
        lng: me.lng,
        t: Date.now(),
        acc: 5,
        speed: lastSpeedMs,
        ele: lastAltitudeM,
      },
      {
        distanceM: activity.distanceM,
        elevGainM: activity.elevGainM,
        movingS: activity.movingS,
        paused: activity.paused,
        autoPaused: activity.autoPaused,
      },
    );
  }, [me, activity, lastSpeedMs, lastAltitudeM]);

  const customFieldValues = useMemo<readonly CustomFieldValue[]>(() => {
    if (!activity) return [];
    const completedLapsCount = (activity.laps ?? []).filter((l) => l.completed).length;
    return evaluateCustomFieldValues(displayPrefs.fields, {
      distanceM: activity.distanceM,
      movingS: activity.movingS,
      elevGainM: activity.elevGainM,
      currentSpeedMs: lastSpeedMs,
      currentAltitudeM: lastAltitudeM,
      remainingRouteDistanceM: turnByTurn.progress?.remainingDistanceM ?? null,
      completedLapsCount,
      units,
    });
  }, [activity, displayPrefs.fields, lastSpeedMs, lastAltitudeM, turnByTurn.progress?.remainingDistanceM, units]);

  const lockScreenPayload = useMemo<LockScreenNavigationPayload | null>(() => {
    if (!activity) return null;
    return buildLockScreenNavigationPayload({
      clientSessionId: activity.clientSessionId ?? `local-${activity.startedAt}`,
      sport: activity.sport,
      selection: activity.selection,
      startedAt: activity.startedAt,
      distanceM: activity.distanceM,
      elevGainM: activity.elevGainM,
      movingS: activity.movingS,
      paused: activity.paused,
      autoPaused: activity.autoPaused,
      offRoute: activity.offRoute ?? false,
      offRouteM: activity.offRouteM,
      units,
      nextManeuver: turnByTurn.nextManeuver,
      distanceToNextManeuverM: turnByTurn.distanceToNextM,
      audioMuted: audioPrefs.channel === 'muted',
    });
  }, [activity, units, turnByTurn.nextManeuver, turnByTurn.distanceToNextM, audioPrefs.channel]);

  const detourGeoJson = useMemo<GeoCollection | null>(() => {
    if (reroute.status !== 'recalculated' || !reroute.detourGeometry || reroute.detourGeometry.length < 2) {
      return null;
    }
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { kind: 'reroute', provider: reroute.provider },
          geometry: {
            type: 'LineString',
            coordinates: reroute.detourGeometry as [number, number][],
          },
        },
      ],
    };
  }, [reroute.status, reroute.detourGeometry, reroute.provider]);

  const accessRouteGeoJson = useMemo<GeoCollection | null>(() => {
    if (
      !accessPlan ||
      accessPlan.status !== 'routed_online' ||
      !accessPlan.routedGeometry ||
      accessPlan.routedGeometry.length < 2
    ) {
      return null;
    }
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            kind: 'access',
            targetKind: accessPlan.targetKind,
            provider: accessPlan.provider,
          },
          geometry: {
            type: 'LineString',
            coordinates: accessPlan.routedGeometry as [number, number][],
          },
        },
      ],
    };
  }, [accessPlan]);

  const onLockScreenAction = useCallback(
    (action: 'pause' | 'resume' | 'lap' | 'mute') => {
      if (action === 'pause' || action === 'resume') {
        onPauseOrResumeActivity?.();
      } else if (action === 'lap') {
        onMarkLap?.();
      } else if (action === 'mute') {
        const nextChannel = audioPrefs.channel === 'muted' ? 'all' : 'muted';
        setAudioPrefs({ ...audioPrefs, channel: nextChannel });
      }
    },
    [onPauseOrResumeActivity, onMarkLap, audioPrefs, setAudioPrefs],
  );

  const guidanceState: NavigationGuidanceUiState = useMemo(
    () => ({
      turnByTurn,
      reroute,
      detourGeoJson,
      accessRouteGeoJson,
      orientation,
      upcomingWaypoints,
      activeWaypointAlert,
      climbCard,
      audioPrefs,
      displayPrefs,
      customFieldValues,
      wakeLock,
      targetZoom,
      lockScreenPayload,
      lockScreenCapability,
      departureEvaluation,
      externalLinks,
      accessPlan,
      availableSwapRoutes,
    }),
    [
      turnByTurn,
      reroute,
      detourGeoJson,
      accessRouteGeoJson,
      orientation,
      upcomingWaypoints,
      activeWaypointAlert,
      climbCard,
      audioPrefs,
      displayPrefs,
      customFieldValues,
      wakeLock,
      targetZoom,
      lockScreenPayload,
      lockScreenCapability,
      departureEvaluation,
      externalLinks,
      accessPlan,
      availableSwapRoutes,
    ],
  );

  return {
    guidance: guidanceState,
    processAcceptedFix,
    setOrientationMode,
    recenter,
    onUserMapPan,
    setAudioPrefs,
    testVoice,
    setDisplayPrefs,
    swapRoute,
    onSelectDepartureAction,
    retryReroute,
    onLockScreenAction,
  };
}
