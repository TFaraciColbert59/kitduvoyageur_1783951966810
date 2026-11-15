import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { getLiveTrackingRuntime } from '@/features/compte/live-tracking/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Alias de `/api/live-tracking/status` pour les clients qui lisent la racine. */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const sessionId = new URL(request.url).searchParams.get('sessionId') ?? undefined;
  if (sessionId !== undefined && (sessionId.length === 0 || sessionId.length > 128)) {
    return fail('not_found', 'Séance introuvable.');
  }

  try {
    return ok(await getLiveTrackingRuntime().getStatus(auth.user.id, sessionId));
  } catch {
    return fail('server', 'Impossible de charger le suivi en direct.');
  }
}
