import { NextRequest } from 'next/server';
import { flagSegmentEffort, type EffortFlagRecord } from '@/features/segments';
import { requireUser } from '@/lib/api/requireUser';
import {
  badRequest,
  canViewSegment,
  conflict,
  forbidden,
  json,
  notFound,
  serverError,
  tooManyRequests,
} from '@/lib/segments/http';
import { effortFlagBodySchema } from '@/lib/segments/schemas';
import { resolveCanonicalSegment } from '@/lib/segments/service';
import {
  countEffortFlagsByUserSince,
  getEffort,
  getEffortFlags,
  saveEffortFlag,
  saveEffortReview,
  upsertEfforts,
} from '@/lib/segments/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/segments/[id]/flags — signale un effort suspect (S4.12). */
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
    const parsed = effortFlagBodySchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Signalement invalide.');
    }

    const effort = getEffort(parsed.data.effortId);
    if (!effort || effort.segmentId !== segment.id) return notFound('Effort introuvable.');

    const nowIso = new Date().toISOString();
    const result = flagSegmentEffort({
      effort,
      existingFlags: getEffortFlags(effort.effortId),
      reporterUserId: auth.user.id,
      reporterFlagsLastHour: countEffortFlagsByUserSince(auth.user.id, Date.now() - 3_600_000),
      category: parsed.data.category,
      comment: parsed.data.comment,
      nowIso,
    });

    if (!result.accepted) {
      switch (result.reason) {
        case 'self_flag_not_allowed':
          return forbidden('Vous ne pouvez pas signaler votre propre effort.');
        case 'duplicate_reporter':
          return conflict('Vous avez déjà signalé cet effort.');
        case 'rate_limit_exceeded':
          return tooManyRequests('Trop de signalements en une heure. Réessayez plus tard.');
        case 'empty_comment':
        default:
          return badRequest('Un commentaire est requis.');
      }
    }

    const flag: EffortFlagRecord = {
      flagId: `flag_${effort.effortId}_${auth.user.id}_${Date.parse(nowIso)}`,
      effortId: effort.effortId,
      segmentId: segment.id,
      reporterUserId: auth.user.id,
      category: parsed.data.category,
      comment: parsed.data.comment.trim(),
      createdAt: nowIso,
    };
    saveEffortFlag(flag);
    saveEffortReview(result.reviewRecord);
    upsertEfforts([result.updatedEffort]);

    return json(
      {
        accepted: true,
        flag,
        effort: result.updatedEffort,
        review: result.reviewRecord,
      },
      201
    );
  } catch (error) {
    return serverError(error, 'POST /api/segments/[id]/flags');
  }
}
