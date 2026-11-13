export type {
  DeviceCapability,
  DeviceLiveDisplaySnapshot,
  DevicePlatform,
  DeviceSegmentReference,
  DeviceSyncResult,
  DeviceSyncStatus,
  EffortInvalidationReason,
  FinalSegmentEffort,
  GeoPoint,
  GhostCheckpoint,
  GhostProfile,
  GhostTargetKind,
  LiveSegmentAlert,
  LiveSegmentAlertType,
  LiveSegmentDefinition,
  LiveSegmentSnapshot,
  LiveSegmentState,
  LiveSegmentThresholds,
  PrivacyContext,
  SegmentDirection,
  SegmentPoint,
  SignalQuality,
  SportType,
} from './types';

export {
  isGhostProfileEligible,
  isSegmentAccessible,
  sanitizeSegmentForLive,
  selectPreferredGhost,
} from './privacy';

export {
  angleDiffDeg,
  buildDirectedTrace,
  computeBearingDeg,
  computeLiveDelta,
  haversineDistanceM,
  interpolateGhostDistanceAtTime,
  interpolateGhostElapsedMs,
  projectPointOntoTrace,
  type LiveDeltaResult,
  type TraceProjection,
} from './geometry';

export {
  DEFAULT_LIVE_SEGMENT_THRESHOLDS,
  LiveSegmentEngine,
  OfflineEffortQueue,
  type LiveSegmentEngineOptions,
} from './engine';

export {
  buildDeviceSyncReferences,
  computeSegmentChecksum,
  FavoriteSegmentSyncService,
  formatDeviceLiveDisplay,
  type DeviceLiveSegmentAdapter,
} from './deviceSync';
