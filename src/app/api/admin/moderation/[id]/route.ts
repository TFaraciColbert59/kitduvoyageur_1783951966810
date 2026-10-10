import { NextRequest } from 'next/server';
import { z } from 'zod';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { readCorrelationId } from '@/lib/observability/correlation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idParam = z.string().uuid();
const decisionSchema = z.object({
  statut: z.enum(['approuve', 'rejete', 'signale', 'en_attente']),
});

/**
 * PATCH /api/admin/moderation/[id] — traite un signalement.
 * Assigne le modérateur traitant (soi-même) et horodate.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('moderation.write');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('csrf_invalid', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-moderation',
    limit: 60,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const { id } = await params;
  if (!idParam.safeParse(id).success) {
    return fail('invalid_id', 'Identifiant invalide', 400, correlationId ?? undefined);
  }
  const body = decisionSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return fail('invalid_decision', 'Décision invalide', 400, correlationId ?? undefined);
  }

  const { data, error } = await supabase
    .from('moderation_queue')
    .update({
      statut: body.data.statut,
      moderateur_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, contenu_type, contenu_id, statut')
    .single();
  if (error) {
    console.error('[admin/moderation] traitement impossible', { code: error.code });
    return fail('process_failed', 'Traitement impossible', 500, correlationId ?? undefined);
  }

  await logAdminAction({
    action: `moderation.${body.data.statut}`,
    actor_id: user.id,
    target_table: 'moderation_queue',
    target_id: id,
    diff: { statut: body.data.statut },
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  return ok({ success: true, data }, { correlationId: correlationId ?? undefined });
}
