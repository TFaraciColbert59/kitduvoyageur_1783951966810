import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { loadShareStats } from '@/features/compte/server/compte';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    return ok(await loadShareStats(auth.supabase, auth.user.id));
  } catch {
    return fail('server', 'Impossible de charger les statistiques de partage.');
  }
}
