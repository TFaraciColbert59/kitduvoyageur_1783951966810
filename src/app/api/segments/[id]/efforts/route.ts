import { NextRequest } from 'next/server';
import {
  buildPersonalEffortHistory,
  buildSegmentLeaderboard,
} from '@/features/segments';
import { requireUser } from '@/lib/api/requireUser';
import {
  badRequest,
  canViewSegment,
  json,
  notFound,
  serverError,
} from '@/lib/segments/http';
import { effortsQuerySchema } from '@/lib/segments/schemas';
import { resolveCanonicalSegment } from '@/lib/segments/service';
import { listEfforts } from '@/lib/segments/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/segments/[id]/efforts — historique personnel (PR) et classement.
 * Le classement communautaire applique P01 et S4.11 via le contrat.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const segment = resolveCanonicalSegment(id);
    if (!segment || !canViewSegment(segment, auth.user.id)) return notFound();

    const parsed = effortsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Paramètres invalides.');
    }

    const efforts = listEfforts(segment.id);
    const history = buildPersonalEffortHistory(efforts, segment.id, auth.user.id);
    const leaderboard = buildSegmentLeaderboard({
      segment,
      efforts,
      viewerUserId: auth.user.id,
      scope: parsed.data.scope,
      timeWindow: parsed.data.window,
      limit: parsed.data.limit,
    });

    return json({
      segmentId: segment.id,
      history,
      leaderboard,
      myEfforts: efforts.filter((effort) => effort.userId === auth.user.id),
    });
  } catch (error) {
    return serverError(error, 'GET /api/segments/[id]/efforts');
  }
}
