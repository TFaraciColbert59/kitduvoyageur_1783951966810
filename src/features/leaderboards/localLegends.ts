import { evaluateLeaderboardPrivacy } from './privacy';
import type {
  AthletePrivacySnapshot,
  LeaderboardScope,
  LeaderboardViewerContext,
  LocalLegendEntry,
  LocalLegendResult,
  SegmentDefinition,
  SegmentEffortInput,
} from './types';
import { validateSegmentEffort } from './validation';

export const DEFAULT_LOCAL_LEGEND_WINDOW_DAYS = 90;
export const DEFAULT_LOCAL_LEGEND_MIN_EFFORTS = 3;

export interface ComputeLocalLegendsOptions {
  windowDays?: number;
  minEffortsForTitle?: number;
  scope?: LeaderboardScope;
  clubId?: string | null;
  viewer?: LeaderboardViewerContext;
  nowIso?: string;
  minCompletionRatio?: number;
  privacyDirectory?: ReadonlyMap<string, AthletePrivacySnapshot>;
}

/**
 * Calcule le classement Local Legends sur une fenêtre glissante (S4.08) :
 * - compte uniquement les passages valides (anti-triche) et autorisés (P01/S6.19),
 * - déduplique par `effortId` pour qu'un même passage ne compte qu'une fois,
 * - gère les égalités de manière déterministe et masque la mention si donnée absente
 *   ou non autorisée.
 */
export function computeLocalLegends(
  segment: SegmentDefinition,
  efforts: ReadonlyArray<SegmentEffortInput>,
  options: ComputeLocalLegendsOptions = {}
): LocalLegendResult {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const windowDays = Math.max(1, Math.floor(options.windowDays ?? DEFAULT_LOCAL_LEGEND_WINDOW_DAYS));
  const windowStartMs = nowMs - windowDays * 86_400_000;
  const windowStartIso = new Date(windowStartMs).toISOString();
  const minEffortsForTitle = Math.max(
    1,
    Math.floor(options.minEffortsForTitle ?? DEFAULT_LOCAL_LEGEND_MIN_EFFORTS)
  );

  const scope: LeaderboardScope = options.scope ?? 'global';
  const clubId = scope === 'club' ? (options.clubId ?? null) : null;
  const viewer: LeaderboardViewerContext = options.viewer ?? {
    viewerId: null,
    isAuthenticated: false,
  };

  interface UserAggregate {
    athlete: AthletePrivacySnapshot;
    effortIds: Set<string>;
    bestElapsedTimeS: number;
    lastEffortMs: number;
    lastEffortAt: string;
  }

  const byUser = new Map<string, UserAggregate>();
  const seenEffortIds = new Set<string>();
  let rejectedCount = 0;
  let totalEligiblePassages = 0;

  for (const effort of efforts) {
    if (seenEffortIds.has(effort.effortId)) {
      continue;
    }

    const validation = validateSegmentEffort(effort, segment, {
      minCompletionRatio: options.minCompletionRatio,
    });
    if (!validation.valid) {
      rejectedCount += 1;
      continue;
    }

    const achievedMs = Date.parse(effort.achievedAt);
    if (!Number.isFinite(achievedMs) || achievedMs < windowStartMs || achievedMs > nowMs) {
      rejectedCount += 1;
      continue;
    }

    const privacy = evaluateLeaderboardPrivacy(
      effort,
      scope,
      clubId,
      viewer,
      options.privacyDirectory
    );
    if (!privacy.allowed || !privacy.athlete) {
      rejectedCount += 1;
      continue;
    }

    seenEffortIds.add(effort.effortId);
    totalEligiblePassages += 1;

    const current = byUser.get(effort.userId);
    if (!current) {
      const ids = new Set<string>();
      ids.add(effort.effortId);
      byUser.set(effort.userId, {
        athlete: privacy.athlete,
        effortIds: ids,
        bestElapsedTimeS: effort.elapsedTimeS,
        lastEffortMs: achievedMs,
        lastEffortAt: effort.achievedAt,
      });
    } else {
      current.effortIds.add(effort.effortId);
      if (effort.elapsedTimeS < current.bestElapsedTimeS) {
        current.bestElapsedTimeS = effort.elapsedTimeS;
      }
      if (achievedMs > current.lastEffortMs) {
        current.lastEffortMs = achievedMs;
        current.lastEffortAt = effort.achievedAt;
      }
    }
  }

  const sorted = Array.from(byUser.values()).sort((a, b) => {
    const countDiff = b.effortIds.size - a.effortIds.size;
    if (countDiff !== 0) return countDiff;
    if (a.bestElapsedTimeS !== b.bestElapsedTimeS) {
      return a.bestElapsedTimeS - b.bestElapsedTimeS;
    }
    if (b.lastEffortMs !== a.lastEffortMs) {
      return b.lastEffortMs - a.lastEffortMs;
    }
    return a.athlete.userId.localeCompare(b.athlete.userId);
  });

  const topCount = sorted[0]?.effortIds.size ?? 0;
  const hasQualifiedLegend = topCount >= minEffortsForTitle;

  const rankings: LocalLegendEntry[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i += 1) {
    const item = sorted[i];
    const count = item.effortIds.size;
    if (i > 0 && count !== sorted[i - 1].effortIds.size) {
      currentRank = i + 1;
    }

    const prevTied = i > 0 && count === sorted[i - 1].effortIds.size;
    const nextTied = i < sorted.length - 1 && count === sorted[i + 1].effortIds.size;

    rankings.push({
      rank: currentRank,
      isTied: prevTied || nextTied,
      userId: item.athlete.userId,
      displayName: item.athlete.displayName || 'Voyageur LKDV',
      avatarUrl: item.athlete.avatarUrl ?? null,
      effortCount: count,
      bestElapsedTimeS: item.bestElapsedTimeS,
      lastEffortAt: item.lastEffortAt,
      isLocalLegend: hasQualifiedLegend && count === topCount,
      isViewer: Boolean(viewer.isAuthenticated && viewer.viewerId === item.athlete.userId),
    });
  }

  const tiedLegends = rankings.filter((r) => r.isLocalLegend);
  const legend = tiedLegends.length === 1 ? tiedLegends[0] : (tiedLegends[0] ?? null);
  const viewerStanding =
    viewer.isAuthenticated && viewer.viewerId
      ? (rankings.find((r) => r.userId === viewer.viewerId) ?? null)
      : null;

  const shouldDisplayMention =
    !segment.isHazardous &&
    !segment.isArchived &&
    tiedLegends.length > 0;

  return {
    segmentId: segment.segmentId,
    sport: segment.sport,
    windowDays,
    windowStartIso,
    windowEndIso: nowIso,
    minEffortsForTitle,
    shouldDisplayMention,
    legend,
    tiedLegends,
    rankings,
    viewerStanding,
    totalEligiblePassages,
    rejectedCount,
    computedAt: nowIso,
  };
}
