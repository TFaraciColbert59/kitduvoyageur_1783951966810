import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { invalidateUserCache } from '@/lib/perf/userMemo';
import { muteUser, readReseauError, unmuteUser } from '@/features/compte/server/reseau';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ userId: z.string().uuid() });

function muteFailure(error: unknown, action: 'mute' | 'unmute'): ReturnType<typeof fail> {
  switch (readReseauError(error, action === 'mute' ? 'mute_failed' : 'unmute_failed')) {
    case 'authentication_required':
      return fail('unauthorized', 'Session requise.');
    case 'self':
      return fail('conflict', 'Impossible de mettre son propre profil en sourdine.');
    case 'target_not_found':
      return fail('not_found', 'Profil inconnu.');
    case 'conversation_not_found':
      return fail('not_found', 'Aucune conversation directe à mettre en sourdine.');
    case 'mute_failed':
      return fail('server', 'La sourdine n’a pas pu être enregistrée.');
    case 'unmute_failed':
      return fail('server', 'La réactivation n’a pas pu être enregistrée.');
    default:
      return fail('server', 'Action de sourdine indisponible.');
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Profil inconnu.');
  try {
    const result = await muteUser(auth.supabase, auth.user.id, parsed.data.userId);
    invalidateUserCache(auth.user.id);
    return ok(result);
  } catch (error) {
    return muteFailure(error, 'mute');
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Profil inconnu.');
  try {
    const result = await unmuteUser(auth.supabase, auth.user.id, parsed.data.userId);
    invalidateUserCache(auth.user.id);
    return ok(result);
  } catch (error) {
    return muteFailure(error, 'unmute');
  }
}
