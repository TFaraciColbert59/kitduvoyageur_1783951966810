import {
  buildExternalNavigationLinks,
  buildLockScreenNavigationPayload,
  createDefaultAudioPreferences,
  createInitialDisplayPreferences,
  createInitialRerouteState,
  type ActiveRecordingSnapshot,
  type ClimbDescentCardState,
  type DepartureEvaluation,
  type LockScreenCapability,
  type LockScreenNavigationPayload,
  type ManeuverKind,
  type NewRouteSelectionInput,
  type ProjectedWaypoint,
  type RerouteState,
  type RouteManeuver,
  type SlopeSegment,
  type TurnByTurnState,
  type UpcomingWaypointItem,
} from '@/features/navigation';

export const START: [number, number] = [6.1, 45.1];
export const TURN: [number, number] = [6.12, 45.12];
export const END: [number, number] = [6.16, 45.16];

export function makeManeuver(
  kind: ManeuverKind,
  index: number,
  overrides: Partial<RouteManeuver> = {},
): RouteManeuver {
  return {
    id: `rev-1:m:${index}`,
    index,
    kind,
    position: index === 0 ? START : index === 1 ? TURN : END,
    alongTrackM: index * 400,
    bearingBeforeDeg: index === 0 ? 45 : 45,
    bearingAfterDeg: index === 0 ? 45 : 135,
    turnAngleDeg: index === 0 ? 0 : 90,
    streetName: null,
    rawInstruction:
      kind === 'turn-left'
        ? 'Tourner à gauche'
        : kind === 'arrive'
          ? 'Arrivée à destination'
          : kind === 'depart'
            ? 'Prendre le départ'
            : 'Continuer tout droit',
    ...overrides,
  };
}

export const MANEUVERS: RouteManeuver[] = [
  makeManeuver('depart', 0),
  makeManeuver('turn-left', 1),
  makeManeuver('arrive', 2),
];

export function makeTurnState(
  overrides: Partial<TurnByTurnState> = {},
): TurnByTurnState {
  return {
    routeRevision: 'rev-1',
    maneuvers: MANEUVERS,
    progress: {
      alongTrackM: 120,
      remainingDistanceM: 680,
      crossTrackM: 4,
      pointOnRoute: [6.105, 45.105],
      lineIndex: 0,
      segmentIndex: 0,
      segmentBearingDeg: 45,
      returnBearingDeg: 225,
    },
    nextManeuver: MANEUVERS[1],
    secondaryManeuver: MANEUVERS[2],
    distanceToNextM: 280,
    formattedDistanceToNext: '280 m',
    stage: 'pre-announce',
    primaryInstruction: 'Tourner à gauche · 280 m',
    spokenInstruction: 'Dans 280 mètres, tourner à gauche.',
    shouldSpeak: true,
    reverseDirection: false,
    offlineReady: true,
    announcedKeys: new Set(['rev-1:m:1:pre-announce']),
    ...overrides,
  };
}

export function makeDeparture(
  overrides: Partial<DepartureEvaluation> = {},
): DepartureEvaluation {
  return {
    kind: 'away_from_route',
    distanceToStartM: 2400,
    distanceToNearestRoutePointM: 180,
    entryAlongTrackM: 400,
    startPosition: START,
    nearestRoutePosition: [6.11, 45.11],
    bearingToStartDeg: 45,
    bearingToNearestDeg: 180,
    availableActions: ['guide_to_start', 'guide_to_nearest_point', 'open_external_road_nav'],
    recommendedAction: 'guide_to_start',
    unavailableReason: null,
    ...overrides,
  };
}

export function makeReroute(overrides: Partial<RerouteState> = {}): RerouteState {
  return {
    ...createInitialRerouteState(),
    ...overrides,
  };
}

