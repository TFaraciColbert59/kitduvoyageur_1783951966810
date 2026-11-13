import type {
  ActivityTraceForSegments,
  SegmentDefinition,
  SegmentEffort,
  SegmentTrackPoint,
} from '@/features/segments';

export function buildTrack(options?: {
  steps?: number;
  stepLatDeg?: number;
  stepSeconds?: number;
  startIso?: string;
  heartRate?: number | null;
  powerW?: number | null;
}): SegmentTrackPoint[] {
  const steps = options?.steps ?? 12;
  const stepLatDeg = options?.stepLatDeg ?? 0.001;
  const stepSeconds = options?.stepSeconds ?? 15;
  const startMs = Date.parse(options?.startIso ?? '2026-11-01T08:00:00.000Z');

  return Array.from({ length: steps }, (_, index) => ({
    lat: 45 + index * stepLatDeg,
    lng: 6,
    ele: 500 + index * 2,
    timestamp: new Date(startMs + index * stepSeconds * 1000).toISOString(),
    accuracyM: 5,
    heartRateBpm: options?.heartRate === undefined ? 150 : options.heartRate,
    powerW: options?.powerW === undefined ? null : options.powerW,
  }));
}

export function buildActivity(overrides?: Partial<ActivityTraceForSegments>): ActivityTraceForSegments {
  return {
    activityId: 'act-1',
    activityVersion: 1,
    userId: 'user-1',
    sport: 'running',
    points: buildTrack(),
    visibility: 'private',
    ...overrides,
  };
}

export function buildSegment(overrides?: Partial<SegmentDefinition>): SegmentDefinition {
  const points = buildTrack().map((point) => ({ lat: point.lat, lng: point.lng, ele: point.ele }));
  return {
    id: 'seg-1',
    version: 1,
    name: 'Montée du Belvédère',
    sport: 'running',
    direction: 'forward',
    points,
    startPoint: points[0],
    endPoint: points[points.length - 1],
    lengthM: 1223,
    elevationGainM: 22,
    elevationLossM: 0,
    meanGradePct: 1.8,
    maxGradePct: 2.1,
    surface: 'sentier',
    visibility: 'public',
    createdByUserId: 'user-1',
    sourceActivityId: 'act-1',
    verified: true,
    verifiedReason: 'criteria_met',
    canonicalSegmentId: null,
    mergedDuplicateIds: [],
    hazardous: false,
    hazardCategory: null,
    hazardReportedAt: null,
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

export function buildEffort(overrides?: Partial<SegmentEffort>): SegmentEffort {
  const elapsedDurationS = overrides?.elapsedDurationS ?? 600;
  return {
    effortId: 'eff-1',
    uniquenessKey: 'act-1:seg-1:v1:occ0',
    segmentId: 'seg-1',
    segmentVersion: 1,
    activityId: 'act-1',
    activityVersion: 1,
    userId: 'user-1',
    sport: 'running',
    direction: 'forward',
    occurrenceIndex: 0,
    status: 'valid',
    exclusionReasons: [],
    startPointIndex: 0,
    endPointIndex: 11,
    enteredAt: '2026-11-01T08:00:00.000Z',
    exitedAt: '2026-11-01T08:10:00.000Z',
    elapsedDurationS,
    movingDurationS: elapsedDurationS - 10,
    pausedDurationS: 10,
    coveredDistanceM: 1223,
    coverageRatio: 1,
    maxCorridorDeviationM: 3,
    elevationGainM: 22,
    elevationLossM: 0,
    avgSpeedKmh: 7.3,
    maxSpeedKmh: 12.4,
    avgHeartRateBpm: 150,
    maxHeartRateBpm: 168,
    avgPowerW: null,
    avgCadenceRpm: null,
    mapMatchQuality: 0.95,
    gpsQuality: 0.92,
    visibility: 'public',
    eligibleForPublicLeaderboard: true,
    personalRank: null,
    isPersonalRecord: false,
    ...overrides,
  };
}
