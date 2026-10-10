import { NextRequest } from 'next/server';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { auditQuerySchema } from '@/server/admin/schemas';
import { readCorrelationId } from '@/lib/observability/correlation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit?action=&target_table=&actor_id=&page=&pageSize=
 * Lecture du journal append-only (permission `audit.read`).
 */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('audit.read');
  if (!gate.ok) return gate.response;
  const { supabase } = gate.ctx;

  const parsed = auditQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return fail(
      'invalid_query',
      'Requête invalide',
      400,
      correlationId ?? undefined
    );
  }
  const { page, pageSize, action, target_table, actor_id } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('action_logs')
    .select(
      'id, actor_id, action, target_table, target_id, diff, ip, source, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);
  if (action) query = query.eq('action', action);
  if (target_table) query = query.eq('target_table', target_table);
  if (actor_id) query = query.eq('actor_id', actor_id);

  const { data, count, error } = await query;
  if (error) {
    console.error('[admin/audit] lecture impossible', { code: error.code });
    return fail('read_failed', 'Lecture impossible', 500, correlationId ?? undefined);
  }

  const res = ok(
    { data: data ?? [], page, pageSize, total: count ?? 0 },
    { correlationId: correlationId ?? undefined }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
