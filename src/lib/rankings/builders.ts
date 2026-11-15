import {
  applyActivityToChallengeProgress,
  buildChallengeLeaderboard,
  buildPeriodLeaderboard,
  buildTrophyShowcase,
  compareProgressionWithPeers,
  computeLocalLegend,
  createInitialChallengeProgress,
  buildPeakBaggingSummary,
  evaluateVirtualRaceParticipation,
  proposeBestEffortGoal,
} from '@/features/rankings';
import type {
  BestEffortGoalProposal,
  ChallengeProgressState,
  ChallengeRule,
  LocalLegendResult,
  LocalLegendTarget,
  PeakBaggingSummary,
  PeakDefinition,
  PeerComparisonQuery,
  PeerComparisonResult,
  PeriodLeaderboardQuery,
  PeriodLeaderboardResult,
  PrivacyPolicyContext,
  RankingActivityRecord,
  RankingUserProfile,
  SportCategory,
  VirtualRaceRegistration,
} from '@/features/rankings/types';
import { getValidatedRaceRegistrationUrl } from '@/features/clubs';
import type {
  ChallengeItem,
  ChallengesPayload,
  LeaderboardPayload,
  LegendTargetOption,
  LocalLegendsPayload,
  PeaksPayload,
  PeersPayload,
  RankingsMeta,
  TrophiesPayload,
} from './types';
import type { LegendsQuery } from './query';

export function rankingsMeta(): RankingsMeta {
  return {
    generatedAt: new Date().toISOString(),
    privacy: 'fail_closed',
  };
}

export function attachSegmentIds(
  activities: readonly RankingActivityRecord[],
  segmentsBySession: ReadonlyMap<string, readonly string[]>
): RankingActivityRecord[] {
  return activities.map((activity) => {
    const segmentIds = segmentsBySession.get(activity.id);
    return segmentIds && segmentIds.length > 0
      ? { ...activity, segmentIds: [...segmentIds] }
      : activity;
  });
}

export function buildLeaderboardPayload(
  activities: readonly RankingActivityRecord[],
  profiles: readonly RankingUserProfile[],
  context: PrivacyPolicyContext,
  query: PeriodLeaderboardQuery,
  limit: number
): LeaderboardPayload {
  const result: PeriodLeaderboardResult = buildPeriodLeaderboard(activities, profiles, {
    ...query,
    limit,
  }, context);
  return { result, meta: rankingsMeta() };
}

function targetFromQuery(input: LegendsQuery, fallbackName: string): LocalLegendTarget {
  return {
    targetId: input.targetId ?? 'unknown',
    targetType: input.targetType,
    name: fallbackName,
    sport: 'hiking',
  };
}

export function buildLocalLegendsPayload(
  activities: readonly RankingActivityRecord[],
  profiles: readonly RankingUserProfile[],
  context: PrivacyPolicyContext,
  targets: readonly LegendTargetOption[],
  input: LegendsQuery,
  selectedTargetName?: string
): LocalLegendsPayload {
  let target: LocalLegendTarget | null = null;
  if (targets.length > 0) {
    target = input.targetId
      ? targets.find(
          (item) => item.targetId === input.targetId && item.targetType === input.targetType
        ) ?? null
      : targets[0];
    if (!target && input.targetId) {
      target = targetFromQuery(input, selectedTargetName || `Cible #${input.targetId}`);
    }
  } else if (input.targetId) {
    target = targetFromQuery(input, selectedTargetName || `Cible #${input.targetId}`);
  }

  const result: LocalLegendResult | null = target
    ? computeLocalLegend(target, activities, profiles, context, input.referenceDate, {
        windowDays: input.windowDays,
        minEffortsRequired: input.minEffortsRequired,
      })
    : null;

  return { targets: [...targets], result, meta: rankingsMeta() };
}

export function buildPeaksPayload(summary: PeakBaggingSummary | null): PeaksPayload {
  return { summary, meta: rankingsMeta() };
}

export function buildPeaksSummaryForViewer(
  viewerId: string,
  activities: readonly RankingActivityRecord[],
  peaks: readonly PeakDefinition[]
): PeaksPayload {
  if (!viewerId) return buildPeaksPayload(null);
  return buildPeaksPayload(buildPeakBaggingSummary(viewerId, activities, peaks));
}

function computeChallengeProgress(
  rule: ChallengeRule,
  viewerId: string,
  activities: readonly RankingActivityRecord[]
): ChallengeProgressState {
  let state = createInitialChallengeProgress(rule, viewerId);
  const viewerActivities = activities
    .filter((activity) => activity.userId === viewerId)
    .slice()
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  for (const activity of viewerActivities) {
    state = applyActivityToChallengeProgress(state, activity, rule);
  }
  return state;
}

export interface BuildChallengesOptions {
  registrationUrls?: ReadonlyMap<string, string | null>;
  raceRegistrations?: ReadonlyMap<string, VirtualRaceRegistration>;
  includeBestEffortProposals?: boolean;
}

const BEST_EFFORT_MILESTONES_M = [5000, 10000, 21100] as const;

