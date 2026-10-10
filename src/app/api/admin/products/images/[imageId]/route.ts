import { NextRequest } from 'next/server';
import { z } from 'zod';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { readCorrelationId } from '@/lib/observability/correlation';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idParam = z.string().uuid();
const primarySchema = z.object({ is_primary: z.literal(true) });
const BUCKET = 'product-images';

/** PATCH /api/admin/products/images/[imageId] — définit le visuel principal. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('products.write');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('invalid_csrf_token', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-products',
    limit: 60,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const { imageId } = await params;
  if (!idParam.safeParse(imageId).success) {
    return fail('invalid_id', 'Identifiant invalide', 400, correlationId ?? undefined);
  }
  if (!primarySchema.safeParse(await req.json().catch(() => null)).success) {
    return fail('invalid_request', 'Requête invalide', 400, correlationId ?? undefined);
  }

  const { data: image } = await supabase
    .from('product_images')
    .select('id, product_id')
    .eq('id', imageId)
    .single();
  if (!image) {
    return fail('image_not_found', 'Image introuvable', 404, correlationId ?? undefined);
  }
  const productId = (image as { product_id: string }).product_id;

  const { error: resetError } = await supabase
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId);
  if (resetError) {
    console.error('[admin/images] reset principal impossible', { code: resetError.code });
    return fail('reset_primary_failed', 'Opération impossible', 500, correlationId ?? undefined);
  }
  const { error } = await supabase
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', imageId);
  if (error) {
    console.error('[admin/images] principal impossible', { code: error.code });
    return fail('set_primary_failed', 'Opération impossible', 500, correlationId ?? undefined);
  }

  await logAdminAction({
    action: 'products.image.primary',
    actor_id: user.id,
    target_table: 'product_images',
    target_id: imageId,
    diff: { product_id: productId },
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  return ok({ success: true }, { correlationId: correlationId ?? undefined });
}

/** DELETE /api/admin/products/images/[imageId] — supprime Storage + fiche. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const correlationId = readCorrelationId(req);
  const gate = await requireAdmin('products.write');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return fail('invalid_csrf_token', 'Jeton CSRF invalide', 403, correlationId ?? undefined);
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-products',
    limit: 60,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  const { imageId } = await params;
  if (!idParam.safeParse(imageId).success) {
    return fail('invalid_id', 'Identifiant invalide', 400, correlationId ?? undefined);
  }

  const { data: image } = await supabase
    .from('product_images')
    .select('id, product_id, storage_path')
    .eq('id', imageId)
    .single();
  if (!image) {
    return fail('image_not_found', 'Image introuvable', 404, correlationId ?? undefined);
  }

  const service = getServiceSupabase();
  if (!service) {
    return fail('storage_unavailable', 'Stockage indisponible', 503, correlationId ?? undefined);
  }
  const { error: rmError } = await service.storage
    .from(BUCKET)
    .remove([(image as { storage_path: string }).storage_path]);
  if (rmError) {
    console.error('[admin/images] retrait storage impossible');
    return fail('storage_delete_failed', 'Suppression storage impossible', 500, correlationId ?? undefined);
  }
  const { error } = await supabase.from('product_images').delete().eq('id', imageId);
  if (error) {
    console.error('[admin/images] suppression impossible', { code: error.code });
    return fail('delete_failed', 'Suppression impossible', 500, correlationId ?? undefined);
  }

  await logAdminAction({
    action: 'products.image.delete',
    actor_id: user.id,
    target_table: 'product_images',
    target_id: imageId,
    diff: { product_id: (image as { product_id: string }).product_id },
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  return ok({ success: true }, { correlationId: correlationId ?? undefined });
}
