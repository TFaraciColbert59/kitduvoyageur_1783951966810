import { describe, expect, it } from 'vitest';
import {
  buildPeakBaggingSummary,
  computeLocalLegend,
  LocalLegendTarget,
  PeakDefinition,
  PrivacyPolicyContext,
  RankingActivityRecord,
  RankingUserProfile,
  validatePeakAscents,
} from '../index';

const PROFILES: RankingUserProfile[] = [
  { userId: 'u1', displayName: 'Alice', avatarUrl: null },
  { userId: 'u2', displayName: 'Bob', avatarUrl: null },
  { userId: 'u3', displayName: 'OptOutUser', avatarUrl: null, localLegendsOptOut: true },
  { userId: 'u4', displayName: 'BlockedUser', avatarUrl: null },
];

const CONTEXT: PrivacyPolicyContext = {
  viewerId: 'u1',
  blockedUserIds: ['u4'],
};

const TARGET: LocalLegendTarget = {
  targetId: 'seg-bastille',
  targetType: 'segment',
  name: 'Montée de la Bastille',
  sport: 'running',
};

const PEAKS: PeakDefinition[] = [
  {
    id: 'peak-chamechaude',
    name: 'Chamechaude',
    elevationMeters: 2082,
    lat: 45.2875,
    lng: 5.7897,
    validationRadiusMeters: 50,
    region: 'Chartreuse',
  },
  {
    id: 'peak-moucherotte',
    name: 'Le Moucherotte',
    elevationMeters: 1901,
    lat: 45.1489,
    lng: 5.6392,
    validationRadiusMeters: 50,
    region: 'Vercors',
  },
];

