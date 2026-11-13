import type { NextRequest } from 'next/server';
import { decodeLeaderboardCursor, type LeaderboardFilterQuery } from '@/features/leaderboards';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit/clientIp';
import {
  authRequired,
  clubAccessDenied,
  clubRequired,
  invalidQuery,
  leaderboardJson,
  segmentNotFound,
  serverError,
} from './http';
import {
  LEADERBOARD_SCOPES,
  LEADERBOARD_SPORTS,
  localLegendQuerySchema,
  leaderboardQuerySchema,
  parseQuery,
  parseSegmentId,
  segmentListQuerySchema,
  type LeaderboardQuery,
} from './schemas';
import {
  LeaderboardAuthRequiredError,
  LeaderboardClubAccessError,
  LeaderboardClubRequiredError,
  LeaderboardSegmentNotFoundError,
  getLeaderboardCapabilities,
  getLeaderboardClubs,
  getSegmentLeaderboardView,
  getSegmentLocalLegendsView,
  listSegmentLeaderboardSummaries,
} from './service';
import { getLeaderboardViewerId } from './session';

const READ_LIMIT = 120;
const READ_WINDOW_MS = 60_000;

function rateLimitIdentifier(viewerId: string | null, request: NextRequest): string {
  return viewerId ?? `ip:${clientIpFromHeaders(request.headers)}`;
}

async function enforceReadLimit(viewerId: string | null, request: NextRequest, scope: string) {
  return enforceRateLimit(rateLimitIdentifier(viewerId, request), {
    scope,
    limit: READ_LIMIT,
    windowMs: READ_WINDOW_MS,
    failMode: 'open',
  });
}

function filtersFromQuery(query: LeaderboardQuery): LeaderboardFilterQuery {
  return {
    period: query.period,
    scope: query.scope,
    clubId: query.clubId ?? null,
    gender: query.gender,
    ageGroup: query.ageGroup,
    weightClass: query.weightClass,
  };
}

function knownError(error: unknown, context: string) {
  if (error instanceof LeaderboardSegmentNotFoundError) return segmentNotFound();
  if (error instanceof LeaderboardAuthRequiredError) return authRequired();
  if (error instanceof LeaderboardClubRequiredError) return clubRequired();
  if (error instanceof LeaderboardClubAccessError) return clubAccessDenied();
  return serverError(context, error);
}

function resolveSegmentId(rawSegmentId: string) {
  return parseSegmentId(rawSegmentId);
}

/** GET /api/leaderboards/segments — cartes de l'index des classements. */
export async function handleListSegments(request: NextRequest) {
  const viewerId = await getLeaderboardViewerId();
  const limited = await enforceReadLimit(viewerId, request, 'leaderboards-list');
  if (limited) return limited;

  const parsed = parseQuery(segmentListQuerySchema, new URL(request.url).searchParams);
  if (parsed.issues) return invalidQuery(parsed.issues);

  try {
    const segments = listSegmentLeaderboardSummaries({
      viewerId,
      q: parsed.data?.q,
      sport: parsed.data?.sport,
      limit: parsed.data?.limit,
    });
    return leaderboardJson({ success: true, segments, total: segments.length });
  } catch (error) {
    return serverError('GET /api/leaderboards/segments', error);
  }
}

/** GET /api/leaderboards/filters — capacités S4.06 et clubs du spectateur. */
export async function handleFilters(request: NextRequest) {
  const viewerId = await getLeaderboardViewerId();
  const limited = await enforceReadLimit(viewerId, request, 'leaderboards-filters');
  if (limited) return limited;

  return leaderboardJson({
    success: true,
    capabilities: getLeaderboardCapabilities(),
    clubOptions: getLeaderboardClubs(viewerId),
    scopes: LEADERBOARD_SCOPES,
    sports: LEADERBOARD_SPORTS,
  });
}

/** GET /api/leaderboards/segments/:segmentId — classement filtré et paginé. */
export async function handleSegmentLeaderboard(request: NextRequest, rawSegmentId: string) {
  const viewerId = await getLeaderboardViewerId();
  const limited = await enforceReadLimit(viewerId, request, 'leaderboards-segment');
  if (limited) return limited;

  const segmentId = resolveSegmentId(rawSegmentId);
  if (!segmentId) {
    return invalidQuery([{ path: 'segmentId', message: 'Identifiant de segment invalide.' }]);
  }

  const query = parseQuery(leaderboardQuerySchema, new URL(request.url).searchParams);
  if (query.issues) return invalidQuery(query.issues);
  const parsed = query.data!;

  const offset = parsed.offset ?? (parsed.cursor ? decodeLeaderboardCursor(parsed.cursor) : 0);

  try {
    const view = getSegmentLeaderboardView(segmentId, {
      viewerId,
      query: filtersFromQuery(parsed),
      pagination: {
        limit: parsed.limit,
        offset,
      },
    });
    return leaderboardJson({
      success: true,
      segment: view.segment,
      leaderboard: view.leaderboard,
      antiCheat: view.antiCheat,
    });
  } catch (error) {
    return knownError(error, 'GET /api/leaderboards/segments/[segmentId]');
  }
}

/** GET /api/leaderboards/segments/:segmentId/local-legends — titres S4.08. */
export async function handleLocalLegends(request: NextRequest, rawSegmentId: string) {
  const viewerId = await getLeaderboardViewerId();
  const limited = await enforceReadLimit(viewerId, request, 'leaderboards-local-legends');
  if (limited) return limited;

  const segmentId = resolveSegmentId(rawSegmentId);
  if (!segmentId) {
    return invalidQuery([{ path: 'segmentId', message: 'Identifiant de segment invalide.' }]);
  }

  const query = parseQuery(localLegendQuerySchema, new URL(request.url).searchParams);
  if (query.issues) return invalidQuery(query.issues);
  const parsed = query.data!;

  try {
    const view = getSegmentLocalLegendsView(segmentId, {
      viewerId,
      scope: parsed.scope,
      clubId: parsed.clubId,
      windowDays: parsed.windowDays,
      minEffortsForTitle: parsed.minEfforts ?? parsed.minEffortsForTitle,
    });
    return leaderboardJson({
      success: true,
      segment: view.segment,
      localLegend: view.localLegend,
    });
  } catch (error) {
    return knownError(error, 'GET /api/leaderboards/segments/[segmentId]/local-legends');
  }
}

/** GET /api/leaderboards/segments/:segmentId/anti-cheat — agrégat sans identité. */
export async function handleAntiCheat(request: NextRequest, rawSegmentId: string) {
  const viewerId = await getLeaderboardViewerId();
  const limited = await enforceReadLimit(viewerId, request, 'leaderboards-anti-cheat');
  if (limited) return limited;

  const segmentId = resolveSegmentId(rawSegmentId);
  if (!segmentId) {
    return invalidQuery([{ path: 'segmentId', message: 'Identifiant de segment invalide.' }]);
  }

  const query = parseQuery(leaderboardQuerySchema, new URL(request.url).searchParams);
  if (query.issues) return invalidQuery(query.issues);
  const parsed = query.data!;

  try {
    const view = getSegmentLeaderboardView(segmentId, {
      viewerId,
      query: filtersFromQuery(parsed),
      pagination: { limit: 1 },
    });
    return leaderboardJson({
      success: true,
      segment: view.segment,
      antiCheat: view.antiCheat,
    });
  } catch (error) {
    return knownError(error, 'GET /api/leaderboards/segments/[segmentId]/anti-cheat');
  }
}
