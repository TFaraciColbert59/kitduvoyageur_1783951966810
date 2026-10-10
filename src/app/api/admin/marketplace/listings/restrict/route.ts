import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok, rpcErrorCode } from '@/server/admin/respond';
import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import {
  buildCommandIdempotencyKey,
  persistCommand,
} from '@/server/admin/commands';
import { readCorrelationId } from '@/lib/observability/correlation';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  listing_id: z.string().uuid(),
  status: z.enum(['actif', 'restreinte', 'suspendue']),
  reason: z.string().min(10).max(2000),
  ticket_id: z.string().max(120).optional(),
});

const RPC_TO_HTTP: Record<string, number> = {
  reason_required: 400,
  invalid_status: 400,
  listing_not_found: 404,
  listing_forbidden: 403,
};

/**
 * POST /api/admin/marketplace/listings/restrict — restriction graduée
 * (Tier3, `marketplace.listing.restrict`, AAL2 auto). Restriction au lieu du
 * blocage binaire : réserve/paiement maintenus, visibilité coupée.
 * Commande idempotente + audit + statut via set_listing_status().
 */
export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('marketplace.listing.restrict');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('csrf_invalid', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-marketplace-restrict',
    limit: 30,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return fail('invalid_body', 'Requête invalide', 400, correlationId ?? undefined);
  }

  const fp = {
    command_key: 'marketplace.listing.restrict' as const,
    resource_type: 'listing',
    resource_id: body.data.listing_id,
    reason: body.data.reason,
    risk_tier: 3 as const,
  };
  let cmd;
  try {
    cmd = await persistCommand(
      supabase as unknown as Parameters<typeof persistCommand>[0],
      user.id,
      {
        ...fp,
        idempotency_key: buildCommandIdempotencyKey(fp, { status: body.data.status }),
        ticket_id: body.data.ticket_id,
        correlation_id: correlationId ?? undefined,
        payload: { status: body.data.status },
      }
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : 'command_insert_failed';
    return fail(code, 'Commande impossible', 500, correlationId ?? undefined);
  }
  // Exécution systématique (RPC idempotente : rejou = même statut).
  // Sur échec : commande marquée `failed` (compensation, pas de fantôme).
  const { error } = await supabase.rpc('set_listing_status', {
    p_listing_id: body.data.listing_id,
    p_status: body.data.status,
    p_reason: body.data.reason,
  });
  if (error) {
    const mapped = rpcErrorCode(error.message ?? '', RPC_TO_HTTP);
    await supabase.rpc('set_command_status', {
      p_command_id: cmd.command_id,
      p_status: 'failed',
      p_result: { error: (error.message ?? '').slice(0, 500) },
    });
    if (!mapped) return fail('restrict_failed', 'Restriction impossible', 500, correlationId ?? undefined);
    return fail(mapped.code, 'Restriction impossible', mapped.status, correlationId ?? undefined);
  }

  await logAdminAction({
    action: 'marketplace.listing.restrict',
    actor_id: user.id,
    target_table: 'listings',
    target_id: body.data.listing_id,
    diff: { status: body.data.status, deduplicated: cmd.deduplicated },
    risk_tier: 3,
    command_id: cmd.command_id,
    correlation_id: correlationId ?? undefined,
    reason: body.data.reason,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });

  const res = ok(
    { command: cmd, status: body.data.status },
    { correlationId: correlationId ?? undefined, status: cmd.deduplicated ? 200 : 201 }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
