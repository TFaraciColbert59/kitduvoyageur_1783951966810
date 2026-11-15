import { describe, expect, it } from 'vitest';
import {
  buildPeriodLeaderboard,
  resolvePeriodWindow,
  PrivacyPolicyContext,
  RankingActivityRecord,
  RankingUserProfile,
} from '../index';

const PROFILES: RankingUserProfile[] = [
  { userId: 'u1', displayName: 'Alice', avatarUrl: null },
  { userId: 'u2', displayName: 'Bob', avatarUrl: null },
  { userId: 'u3', displayName: 'Charlie (OptOut)', avatarUrl: null, rankingsOptOut: true },
  { userId: 'u4', displayName: 'Dave (Blocked)', avatarUrl: null },
  { userId: 'u5', displayName: 'Eve (BlockedBy)', avatarUrl: null },
];

const CONTEXT: PrivacyPolicyContext = {
  viewerId: 'u1',
  blockedUserIds: ['u4'],
  blockedByUserIds: ['u5'],
};

const ACTIVITIES: RankingActivityRecord[] = [
  {
    id: 'a1',
    userId: 'u1',
    sport: 'running',
    startedAt: '2026-11-11T08:00:00.000Z',
    durationSec: 3600,
    distanceMeters: 12000,
    elevationGainMeters: 150,
    visibility: 'public',
    isValid: true,
    isFlagged: false,
    gpsTrack: [{ lat: 45.1, lng: 5.7 }],
  },
  {
    id: 'a1-private',
    userId: 'u1',
    sport: 'running',
    startedAt: '2026-11-12T08:00:00.000Z',
    durationSec: 3600,
    distanceMeters: 50000,
    elevationGainMeters: 1000,
    visibility: 'private',
    isValid: true,
    isFlagged: false,
  },
  {
    id: 'a2',
    userId: 'u2',
    sport: 'running',
    startedAt: '2026-11-12T09:00:00.000Z',
    durationSec: 4200,
    distanceMeters: 15000,
    elevationGainMeters: 200,
    visibility: 'public',
    isValid: true,
    isFlagged: false,
  },
  {
    id: 'a2-flagged',
    userId: 'u2',
    sport: 'running',
    startedAt: '2026-11-13T09:00:00.000Z',
    durationSec: 1000,
    distanceMeters: 99000,
    elevationGainMeters: 3000,
    visibility: 'public',
    isValid: true,
    isFlagged: true,
  },
  {
    id: 'a2-invalid',
    userId: 'u2',
    sport: 'running',
    startedAt: '2026-11-13T10:00:00.000Z',
    durationSec: 1000,
    distanceMeters: 80000,
    elevationGainMeters: 2000,
    visibility: 'public',
    isValid: false,
    isFlagged: false,
  },
  {
    id: 'a3-optout',
    userId: 'u3',
    sport: 'running',
    startedAt: '2026-11-12T10:00:00.000Z',
    durationSec: 3000,
    distanceMeters: 25000,
    elevationGainMeters: 300,
    visibility: 'public',
    isValid: true,
    isFlagged: false,
  },
  {
    id: 'a4-blocked',
    userId: 'u4',
    sport: 'running',
    startedAt: '2026-11-12T10:00:00.000Z',
    durationSec: 3000,
    distanceMeters: 30000,
    elevationGainMeters: 300,
    visibility: 'public',
    isValid: true,
    isFlagged: false,
  },
  {
    id: 'a5-blocked-by',
    userId: 'u5',
    sport: 'running',
    startedAt: '2026-11-12T10:00:00.000Z',
    durationSec: 3000,
    distanceMeters: 40000,
    elevationGainMeters: 300,
    visibility: 'public',
    isValid: true,
    isFlagged: false,
  },
  {
    id: 'a1-cycling',
    userId: 'u1',
    sport: 'cycling',
    startedAt: '2026-11-12T14:00:00.000Z',
    durationSec: 5400,
    distanceMeters: 45000,
    elevationGainMeters: 600,
    visibility: 'public',
    isValid: true,
    isFlagged: false,
  },
];

describe('periodLeaderboards & fail-closed P01/S6.19 privacy', () => {
  it('resolves ISO weekly and monthly UTC windows accurately', () => {
    const weekly = resolvePeriodWindow('weekly', '2026-11-13T12:00:00.000Z');
    expect(weekly.startsAt).toBe('2026-11-09T00:00:00.000Z');
    expect(weekly.endsAt).toBe('2026-11-15T23:59:59.999Z');
    expect(weekly.periodKey).toBe('2026-W46');

    const monthly = resolvePeriodWindow('monthly', '2026-11-13T12:00:00.000Z');
    expect(monthly.startsAt).toBe('2026-11-01T00:00:00.000Z');
    expect(monthly.endsAt).toBe('2026-11-30T23:59:59.999Z');
    expect(monthly.periodKey).toBe('2026-11');
  });

  it('excludes private, flagged, invalid, opted-out (P01), and blocked (S6.19) activities', () => {
    const result = buildPeriodLeaderboard(
      ACTIVITIES,
      PROFILES,
      {
        periodKind: 'weekly',
        referenceDate: '2026-11-13T12:00:00.000Z',
        sport: 'running',
        metric: 'distanceMeters',
      },
      CONTEXT
    );

    expect(result.totalParticipants).toBe(2);
    expect(result.entries.map((e) => e.userId)).toEqual(['u2', 'u1']);
    expect(result.entries[0].metricValue).toBe(15000);
    expect(result.entries[1].metricValue).toBe(12000);
    expect(result.currentUserEntry?.rank).toBe(2);
    // Ensure GPS coordinates are never leaked on leaderboard entries
    expect('gpsTrack' in result.entries[1]).toBe(false);
  });

  it('supports sport="all" and elevationGainMeters metric on monthly window', () => {
    const result = buildPeriodLeaderboard(
      ACTIVITIES,
      PROFILES,
      {
        periodKind: 'monthly',
        referenceDate: '2026-11-13T12:00:00.000Z',
        sport: 'all',
        metric: 'elevationGainMeters',
      },
      CONTEXT
    );

    expect(result.entries[0].userId).toBe('u1');
    expect(result.entries[0].metricValue).toBe(750); // 150 + 600
    expect(result.entries[1].userId).toBe('u2');
    expect(result.entries[1].metricValue).toBe(200);
  });
});
