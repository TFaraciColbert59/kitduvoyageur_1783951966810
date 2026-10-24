import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { loadCompteMap } from '@/features/compte/map/server/loadCompteMap';
import { getCached, setCached, userCacheKey } from '@/lib/perf/userMemo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    const cacheKey = userCacheKey(auth.user.id, 'map');
    const cached = getCached<Record<string, unknown>>(cacheKey);
    const payload = cached ?? (await loadCompteMap(auth.supabase, auth.user.id));
    if (!cached) setCached(cacheKey, payload, 30_000);
    const response = ok(payload);
    response.headers.set('Cache-Control', 'private, max-age=45, stale-while-revalidate=120');
    return response;
  } catch {
    return fail('server', 'Impossible de charger ta carte.');
  }
}
