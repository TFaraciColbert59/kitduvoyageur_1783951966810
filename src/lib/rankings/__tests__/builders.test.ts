import { describe, expect, it } from 'vitest';
import type {
  ChallengeRule,
  PeakDefinition,
  PrivacyPolicyContext,
  RankingActivityRecord,
  RankingUserProfile,
} from '@/features/rankings/types';
import {
  attachSegmentIds,
  buildChallengesPayload,
  buildLeaderboardPayload,
  buildLocalLegendsPayload,
  buildPeaksSummaryForViewer,
  buildPeersPayload,
  buildTrophiesPayload,
} from '../builders';

const PROFILES: RankingUserProfile[] = [
  { userId: 'u1', displayName: 'Alice', avatarUrl: null },
  { userId: 'u2', displayName: 'Bob', avatarUrl: null },
  { userId: 'u3', displayName: 'Bloqué', avatarUrl: null },
  { userId: 'u4', displayName: 'Opt-out', avatarUrl: null, rankingsOptOut: true, peerComparisonOptOut: true },
];

function activity(overrides: Partial<RankingActivityRecord> & Pick<RankingActivityRecord, 'id' | 'userId'>): RankingActivityRecord {
  return {
    sport: 'hiking',
    startedAt: '2026-11-10T08:00:00.000Z',
    durationSec: 3600,
    distanceMeters: 10000,
    elevationGainMeters: 100,
    visibility: 'public',
    isValid: true,
    isFlagged: false,
    ...overrides,
  };
}

const CONTEXT: PrivacyPolicyContext = {
  viewerId: 'u1',
  authorizedPeerIds: ['u2', 'u3', 'u4'],
  blockedUserIds: ['u3'],
  rankingsOptOutUserIds: ['u4'],
};

