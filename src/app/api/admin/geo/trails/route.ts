import { NextRequest } from 'next/server';

import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { sanitizeIlike } from '@/server/admin/sanitize';
import { paginationSchema } from '@/server/admin/schemas';
import { readCorrelationId } from '@/lib/observability/correlation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/geo/trails?q=&page=&pageSize= — registre des sentiers.
 * Géométrie exclue volontairement (poids) : registre, pas tuiles.
 */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('geo.read');
  if (!gate.ok) return gate.response;
  const { supabase } = gate.ctx;

  const parsed = paginationSchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return fail('invalid_query', 'Requête invalide', 400, correlationId ?? undefined);
  }
  const { page, pageSize } = parsed.data;
  const q = sanitizeIlike(parsed.data.q ?? '');
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('hiking_routes')
    .select('id, osm_relation_id, name, ref, network, distance_km, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (q) query = query.or(`name.ilike.%${q}%,ref.ilike.%${q}%`);

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
