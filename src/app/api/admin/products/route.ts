import { NextRequest, NextResponse } from 'next/server';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { productCreateSchema } from '@/server/admin/productSchemas';
import { paginationSchema } from '@/server/admin/schemas';
import { slugify } from '@/features/admin/productUtils';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/products?q=&page=&pageSize= — catalogue complet
 * (inclut les archivés `deleted_at`, avec fanion).
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin('products.read');
  if (!gate.ok) return gate.response;
  const { supabase } = gate.ctx;

  const parsed = paginationSchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const { page, pageSize, q } = parsed.data;
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
    return NextResponse.json({ error: 'Lecture impossible' }, { status: 500 });
  }
  const res = NextResponse.json({ data: data ?? [], page, pageSize, total: count ?? 0 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

/**
 * POST /api/admin/products — création (slug auto si absent).
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdmin('products.write');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return NextResponse.json({ error: 'Jeton CSRF invalide' }, { status: 403 });
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
    return NextResponse.json(
      {
        error: 'Requête invalide',
        fields: body.error.issues.map((i) => i.path.join('.')),
      },
      { status: 400 }
    );
  }

  const slug = body.data.slug || slugify(body.data.name);
  if (!slug) {
    return NextResponse.json({ error: 'Slug impossible à générer' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('shop_products')
    .insert({ ...body.data, slug })
    .select('id, slug, name')
    .single();
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Doublon (slug ou référence)' }, { status: 409 });
    }
    console.error('[admin/products] création impossible', { code: error.code });
    return NextResponse.json({ error: 'Création impossible' }, { status: 500 });
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
  return NextResponse.json({ success: true, data }, { status: 201 });
}
