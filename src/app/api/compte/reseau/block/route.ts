import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { invalidateUserCache } from '@/lib/perf/userMemo';
import { blockUser, readReseauError, unblockUser } from '@/features/compte/server/reseau';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  userId: z.string().uuid(),
  groupId: z.string().uuid().optional(),
});

function blockFailure(error: unknown, action: 'block' | 'unblock'): ReturnType<typeof fail> {
  switch (readReseauError(error, action === 'block' ? 'block_failed' : 'unblock_failed')) {
    case 'authentication_required':
      return fail('unauthorized', 'Session requise.');
    case 'self':
      return fail('conflict', 'Impossible de bloquer son propre profil.');
    case 'target_not_found':
      return fail('not_found', 'Profil inconnu.');
    case 'block_failed':
      return fail('server', 'Le blocage n’a pas pu être enregistré.');
    case 'unblock_failed':
      return fail('server', 'Le déblocage n’a pas pu être enregistré.');
    default:
      return fail('server', 'Action de blocage indisponible.');
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Profil inconnu.');
  try {
    const result = await blockUser(
      auth.supabase,
      auth.user.id,
      parsed.data.userId,
      parsed.data.groupId
    );
    invalidateUserCache(auth.user.id);
    return ok(result);
  } catch (error) {
    return blockFailure(error, 'block');
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Profil inconnu.');
  try {
    const result = await unblockUser(auth.supabase, auth.user.id, parsed.data.userId);
    invalidateUserCache(auth.user.id);
    return ok(result);
  } catch (error) {
    return blockFailure(error, 'unblock');
  }
}
