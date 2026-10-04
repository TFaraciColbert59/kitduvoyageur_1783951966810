import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noteSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  target_table: z.string().trim().max(63).optional(),
  target_id: z.string().trim().max(255).optional(),
});

/**
 * POST /api/admin/notes — note libre journalisée (visible dans l'audit).
 * Stockée comme entrée `admin.note` dans action_logs (append-only).
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return NextResponse.json({ error: 'Jeton CSRF invalide' }, { status: 403 });
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-notes',
    limit: 20,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const body = noteSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: 'Note invalide' }, { status: 400 });
  }

  await logAdminAction({
    action: 'admin.note',
    actor_id: user.id,
    target_table: body.data.target_table ?? undefined,
    target_id: body.data.target_id ?? undefined,
    diff: { note: body.data.text },
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ success: true });
}
