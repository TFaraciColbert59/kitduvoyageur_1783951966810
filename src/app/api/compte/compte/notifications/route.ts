import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from '@/features/compte/server/compte';
import { getCached, invalidateUserCache, setCached, userCacheKey } from '@/lib/perf/userMemo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Patch = z
  .object({
    ids: z.array(z.string().uuid()).max(80).optional(),
    all: z.boolean().optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    const cacheKey = userCacheKey(auth.user.id, 'notifications');
    const cached = getCached<Record<string, unknown>>(cacheKey);
    const payload = cached ?? (await loadNotifications(auth.supabase, auth.user.id));
    if (!cached) setCached(cacheKey, payload, 10_000);
    const response = ok(payload);
    response.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
    return response;
  } catch {
    return fail('server', 'Impossible de charger tes notifications.');
  }
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('not_found', 'Notification invalide.');
  try {
    if (parsed.data.all) {
      await markAllNotificationsRead(auth.supabase, auth.user.id);
    } else if (parsed.data.ids?.length) {
      await markNotificationsRead(auth.supabase, auth.user.id, parsed.data.ids);
    }
    invalidateUserCache(auth.user.id);
    return ok({ status: 'read' });
  } catch {
    return fail('server', 'Impossible de marquer ces notifications.');
  }
}
