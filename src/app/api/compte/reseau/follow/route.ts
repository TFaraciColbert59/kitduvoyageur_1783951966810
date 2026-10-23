import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { followUser, unfollowUser } from '@/features/compte/server/reseau';
import { emitFollowerNotification } from '@/features/compte/server/activityNotifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ userId: z.string().uuid() });

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Profil inconnu.');
  if (parsed.data.userId === auth.user.id) return fail('conflict', 'Impossible de se suivre soi-même.');
  try {
    const result = await followUser(auth.supabase, auth.user.id, parsed.data.userId);
    void emitFollowerNotification({
      actorId: auth.user.id,
      targetId: parsed.data.userId,
      requested: result.status === 'requested',
    });
    return ok(result);
  } catch {
    return fail('server', 'Impossible de suivre ce profil.');
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Profil inconnu.');
  try {
    await unfollowUser(auth.supabase, auth.user.id, parsed.data.userId);
    return ok({ status: 'unfollowed' });
  } catch {
    return fail('server', 'Impossible de retirer ce profil.');
  }
}
