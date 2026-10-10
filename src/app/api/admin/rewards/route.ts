import { NextRequest } from 'next/server';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { rewardsActionSchema } from '@/server/admin/schemas';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { readCorrelationId } from '@/lib/observability/correlation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;

/**
 * POST /api/admin/rewards — actions financières du moteur de récompense.
 * Durci : zod strict, rate-limit fail-closed, CSRF, audit serveur,
 * erreurs génériques (jamais de `error.message` brut).
 */
export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('rewards.write');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('csrf_invalid', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }

  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-rewards',
    limit: 30,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY_BYTES) {
    return fail('payload_too_large', 'Corps trop volumineux', 413, correlationId ?? undefined);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail('invalid_json', 'JSON invalide', 400, correlationId ?? undefined);
  }

  const parsed = rewardsActionSchema.safeParse(raw);
  if (!parsed.success) {
    return fail('invalid_body', 'Requête invalide', 400, correlationId ?? undefined);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const userAgent = req.headers.get('user-agent') ?? undefined;

  try {
    switch (parsed.data.action) {
      case 'finalize_period': {
        const { period_id, eligible_revenue } = parsed.data;
        const { data, error } = await supabase.rpc('finalize_reward_period', {
          p_period_id: period_id,
          p_eligible_revenue: eligible_revenue,
        });
        if (error) {
          console.error('[admin/rewards] finalize_period refusé', { code: error.code });
          return fail('operation_rejected', 'Opération refusée', 400, correlationId ?? undefined);
        }
        await logAdminAction({
          action: 'rewards.finalize_period',
          actor_id: user.id,
          target_table: 'reward_periods',
          target_id: period_id,
          diff: { eligible_revenue },
          ip,
          user_agent: userAgent,
        });
        return ok({ success: true, data }, { correlationId: correlationId ?? undefined });
      }

      case 'process_withdrawal': {
        const { withdrawal_id, approve, reference, reason } = parsed.data;
        const { data, error } = await supabase.rpc('process_withdrawal', {
          p_withdrawal_id: withdrawal_id,
          p_approve: approve,
          p_reference: reference,
          p_reason: reason,
        });
        if (error) {
          console.error('[admin/rewards] process_withdrawal refusé', { code: error.code });
          return fail('operation_rejected', 'Opération refusée', 400, correlationId ?? undefined);
        }
        await logAdminAction({
          action: approve ? 'rewards.withdrawal.approve' : 'rewards.withdrawal.reject',
          actor_id: user.id,
          target_table: 'reward_withdrawals',
          target_id: withdrawal_id,
          diff: { reference, reason },
          ip,
          user_agent: userAgent,
        });
        return ok({ success: true, data }, { correlationId: correlationId ?? undefined });
      }

      case 'process_contribution': {
        const { contribution_id, approve, reason } = parsed.data;
        const { data, error } = await supabase.rpc('process_pending_contribution', {
          p_contribution_id: contribution_id,
          p_approve: approve,
          p_reason: reason,
        });
        if (error) {
          console.error('[admin/rewards] process_contribution refusé', { code: error.code });
          return fail('operation_rejected', 'Opération refusée', 400, correlationId ?? undefined);
        }
        await logAdminAction({
          action: 'rewards.contribution.process',
          actor_id: user.id,
          target_table: 'reward_contributions',
          target_id: contribution_id,
          diff: { approve, reason },
          ip,
          user_agent: userAgent,
        });
        return ok({ success: true, data }, { correlationId: correlationId ?? undefined });
      }

      case 'update_config': {
        const { key, value, description } = parsed.data;
        const { data, error } = await supabase
          .from('reward_config')
          .upsert({
            key,
            value,
            description,
            updated_at: new Date().toISOString(),
          })
          .select();
        if (error) {
          console.error('[admin/rewards] update_config refusé', { code: error.code });
          return fail('operation_rejected', 'Opération refusée', 400, correlationId ?? undefined);
        }
        await logAdminAction({
          action: 'rewards.config.update',
          actor_id: user.id,
          target_table: 'reward_config',
          target_id: key,
          diff: { value, description },
          ip,
          user_agent: userAgent,
        });
        return ok({ success: true, data }, { correlationId: correlationId ?? undefined });
      }
    }
  } catch (err) {
    console.error('[admin/rewards] erreur inattendue', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    return fail('internal_error', 'Erreur serveur', 500, correlationId ?? undefined);
  }
}
