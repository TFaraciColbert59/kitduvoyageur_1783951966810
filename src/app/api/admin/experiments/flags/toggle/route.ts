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
  flag_id: z.string().min(1).max(120),
  enabled: z.boolean(),
  reason: z.string().min(10).max(2000),
  ticket_id: z.string().max(120).optional(),
});

const RPC_TO_HTTP: Record<string, number> = {
  reason_required: 400,
  flag_not_found: 404,
  flag_forbidden: 403,
};

/**
 * POST /api/admin/experiments/flags/toggle — kill switch / rollout.
 * Tier3 (`features.flag.update`, AAL2 auto) : commande idempotente + audit
 * + exécution via set_feature_flag() (voie UNIQUE d'écriture).
 */
export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('features.flag.update');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('csrf_invalid', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-flags-toggle',
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
    command_key: 'features.flag.update' as const,
    resource_type: 'flag',
    resource_id: body.data.flag_id,
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
        idempotency_key: buildCommandIdempotencyKey(fp, { enabled: body.data.enabled }),
        ticket_id: body.data.ticket_id,
        correlation_id: correlationId ?? undefined,
        payload: { enabled: body.data.enabled },
      }
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : 'command_insert_failed';
    return fail(code, 'Commande impossible', 500, correlationId ?? undefined);
  }
  // Exécution systématique (RPC idempotente) + compensation `failed`.
  const { error } = await supabase.rpc('set_feature_flag', {
    p_flag_id: body.data.flag_id,
    p_enabled: body.data.enabled,
    p_reason: body.data.reason,
  });
  if (error) {
    const mapped = rpcErrorCode(error.message ?? '', RPC_TO_HTTP);
    await supabase.rpc('set_command_status', {
      p_command_id: cmd.command_id,
      p_status: 'failed',
      p_result: { error: (error.message ?? '').slice(0, 500) },
    });
    if (!mapped) return fail('toggle_failed', 'Bascule impossible', 500, correlationId ?? undefined);
    return fail(mapped.code, 'Bascule impossible', mapped.status, correlationId ?? undefined);
  }

  await logAdminAction({
    action: 'features.flag.update',
    actor_id: user.id,
    target_table: 'feature_flags',
    target_id: body.data.flag_id,
    diff: { enabled: body.data.enabled, deduplicated: cmd.deduplicated },
    risk_tier: 3,
    command_id: cmd.command_id,
    correlation_id: correlationId ?? undefined,
    reason: body.data.reason,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });

  const res = ok(
    { command: cmd, enabled: body.data.enabled },
    { correlationId: correlationId ?? undefined, status: cmd.deduplicated ? 200 : 201 }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
