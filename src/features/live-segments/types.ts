export type SportType = 'cycling' | 'running' | 'hiking' | 'trail' | 'gravel';

export type SegmentDirection = 'forward' | 'reverse' | 'bidirectional';

export type LiveSegmentState =
  | 'idle'
  | 'approaching'
  | 'active'
  | 'off_route'
  | 'gps_lost'
  | 'completed'
  | 'aborted';

export type SignalQuality = 'good' | 'degraded' | 'lost';

export type GhostTargetKind = 'pr' | 'kom' | 'qom' | 'target' | 'friend';

export interface GeoPoint {
  lat: number;
  lon: number;
  ele?: number;
  /** Horizontal accuracy in meters (lower is better). */
  accuracyM?: number;
  /** Wall-clock UTC timestamp in milliseconds. */
  timestampMs: number;
  /** Monotonic clock in milliseconds (preferred for elapsed duration). */
  monotonicMs?: number;
}

export interface SegmentPoint {
  lat: number;
  lon: number;
  ele?: number;
  /** Cumulative distance from segment start in meters. */
  cumulativeDistanceM: number;
}

export interface GhostCheckpoint {
  distanceM: number;
  elapsedMs: number;
}

export interface GhostProfile {
  kind: GhostTargetKind;
  /** Display label (must be anonymized if owner is private/opted-out). */
  label: string;
  totalTimeMs: number;
  checkpoints: GhostCheckpoint[];
  ownerId?: string;
  isPublic: boolean;
  isOptedIn: boolean;
}

export interface PrivacyContext {
  viewerId: string;
  /** Whether the current user has opted in to Live Segments. */
  optedInLiveSegments: boolean;
  /** User IDs blocked by or blocking the viewer (S6.19). */
  blockedUserIds: ReadonlySet<string> | readonly string[];
  /** Peer IDs authorized to share friend ghost targets. */
  allowedPeerIds: ReadonlySet<string> | readonly string[];
}

export interface LiveSegmentDefinition {
  id: string;
  version: number;
  name: string;
  sport: SportType;
  direction: SegmentDirection;
  points: SegmentPoint[];
  totalDistanceM: number;
  elevationGainM: number;
  isPrivate: boolean;
  ownerId: string;
  isStarred?: boolean;
  ghostProfiles: GhostProfile[];
}

export interface LiveSegmentThresholds {
  /** Radius to enter `approaching` state (meters). */
  approachRadiusM: number;
  /** Hysteresis radius to exit `approaching` back to `idle` (must be > approachRadiusM). */
  approachExitRadiusM: number;
  /** Radius around start gate to trigger `active` (meters). */
  startRadiusM: number;
  /** Max heading difference in degrees to accept start/progression. */
  maxHeadingDiffDeg: number;
  /** Radius around finish gate to complete segment (meters). */
  finishRadiusM: number;
  /** Distance from trace to consider sample off-route (meters). */
  offRouteThresholdM: number;
  /** Tighter distance from trace to rejoin from `off_route` (hysteresis). */
  rejoinThresholdM: number;
  /** Consecutive off-route samples before transitioning to `off_route`. */
  offRouteGraceSamples: number;
  /** Consecutive off-route samples in `off_route` before aborting. */
  offRouteAbortSamples: number;
  /** Maximum acceptable GPS horizontal accuracy (meters). */
  maxAccuracyM: number;
  /** Maximum gap between valid GPS fixes before declaring `gps_lost` (ms). */
  maxGpsGapMs: number;
  /** Minimum fraction of segment distance that must be traversed to validate finish. */
  minCoverageRatio: number;
  /** Maximum plausible speed (m/s) to guard against GPS teleportation / false KOM. */
  maxPlausibleSpeedMps: number;
}

export type LiveSegmentAlertType =
  | 'approach'
  | 'start'
  | 'off_route'
  | 'rejoined'
  | 'gps_lost'
  | 'gps_restored'
  | 'finish'
  | 'aborted';

export interface LiveSegmentAlert {
  type: LiveSegmentAlertType;
  segmentId: string;
  timestampMs: number;
  deltaMs: number | null;
  reason?: string;
}

export type EffortInvalidationReason =
  | 'gps_lost_during_effort'
  | 'gps_teleport_detected'
  | 'insufficient_coverage'
  | 'off_route_aborted'
  | 'paused_during_effort';

export interface FinalSegmentEffort {
  effortId: string;
  segmentId: string;
  segmentVersion: number;
  sport: SportType;
  direction: 'forward' | 'reverse';
  startedAtMs: number;
  finishedAtMs: number;
  elapsedMs: number;
  distanceCoveredM: number;
  coverageRatio: number;
  /** False if GPS loss, teleportation, or insufficient coverage occurred (no false KOM). */
  isValidForLeaderboard: boolean;
  invalidationReason?: EffortInvalidationReason;
  beatPr: boolean;
  beatKom: boolean;
  queuedForSync: boolean;
}

export interface LiveSegmentSnapshot {
  state: LiveSegmentState;
  /** True when UI banner/overlay should be displayed; false once withdrawn. */
  isVisible: boolean;
  segmentId: string | null;
  segmentName: string | null;
  sport: SportType | null;
  matchedDirection: 'forward' | 'reverse' | null;
  distanceToStartM: number | null;
  distanceCoveredM: number;
  totalDistanceM: number;
  progressRatio: number;
  elapsedMs: number;
  /** Always true while active; false only for final validated result. */
  isLiveEstimate: boolean;
  signalQuality: SignalQuality;
  activeGhostKind: GhostTargetKind | null;
  activeGhostLabel: string | null;
  /** Negative = ahead of ghost (avance), Positive = behind ghost (retard). */
  deltaMs: number | null;
  /** Positive = ahead in meters, Negative = behind in meters. */
  deltaDistanceM: number | null;
  projectedFinishMs: number | null;
  alerts: LiveSegmentAlert[];
  finalResult: FinalSegmentEffort | null;
}

export type DevicePlatform =
  | 'garmin_connect'
  | 'wahoo_elemnt'
  | 'hammerhead_karoo'
  | 'apple_watch'
  | 'wear_os'
  | 'web_unsupported';

export interface DeviceCapability {
  deviceId: string;
  deviceName: string;
  platform: DevicePlatform;
  supportsLiveSegments: boolean;
  maxSyncedSegments: number;
  supportedSports: SportType[];
  hasPermission: boolean;
  isOnline: boolean;
}

export interface DeviceSegmentReference {
  segmentId: string;
  version: number;
  checksum: string;
  name: string;
  sport: SportType;
  direction: SegmentDirection;
  totalDistanceM: number;
  elevationGainM: number;
  targetGhost: {
    kind: GhostTargetKind;
    label: string;
    totalTimeMs: number;
  } | null;
}

export type DeviceSyncStatus =
  | 'synced'
  | 'offline_queued'
  | 'device_incompatible'
  | 'permission_denied'
  | 'privacy_opted_out';

export interface DeviceSyncResult {
  deviceId: string;
  status: DeviceSyncStatus;
  syncedSegmentIds: string[];
  skippedSegmentIds: string[];
  queuedPayloadCount: number;
  reason?: string;
}

export interface DeviceLiveDisplaySnapshot {
  segmentId: string;
  title: string;
  directionLabel: 'FWD' | 'REV';
  remainingDistanceM: number;
  elapsedMs: number;
  deltaMs: number | null;
  ghostLabel: string | null;
  signalQuality: SignalQuality;
}
