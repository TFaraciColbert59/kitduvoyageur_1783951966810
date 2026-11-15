import { NextRequest } from 'next/server';
import { detectActivitySegmentEfforts } from '@/features/segments';
import { requireUser } from '@/lib/api/requireUser';
import {
  badRequest,
  forbidden,
  json,
  serverError,
} from '@/lib/segments/http';
import { detectEffortsBodySchema } from '@/lib/segments/schemas';
import { runSegmentMaintenance } from '@/lib/segments/service';
import { getSegment, listSegments, upsertEfforts } from '@/lib/segments/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/segments/detect — détecte les passages d'une activité sur le catalogue.
 * Le demandeur ne peut soumettre que sa propre trace (P01).
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
    const parsed = detectEffortsBodySchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Activité invalide.');
    }

    const { activity, segmentIds } = parsed.data;
    if (activity.userId !== auth.user.id) {
      return forbidden("L'activité source ne vous appartient pas.");
    }

    const catalog = segmentIds
      ? segmentIds
          .map((segmentId) => getSegment(segmentId))
          .filter((segment): segment is NonNullable<typeof segment> => segment !== null)
      : listSegments();

    const visibleCatalog = catalog.filter(
      (segment) =>
        !segment.deletedAt &&
        segment.canonicalSegmentId === null &&
        (segment.visibility === 'public' || segment.createdByUserId === auth.user.id)
    );

    const detected = detectActivitySegmentEfforts(activity, visibleCatalog);
    upsertEfforts(detected.allDetected);
    runSegmentMaintenance();

    return json(
      {
        validEfforts: detected.validEfforts,
        allDetected: detected.allDetected,
        counts: {
          valid: detected.validEfforts.length,
          total: detected.allDetected.length,
        },
      },
      201
    );
  } catch (error) {
    return serverError(error, 'POST /api/segments/detect');
  }
}
