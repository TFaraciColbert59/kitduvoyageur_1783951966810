import type {
  FinalSegmentEffort,
  GhostProfile,
  LiveSegmentAlert,
  LiveSegmentDefinition,
  LiveSegmentSnapshot,
  SegmentPoint,
} from '@/features/live-segments';
import type { LiveSegmentSummaryView } from '../types';

export const BASE_TIME = 1_700_000_000_000;

const METERS_PER_DEG_LAT = 111_194.9266;

export function latAt(meters: number): number {
  return 48 + meters / METERS_PER_DEG_LAT;
}

export function makeSegmentPoints(totalM = 1000, count = 21): SegmentPoint[] {
  const step = totalM / (count - 1);
  return Array.from({ length: count }, (_, index) => ({
    lat: latAt(step * index),
    lon: 2,
    ele: 300 + index * 2,
    cumulativeDistanceM: Math.round(step * index * 10) / 10,
  }));
}

export function makeGhost(overrides: Partial<GhostProfile> = {}): GhostProfile {
  return {
    kind: 'target',
    label: 'Objectif 10 min',
    totalTimeMs: 600_000,
    checkpoints: [
      { distanceM: 0, elapsedMs: 0 },
      { distanceM: 500, elapsedMs: 300_000 },
      { distanceM: 1000, elapsedMs: 600_000 },
    ],
    isPublic: true,
    isOptedIn: true,
    ...overrides,
  };
}

export function makeSegment(overrides: Partial<LiveSegmentDefinition> = {}): LiveSegmentDefinition {
  return {
    id: 'seg-test',
    version: 1,
    name: 'Montée de test',
    sport: 'cycling',
    direction: 'forward',
    points: makeSegmentPoints(),
    totalDistanceM: 1000,
    elevationGainM: 80,
    isPrivate: false,
    ownerId: 'owner-1',
    isStarred: true,
    ghostProfiles: [makeGhost()],
    ...overrides,
  };
}

export function makeSummary(
  overrides: Partial<LiveSegmentSummaryView> = {},
): LiveSegmentSummaryView {
  const segment = makeSegment();
  return {
    id: segment.id,
    version: segment.version,
    name: segment.name,
    sport: segment.sport,
    direction: segment.direction,
    totalDistanceM: segment.totalDistanceM,
    elevationGainM: segment.elevationGainM,
    region: 'Test · France',
    dataSource: 'demo_catalog',
    pointCount: segment.points.length,
    points: segment.points,
    start: segment.points[0],
    ghostProfiles: segment.ghostProfiles,
    distanceFromViewerM: 120,
    ...overrides,
  };
}

export function makeEffort(overrides: Partial<FinalSegmentEffort> = {}): FinalSegmentEffort {
  return {
    effortId: 'seg-test:1700000000000:1',
    segmentId: 'seg-test',
    segmentVersion: 1,
    sport: 'cycling',
    direction: 'forward',
    startedAtMs: BASE_TIME,
    finishedAtMs: BASE_TIME + 540_000,
    elapsedMs: 540_000,
    distanceCoveredM: 1000,
    coverageRatio: 1,
    isValidForLeaderboard: true,
    beatPr: false,
    beatKom: false,
    queuedForSync: false,
    ...overrides,
  };
}

export function makeAlert(overrides: Partial<LiveSegmentAlert> = {}): LiveSegmentAlert {
  return {
    type: 'approach',
    segmentId: 'seg-test',
    timestampMs: BASE_TIME,
    deltaMs: null,
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<LiveSegmentSnapshot> = {}): LiveSegmentSnapshot {
  return {
    state: 'active',
    isVisible: true,
    segmentId: 'seg-test',
    segmentName: 'Montée de test',
    sport: 'cycling',
    matchedDirection: 'forward',
    distanceToStartM: 0,
    distanceCoveredM: 420,
    totalDistanceM: 1000,
    progressRatio: 0.42,
    elapsedMs: 252_000,
    isLiveEstimate: true,
    signalQuality: 'good',
    activeGhostKind: 'target',
    activeGhostLabel: 'Objectif 10 min',
    deltaMs: -18_000,
    deltaDistanceM: 42,
    projectedFinishMs: 582_000,
    alerts: [],
    finalResult: null,
    ...overrides,
  };
}
