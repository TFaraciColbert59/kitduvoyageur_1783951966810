import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { readCorrelationId } from '@/lib/observability/correlation';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { getServiceSupabase } from '@/lib/ai/serviceClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  orderId: z.string().uuid(),
});

/**
 * POST /api/admin/orders/confirm — confirmation d'une commande `pending`
 * (virement). Les points sont crédités par le trigger
 * `process_pending_order_points` : jamais touchés ici.
 */
export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);

  const gate = await requireAdmin('orders.write');
  if (!gate.ok) return gate.response;
  const { user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('csrf_invalid', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-orders-confirm',
    limit: 30,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return fail('invalid_body', 'Requête invalide', 400, correlationId ?? undefined);
  }

  const service = getServiceSupabase();
  if (!service) {
    return fail('service_unavailable', 'Service indisponible', 503, correlationId ?? undefined);
  }

  const { data, error } = await service
    .from('orders')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', body.data.orderId)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('[admin/orders/confirm] confirmation impossible', { code: error.code });
    return fail('confirm_failed', 'Confirmation impossible', 500, correlationId ?? undefined);
  }
  if (!Array.isArray(data) || data.length === 0) {
    return fail('not_confirmable', 'Commande non confirmable', 409, correlationId ?? undefined);
  }

  await logAdminAction({
    action: 'orders.confirm',
    actor_id: user.id,
    target_table: 'orders',
    target_id: body.data.orderId,
    diff: { status: 'confirmed' },
    correlation_id: correlationId ?? undefined,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });

  const res = ok({ success: true }, { correlationId: correlationId ?? undefined });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
