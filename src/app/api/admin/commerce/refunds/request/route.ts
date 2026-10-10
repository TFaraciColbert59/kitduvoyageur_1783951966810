import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import {
  buildCommandIdempotencyKey,
  persistCommand,
} from '@/server/admin/commands';
import { readCorrelationId } from '@/lib/observability/correlation';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  buildRefundCommand,
  previewRefund,
} from '@/features/admin-os/commerce/refunds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  order_id: z.string().uuid(),
  amount_eur: z.number().positive().max(100000),
  reason: z.string().min(10).max(2000),
  ticket_id: z.string().max(120).optional(),
});

/**
 * POST /api/admin/commerce/refunds/request — demande de remboursement.
 * Routage Tier3 (< 1000 €, `commerce.refund.request`) / Tier4 (≥ 1000 €,
 * `commerce.refund.approve` + second approbateur). Idempotent (clé =
 * commande + motif). Exécution prestataire : manuelle avec référence tracée
 * (pas de charge auto — plomberie Stripe non prouvée, voir decision log).
 */
export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return fail('invalid_body', 'Requête invalide', 400, correlationId ?? undefined);
  }

  // Lecture commande + en-cours AVANT routage (seuil sur exposition cumulée).
  // Gate `orders.read` (pas `admin.access`) : pas d'oracle d'existence.
  const gate0 = await requireAdmin('orders.read');
  if (!gate0.ok) return gate0.response;
  const { data: order0, error: orderError0 } = await gate0.ctx.supabase
    .from('orders')
    .select('id, order_number, status, total_eur')
    .eq('id', body.data.order_id)
    .single();
  if (orderError0 || !order0) {
    return fail('order_not_found', 'Commande introuvable', 404, correlationId ?? undefined);
  }
  const o0 = order0 as { id: string; order_number: string; status: string; total_eur: number };
  const { data: prior0 } = await gate0.ctx.supabase
    .from('admin_commands')
    .select('payload')
    .eq('resource_type', 'order')
    .eq('resource_id', o0.id)
    .in('command_key', ['commerce.refund.request', 'commerce.refund.approve'])
    .in('status', ['validated', 'awaiting_approval', 'approved', 'executing', 'partially_succeeded', 'succeeded']);
  const priorTotal0 = ((prior0 ?? []) as { payload: { amount_eur?: number } | null }[]).reduce(
    (s, c) => s + (typeof c.payload?.amount_eur === 'number' ? c.payload.amount_eur : 0),
    0
  );
  const fp = buildRefundCommand(body.data.order_id, body.data.amount_eur, body.data.reason, priorTotal0);

  // Permission réévaluée serveur au moment de l'exécution (gate #6),
  // AAL2 imposée automatiquement (Tier ≥ 3).
  const gate = await requireAdmin(fp.command_key);
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('csrf_invalid', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-commerce-refunds',
    limit: 20,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  // Statuts terminaux connus ; orders.status n'a pas de CHECK : tout autre
  // statut reste remboursable avec audit (pas de refus inventé).
  const o = o0;
  if (o.status === 'cancelled' || o.status === 'refunded') {
    return fail(
      'order_not_refundable',
      `Commande non remboursable (statut ${o.status})`,
      409,
      correlationId ?? undefined
    );
  }

  // Exposition = déjà remboursé + en-cours (anti double-clic / smurfing).
  const priorTotal = priorTotal0;

  let preview;
  try {
    preview = previewRefund({ total_eur: Number(o.total_eur) }, priorTotal, body.data.amount_eur);
  } catch (e) {
    const code = e instanceof Error ? e.message : 'refund_invalid_amount';
    return fail(code, 'Montant refusé', 409, correlationId ?? undefined);
  }

  const key = buildCommandIdempotencyKey(fp, { amount_eur: body.data.amount_eur });
  let cmd;
  try {
    cmd = await persistCommand(
      supabase as unknown as Parameters<typeof persistCommand>[0],
      user.id,
      {
        ...fp,
        idempotency_key: key,
        ticket_id: body.data.ticket_id,
        correlation_id: correlationId ?? undefined,
        payload: { amount_eur: body.data.amount_eur, order_number: o.order_number },
      }
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : 'command_insert_failed';
    return fail(code, 'Commande impossible', 500, correlationId ?? undefined);
  }

  await logAdminAction({
    action: fp.command_key,
    actor_id: user.id,
    target_table: 'orders',
    target_id: o.id,
    diff: { amount_eur: body.data.amount_eur, preview, deduplicated: cmd.deduplicated },
    risk_tier: fp.risk_tier,
    command_id: cmd.command_id,
    correlation_id: correlationId ?? undefined,
    reason: body.data.reason,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });

  const res = ok(
    { command: cmd, preview, order_number: o.order_number },
    { correlationId: correlationId ?? undefined, status: cmd.deduplicated ? 200 : 201 }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
