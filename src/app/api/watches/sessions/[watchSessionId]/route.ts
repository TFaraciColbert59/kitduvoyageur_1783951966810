import { requireUser } from '@/lib/api/requireUser';
import { ok } from '@/lib/api/respond';
import { getWatchSession } from '@/features/compte/server/watches';
import { handleWatchError, rejected } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_ID = /^[A-Za-z0-9._:-]{1,160}$/;

/** GET /api/watches/sessions/[watchSessionId] — séance canonique rapprochée. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ watchSessionId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const watchSessionId = (await params).watchSessionId;
  if (!SESSION_ID.test(watchSessionId)) {
    return rejected('invalid_session_id', 'Identifiant de séance montre invalide.');
  }
  try {
    return ok({ session: getWatchSession(auth.user.id, watchSessionId) });
  } catch (error) {
    return handleWatchError(error);
  }
}
