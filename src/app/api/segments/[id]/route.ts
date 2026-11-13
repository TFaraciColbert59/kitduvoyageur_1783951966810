import { NextRequest } from 'next/server';
import {
  deleteSegment,
  evaluateSegmentHazardStatus,
  updateSegment,
  type SegmentCrudValidationError,
} from '@/features/segments';
import { requireUser } from '@/lib/api/requireUser';
import {
  badRequest,
  canEditSegment,
  canViewSegment,
  conflict,
  forbidden,
  json,
  notFound,
  serverError,
  unprocessable,
} from '@/lib/segments/http';
import { updateSegmentBodySchema } from '@/lib/segments/schemas';
import { resolveCanonicalSegment, runSegmentMaintenance } from '@/lib/segments/service';
import {
  getPreferences,
  getSegment,
  listEfforts,
  listHazardReports,
  replaceEffortsForSegment,
  upsertSegment,
} from '@/lib/segments/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPDATE_ERROR_MESSAGES: Record<SegmentCrudValidationError, string> = {
  invalid_name: 'Le nom doit contenir au moins 3 caractères.',
  invalid_bounds: 'Les bornes du segment sont invalides.',
  too_few_points: 'Le segment doit contenir au moins 3 points.',
  segment_too_short: 'Le segment est trop court (minimum 120 m).',
  segment_too_long: 'Le segment est trop long (maximum 80 km).',
  manual_or_indoor_source: 'Activité source invalide.',
  privacy_zone_conflict_for_public_segment:
    'Le tracé traverse une zone masquée : le segment doit rester privé.',
  gps_gap_in_source_trace: 'La trace source contient un saut GPS trop important.',
  unauthorized_not_owner: 'Seul le créateur peut modifier ce segment.',
};

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/segments/[id] — fiche, état de danger et préférences du lecteur. */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const segment = resolveCanonicalSegment(id);
    if (!segment || !canViewSegment(segment, auth.user.id)) return notFound();

    const reports = listHazardReports(segment.id);
    return json({
      segment,
      requestedId: id,
      mergedInto: segment.id !== id ? segment.id : null,
      hazard: evaluateSegmentHazardStatus(segment, reports),
      hazardReports: reports,
      effortsCount: listEfforts(segment.id).length,
      preferences: getPreferences(auth.user.id),
    });
  } catch (error) {
    return serverError(error, 'GET /api/segments/[id]');
  }
}

/** PATCH /api/segments/[id] — nom, sport, surface, visibilité ou bornes. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const segment = getSegment(id);
    if (!segment || !canViewSegment(segment, auth.user.id)) return notFound();
    if (!canEditSegment(segment, auth.user.id)) {
      return forbidden('Seul le créateur peut modifier ce segment.');
    }
    if (segment.canonicalSegmentId) {
      return conflict('Ce segment a été fusionné dans un segment canonique.');
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return badRequest('Corps JSON invalide.');
    }

    const parsed = updateSegmentBodySchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Modification invalide.');
    }
    const body = parsed.data;
    if (body.newBounds && body.newBounds.activity.userId !== auth.user.id) {
      return forbidden("L'activité source ne vous appartient pas.");
    }

    const existingEfforts = listEfforts(segment.id);
    const updated = updateSegment({
      segment,
      actorUserId: auth.user.id,
      name: body.name,
      sport: body.sport,
      surface: body.surface,
      visibility: body.visibility,
      newBounds: body.newBounds,
      existingEfforts,
    });

    if (!updated.ok) {
      return unprocessable(
        updated.error ? UPDATE_ERROR_MESSAGES[updated.error] : 'Modification impossible.',
        updated.error ?? 'validation_failed'
      );
    }

    upsertSegment(updated.segment);
    replaceEffortsForSegment(segment.id, updated.updatedEfforts);
    if (updated.requiresEffortRecomputation) {
      runSegmentMaintenance();
    }

    return json({
      segment: getSegment(segment.id) ?? updated.segment,
      requiresEffortRecomputation: updated.requiresEffortRecomputation,
      preferences: getPreferences(auth.user.id),
    });
  } catch (error) {
    return serverError(error, 'PATCH /api/segments/[id]');
  }
}

/** DELETE /api/segments/[id] — suppression logique par le créateur uniquement. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const segment = getSegment(id);
    if (!segment || !canViewSegment(segment, auth.user.id)) return notFound();
    if (!canEditSegment(segment, auth.user.id)) {
      return forbidden('Seul le créateur peut supprimer ce segment.');
    }

    const deleted = deleteSegment({
      segment,
      actorUserId: auth.user.id,
      existingEfforts: listEfforts(segment.id),
    });
    if (!deleted.ok) {
      return forbidden(UPDATE_ERROR_MESSAGES[deleted.error ?? 'unauthorized_not_owner']);
    }

    upsertSegment(deleted.deletedSegment);
    replaceEffortsForSegment(segment.id, deleted.remainingEfforts);
    return json({ deleted: true, segment: deleted.deletedSegment });
  } catch (error) {
    return serverError(error, 'DELETE /api/segments/[id]');
  }
}
