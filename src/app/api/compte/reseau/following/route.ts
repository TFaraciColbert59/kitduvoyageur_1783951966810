import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { loadReseau } from '@/features/compte/server/reseau';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    return ok(await loadReseau(auth.supabase, auth.user.id, 'following'));
  } catch {
    return fail('server', 'Impossible de charger les abonnements.');
  }
}
