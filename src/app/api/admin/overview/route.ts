import { NextRequest } from 'next/server';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { readCorrelationId } from '@/lib/observability/correlation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/overview — compteurs temps réel du tableau de bord.
 * Lectures RLS via le client de l'appelant (policies admin).
 */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('users.read');
  if (!gate.ok) return gate.response;
  const { supabase } = gate.ctx;

  const [products, orders, users, withdrawals, audit] = await Promise.all([
    supabase.from('shop_products').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('reward_withdrawals')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'under_review']),
    supabase
      .from('action_logs')
      .select('id, action, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const failed = [products, orders, users, withdrawals, audit].find((r) => r.error);
  if (failed?.error) {
    console.error('[admin/overview] lecture impossible', { code: failed.error.code });
    return fail('read_failed', 'Lecture impossible', 500, correlationId ?? undefined);
  }

  const res = ok(
    {
      products: products.count ?? 0,
      orders: orders.count ?? 0,
      users: users.count ?? 0,
      pendingWithdrawals: withdrawals.count ?? 0,
      recentAudit: audit.data ?? [],
    },
    { correlationId: correlationId ?? undefined }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
