import { NextRequest } from 'next/server';
import {
  evaluateSegmentHazardStatus,
  reportSegmentHazard,
  resolveSegmentHazard,
  type SubmitSegmentHazardResult,
} from '@/features/segments';
import { requireUser } from '@/lib/api/requireUser';
import {
  badRequest,
  canEditSegment,
  canViewSegment,
  conflict,
  json,
  notFound,
  serverError,
  tooManyRequests,
  unprocessable,
} from '@/lib/segments/http';
import { hazardReportBodySchema } from '@/lib/segments/schemas';
import { resolveCanonicalSegment } from '@/lib/segments/service';
import {
  countHazardReportsByUserSince,
  listEfforts,
  listHazardReports,
  saveHazardReport,
  saveHazardReports,
  upsertEfforts,
  upsertSegment,
} from '@/lib/segments/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function rejectionResponse(result: SubmitSegmentHazardResult) {
  switch (result.rejectionReason) {
    case 'rate_limit_exceeded':
      return tooManyRequests('Trop de signalements en une heure. Réessayez plus tard.');
    case 'duplicate_reporter':
      return conflict('Vous avez déjà signalé un danger sur ce segment.');
    case 'invalid_description':
    default:
      return unprocessable('La description doit contenir au moins 5 caractères.');
  }
}

/** GET /api/segments/[id]/hazard — état consolidé du danger. */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const segment = resolveCanonicalSegment(id);
    if (!segment || !canViewSegment(segment, auth.user.id)) return notFound();

    const reports = listHazardReports(segment.id);
    return json({
      evaluation: evaluateSegmentHazardStatus(segment, reports),
      reports,
    });
  } catch (error) {
    return serverError(error, 'GET /api/segments/[id]/hazard');
  }
}

/**
 * POST /api/segments/[id]/hazard — signale un danger (S4.11).
 * Dès le seuil communautaire, le segment sort du classement et les notifications
 * de compétition sont supprimées (effets portés par le contrat).
 */
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
    const parsed = hazardReportBodySchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Signalement invalide.');
    }

    const existingReports = listHazardReports(segment.id);
    const reporterReportsLastHour = countHazardReportsByUserSince(
      auth.user.id,
      Date.now() - 3_600_000
    );
    const result = reportSegmentHazard({
      segment,
      existingReports,
      efforts: listEfforts(segment.id),
      reporterUserId: auth.user.id,
      reporterReportsLastHour,
      category: parsed.data.category,
      description: parsed.data.description,
      officialSource: parsed.data.officialSource === true && canEditSegment(segment, auth.user.id),
    });

    if (!result.accepted) return rejectionResponse(result);

    if (result.report) saveHazardReport(result.report);
    upsertSegment(result.updatedSegment);
    upsertEfforts(result.updatedEfforts);

    return json(
      {
        accepted: true,
        report: result.report,
        segment: result.updatedSegment,
        evaluation: result.evaluation,
      },
      201
    );
  } catch (error) {
    return serverError(error, 'POST /api/segments/[id]/hazard');
  }
}

/** DELETE /api/segments/[id]/hazard — lève le danger (créateur uniquement). */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const segment = resolveCanonicalSegment(id);
    if (!segment || !canViewSegment(segment, auth.user.id)) return notFound();
    if (!canEditSegment(segment, auth.user.id)) {
      return conflict('Seul le créateur peut lever un danger sur ce segment.');
    }

    const resolved = resolveSegmentHazard({
      segment,
      reports: listHazardReports(segment.id),
      efforts: listEfforts(segment.id),
    });
    saveHazardReports(resolved.updatedReports);
    upsertSegment(resolved.updatedSegment);
    upsertEfforts(resolved.updatedEfforts);

    return json({
      resolved: true,
      segment: resolved.updatedSegment,
      evaluation: resolved.evaluation,
    });
  } catch (error) {
    return serverError(error, 'DELETE /api/segments/[id]/hazard');
  }
}
