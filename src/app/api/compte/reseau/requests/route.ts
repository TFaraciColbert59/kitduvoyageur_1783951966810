import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import {
  loadFollowRequests,
  readReseauError,
  respondFollowRequest,
} from '@/features/compte/server/reseau';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['accept', 'decline']),
});

function requestFailure(error: unknown): ReturnType<typeof fail> {
  switch (readReseauError(error, 'respond_failed')) {
    case 'authentication_required':
      return fail('unauthorized', 'Session requise.');
    case 'request_not_found':
      return fail('not_found', 'Demande introuvable.');
    case 'request_not_pending':
      return fail('conflict', 'Cette demande a déjà été traitée.');
    case 'blocked':
      return fail('conflict', 'Ce profil n’est pas disponible.');
    case 'invalid_action':
      return fail('conflict', 'Action invalide.');
    default:
      return fail('server', 'Impossible de répondre à cette demande.');
  }
}

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
    // La RPC vérifie elle-même que auth.uid() est la cible de la demande.
    await respondFollowRequest(auth.supabase, parsed.data.requestId, parsed.data.action);
    return ok({ status: parsed.data.action });
  } catch (error) {
    return requestFailure(error);
  }
}
