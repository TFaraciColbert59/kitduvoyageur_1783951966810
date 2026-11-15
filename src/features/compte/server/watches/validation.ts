/**
 * Lot D03-UI — validation zod des entrées HTTP `/api/watches`.
 *
 * Toute entrée est validée à la réception. Les schémas reprennent exactement
 * le contrat `src/features/watches` (aucun champ inventé) et bornent les
 * tableaux pour éviter un lot de plusieurs milliers de points.
 */

import { z } from 'zod';

export const WATCH_PLATFORMS = ['apple_watch', 'wear_os', 'galaxy_watch'] as const;
export const WATCH_TRANSPORTS = ['watch_connectivity', 'wear_data_layer'] as const;
export const WATCH_SESSION_STATUSES = [
  'prepared',
  'recording',
  'paused',
  'finalizing',
  'finished',
] as const;
export const WATCH_SYNC_STATES = [
  'pending_local',
  'transferring',
  'partially_acked',
  'synced',
  'conflict',
  'failed_retryable',
] as const;
export const WATCH_EVENT_TYPES = [
  'pause',
  'resume',
  'reboot_detected',
  'clock_jump_detected',
  'permission_revoked',
  'handoff_to_phone',
  'handoff_to_watch',
] as const;
export const WATCH_RESOURCE_KINDS = [
  'route_geometry',
  'maneuvers',
  'vector_tiles',
  'style_json',
  'glyphs',
  'sprites',
  'pois',
] as const;
export const WATCH_POI_CATEGORIES = [
  'summit',
  'water',
  'shelter',
  'danger',
  'viewpoint',
  'waypoint',
  'turn',
] as const;
export const WATCH_FIELD_KEYS = [
  'distance_total_m',
  'distance_remaining_m',
  'elevation_gain_m',
  'elevation_remaining_m',
  'moving_time_s',
  'elapsed_time_s',
  'current_speed_mps',
  'average_speed_mps',
  'pace_s_per_km',
  'heart_rate_bpm',
  'eta_utc_ms',
  'off_route_distance_m',
  'next_turn_distance_m',
  'battery_percent',
] as const;
export const WATCH_MANEUVER_DIRECTIONS = [
  'straight',
  'slight_left',
  'left',
  'sharp_left',
  'slight_right',
  'right',
  'sharp_right',
  'uturn',
  'arrive',
] as const;

const timestamp = z.number().int().min(946_684_800_000).max(4_102_444_800_000);
const optionalTimestamp = timestamp.nullable().optional();
const nullableNumber = z.number().nullable();

export const WatchGpsPointSchema = z
  .object({
    key: z.string().trim().min(1).max(200).optional(),
    watchSessionId: z.string().trim().min(1).max(160),
    seq: z.number().int().min(1).max(1_000_000_000),
    recordedAtUtcMs: timestamp,
    monotonicMs: z.number().int().nullable(),
    bootId: z.string().trim().min(1).max(120),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    eleM: nullableNumber,
    accuracyM: z.number().min(0).max(100_000).nullable(),
    speedMps: z.number().min(0).max(200).nullable(),
    heartRateBpm: z.number().min(0).max(300).nullable(),
    drawn: z.boolean(),
    breakBefore: z.boolean(),
  })
  .strict();