describe('Local Legends (90-day rolling window) & Peak Bagging (K5.26)', () => {
  it('computes Local Legend over a 90-day rolling window and enforces P01 opt-out & S6.19 blocks', () => {
    const refDate = '2026-11-13T12:00:00.000Z';
    const exactly90DaysAgo = new Date(Date.parse(refDate) - 90 * 86_400_000).toISOString();
    const ninetyOneDaysAgo = new Date(Date.parse(refDate) - 91 * 86_400_000).toISOString();

    const activities: RankingActivityRecord[] = [
      // u1: 2 efforts inside 90d, 1 outside (91d)
      {
        id: 'l1',
        userId: 'u1',
        sport: 'running',
        startedAt: exactly90DaysAgo,
        durationSec: 1200,
        distanceMeters: 3000,
        elevationGainMeters: 250,
        visibility: 'public',
        isValid: true,
        isFlagged: false,
        segmentIds: ['seg-bastille'],
      },
      {
        id: 'l2',
        userId: 'u1',
        sport: 'running',
        startedAt: '2026-11-10T08:00:00.000Z',
        durationSec: 1150,
        distanceMeters: 3000,
        elevationGainMeters: 250,
        visibility: 'public',
        isValid: true,
        isFlagged: false,
        segmentIds: ['seg-bastille'],
      },
      {
        id: 'l3-too-old',
        userId: 'u1',
        sport: 'running',
        startedAt: ninetyOneDaysAgo,
        durationSec: 1100,
        distanceMeters: 3000,
        elevationGainMeters: 250,
        visibility: 'public',
        isValid: true,
        isFlagged: false,
        segmentIds: ['seg-bastille'],
      },
      // u2: 3 efforts, but 1 is private and 1 is flagged -> only 1 valid public effort
      {
        id: 'l4',
        userId: 'u2',
        sport: 'running',
        startedAt: '2026-11-01T08:00:00.000Z',
        durationSec: 1100,
        distanceMeters: 3000,
        elevationGainMeters: 250,
        visibility: 'public',
        isValid: true,
        isFlagged: false,
        segmentIds: ['seg-bastille'],
      },
      {
        id: 'l5-private',
        userId: 'u2',
        sport: 'running',
        startedAt: '2026-11-02T08:00:00.000Z',
        durationSec: 1100,
        distanceMeters: 3000,
        elevationGainMeters: 250,
        visibility: 'private',
        isValid: true,
        isFlagged: false,
        segmentIds: ['seg-bastille'],
      },
      {
        id: 'l6-flagged',
        userId: 'u2',
        sport: 'running',
        startedAt: '2026-11-03T08:00:00.000Z',
        durationSec: 1100,
        distanceMeters: 3000,
        elevationGainMeters: 250,
        visibility: 'public',
        isValid: true,
        isFlagged: true,
        segmentIds: ['seg-bastille'],
      },
      // u3 (opt-out): 5 efforts -> must be excluded
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `opt-${i}`,
        userId: 'u3',
        sport: 'running' as const,
        startedAt: '2026-11-05T08:00:00.000Z',
        durationSec: 1000,
        distanceMeters: 3000,
        elevationGainMeters: 250,
        visibility: 'public' as const,
        isValid: true,
        isFlagged: false,
        segmentIds: ['seg-bastille'],
      })),
      // u4 (blocked): 4 efforts -> must be excluded
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `blk-${i}`,
        userId: 'u4',
        sport: 'running' as const,
        startedAt: '2026-11-05T08:00:00.000Z',
        durationSec: 1000,
        distanceMeters: 3000,
        elevationGainMeters: 250,
        visibility: 'public' as const,
        isValid: true,
        isFlagged: false,
        segmentIds: ['seg-bastille'],
      })),
    ];

    const result = computeLocalLegend(TARGET, activities, PROFILES, CONTEXT, refDate);
    expect(result.windowDays).toBe(90);
    expect(result.leader?.userId).toBe('u1');
    expect(result.leader?.effortCount).toBe(2);
    expect(result.effortsToDethrone).toBe(0);
    expect(result.entries.map((e) => e.userId)).toEqual(['u1', 'u2']);
    expect(result.entries[1].effortCount).toBe(1);
  });

  it('K5.26 validates peak ascents via GPS Haversine and revokes on invalid/flagged/deleted activity', () => {
    const validAscent: RankingActivityRecord = {
      id: 'hike-1',
      userId: 'u1',
      sport: 'hiking',
      startedAt: '2026-10-10T10:00:00.000Z',
      durationSec: 10800,
      distanceMeters: 12000,
      elevationGainMeters: 900,
      visibility: 'public',
      isValid: true,
      isFlagged: false,
      gpsTrack: [
        { lat: 45.28, lng: 5.78 },
        { lat: 45.2876, lng: 5.7898 }, // ~13m from Chamechaude summit
      ],
    };

    const farMiss: RankingActivityRecord = {
      id: 'hike-2',
      userId: 'u1',
      sport: 'hiking',
      startedAt: '2026-10-15T10:00:00.000Z',
      durationSec: 7200,
      distanceMeters: 8000,
      elevationGainMeters: 500,
      visibility: 'public',
      isValid: true,
      isFlagged: false,
      gpsTrack: [{ lat: 45.14, lng: 5.63 }], // > 1 km from Moucherotte
    };

    expect(validatePeakAscents(validAscent, PEAKS)).toHaveLength(1);
    expect(validatePeakAscents(farMiss, PEAKS)).toHaveLength(0);

    const summary = buildPeakBaggingSummary('u1', [validAscent, farMiss], PEAKS);
    expect(summary.conqueredPeaksCount).toBe(1);
    expect(summary.completionPct).toBe(50);
    expect(summary.highestConqueredPeakMeters).toBe(2082);
    expect(summary.cumulativePeakElevationMeters).toBe(2082);

    // Flagging the activity revokes the peak ascent
    const flaggedAscent: RankingActivityRecord = { ...validAscent, isFlagged: true };
    const revokedSummary = buildPeakBaggingSummary('u1', [flaggedAscent, farMiss], PEAKS);
    expect(revokedSummary.conqueredPeaksCount).toBe(0);
    expect(revokedSummary.highestConqueredPeakMeters).toBeNull();
  });
});
