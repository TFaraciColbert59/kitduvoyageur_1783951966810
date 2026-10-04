import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

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
  const gate = await requireAdmin('moderation.write');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return NextResponse.json({ error: 'Jeton CSRF invalide' }, { status: 403 });
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
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
  }
  const body = decisionSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: 'Décision invalide' }, { status: 400 });
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
    return NextResponse.json({ error: 'Traitement impossible' }, { status: 500 });
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
  return NextResponse.json({ success: true, data });
}