export const WatchPauseEventSchema = z
  .object({
    seq: z.number().int().min(1).max(1_000_000_000),
    type: z.enum(WATCH_EVENT_TYPES),
    atUtcMs: timestamp,
    monotonicMs: z.number().int().nullable(),
    bootId: z.string().trim().min(1).max(120),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const WatchSessionSummarySchema = z
  .object({
    watchSessionId: z.string().trim().min(1).max(160),
    deviceId: z.string().trim().min(1).max(160),
    platform: z.enum(WATCH_PLATFORMS),
    sport: z.string().trim().min(1).max(80),
    routePackId: z.string().trim().max(160).nullable(),
    startedAtUtcMs: timestamp,
    endedAtUtcMs: timestamp,
    elapsedMs: z.number().min(0).max(10_000_000_000),
    movingMs: z.number().min(0).max(10_000_000_000),
    distanceM: z.number().min(0).max(100_000_000),
    elevGainM: z.number().min(0).max(10_000_000),
    elevLossM: z.number().min(0).max(10_000_000),
    totalPoints: z.number().int().min(0).max(1_000_000_000),
    totalEvents: z.number().int().min(0).max(1_000_000_000),
    sourceGeneration: z.number().int().min(1).max(1_000_000),
    idempotencyKey: z.string().trim().min(1).max(200),
  })
  .strict();

export const WatchSessionBatchSchema = z
  .object({
    batchId: z.string().trim().min(1).max(240),
    watchSessionId: z.string().trim().min(1).max(160),
    deviceId: z.string().trim().min(1).max(160),
    platform: z.enum(WATCH_PLATFORMS),
    sport: z.string().trim().min(1).max(80),
    routePackId: z.string().trim().max(160).nullable(),
    sourceGeneration: z.number().int().min(1).max(1_000_000),
    fromSeq: z.number().int().min(0).max(1_000_000_000),
    toSeq: z.number().int().min(0).max(1_000_000_000),
    points: z.array(WatchGpsPointSchema).max(500),
    events: z.array(WatchPauseEventSchema).max(200),
    summary: WatchSessionSummarySchema.nullable(),
    sentAtUtcMs: timestamp,
  })
  .strict();

export const WatchSessionBatchEnvelopeSchema = z.union([
  z.object({ batch: WatchSessionBatchSchema }).strict(),
  WatchSessionBatchSchema,
]);

export const WatchSessionBulkSchema = z
  .object({
    batches: z.array(WatchSessionBatchSchema).min(1).max(50),
  })
  .strict();

export const WatchPermissionSnapshotSchema = z
  .object({
    locationWhenInUse: z.enum(['granted', 'denied', 'prompt']),
    locationAlwaysOrWorkout: z.enum(['granted', 'denied', 'prompt']),
    healthWorkoutWrite: z.enum(['granted', 'denied', 'prompt']),
    healthMetricsRead: z.enum(['granted', 'denied', 'indeterminate', 'prompt']),
  })
  .strict();

export const WatchDeviceProfileSchema = z
  .object({
    deviceId: z.string().trim().min(1).max(160),
    platform: z.enum(WATCH_PLATFORMS),
    modelName: z.string().trim().min(1).max(120),
    osVersion: z.string().trim().min(1).max(40),
    hasBuiltInGps: z.boolean(),
    storageAvailableBytes: z.number().int().min(0).max(10_000_000_000_000),
    batteryPercent: z.number().min(0).max(100).nullable(),
    pairedPhonePlatform: z.enum(['ios', 'android', 'web']),
    permissions: WatchPermissionSnapshotSchema,
  })
  .strict();

export const WatchOfflineBoundsSchema = z
  .object({
    west: z.number().min(-180).max(180),
    south: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
    north: z.number().min(-90).max(90),
  })
  .strict();

export const WatchOfflineResourceSchema = z
  .object({
    resourceId: z.string().trim().min(1).max(160),
    kind: z.enum(WATCH_RESOURCE_KINDS),
    requiredForFullMap: z.boolean(),
    sizeBytes: z.number().int().min(0).max(10_000_000_000_000),
    sha256: z.string().trim().min(1).max(128),
  })
  .strict();

export const WatchOfflinePackManifestSchema = z
  .object({
    packId: z.string().trim().min(1).max(160),
    routeId: z.string().trim().min(1).max(160),
    routeRevision: z.number().int().min(1).max(1_000_000),
    ownerUserId: z.string().trim().min(1).max(160),
    provider: z.string().trim().min(1).max(120),
    OfflineLicenseAllowed: z.boolean(),
    styleVersion: z.string().trim().min(1).max(120),
    bounds: WatchOfflineBoundsSchema,
    minZoom: z.number().int().min(0).max(24),
    maxZoom: z.number().int().min(0).max(24),
    totalBytes: z.number().int().min(0).max(10_000_000_000_000),
    checksumSha256: z.string().trim().min(1).max(128),
    resources: z.array(WatchOfflineResourceSchema).min(1).max(200),
    createdAtUtcMs: timestamp,
  })
  .strict();

export const WatchOfflinePackChunkSchema = z
  .object({
    packId: z.string().trim().min(1).max(160),
    routeRevision: z.number().int().min(1).max(1_000_000),
    chunkIndex: z.number().int().min(0).max(1_000_000),
    totalChunks: z.number().int().min(1).max(1_000_000),
    byteLength: z.number().int().min(0).max(10_000_000_000),
    resourceIdsCovered: z.array(z.string().trim().min(1).max(160)).max(200),
    chunkChecksum: z.string().trim().min(1).max(128),
  })
  .strict();

export const WatchStagePackSchema = z.union([
  z.object({
    manifest: WatchOfflinePackManifestSchema,
    totalChunks: z.number().int().min(1).max(1_000_000).optional(),
  }).strict(),
  WatchOfflinePackManifestSchema,
]);

export const WatchVerifyPackSchema = z
  .object({
    checksumSha256: z.string().trim().min(1).max(128).optional(),
    actualChecksumSha256: z.string().trim().min(1).max(128).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.checksumSha256 ?? value.actualChecksumSha256), {
    message: 'La somme de contrôle vérifiée est requise.',
  });

export const WatchNextManeuverSchema = z
  .object({
    instruction: z.string().trim().min(1).max(240),
    direction: z.enum(WATCH_MANEUVER_DIRECTIONS),
    distanceToTurnM: z.number().min(0).max(100_000),
    streetOrTrailName: z.string().trim().max(160).nullable().optional(),
  })
  .strict();

export const WatchRoutePoiSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    name: z.string().trim().min(1).max(160),
    category: z.enum(WATCH_POI_CATEGORIES),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    distanceAlongRouteM: z.number().min(0).max(10_000_000),
    eleM: z.number().min(-1000).max(9000).nullable().optional(),
    maneuverInstruction: z.string().trim().max(240).nullable().optional(),
  })
  .strict();

