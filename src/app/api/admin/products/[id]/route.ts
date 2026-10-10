import { NextRequest } from 'next/server';
import { z } from 'zod';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { productUpdateSchema } from '@/server/admin/productSchemas';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { readCorrelationId } from '@/lib/observability/correlation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idParam = z.string().uuid();

/** GET /api/admin/products/[id] — fiche + images + mouvements. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('products.read');
  if (!gate.ok) return gate.response;
  const { supabase } = gate.ctx;

  const { id } = await params;
  if (!idParam.safeParse(id).success) {
    return fail('invalid_id', 'Identifiant invalide', 400, correlationId ?? undefined);
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
    return fail('not_found', 'Produit introuvable', 404, correlationId ?? undefined);
  }
  const res = ok(
    {
      data: {
        product: product.data,
        images: images.data ?? [],
        movements: movements.data ?? [],
      },
    },
    { correlationId: correlationId ?? undefined }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

/** PATCH /api/admin/products/[id] — mise à jour partielle (hors stock). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!idParam.safeParse(id).success) {
    return fail('invalid_id', 'Identifiant invalide', 400, correlationId ?? undefined);
  }
  const body = productUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return fail('invalid_body', 'Requête invalide', 400, correlationId ?? undefined);
  }

  const { data, error } = await supabase
    .from('shop_products')
    .update({ ...body.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, slug, name')
    .single();
  if (error) {
    if (error.code === '23505') {
      return fail('duplicate', 'Doublon (slug ou référence)', 409, correlationId ?? undefined);
    }
    console.error('[admin/products] mise à jour impossible', { code: error.code });
    return fail('update_failed', 'Mise à jour impossible', 500, correlationId ?? undefined);
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
  return ok({ success: true, data }, { correlationId: correlationId ?? undefined });
}

/** DELETE /api/admin/products/[id] — archivage (soft-delete, jamais de suppression dure). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!idParam.safeParse(id).success) {
    return fail('invalid_id', 'Identifiant invalide', 400, correlationId ?? undefined);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('shop_products')
    .update({ deleted_at: now, is_active: false, updated_at: now })
    .eq('id', id);
  if (error) {
    console.error('[admin/products] archivage impossible', { code: error.code });
    return fail('archive_failed', 'Archivage impossible', 500, correlationId ?? undefined);
  }

  await logAdminAction({
    action: 'products.archive',
    actor_id: user.id,
    target_table: 'shop_products',
    target_id: id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  return ok({ success: true }, { correlationId: correlationId ?? undefined });
}
