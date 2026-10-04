import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { productUpdateSchema } from '@/server/admin/productSchemas';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idParam = z.string().uuid();

/** GET /api/admin/products/[id] — fiche + images + mouvements. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin('products.read');
  if (!gate.ok) return gate.response;
  const { supabase } = gate.ctx;

  const { id } = await params;
  if (!idParam.safeParse(id).success) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
  }

  const [product, images, movements] = await Promise.all([
    supabase.from('shop_products').select('*').eq('id', id).single(),
    supabase
      .from('product_images')
      .select('*')
      .eq('product_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  if (product.error) {
    return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  }
  const res = NextResponse.json({
    data: {
      product: product.data,
      images: images.data ?? [],
      movements: movements.data ?? [],
    },
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

/** PATCH /api/admin/products/[id] — mise à jour partielle (hors stock). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!idParam.safeParse(id).success) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
  }
  const body = productUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      {
        error: 'Requête invalide',
        fields: body.error.issues.map((i) => i.path.join('.')),
      },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('shop_products')
    .update({ ...body.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, slug, name')
    .single();
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Doublon (slug ou référence)' }, { status: 409 });
    }
    console.error('[admin/products] mise à jour impossible', { code: error.code });
    return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 });
  }

  await logAdminAction({
    action: 'products.update',
    actor_id: user.id,
    target_table: 'shop_products',
    target_id: id,
    diff: body.data as Record<string, unknown>,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ success: true, data });
}

/** DELETE /api/admin/products/[id] — archivage (soft-delete, jamais de suppression dure). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!idParam.safeParse(id).success) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('shop_products')
    .update({ deleted_at: now, is_active: false, updated_at: now })
    .eq('id', id);
  if (error) {
    console.error('[admin/products] archivage impossible', { code: error.code });
    return NextResponse.json({ error: 'Archivage impossible' }, { status: 500 });
  }

  await logAdminAction({
    action: 'products.archive',
    actor_id: user.id,
    target_table: 'shop_products',
    target_id: id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ success: true });
}
