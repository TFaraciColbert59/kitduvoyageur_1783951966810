import { describe, expect, it } from 'vitest';
import {
  applyActivityToChallengeProgress,
  buildChallengeLeaderboard,
  buildTrophyShowcase,
  CampaignEligibilityRule,
  ChallengeRule,
  compareProgressionWithPeers,
  computeCampaignParticipationMetrics,
  createInitialChallengeProgress,
  evaluateVirtualRaceParticipation,
  PrivacyPolicyContext,
  proposeBestEffortGoal,
  RankingActivityRecord,
  RankingUserProfile,
} from '../index';

const PROFILES: RankingUserProfile[] = [
  { userId: 'u1', displayName: 'Alice', avatarUrl: null },
  { userId: 'u2', displayName: 'Bob', avatarUrl: null },
  { userId: 'u3', displayName: 'Charlie (Blocked)', avatarUrl: null },
  { userId: 'u4', displayName: 'Diane (OptOut)', avatarUrl: null, peerComparisonOptOut: true },
];

const CONTEXT: PrivacyPolicyContext = {
  viewerId: 'u1',
  authorizedPeerIds: ['u2', 'u3', 'u4'],
  blockedUserIds: ['u3'],
};

describe('Challenges (K5.25, S5.20..S5.23, S6.26), Trophies (S5.24) & Peer Comparison', () => {
  const distanceRule: ChallengeRule = {
    id: 'chal-nov-20k',
    version: 1,
    kind: 'public',
    title: 'Défi 20 km Novembre',
    description: 'Courir 20 km en novembre',
    sport: 'running',
    criterion: 'distance_meters',
    targetValue: 20000,
    unit: 'm',
    startsAt: '2026-11-01T00:00:00.000Z',
    endsAt: '2026-11-30T23:59:59.999Z',
    rewardBadgeId: 'badge-nov-20k',
    rewardTitle: 'Finisher 20 km',
    rewardPoints: 100,
  };

  it('K5.25: idempotent replay and compensation on correction / deletion / flagging', () => {
    const act1: RankingActivityRecord = {
      id: 'act-1',
      userId: 'u1',
      sport: 'running',
      startedAt: '2026-11-05T08:00:00.000Z',
      durationSec: 3600,
      distanceMeters: 12000,
      elevationGainMeters: 100,
      visibility: 'public',
      isValid: true,
      isFlagged: false,
    };
    const act2: RankingActivityRecord = {
      id: 'act-2',
      userId: 'u1',
      sport: 'running',
      startedAt: '2026-11-08T08:00:00.000Z',
      durationSec: 3000,
      distanceMeters: 10000,
      elevationGainMeters: 80,
      visibility: 'public',
      isValid: true,
      isFlagged: false,
    };

    let state = createInitialChallengeProgress(distanceRule, 'u1');
    state = applyActivityToChallengeProgress(state, act1, distanceRule, '2026-11-05T09:00:00.000Z');
    // Replay act1: must NOT double-count
    state = applyActivityToChallengeProgress(state, act1, distanceRule, '2026-11-05T09:01:00.000Z');
    expect(state.currentValue).toBe(12000);
    expect(state.ledger).toHaveLength(1);

    // Apply act2 -> completes challenge
    state = applyActivityToChallengeProgress(state, act2, distanceRule, '2026-11-08T09:00:00.000Z');
    expect(state.currentValue).toBe(22000);
    expect(state.isCompleted).toBe(true);
    expect(state.badgeAwarded).toBe(true);

    // Showcase shows active finisher badge
    const showcaseActive = buildTrophyShowcase({
      userId: 'u1',
      challengeStates: [{ rule: distanceRule, progress: state }],
    });
    expect(showcaseActive.finisherBadgesCount).toBe(1);
    expect(showcaseActive.totalActiveTrophies).toBe(1);

    // Flag act2 -> compensated & trophy revoked (S5.24)
    const flaggedAct2: RankingActivityRecord = { ...act2, isFlagged: true };
    state = applyActivityToChallengeProgress(
      state,
      flaggedAct2,
      distanceRule,
      '2026-11-09T10:00:00.000Z'
    );
    expect(state.currentValue).toBe(12000);
    expect(state.isCompleted).toBe(false);
    expect(state.badgeAwarded).toBe(false);
    expect(state.ledger.some((e) => e.status === 'compensated' && e.reason === 'flagged')).toBe(true);

    const showcaseRevoked = buildTrophyShowcase({
      userId: 'u1',
      challengeStates: [{ rule: distanceRule, progress: state }],
    });
    expect(showcaseRevoked.totalActiveTrophies).toBe(0);
    expect(showcaseRevoked.trophies[0].isRevoked).toBe(true);
  });

  it('S5.21: isolates private invite-only challenges from non-invited users', () => {
    const privateRule: ChallengeRule = {
      ...distanceRule,
      id: 'priv-1',
      kind: 'private_invite',
      invitedUserIds: ['u1', 'u2'],
    };

    const activities: RankingActivityRecord[] = [
      {
        id: 'p1',
        userId: 'u1',
        sport: 'running',
        startedAt: '2026-11-05T08:00:00.000Z',
        durationSec: 3600,
        distanceMeters: 10000,
        elevationGainMeters: 100,
        visibility: 'followers',
        isValid: true,
        isFlagged: false,
      },
      {
        id: 'p2-non-invited',
        userId: 'u4',
        sport: 'running',
        startedAt: '2026-11-05T08:00:00.000Z',
        durationSec: 3600,
        distanceMeters: 30000,
        elevationGainMeters: 100,
        visibility: 'public',
        isValid: true,
        isFlagged: false,
      },
    ];

    const invitedView = buildChallengeLeaderboard(privateRule, activities, PROFILES, CONTEXT);
    expect(invitedView).toHaveLength(1);
    expect(invitedView?.[0].userId).toBe('u1');

    const nonInvitedView = buildChallengeLeaderboard(privateRule, activities, PROFILES, {
      viewerId: 'u4',
    });
    expect(nonInvitedView).toBeNull();
  });

  it('S5.22 & S5.23 & S6.26: best effort proposal, virtual race, and campaign metrics', () => {
    const activities: RankingActivityRecord[] = [
      {
        id: 'be-1',
        userId: 'u1',
        sport: 'running',
        startedAt: '2026-11-05T08:00:00.000Z',
        durationSec: 2500,
        distanceMeters: 10500,
        elevationGainMeters: 50,
        visibility: 'public',
        isValid: true,
        isFlagged: false,
        bestEfforts: [
          {
            distanceMeters: 10000,
            durationSec: 2400,
            activityId: 'be-1',
            achievedAt: '2026-11-05T08:40:00.000Z',
            sport: 'running',
          },
        ],
      },
      {
        id: 'be-2-private',
        userId: 'u2',
        sport: 'running',
        startedAt: '2026-11-06T08:00:00.000Z',
        durationSec: 2600,
        distanceMeters: 10000,
        elevationGainMeters: 50,
        visibility: 'private',
        isValid: true,
        isFlagged: false,
      },
    ];

    // S5.22 Best effort proposal
    const proposal = proposeBestEffortGoal(activities, 'u1', 'running', 10000, 5);
    expect(proposal?.previousBestDurationSec).toBe(2400);
    expect(proposal?.proposedTargetDurationSec).toBe(2280);
    expect(proposeBestEffortGoal(activities, 'u1', 'cycling', 10000, 5)).toBeNull();

    // S5.23 Virtual race
    const virtualRace: ChallengeRule = {
      ...distanceRule,
      id: 'vr-10k',
      kind: 'virtual_race',
      targetValue: 10000,
      partnerId: 'partner-utmb',
      partnerAvailable: true,
    };
    const vrResult = evaluateVirtualRaceParticipation(
      virtualRace,
      { raceId: 'vr-10k', userId: 'u1', registeredAt: '2026-11-01T10:00:00.000Z', status: 'registered' },
      activities,
      'u1'
    );
    expect(vrResult.eligible).toBe(true);
    expect(vrResult.finisherBadgeAwarded).toBe(true);
    expect(vrResult.bestDurationSec).toBe(2500);

    const vrNotRegistered = evaluateVirtualRaceParticipation(virtualRace, null, activities, 'u1');
    expect(vrNotRegistered.eligible).toBe(false);
    expect(vrNotRegistered.reasonIfIneligible).toBe('not_registered');

    // S6.26 Campaign metrics
    const campaign: CampaignEligibilityRule = {
      campaignId: 'camp-autumn',
      sponsorName: 'LKDV Partner',
      startsAt: '2026-11-01T00:00:00.000Z',
      endsAt: '2026-11-30T23:59:59.999Z',
      allowedSports: ['running'],
      minDistanceMeters: 5000,
      requiresPublicVisibility: true,
    };
    const metrics = computeCampaignParticipationMetrics(campaign, activities, PROFILES, CONTEXT);
    expect(metrics.uniqueParticipants).toBe(1);
    expect(metrics.validatedActivities).toBe(1);
    expect(metrics.rejectedActivities).toBe(1); // u2's private activity rejected
  });

  it('compares progression with authorized peers only and preserves null when absent', () => {
    const activities: RankingActivityRecord[] = [
      {
        id: 'pc-1',
        userId: 'u1',
        sport: 'running',
        startedAt: '2026-11-11T08:00:00.000Z',
        durationSec: 3600,
        distanceMeters: 10000,
        elevationGainMeters: null, // absent -> must stay null
        visibility: 'followers',
        isValid: true,
        isFlagged: false,
      },
      {
        id: 'pc-2',
        userId: 'u2',
        sport: 'running',
        startedAt: '2026-11-12T08:00:00.000Z',
        durationSec: 3000,
        distanceMeters: 8000,
        elevationGainMeters: 120,
        visibility: 'public',
        isValid: true,
        isFlagged: false,
      },
      {
        id: 'pc-3-blocked',
        userId: 'u3',
        sport: 'running',
        startedAt: '2026-11-12T08:00:00.000Z',
        durationSec: 3000,
        distanceMeters: 20000,
        elevationGainMeters: 300,
        visibility: 'public',
        isValid: true,
        isFlagged: false,
      },
    ];

    const comparison = compareProgressionWithPeers(
      activities,
      PROFILES,
      { periodKind: 'weekly', referenceDate: '2026-11-13T12:00:00.000Z', sport: 'running' },
      CONTEXT
    );

    expect(comparison.excludedPeerCount).toBe(2); // u3 blocked + u4 opted out
    expect(comparison.peers.map((p) => p.userId)).toEqual(['u2']);
    expect(comparison.currentUser.totalElevationGainMeters).toBeNull();
    expect(comparison.deltas[0].distanceDeltaMeters).toBe(2000);
    expect(comparison.deltas[0].elevationDeltaMeters).toBeNull();
  });
});
