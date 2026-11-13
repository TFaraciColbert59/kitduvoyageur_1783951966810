import { z } from 'zod';

import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { getLiveTrackingRuntime } from '@/features/compte/live-tracking/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Start = z
  .object({
    sessionId: z.string().trim().min(1).max(128).optional(),
    status: z.enum(['active', 'paused']).optional(),
    startedAtMs: z.number().int().nonnegative().optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    return ok({ sessions: await getLiveTrackingRuntime().listSessions(auth.user.id) });
  } catch {
    return fail('server', 'Impossible de charger les séances.');
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = Start.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail('not_found', 'Séance invalide.');

  try {
    const result = await getLiveTrackingRuntime().startSession(auth.user.id, body.data);
    if (!result.ok) {
      if (result.error === 'unauthorized') return fail('forbidden', 'Séance non autorisée.');
      if (result.error === 'session_ended') return fail('conflict', 'Cette séance est terminée.');
      return fail('not_found', 'Séance invalide.');
    }
    return ok({ session: result.session }, 201);
  } catch {
    return fail('server', 'Impossible de démarrer la séance.');
  }
}
