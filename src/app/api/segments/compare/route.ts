import { NextRequest } from 'next/server';
import { compareSegmentEfforts } from '@/features/segments';
import { requireUser } from '@/lib/api/requireUser';
import {
  badRequest,
  canViewSegment,
  forbidden,
  json,
  notFound,
  serverError,
} from '@/lib/segments/http';
import { compareEffortsBodySchema } from '@/lib/segments/schemas';
import { resolveCanonicalSegment } from '@/lib/segments/service';
import { getEffort } from '@/lib/segments/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/segments/compare — comparaison point par point de deux efforts.
 * P01 : la trace brute d'un autre athlète n'est jamais acceptée ni renvoyée ;
 * seuls les agrégats déjà éligibles au classement public sont comparables.
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
    const parsed = compareEffortsBodySchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Comparaison invalide.');
    }

    const body = parsed.data;
    const segment = resolveCanonicalSegment(body.segmentId);
    if (!segment || !canViewSegment(segment, auth.user.id)) return notFound();

    const candidate = getEffort(body.candidateEffortId);
    const reference = getEffort(body.referenceEffortId);
    if (
      !candidate ||
      !reference ||
      candidate.segmentId !== segment.id ||
      reference.segmentId !== segment.id
    ) {
      return notFound('Effort introuvable sur ce segment.');
    }

    const involvesOtherAthlete =
      candidate.userId !== auth.user.id || reference.userId !== auth.user.id;
    if (involvesOtherAthlete) {
      if (
        segment.visibility !== 'public' ||
        segment.hazardous ||
        !candidate.eligibleForPublicLeaderboard ||
        !reference.eligibleForPublicLeaderboard
      ) {
        return forbidden('Ces efforts ne sont pas publics et comparables.');
      }
    }

    const candidateTrackPoints =
      candidate.userId === auth.user.id ? body.candidateTrackPoints : undefined;
    const referenceTrackPoints =
      reference.userId === auth.user.id ? body.referenceTrackPoints : undefined;

    const result = compareSegmentEfforts({
      segment,
      candidateEffort: candidate,
      referenceEffort: reference,
      candidateTrackPoints,
      referenceTrackPoints,
      stepsCount: body.stepsCount,
    });

    return json({ comparison: result });
  } catch (error) {
    return serverError(error, 'POST /api/segments/compare');
  }
}
