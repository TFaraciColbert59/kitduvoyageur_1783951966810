import { NextRequest } from 'next/server';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { sanitizeIlike } from '@/server/admin/sanitize';
import { productCreateSchema } from '@/server/admin/productSchemas';
import { paginationSchema } from '@/server/admin/schemas';
import { slugify } from '@/features/admin/productUtils';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { readCorrelationId } from '@/lib/observability/correlation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/products?q=&page=&pageSize= — catalogue complet
 * (inclut les archivés `deleted_at`, avec fanion).
 */
export async function GET(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('products.read');
  if (!gate.ok) return gate.response;
  const { supabase } = gate.ctx;

  const parsed = paginationSchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return fail('invalid_query', 'Requête invalide', 400, correlationId ?? undefined);
  }
  const { page, pageSize } = parsed.data;
  const q = sanitizeIlike(parsed.data.q);
  const from = (page - 1) * pageSize;

  let query = supabase
    .from('shop_products')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%,brand.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) {
    console.error('[admin/products] lecture impossible', { code: error.code });
    return fail('read_failed', 'Lecture impossible', 500, correlationId ?? undefined);
  }
  const res = ok(
    { data: data ?? [], page, pageSize, total: count ?? 0 },
    { correlationId: correlationId ?? undefined }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

/**
 * POST /api/admin/products — création (slug auto si absent).
 */
export async function POST(req: NextRequest) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('products.write');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('csrf_invalid', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-products',
    limit: 60,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const body = productCreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return fail('invalid_body', 'Requête invalide', 400, correlationId ?? undefined);
  }

  const slug = body.data.slug || slugify(body.data.name);
  if (!slug) {
    return fail('invalid_slug', 'Slug impossible à générer', 400, correlationId ?? undefined);
  }

  const { data, error } = await supabase
    .from('shop_products')
    .insert({ ...body.data, slug })
    .select('id, slug, name')
    .single();
  if (error) {
    if (error.code === '23505') {
      return fail('duplicate', 'Doublon (slug ou référence)', 409, correlationId ?? undefined);
    }
    console.error('[admin/products] création impossible', { code: error.code });
    return fail('create_failed', 'Création impossible', 500, correlationId ?? undefined);
  }

  await logAdminAction({
    action: 'products.create',
    actor_id: user.id,
    target_table: 'shop_products',
    target_id: (data as { id: string }).id,
    diff: { slug, name: body.data.name, price_eur: body.data.price_eur },
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  return ok({ success: true, data }, { correlationId: correlationId ?? undefined, status: 201 });
}
