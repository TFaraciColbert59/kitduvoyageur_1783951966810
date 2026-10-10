import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok, rpcErrorCode } from '@/server/admin/respond';
import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { readCorrelationId } from '@/lib/observability/correlation';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  approval_id: z.string().uuid(),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().min(10).max(2000),
});

const RPC_TO_HTTP: Record<string, number> = {
  reason_required: 400,
  invalid_decision: 400,
  approval_not_found: 404,
  command_not_found: 404,
  approval_not_pending: 409,
  sod_violation: 403,
  approval_forbidden: 403,
};

/**
 * POST /api/admin/commerce/approvals/decide — vote du second regard.
 * Voie UNIQUE : `public.decide_approval()` (atomique : SoD + permission de
 * la commande + statut en une transaction). La permission de la commande
 * est réévaluée serveur ici (gate #6) puis dans la fonction SQL.
 */
export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return fail('invalid_body', 'Requête invalide', 400, correlationId ?? undefined);
  }

  // Contexte : demande + commande pour choisir la permission à exiger.
  // Lecture provisoire sous `admin.access`, réexigée finement ensuite.
  const boot = await requireAdmin('admin.access');
  if (!boot.ok) return boot.response;

  const { data: approval, error: approvalError } = await boot.ctx.supabase
    .from('admin_approval_requests')
    .select('id, command_id, requested_by, status')
    .eq('id', body.data.approval_id)
    .single();
  if (approvalError || !approval) {
    return fail('approval_not_found', 'Demande introuvable', 404, correlationId ?? undefined);
  }
  const a = approval as { id: string; command_id: string; requested_by: string; status: string };
  const { data: cmd } = await boot.ctx.supabase
    .from('admin_commands')
    .select('id, command_key')
    .eq('id', a.command_id)
    .single();
  const commandKey = (cmd as { command_key?: string } | null)?.command_key;
  if (!commandKey) {
    return fail('command_not_found', 'Commande introuvable', 404, correlationId ?? undefined);
  }

  // L'approbateur doit détenir la permission de la commande elle-même.
  const gate = await requireAdmin(commandKey);
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('csrf_invalid', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-commerce-approvals-decide',
    limit: 30,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const { data, error } = await supabase.rpc('decide_approval', {
    p_approval_id: body.data.approval_id,
    p_decision: body.data.decision,
    p_reason: body.data.reason,
  });
  if (error) {
    const mapped = rpcErrorCode(error.message ?? '', RPC_TO_HTTP);
    if (!mapped) return fail('decision_failed', 'Décision impossible', 500, correlationId ?? undefined);
    return fail(mapped.code, 'Décision impossible', mapped.status, correlationId ?? undefined);
  }

  await logAdminAction({
    action: 'approval.decide',
    actor_id: user.id,
    target_table: 'admin_commands',
    target_id: a.command_id,
    diff: { decision: body.data.decision, approval_status: data },
    risk_tier: 4,
    command_id: a.command_id,
    approval_id: body.data.approval_id,
    correlation_id: correlationId ?? undefined,
    reason: body.data.reason,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });

  const res = ok(
    { approval_id: body.data.approval_id, status: data },
    { correlationId: correlationId ?? undefined }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
