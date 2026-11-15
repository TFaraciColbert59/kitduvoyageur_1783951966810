import { evaluateLeaderboardPrivacy } from './privacy';
import type {
  AthleteGender,
  AthletePrivacySnapshot,
  LeaderboardFilterCapabilities,
  LeaderboardFilterQuery,
  LeaderboardPaginationInput,
  LeaderboardTitle,
  LeaderboardViewerContext,
  RejectedEffortDiagnostic,
  SanitizedLeaderboardEntry,
  SanitizedLeaderboardFilters,
  SegmentDefinition,
  SegmentEffortInput,
  SegmentLeaderboardResult,
} from './types';
import { isWithinPeriodWindow, validateSegmentEffort } from './validation';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

const CYCLING_SPORTS = new Set(['cycling', 'mtb', 'gravel']);

export function getLeaderboardFilterCapabilities(): LeaderboardFilterCapabilities {
  return {
    supportedFilters: ['period', 'scope', 'clubId', 'gender'],
    removedFilters: ['age', 'weight'],
    periods: ['all_time', 'this_year', 'this_month', 'this_week', 'today', 'rolling_90d'],
    scopes: ['global', 'friends', 'club'],
  };
}

/**
 * Nettoie les filtres de classement selon le plan LKDV (S4.06) :
 * les sélecteurs âge et poids sont systématiquement retirés.
 */
export function sanitizeLeaderboardFilters(
  query: LeaderboardFilterQuery = {}
): SanitizedLeaderboardFilters {
  const strippedUnsupportedFilters: Array<'ageGroup' | 'weightClass'> = [];
  if (query.ageGroup !== undefined && query.ageGroup !== '') {
    strippedUnsupportedFilters.push('ageGroup');
  }
  if (query.weightClass !== undefined && query.weightClass !== '') {
    strippedUnsupportedFilters.push('weightClass');
  }

  return {
    period: query.period ?? 'all_time',
    scope: query.scope ?? 'global',
    clubId: query.scope === 'club' ? (query.clubId ?? null) : null,
    gender: query.gender ?? 'all',
    strippedUnsupportedFilters,
  };
}

export function encodeLeaderboardCursor(offset: number): string {
  return `offset:${Math.max(0, Math.floor(offset))}`;
}

