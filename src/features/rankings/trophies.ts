import {
  ChallengeProgressState,
  ChallengeRule,
  LocalLegendResult,
  PeakBaggingSummary,
  PeriodLeaderboardResult,
  TrophyBadge,
  TrophyShowcase,
} from './types';

export interface BuildTrophyShowcaseInput {
  userId: string;
  challengeStates?: readonly { rule: ChallengeRule; progress: ChallengeProgressState }[];
  localLegends?: readonly LocalLegendResult[];
  periodPodiums?: readonly PeriodLeaderboardResult[];
  peakSummary?: PeakBaggingSummary | null;
}

const PEAK_MILESTONE_THRESHOLDS = [1, 5, 10, 25, 50, 100] as const;

/**
 * S5.24: Builds a user's trophy showcase from verified challenges, Local Legend crowns,
 * period podiums (top 3), and Peak Bagging milestones.
 * Revoked/uncompleted challenges are marked `isRevoked: true` if they previously had a
 * compensated ledger entry and are excluded from active trophy counts.
 */
export function buildTrophyShowcase(input: BuildTrophyShowcaseInput): TrophyShowcase {
  const trophies: TrophyBadge[] = [];

  for (const item of input.challengeStates ?? []) {
    const { rule, progress } = item;
    if (progress.userId !== input.userId) {
      continue;
    }

    const hadCompensated = progress.ledger.some((entry) => entry.status === 'compensated');

    if (progress.isCompleted && progress.badgeAwarded) {
      trophies.push({
        id: `challenge:${rule.id}:v${rule.version}`,
        category: 'challenge_finisher',
        title: rule.rewardTitle || rule.title,
        subtitle: `Défi ${rule.title}`,
        awardedAt: progress.completedAt ?? rule.endsAt,
        sourceId: rule.id,
        isRevoked: false,
      });
    } else if (hadCompensated) {
      trophies.push({
        id: `challenge:${rule.id}:v${rule.version}`,
        category: 'challenge_finisher',
        title: rule.rewardTitle || rule.title,
        subtitle: `Défi ${rule.title} (révoqué après correction)`,
        awardedAt: rule.endsAt,
        sourceId: rule.id,
        isRevoked: true,
      });
    }
  }

  for (const legend of input.localLegends ?? []) {
    if (legend.leader && legend.leader.userId === input.userId && !legend.currentUserOptedOut) {
      trophies.push({
        id: `crown:legend:${legend.target.targetId}`,
        category: 'local_legend_crown',
        title: `Local Legend · ${legend.target.name}`,
        subtitle: `${legend.leader.effortCount} passages sur 90 jours`,
        awardedAt: legend.leader.lastEffortAt,
        sourceId: legend.target.targetId,
        isRevoked: false,
      });
    }
  }

  for (const leaderboard of input.periodPodiums ?? []) {
    const entry = leaderboard.currentUserEntry;
    if (entry && entry.rank >= 1 && entry.rank <= 3) {
      trophies.push({
        id: `podium:${leaderboard.window.periodKey}:${leaderboard.sport}:${entry.rank}`,
        category: 'period_podium',
        title: `Podium #${entry.rank} · ${leaderboard.window.periodKey}`,
        subtitle: `${leaderboard.sport} (${leaderboard.metric})`,
        awardedAt: leaderboard.window.endsAt,
        sourceId: leaderboard.window.periodKey,
        isRevoked: false,
        rank: entry.rank,
      });
    }
  }

  if (input.peakSummary && input.peakSummary.userId === input.userId) {
    const conquered = input.peakSummary.conqueredPeaksCount;
    for (const threshold of PEAK_MILESTONE_THRESHOLDS) {
      if (conquered >= threshold) {
        trophies.push({
          id: `peaks:milestone:${threshold}`,
          category: 'peak_milestone',
          title: threshold === 1 ? 'Premier sommet conquis' : `${threshold} sommets conquis`,
          subtitle: `Peak Bagging (${conquered}/${input.peakSummary.totalPeaksInCatalog})`,
          awardedAt:
            input.peakSummary.entries
              .map((e) => e.lastAscentAt)
              .filter((d): d is string => Boolean(d))
              .sort()
              .pop() ?? new Date().toISOString(),
          sourceId: `peaks:${threshold}`,
          isRevoked: false,
        });
      }
    }
  }

  const active = trophies.filter((t) => !t.isRevoked);

  return {
    userId: input.userId,
    totalActiveTrophies: active.length,
    crownsCount: active.filter((t) => t.category === 'local_legend_crown' || t.category === 'period_podium').length,
    finisherBadgesCount: active.filter((t) => t.category === 'challenge_finisher').length,
    peakMilestonesCount: active.filter((t) => t.category === 'peak_milestone').length,
    trophies,
  };
}