export function makeSlopeSegment(
  overrides: Partial<SlopeSegment> = {},
): SlopeSegment {
  return {
    id: 'slope-climb-0-400',
    kind: 'climb',
    index: 0,
    startDistanceM: 400,
    endDistanceM: 1000,
    lengthM: 600,
    startElevationM: 1200,
    endElevationM: 1274,
    gainM: 74,
    lossM: 0,
    averageGradePct: 12.3,
    maxGradePct: 18.4,
    points: [
      { d: 400, ele: 1200 },
      { d: 600, ele: 1230 },
      { d: 800, ele: 1255 },
      { d: 1000, ele: 1274 },
    ],
    ...overrides,
  };
}

export function makeClimbCard(
  overrides: Partial<ClimbDescentCardState> = {},
): ClimbDescentCardState {
  const segment = overrides.segment !== undefined ? overrides.segment : makeSlopeSegment();
  return {
    status: 'active_climb',
    segment,
    distanceToStartM: 0,
    progressRatio: 0.4,
    remainingDistanceM: 360,
    remainingElevationDeltaM: 74,
    currentGradePct: 7.2,
    remainingProfilePoints: segment ? segment.points : [],
    summaryLabel: 'Montée en cours · reste 360 m (+74 m · 12,3 %)',
    ...overrides,
  };
}

export function makeWaypoint(
  id: string,
  name: string,
  alongTrackM: number,
  overrides: Partial<ProjectedWaypoint> = {},
): ProjectedWaypoint {
  return {
    id,
    name,
    kind: 'refuge',
    lat: 45.12,
    lng: 6.12,
    eleM: 1430,
    sports: ['rando'],
    authorized: true,
    description: null,
    alongTrackM,
    lateralOffsetM: 8,
    ...overrides,
  };
}

export function makeUpcoming(
  waypoint: ProjectedWaypoint,
  distanceRemainingM: number,
  etaSeconds: number | null = null,
): UpcomingWaypointItem {
  return {
    waypoint,
    distanceRemainingM,
    formattedDistance:
      distanceRemainingM >= 1000
        ? `${(distanceRemainingM / 1000).toFixed(2)} km`
        : `${Math.round(distanceRemainingM)} m`,
    etaSeconds,
  };
}

export const RECORDING: ActiveRecordingSnapshot = {
  sessionId: 'session-1',
  clientSessionId: 'client-1',
  sport: 'rando',
  startedAt: 1_700_000_000_000,
  paused: false,
  autoPaused: false,
  distanceM: 4321,
  elevGainM: 312,
  movingS: 3600,
  splits: [],
  mileSplits: [],
  laps: [],
};

export const ROUTES: NewRouteSelectionInput[] = [
  {
    id: 'route-lac',
    name: 'Tour du lac',
    geojson: { type: 'LineString', coordinates: [START, TURN, END] },
    status: 'ready',
  },
  {
    id: 'route-crete',
    name: 'Crête des Aiguilles',
    geojson: { type: 'LineString', coordinates: [TURN, END, START] },
    status: 'ready',
  },
  {
    id: 'route-loading',
    name: 'Variante en chargement',
    geojson: null,
    status: 'loading',
  },
];

export const DISPLAY_PREFERENCES = createInitialDisplayPreferences('rando');

export const AUDIO_PREFERENCES = createDefaultAudioPreferences();

export function makeLockPayload(
  overrides: Partial<Parameters<typeof buildLockScreenNavigationPayload>[0]> = {},
): LockScreenNavigationPayload {
  return buildLockScreenNavigationPayload({
    clientSessionId: 'client-1',
    sport: 'rando',
    startedAt: 1_700_000_000_000,
    distanceM: 8400,
    elevGainM: 420,
    movingS: 5400,
    paused: false,
    autoPaused: false,
    offRoute: false,
    offRouteM: null,
    units: 'metric',
    nextManeuver: MANEUVERS[1],
    distanceToNextManeuverM: 120,
    audioMuted: false,
    ...overrides,
  });
}

export const IOS_CAPABILITY: LockScreenCapability = {
  platform: 'ios',
  supported: true,
  liveActivityAvailable: true,
  dynamicIslandAvailable: true,
  ongoingNotificationAvailable: false,
  reason: null,
};

export const EXTERNAL_LINKS = buildExternalNavigationLinks({
  lat: 45.1,
  lng: 6.1,
  label: 'Départ du lac',
  mode: 'driving',
});
