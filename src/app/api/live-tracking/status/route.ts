import { z } from 'zod';

import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { getLiveTrackingRuntime } from '@/features/compte/live-tracking/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({
  sessionId: z.string().trim().min(1).max(128).optional(),
});

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = Query.safeParse({
    sessionId: new URL(request.url).searchParams.get('sessionId') ?? undefined,
  });
  if (!parsed.success) return fail('not_found', 'Séance introuvable.');

  try {
    return ok(await getLiveTrackingRuntime().getStatus(auth.user.id, parsed.data.sessionId));
  } catch {
    return fail('server', 'Impossible de charger le suivi en direct.');
  }
}