export const WatchLiveMetricsSchema = z
  .object({
    distanceM: z.number().min(0).max(100_000_000),
    distanceRemainingM: z.number().min(0).max(100_000_000).nullable().optional(),
    elevGainM: z.number().min(0).max(10_000_000),
    elevRemainingM: z.number().min(0).max(10_000_000).nullable().optional(),
    movingS: z.number().min(0).max(10_000_000_000),
    elapsedS: z.number().min(0).max(10_000_000_000),
    currentSpeedMps: z.number().min(0).max(200).nullable().optional(),
    averageSpeedMps: z.number().min(0).max(200).nullable().optional(),
    heartRateBpm: z.number().min(0).max(300).nullable().optional(),
    currentElevationM: z.number().min(-1000).max(9000).nullable().optional(),
    etaUtcMs: optionalTimestamp,
    offRoute: z.boolean(),
    offRouteDistanceM: z.number().min(0).max(1_000_000).nullable().optional(),
    paused: z.boolean(),
    batteryPercent: z.number().min(0).max(100).nullable().optional(),
  })
  .strict();

export const WatchFieldLayoutSchema = z
  .object({
    sport: z.string().trim().min(1).max(80),
    maxSlotsPerPage: z.number().int().min(1).max(6),
    pages: z.array(z.array(z.enum(WATCH_FIELD_KEYS)).min(0).max(6)).min(1).max(10),
  })
  .strict();

export const WatchCustomFieldValueSchema = z
  .object({
    key: z.enum(WATCH_FIELD_KEYS),
    label: z.string().min(1).max(80),
    unit: z.enum(['m', 'km', 's', 'mps', 'km/h', 's/km', 'bpm', 'timestamp', '%']),
    value: z.number().nullable(),
    formatted: z.string().max(80),
    available: z.boolean(),
  })
  .strict();

export const WatchUpcomingPoiSchema = z
  .object({
    id: z.string().min(1).max(160),
    name: z.string().min(1).max(160),
    category: z.enum(WATCH_POI_CATEGORIES),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    distanceAlongRouteM: z.number().min(0).max(10_000_000),
    distanceRemainingM: z.number().min(0).max(10_000_000),
    elevationDeltaM: z.number().nullable(),
    maneuverInstruction: z.string().max(240).nullable(),
  })
  .strict();

export const WatchLiveSyncFrameSchema = z
  .object({
    frameSeq: z.number().int().min(1).max(1_000_000_000),
    sessionId: z.string().trim().min(1).max(160),
    routeId: z.string().trim().max(160).nullable(),
    sourceOwner: z.enum(['phone', 'watch']),
    sourceGeneration: z.number().int().min(1).max(1_000_000),
    sentAtUtcMs: timestamp,
    paused: z.boolean(),
    offRoute: z.boolean(),
    offRouteDistanceM: z.number().min(0).max(1_000_000).nullable(),
    nextManeuver: WatchNextManeuverSchema.nullable(),
    upcomingPois: z.array(WatchUpcomingPoiSchema).max(50),
    customFields: z.array(WatchCustomFieldValueSchema).max(30),
  })
  .strict();

export const WatchLiveSyncActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('build_frame'),
      sessionId: z.string().trim().min(1).max(160),
      routeId: z.string().trim().max(160).nullable().optional(),
      metrics: WatchLiveMetricsSchema,
      pois: z.array(WatchRoutePoiSchema).max(500).optional(),
      nextManeuver: WatchNextManeuverSchema.nullable().optional(),
      nowUtcMs: optionalTimestamp,
    })
    .strict(),
  z
    .object({
      action: z.literal('set_layout'),
      config: WatchFieldLayoutSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('handoff'),
      sessionId: z.string().trim().min(1).max(160),
      toSource: z.enum(['phone', 'watch']),
      lastAcceptedSeq: z.number().int().min(0).max(1_000_000_000),
      nowUtcMs: optionalTimestamp,
    })
    .strict(),
  z
    .object({
      action: z.literal('apply_frame'),
      frame: WatchLiveSyncFrameSchema,
    })
    .strict(),
]);

export type WatchSessionBatchInput = z.infer<typeof WatchSessionBatchSchema>;
export type WatchDeviceProfileInput = z.infer<typeof WatchDeviceProfileSchema>;
export type WatchOfflinePackManifestInput = z.infer<typeof WatchOfflinePackManifestSchema>;
export type WatchOfflinePackChunkInput = z.infer<typeof WatchOfflinePackChunkSchema>;
export type WatchLiveMetricsInputSchema = z.infer<typeof WatchLiveMetricsSchema>;
export type WatchFieldLayoutInput = z.infer<typeof WatchFieldLayoutSchema>;
export type WatchRoutePoiInputSchema = z.infer<typeof WatchRoutePoiSchema>;
export type WatchLiveSyncActionInput = z.infer<typeof WatchLiveSyncActionSchema>;