describe('constructeurs de payloads G03', () => {
  it('classement : exclut privé, bloqué et opt-out avant le calcul', () => {
    const payload = buildLeaderboardPayload(
      [
        activity({ id: 'a1', userId: 'u1', distanceMeters: 12000 }),
        activity({ id: 'a2', userId: 'u2', distanceMeters: 50000, visibility: 'private' }),
        activity({ id: 'a3', userId: 'u3', distanceMeters: 90000 }),
        activity({ id: 'a4', userId: 'u4', distanceMeters: 70000 }),
      ],
      PROFILES,
      CONTEXT,
      {
        periodKind: 'weekly',
        referenceDate: '2026-11-13T12:00:00.000Z',
        metric: 'distanceMeters',
        sport: 'hiking',
        scope: 'public',
      },
      25
    );

    expect(payload.result.entries.map((entry) => entry.userId)).toEqual(['u1']);
    expect(payload.result.totalParticipants).toBe(1);
    expect(payload.meta.privacy).toBe('fail_closed');
  });

  it('Local Legends : fenêtre, minimum de passages et efforts pour détrôner', () => {
    const payload = buildLocalLegendsPayload(
      [
        activity({ id: 'l1', userId: 'u1', routeIds: ['12'] }),
        activity({ id: 'l2', userId: 'u1', routeIds: ['12'], startedAt: '2026-11-11T08:00:00.000Z' }),
        activity({ id: 'l3', userId: 'u2', routeIds: ['12'] }),
        activity({ id: 'l4', userId: 'u2', routeIds: ['12'], startedAt: '2026-11-12T08:00:00.000Z' }),
        activity({ id: 'l5', userId: 'u2', routeIds: ['12'], startedAt: '2026-11-13T08:00:00.000Z' }),
      ],
      PROFILES,
      { ...CONTEXT, rankingsOptOutUserIds: [] },
      [
        {
          targetId: '12',
          targetType: 'route',
          name: 'GR 20',
          sport: 'hiking',
          effortCount: 5,
        },
      ],
      {
        targetType: 'route',
        targetId: '12',
        referenceDate: '2026-11-13T12:00:00.000Z',
        windowDays: 90,
        minEffortsRequired: 2,
      }
    );

    expect(payload.result?.leader?.userId).toBe('u2');
    expect(payload.result?.leader?.effortCount).toBe(3);
    expect(payload.result?.currentUserEffortCount).toBe(2);
    expect(payload.result?.effortsToDethrone).toBe(2);
    expect(payload.targets[0].name).toBe('GR 20');
  });

  it('Peak Bagging : un sommet à moins de 50 m, aucun autre', () => {
    const peaks: PeakDefinition[] = [
      { id: 'p1', name: 'Pic A', elevationMeters: 2500, lat: 45.1, lng: 6.1 },
      { id: 'p2', name: 'Pic B', elevationMeters: 3000, lat: 45.5, lng: 6.5 },
    ];
    const payload = buildPeaksSummaryForViewer(
      'u1',
      [
        activity({
          id: 'peak-1',
          userId: 'u1',
          gpsTrack: [{ lat: 45.1001, lng: 6.1001 }],
        }),
      ],
      peaks
    );

    expect(payload.summary?.conqueredPeaksCount).toBe(1);
    expect(payload.summary?.entries.find((entry) => entry.peakId === 'p1')?.isConquered).toBe(true);
    expect(payload.summary?.entries.find((entry) => entry.peakId === 'p2')?.isConquered).toBe(false);
    expect(JSON.stringify(payload)).not.toContain('45.1001');
  });

  it('Défis et trophées : la progression vient des activités, le badge suit', () => {
    const rule: ChallengeRule = {
      id: 'chal-20k',
      version: 1,
      kind: 'public',
      title: '20 km de novembre',
      description: 'Cumuler 20 km',
      sport: 'hiking',
      criterion: 'distance_meters',
      targetValue: 20000,
      unit: 'm',
      startsAt: '2026-11-01T00:00:00.000Z',
      endsAt: '2026-11-30T23:59:59.999Z',
      rewardBadgeId: 'badge-20k',
      rewardTitle: 'Finisher 20 km',
      rewardPoints: 100,
    };
    const activities = [
      activity({ id: 'c1', userId: 'u1', distanceMeters: 12000 }),
      activity({ id: 'c2', userId: 'u1', distanceMeters: 10000, startedAt: '2026-11-11T08:00:00.000Z' }),
    ];
    const challenges = buildChallengesPayload(
      [{ rule, trackable: true }],
      activities,
      PROFILES,
      CONTEXT,
      'u1'
    );

    expect(challenges.items[0].progress?.isCompleted).toBe(true);
    expect(challenges.items[0].progress?.badgeAwarded).toBe(true);
    expect(challenges.items[0].leaderboard?.[0].userId).toBe('u1');

    const trophies = buildTrophiesPayload({
      viewerId: 'u1',
      challengeItems: challenges.items,
      localLegendResults: [],
      periodPodiums: [],
      peakSummary: null,
    });
    expect(trophies.showcase.finisherBadgesCount).toBe(1);
    expect(trophies.showcase.totalActiveTrophies).toBe(1);
  });

  it('pairs : les métriques absentes restent null', () => {
    const payload = buildPeersPayload(
      [
        activity({ id: 'p1', userId: 'u1', distanceMeters: 10000, elevationGainMeters: null }),
        activity({ id: 'p2', userId: 'u2', distanceMeters: 8000, elevationGainMeters: 120 }),
      ],
      PROFILES,
      CONTEXT,
      { periodKind: 'weekly', referenceDate: '2026-11-13T12:00:00.000Z', sport: 'hiking' },
      []
    );

    expect(payload.result.currentUser.totalElevationGainMeters).toBeNull();
    expect(payload.result.deltas[0].distanceDeltaMeters).toBe(2000);
    expect(payload.result.deltas[0].elevationDeltaMeters).toBeNull();
    expect(payload.result.excludedPeerCount).toBe(2);
  });

  it('rattache les passages de segments sans toucher aux autres champs', () => {
    const base = activity({ id: 's1', userId: 'u1' });
    const [enriched] = attachSegmentIds([base], new Map([['s1', ['99', '100']]]));
    expect(enriched.segmentIds).toEqual(['99', '100']);
    expect(enriched.distanceMeters).toBe(base.distanceMeters);
  });
});
