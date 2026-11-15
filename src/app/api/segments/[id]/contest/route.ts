import { NextRequest } from 'next/server';
import {
  contestEffortExclusion,
  type EffortReviewRecord,
} from '@/features/segments';
import { requireUser } from '@/lib/api/requireUser';
import {
  badRequest,
  canViewSegment,
  forbidden,
  json,
  notFound,
  serverError,
} from '@/lib/segments/http';
import { effortContestBodySchema } from '@/lib/segments/schemas';
import { resolveCanonicalSegment } from '@/lib/segments/service';
import {
  getEffort,
  getEffortFlags,
  getEffortReview,
  saveEffortReview,
  upsertEfforts,
} from '@/lib/segments/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function reviewFallback(effort: NonNullable<ReturnType<typeof getEffort>>, flagCount: number): EffortReviewRecord {
  return {
    effortId: effort.effortId,
    segmentId: effort.segmentId,
    ownerUserId: effort.userId,
    machineReasons: effort.exclusionReasons.filter((reason) => reason !== 'flagged_by_community'),
    communityFlagsCount: flagCount,
    status:
      effort.status === 'excluded'
        ? 'excluded'
        : effort.status === 'under_review'
          ? 'under_review'
          : 'valid',
    redactedSummary: {
      elapsedDurationS: effort.elapsedDurationS,
      avgSpeedKmh: effort.avgSpeedKmh,
      maxSpeedKmh: effort.maxSpeedKmh,
      sport: effort.sport,
    },
  };
}

/** POST /api/segments/[id]/contest — le propriétaire conteste une exclusion (S4.12). */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const segment = resolveCanonicalSegment(id);
    if (!segment || !canViewSegment(segment, auth.user.id)) return notFound();

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return badRequest('Corps JSON invalide.');
    }
    const parsed = effortContestBodySchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Contestation invalide.');
    }

    const effort = getEffort(parsed.data.effortId);
    if (!effort || effort.segmentId !== segment.id) return notFound('Effort introuvable.');
    if (effort.userId !== auth.user.id) {
      return forbidden('Seul le propriétaire de l’effort peut le contester.');
    }

    const review =
      getEffortReview(effort.effortId) ??
      reviewFallback(effort, getEffortFlags(effort.effortId).length);
    const result = contestEffortExclusion({
      effort,
      reviewRecord: review,
      requesterUserId: auth.user.id,
      justification: parsed.data.justification,
    });

    if (!result.allowed) {
      return badRequest(
        'Cette exclusion ne peut pas être contestée (trace incomplète, mauvais sens ou activité manuelle).'
      );
    }

    saveEffortReview(result.reviewRecord);
    upsertEfforts([result.updatedEffort]);

    return json({
      contested: true,
      effort: result.updatedEffort,
      review: result.reviewRecord,
    });
  } catch (error) {
    return serverError(error, 'POST /api/segments/[id]/contest');
  }
}
