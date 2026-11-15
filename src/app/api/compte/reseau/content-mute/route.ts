import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { invalidateUserCache } from '@/lib/perf/userMemo';
import {
  muteContentUser,
  readReseauError,
  unmuteContentUser,
} from '@/features/compte/server/reseau';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ userId: z.string().uuid() });

function contentMuteFailure(
  error: unknown,
  action: 'mute' | 'unmute'
): ReturnType<typeof fail> {
  switch (
    readReseauError(
      error,
      action === 'mute' ? 'content_mute_failed' : 'content_unmute_failed'
    )
  ) {
    case 'authentication_required':
      return fail('unauthorized', 'Session requise.');
    case 'self':
      return fail('conflict', 'Impossible de masquer ses propres contenus.');
    case 'target_not_found':
      return fail('not_found', 'Profil inconnu.');
    case 'content_mute_failed':
      return fail('server', 'La sourdine de contenu n’a pas pu être enregistrée.');
    case 'content_unmute_failed':
      return fail('server', 'La réactivation des contenus n’a pas pu être enregistrée.');
    default:
      return fail('server', 'Action de sourdine de contenu indisponible.');
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Profil inconnu.');
  try {
    const result = await muteContentUser(auth.supabase, auth.user.id, parsed.data.userId);
    invalidateUserCache(auth.user.id);
    return ok(result);
  } catch (error) {
    return contentMuteFailure(error, 'mute');
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Profil inconnu.');
  try {
    const result = await unmuteContentUser(auth.supabase, auth.user.id, parsed.data.userId);
    invalidateUserCache(auth.user.id);
    return ok(result);
  } catch (error) {
    return contentMuteFailure(error, 'unmute');
  }
}
