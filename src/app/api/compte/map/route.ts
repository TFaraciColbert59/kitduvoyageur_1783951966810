import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { loadCompteMap } from '@/features/compte/map/server/loadCompteMap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    const response = ok(await loadCompteMap(auth.supabase, auth.user.id));
    response.headers.set('Cache-Control', 'private, max-age=45, stale-while-revalidate=120');
    return response;
  } catch {
    return fail('server', 'Impossible de charger ta carte.');
  }
}
