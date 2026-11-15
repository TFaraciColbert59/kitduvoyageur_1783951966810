import { NextRequest } from 'next/server';
import {
  hideSegmentForUser,
  toggleSegmentStar,
  unhideSegmentForUser,
} from '@/features/segments';
import { requireUser } from '@/lib/api/requireUser';
import {
  badRequest,
  canViewSegment,
  json,
  notFound,
  serverError,
} from '@/lib/segments/http';
import { preferencesBodySchema } from '@/lib/segments/schemas';
import { resolveCanonicalSegment } from '@/lib/segments/service';
import { getPreferences, savePreferences } from '@/lib/segments/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/segments/preferences — favoris et masquages du lecteur. */
export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    return json({ preferences: getPreferences(auth.user.id) });
  } catch (error) {
    return serverError(error, 'GET /api/segments/preferences');
  }
}

/** PATCH /api/segments/preferences — étoile / masque un segment de façon idempotente. */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return badRequest('Corps JSON invalide.');
    }
    const parsed = preferencesBodySchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Préférence invalide.');
    }

    const segment = resolveCanonicalSegment(parsed.data.segmentId);
    if (!segment || !canViewSegment(segment, auth.user.id)) return notFound();

    const current = getPreferences(auth.user.id);
    const alreadyStarred = current.starredSegmentIds.includes(segment.id);
    const alreadyHidden = current.hiddenSegmentIds.includes(segment.id);

    let next = current;
    switch (parsed.data.action) {
      case 'star':
        if (!alreadyStarred) next = toggleSegmentStar(current, segment.id);
        break;
      case 'unstar':
        if (alreadyStarred) next = toggleSegmentStar(current, segment.id);
        break;
      case 'hide':
        if (!alreadyHidden) next = hideSegmentForUser(current, segment.id);
        break;
      case 'unhide':
        next = unhideSegmentForUser(current, segment.id);
        break;
    }

    return json({ preferences: savePreferences(next) });
  } catch (error) {
    return serverError(error, 'PATCH /api/segments/preferences');
  }
}