function buildBestEffortProposalsForViewer(
  activities: readonly RankingActivityRecord[],
  viewerId: string
): BestEffortGoalProposal[] {
  if (!viewerId) return [];
  const enriched = activities
    .filter((activity) => activity.userId === viewerId && activity.isValid && !activity.deleted)
    .map((activity) => {
      if (activity.bestEfforts && activity.bestEfforts.length > 0) return activity;
      const dist = activity.distanceMeters ?? 0;
      const dur = activity.durationSec ?? 0;
      if (dist <= 0 || dur <= 0) return activity;
      const derived = BEST_EFFORT_MILESTONES_M.filter((m) => dist >= m).map((m) => ({
        sport: activity.sport,
        distanceMeters: m,
        durationSec: Math.max(1, Math.round(dur * (m / dist))),
        activityId: activity.id,
        achievedAt: activity.startedAt,
      }));
      return derived.length > 0 ? { ...activity, bestEfforts: derived } : activity;
    });

  const sports = Array.from(
    new Set(enriched.map((a) => a.sport).filter((s): s is SportCategory => s !== 'all'))
  );
  const proposals: BestEffortGoalProposal[] = [];
  for (const sport of sports) {
    for (const targetMeters of BEST_EFFORT_MILESTONES_M) {
      const proposal = proposeBestEffortGoal(enriched, viewerId, sport, targetMeters, 3);
      if (proposal) proposals.push(proposal);
    }
  }
  return proposals.slice(0, 6);
}

export function buildChallengesPayload(
  items: readonly { rule: ChallengeRule; trackable: boolean }[],
  activities: readonly RankingActivityRecord[],
  profiles: readonly RankingUserProfile[],
  context: PrivacyPolicyContext,
  viewerId: string,
  options: BuildChallengesOptions = {}
): ChallengesPayload {
  const challengeItems: ChallengeItem[] = items.map(({ rule, trackable }) => {
    const progress = trackable && viewerId ? computeChallengeProgress(rule, viewerId, activities) : null;
    const leaderboard = trackable
      ? buildChallengeLeaderboard(rule, activities, profiles, context)
      : null;
    const registrationUrl =
      rule.kind === 'virtual_race'
        ? getValidatedRaceRegistrationUrl(options.registrationUrls?.get(rule.id))
        : null;
    const virtualRaceResult =
      rule.kind === 'virtual_race' && viewerId
        ? evaluateVirtualRaceParticipation(
            rule,
            options.raceRegistrations?.get(rule.id) ?? null,
            activities,
            viewerId
          )
        : null;
    return {
      rule,
      trackable,
      progress,
      leaderboard,
      ...(registrationUrl ? { registrationUrl } : {}),
      ...(virtualRaceResult ? { virtualRaceResult } : {}),
    };
  });
  const bestEffortProposals =
    options.includeBestEffortProposals && viewerId
      ? buildBestEffortProposalsForViewer(activities, viewerId)
      : undefined;
  return {
    items: challengeItems,
    ...(bestEffortProposals ? { bestEffortProposals } : {}),
    meta: rankingsMeta(),
  };
}

export interface TrophyInputs {
  viewerId: string;
  challengeItems: readonly ChallengeItem[];
  localLegendResults: readonly LocalLegendResult[];
  periodPodiums: readonly PeriodLeaderboardResult[];
  peakSummary: PeakBaggingSummary | null;
}

export function buildTrophiesPayload(input: TrophyInputs): TrophiesPayload {
  const challengeStates = input.challengeItems
    .filter((item): item is ChallengeItem & { progress: ChallengeProgressState } =>
      item.progress !== null
    )
    .map((item) => ({ rule: item.rule, progress: item.progress }));

  return {
    showcase: buildTrophyShowcase({
      userId: input.viewerId,
      challengeStates,
      localLegends: input.localLegendResults,
      periodPodiums: input.periodPodiums,
      peakSummary: input.peakSummary,
    }),
    meta: rankingsMeta(),
  };
}

export function buildPeersPayload(
  activities: readonly RankingActivityRecord[],
  profiles: readonly RankingUserProfile[],
  context: PrivacyPolicyContext,
  query: PeerComparisonQuery,
  peaks: readonly PeakDefinition[],
  activeTrophiesByUser?: ReadonlyMap<string, number>
): PeersPayload {
  const result: PeerComparisonResult = compareProgressionWithPeers(
    activities,
    profiles,
    query,
    context,
    { peaks, activeTrophiesByUser }
  );
  return { result, meta: rankingsMeta() };
}

/**
 * Sélectionne les cibles qui peuvent porter une couronne Local Legend pour le
 * spectateur : ses propres passages d'abord, puis les plus disputées.
 */
export function selectCrownTargets(
  targets: readonly LegendTargetOption[],
  activities: readonly RankingActivityRecord[],
  viewerId: string,
  limit = 8
): LegendTargetOption[] {
  const viewerTargetIds = new Set<string>();
  for (const activity of activities) {
    if (activity.userId !== viewerId) continue;
    for (const id of activity.routeIds ?? []) viewerTargetIds.add(`route:${id}`);
    for (const id of activity.segmentIds ?? []) viewerTargetIds.add(`segment:${id}`);
  }
  return targets
    .slice()
    .sort((a, b) => {
      const aMine = viewerTargetIds.has(`${a.targetType}:${a.targetId}`) ? 1 : 0;
      const bMine = viewerTargetIds.has(`${b.targetType}:${b.targetId}`) ? 1 : 0;
      if (aMine !== bMine) return bMine - aMine;
      return b.effortCount - a.effortCount;
    })
    .slice(0, limit);
}
