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
import { canTransitionPrompt } from '@/features/admin-os/ai/prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  key: z.string().min(1).max(120),
  status: z.enum(['draft', 'review', 'production', 'archived']),
  reason: z.string().min(10).max(2000),
  ticket_id: z.string().max(120).optional(),
  command_id: z.string().uuid().optional(),
});

const RPC_TO_HTTP: Record<string, number> = {
  invalid_status: 400,
  promotion_unlinked: 409,
  promotion_not_approved: 409,
  prompt_not_found: 404,
  prompt_forbidden: 403,
};

/**
 * POST /api/admin/ai/prompts/promote — changement de statut gouverné.
 * `production` exige `command_id` d'une commande `ai.prompt.promote`
 * APPROVED liée (vérifié en SQL par set_prompt_status, miroir applicatif
 * canTransitionPrompt). Commande + approbation via les routes génériques
 * /api/admin/commerce/approvals/*.
 */
export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('ai.prompt.promote');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('csrf_invalid', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-ai-promote',
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
    command_key: 'ai.prompt.promote' as const,
    resource_type: 'prompt',
    resource_id: body.data.key,
    reason: body.data.reason,
    risk_tier: 3 as const,
  };

  // Garde AVANT toute persistance : pas de commande fantôme sur refus.
  let link: { command_key: string; status: string; resource_id: string } | null = null;
  if (body.data.command_id) {
    const { data: linked } = await supabase
      .from('admin_commands')
      .select('command_key, status, resource_id')
      .eq('id', body.data.command_id)
      .single();
    link = (linked as { command_key: string; status: string; resource_id: string } | null) ?? null;
  }
  const { data: current } = await supabase
    .from('ai_prompts')
    .select('status')
    .eq('key', body.data.key)
    .single();
  const blocked = canTransitionPrompt(
    (current as { status?: string } | null)?.status ?? 'draft',
    body.data.status,
    link,
    body.data.key
  );
  if (blocked) {
    const status = blocked === 'promotion_not_approved' || blocked === 'promotion_unlinked' ? 409 : 400;
    return fail(blocked, 'Promotion refusée', status, correlationId ?? undefined);
  }

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

  // Exécution systématique + compensation `failed` (jamais de fantôme).
  const { error } = await supabase.rpc('set_prompt_status', {
    p_key: body.data.key,
    p_status: body.data.status,
    p_command_id: body.data.command_id ?? cmd.command_id,
  });
  if (error) {
    const mapped = rpcErrorCode(error.message ?? '', RPC_TO_HTTP);
    await supabase.rpc('set_command_status', {
      p_command_id: cmd.command_id,
      p_status: 'failed',
      p_result: { error: (error.message ?? '').slice(0, 500) },
    });
    if (!mapped) return fail('promote_failed', 'Promotion impossible', 500, correlationId ?? undefined);
    return fail(mapped.code, 'Promotion impossible', mapped.status, correlationId ?? undefined);
  }

  await logAdminAction({
    action: 'ai.prompt.promote',
    actor_id: user.id,
    target_table: 'ai_prompts',
    target_id: body.data.key,
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
