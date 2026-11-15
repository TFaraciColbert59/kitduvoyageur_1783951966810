import { NextRequest } from 'next/server';
import {
  createSegmentFromActivity,
  searchSegments,
  type SegmentCrudValidationError,
} from '@/features/segments';
import { requireUser } from '@/lib/api/requireUser';
import {
  badRequest,
  forbidden,
  json,
  serverError,
  unprocessable,
} from '@/lib/segments/http';
import { createSegmentBodySchema, listSegmentsQuerySchema } from '@/lib/segments/schemas';
import { runSegmentMaintenance } from '@/lib/segments/service';
import {
  getPreferences,
  getSegment,
  listSegments,
  upsertSegment,
} from '@/lib/segments/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CRUD_ERROR_MESSAGES: Record<SegmentCrudValidationError, string> = {
  invalid_name: 'Le nom doit contenir au moins 3 caractères.',
  invalid_bounds: 'Les bornes du segment sont invalides.',
  too_few_points: 'Le segment doit contenir au moins 3 points.',
  segment_too_short: 'Le segment est trop court (minimum 120 m).',
  segment_too_long: 'Le segment est trop long (maximum 80 km).',
  manual_or_indoor_source: 'Une activité manuelle ou en intérieur ne peut pas créer de segment.',
  privacy_zone_conflict_for_public_segment:
    'Le tracé traverse une zone masquée : le segment doit rester privé.',
  gps_gap_in_source_trace: 'La trace source contient un saut GPS trop important.',
  unauthorized_not_owner: 'Seul le créateur peut modifier ce segment.',
};

/**
 * GET /api/segments — recherche, favoris, masquage personnel et filtre sport.
 * P01 : les segments privés d'autrui ne sont jamais retournés.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = listSegmentsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Paramètres de recherche invalides.');
    }

    const { q, sport, lat, lng, radius, includeHidden, limit } = parsed.data;
    if ((lat === undefined) !== (lng === undefined)) {
      return badRequest('Les paramètres lat et lng doivent être fournis ensemble.');
    }

    const preferences = getPreferences(auth.user.id);
    const result = searchSegments(listSegments(), {
      query: q,
      sportFilter: sport ?? null,
      viewerUserId: auth.user.id,
      preferences,
      nearCenter: lat !== undefined && lng !== undefined ? { lat, lng } : null,
      maxRadiusM: radius,
      includeHidden,
      limit: limit ?? 50,
    });

    return json({ ...result, preferences });
  } catch (error) {
    return serverError(error, 'GET /api/segments');
  }
}

/**
 * POST /api/segments — crée un segment depuis une tranche d'activité GPS.
 * L'activité doit appartenir au demandeur ; la fusion S4.04 est rejouée après création.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return badRequest('Corps JSON invalide.');
    }

    const parsed = createSegmentBodySchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Segment invalide.');
    }

    const body = parsed.data;
    if (body.activity.userId !== auth.user.id) {
      return forbidden("L'activité source ne vous appartient pas.");
    }

    const created = createSegmentFromActivity({
      segmentId: body.segmentId,
      name: body.name,
      activity: body.activity,
      startPointIndex: body.startPointIndex,
      endPointIndex: body.endPointIndex,
      visibility: body.visibility,
      sport: body.sport,
      surface: body.surface,
    });

    if (!created.ok || !created.segment) {
      return unprocessable(
        created.error ? CRUD_ERROR_MESSAGES[created.error] : 'Création impossible.',
        created.error ?? 'validation_failed'
      );
    }

    upsertSegment(created.segment);
    const maintenance = runSegmentMaintenance();
    const canonical =
      getSegment(created.segment.id) ??
      maintenance.segments.find((segment) => segment.id === created.segment!.id) ??
      created.segment;

    return json(
      {
        segment: canonical,
        mergedInto: canonical.canonicalSegmentId,
        verified: canonical.verified,
      },
      201
    );
  } catch (error) {
    return serverError(error, 'POST /api/segments');
  }
}
