import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { invalidateUserCache } from '@/lib/perf/userMemo';
import { followUser, readReseauError, unfollowUser } from '@/features/compte/server/reseau';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ userId: z.string().uuid() });

function followFailure(error: unknown): ReturnType<typeof fail> {
  switch (readReseauError(error, 'follow_failed')) {
    case 'authentication_required':
      return fail('unauthorized', 'Session requise.');
    case 'target_not_found':
      return fail('not_found', 'Profil inconnu.');
    case 'self':
      return fail('conflict', 'Impossible de se suivre soi-même.');
    case 'blocked':
      return fail('conflict', 'Ce profil n’est pas disponible.');
    case 'follow_request_closed':
      return fail('conflict', 'Cette demande de suivi est déjà close.');
    default:
      return fail('server', 'Impossible de suivre ce profil.');
  }
}

function unfollowFailure(error: unknown): ReturnType<typeof fail> {
  switch (readReseauError(error, 'unfollow_failed')) {
    case 'authentication_required':
      return fail('unauthorized', 'Session requise.');
    case 'target_not_found':
      return fail('not_found', 'Profil inconnu.');
    default:
      return fail('server', 'Impossible de retirer ce profil.');
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Profil inconnu.');
  if (parsed.data.userId === auth.user.id) return fail('conflict', 'Impossible de se suivre soi-même.');
  try {
    // L'acteur est celui du JWT côté RPC : la route ne transmet que la cible.
    const status = await followUser(auth.supabase, parsed.data.userId);
    // Les vues acteur mises en cache ne doivent pas resservir un état
    // antérieur après la mutation.
    invalidateUserCache(auth.user.id);
    return ok(status);
  } catch (error) {
    return followFailure(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Profil inconnu.');
  try {
    await unfollowUser(auth.supabase, parsed.data.userId);
    invalidateUserCache(auth.user.id);
    return ok({ status: 'unfollowed' });
  } catch (error) {
    return unfollowFailure(error);
  }
}
