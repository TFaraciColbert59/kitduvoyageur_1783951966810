import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { loadOrders } from '@/features/compte/server/compte';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    return ok({ orders: await loadOrders(auth.supabase, auth.user.id) });
  } catch {
    return fail('server', 'Impossible de charger tes commandes.');
  }
}