export function decodeLeaderboardCursor(cursor?: string | null): number {
  if (!cursor) return 0;
  const match = /^offset:(\d+)$/.exec(cursor.trim());
  if (!match) return 0;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function compareEffortsDeterministic(
  a: { elapsedTimeS: number; achievedAt: string; effortId: string },
  b: { elapsedTimeS: number; achievedAt: string; effortId: string }
): number {
  if (a.elapsedTimeS !== b.elapsedTimeS) {
    return a.elapsedTimeS - b.elapsedTimeS;
  }
  const aMs = Date.parse(a.achievedAt);
  const bMs = Date.parse(b.achievedAt);
  if (aMs !== bMs) {
    return aMs - bMs;
  }
  return a.effortId.localeCompare(b.effortId);
}

export function getTitleForSportAndGender(
  sport: SegmentDefinition['sport'],
  gender: AthleteGender
): LeaderboardTitle {
  if (CYCLING_SPORTS.has(sport)) {
    return gender === 'women' ? 'QOM' : 'KOM';
  }
  return 'CR';
}

export interface BuildSegmentLeaderboardOptions {
  filters?: LeaderboardFilterQuery;
  viewer?: LeaderboardViewerContext;
  pagination?: LeaderboardPaginationInput;
  nowIso?: string;
  minCompletionRatio?: number;
  privacyDirectory?: ReadonlyMap<string, AthletePrivacySnapshot>;
  includeDiagnostics?: boolean;
}

/**
 * Construit le classement d'un segment (S4.05 / S4.06) avec :
 * - validation déterministe des efforts et anti-triche,
 * - respect strict P01 / S6.19 en fail-closed,
 * - déduplication par athlète (meilleur effort valide),
 * - attribution des titres KOM / QOM / CR,
 * - égalités stables et pagination déterministe.
 */
export function buildSegmentLeaderboard(
  segment: SegmentDefinition,
  efforts: ReadonlyArray<SegmentEffortInput>,
  options: BuildSegmentLeaderboardOptions = {}
): SegmentLeaderboardResult {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const filters = sanitizeLeaderboardFilters(options.filters);
  const viewer: LeaderboardViewerContext = options.viewer ?? {
    viewerId: null,
    isAuthenticated: false,
  };

  const diagnostics: RejectedEffortDiagnostic[] = [];
  let rejectedCount = 0;

  const recordRejection = (effort: SegmentEffortInput, reason: RejectedEffortDiagnostic['reason']) => {
    rejectedCount += 1;
    if (options.includeDiagnostics) {
      diagnostics.push({
        effortId: effort.effortId,
        userId: effort.userId,
        reason,
      });
    }
  };

  interface CandidateEffort {
    effort: SegmentEffortInput;
    athlete: AthletePrivacySnapshot;
    computedAverageSpeedKmh: number | null;
    gender: AthleteGender;
  }

  const bestByUser = new Map<string, CandidateEffort>();

  for (const effort of efforts) {
    const validation = validateSegmentEffort(effort, segment, {
      minCompletionRatio: options.minCompletionRatio,
    });
    if (!validation.valid) {
      recordRejection(effort, validation.reason!);
      continue;
    }

    if (!isWithinPeriodWindow(effort.achievedAt, filters.period, nowIso)) {
      recordRejection(effort, 'outside_period');
      continue;
    }

    const privacy = evaluateLeaderboardPrivacy(
      effort,
      filters.scope,
      filters.clubId,
      viewer,
      options.privacyDirectory
    );
    if (!privacy.allowed || !privacy.athlete) {
      recordRejection(effort, privacy.reason!);
      continue;
    }

    const gender: AthleteGender = effort.athleteGender ?? 'unspecified';
    if (filters.gender !== 'all' && gender !== filters.gender) {
      continue;
    }

    const existing = bestByUser.get(effort.userId);
    if (!existing || compareEffortsDeterministic(effort, existing.effort) < 0) {
      bestByUser.set(effort.userId, {
        effort,
        athlete: privacy.athlete,
        computedAverageSpeedKmh: validation.computedAverageSpeedKmh,
        gender,
      });
    }
  }

  const sortedCandidates = Array.from(bestByUser.values()).sort((a, b) =>
    compareEffortsDeterministic(a.effort, b.effort)
  );

  // Déterminer les meilleurs temps par titre avant pagination
  const isCycling = CYCLING_SPORTS.has(segment.sport);
  const bestOverallTimeS = sortedCandidates[0]?.effort.elapsedTimeS ?? null;
  const bestMenTimeS =
    sortedCandidates.find((c) => c.gender === 'men')?.effort.elapsedTimeS ?? null;
  const bestWomenTimeS =
    sortedCandidates.find((c) => c.gender === 'women')?.effort.elapsedTimeS ?? null;

  const rankedEntries: SanitizedLeaderboardEntry[] = [];
  let currentRank = 1;

  for (let i = 0; i < sortedCandidates.length; i += 1) {
    const candidate = sortedCandidates[i];
    if (i > 0 && candidate.effort.elapsedTimeS !== sortedCandidates[i - 1].effort.elapsedTimeS) {
      currentRank = i + 1;
    }

    const prevTied =
      i > 0 && candidate.effort.elapsedTimeS === sortedCandidates[i - 1].effort.elapsedTimeS;
    const nextTied =
      i < sortedCandidates.length - 1 &&
      candidate.effort.elapsedTimeS === sortedCandidates[i + 1].effort.elapsedTimeS;

    let title: LeaderboardTitle | null = null;
    if (isCycling) {
      if (candidate.gender === 'women' && bestWomenTimeS === candidate.effort.elapsedTimeS) {
        title = 'QOM';
      } else if (candidate.gender === 'men' && bestMenTimeS === candidate.effort.elapsedTimeS) {
        title = 'KOM';
      }
    } else if (bestOverallTimeS === candidate.effort.elapsedTimeS) {
      title = 'CR';
    }

    rankedEntries.push({
      rank: currentRank,
      isTied: prevTied || nextTied,
      effortId: candidate.effort.effortId,
      activityId: candidate.effort.activityId,
      userId: candidate.effort.userId,
      displayName: candidate.athlete.displayName || 'Voyageur LKDV',
      avatarUrl: candidate.athlete.avatarUrl ?? null,
      elapsedTimeS: candidate.effort.elapsedTimeS,
      movingTimeS: candidate.effort.movingTimeS ?? null,
      averageSpeedKmh: candidate.computedAverageSpeedKmh,
      achievedAt: candidate.effort.achievedAt,
      athleteGender: candidate.gender,
      title,
      isViewer: Boolean(viewer.isAuthenticated && viewer.viewerId === candidate.effort.userId),
    });
  }

  const rawLimit = options.pagination?.limit ?? DEFAULT_PAGE_LIMIT;
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.floor(rawLimit)));
  const offset =
    options.pagination?.offset !== undefined
      ? Math.max(0, Math.floor(options.pagination.offset))
      : decodeLeaderboardCursor(options.pagination?.cursor);

  const pagedEntries = rankedEntries.slice(offset, offset + limit);
  const hasMore = offset + pagedEntries.length < rankedEntries.length;
  const nextCursor = hasMore ? encodeLeaderboardCursor(offset + limit) : null;

  const viewerEntry =
    viewer.isAuthenticated && viewer.viewerId
      ? (rankedEntries.find((e) => e.userId === viewer.viewerId) ?? null)
      : null;

  const kom = rankedEntries.find((e) => e.title === 'KOM') ?? null;
  const qom = rankedEntries.find((e) => e.title === 'QOM') ?? null;
  const cr = rankedEntries.find((e) => e.title === 'CR') ?? null;

  return {
    segmentId: segment.segmentId,
    sport: segment.sport,
    filters,
    capabilities: getLeaderboardFilterCapabilities(),
    entries: pagedEntries,
    page: {
      limit,
      offset,
      totalEntries: rankedEntries.length,
      hasMore,
      nextCursor,
    },
    viewerEntry,
    titles: { kom, qom, cr },
    rejectedCount,
    ...(options.includeDiagnostics ? { diagnostics } : {}),
    computedAt: nowIso,
  };
}
