import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { sanitizeIlike } from '@/server/admin/sanitize';
import { paginationSchema } from '@/server/admin/schemas';
import { readCorrelationId } from '@/lib/observability/correlation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRIP_STATUSES = ['draft', 'planned', 'active', 'completed', 'cancelled'] as const;

const querySchema = paginationSchema.extend({
  status: z.enum(TRIP_STATUSES).optional(),
});

/**
 * GET /api/admin/trips?status=&q=&page=&pageSize= — explorateur voyages.
 * Lecture RLS, pagination serveur (gate : jamais de full-scan navigateur).
 */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('trips.read');
  if (!gate.ok) return gate.response;
  const { supabase } = gate.ctx;

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return fail('invalid_query', 'Requête invalide', 400, correlationId ?? undefined);
  }
  const { page, pageSize, status } = parsed.data;
  const q = sanitizeIlike(parsed.data.q ?? '');
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('trips')
    .select(
      'id, slug, title, status, visibility, user_id, destination_name, start_date, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);
  if (status) query = query.eq('status', status);
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) {
    return fail('read_failed', 'Lecture impossible', 500, correlationId ?? undefined);
  }
  const res = ok(
    { data: data ?? [], page, pageSize, total: count ?? 0 },
    { correlationId: correlationId ?? undefined }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
