import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { loadFollowRequests, respondFollowRequest } from '@/features/compte/server/reseau';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['accept', 'decline']),
});

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    return ok({ requests: await loadFollowRequests(auth.supabase, auth.user.id) });
  } catch {
    return fail('server', 'Impossible de charger les demandes.');
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Demande inconnue.');
  try {
    await respondFollowRequest(auth.supabase, auth.user.id, parsed.data.requestId, parsed.data.action);
    return ok({ status: parsed.data.action });
  } catch (error) {
    if (error instanceof Error && error.message === 'request_not_found') {
      return fail('not_found', 'Demande introuvable.');
    }
    return fail('server', 'Impossible de répondre à cette demande.');
  }
}
