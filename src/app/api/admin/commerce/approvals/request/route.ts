import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { readCorrelationId } from '@/lib/observability/correlation';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  command_id: z.string().uuid(),
  reason: z.string().min(10).max(2000),
});

/**
 * POST /api/admin/commerce/approvals/request — ouvre une demande de second
 * regard sur une commande `requires_approval` (Tier4). Idempotent : une
 * demande `pending` existante est retournée telle quelle.
 */
export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('admin.access');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('csrf_invalid', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-commerce-approvals',
    limit: 30,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return fail('invalid_body', 'Requête invalide', 400, correlationId ?? undefined);
  }

  const { data: cmd, error: cmdError } = await supabase
    .from('admin_commands')
    .select('id, command_key, requires_approval, status')
    .eq('id', body.data.command_id)
    .single();
  if (cmdError || !cmd) {
    return fail('command_not_found', 'Commande introuvable', 404, correlationId ?? undefined);
  }
  const c = cmd as { id: string; command_key: string; requires_approval: boolean; status: string };
  if (!c.requires_approval) {
    return fail('approval_not_required', 'Cette commande ne requiert pas d’approbation', 409, correlationId ?? undefined);
  }
  if (!['validated', 'awaiting_approval'].includes(c.status)) {
    return fail('command_not_approvable', `Commande non approuvable (statut ${c.status})`, 409, correlationId ?? undefined);
  }

  const { data: pending } = await supabase
    .from('admin_approval_requests')
    .select('id, status')
    .eq('command_id', c.id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();
  if (pending) {
    return ok(
      { approval_id: (pending as { id: string }).id, deduplicated: true },
      { correlationId: correlationId ?? undefined }
    );
  }

  const { data: created, error: insertError } = await supabase
    .from('admin_approval_requests')
    .insert({ command_id: c.id, requested_by: user.id, reason: body.data.reason.trim() })
    .select('id')
    .single();
  if (insertError || !created) {
    return fail('approval_insert_failed', 'Demande impossible', 500, correlationId ?? undefined);
  }

  await logAdminAction({
    action: 'approval.request',
    actor_id: user.id,
    target_table: 'admin_commands',
    target_id: c.id,
    diff: { command_key: c.command_key },
    risk_tier: 3,
    command_id: c.id,
    approval_id: (created as { id: string }).id,
    correlation_id: correlationId ?? undefined,
    reason: body.data.reason,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });

  const res = ok(
    { approval_id: (created as { id: string }).id, deduplicated: false },
    { correlationId: correlationId ?? undefined, status: 201 }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
