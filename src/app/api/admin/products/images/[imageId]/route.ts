import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
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

  const { imageId } = await params;
  if (!idParam.safeParse(imageId).success) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
  }
  if (!primarySchema.safeParse(await req.json().catch(() => null)).success) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const { data: image } = await supabase
    .from('product_images')
    .select('id, product_id')
    .eq('id', imageId)
    .single();
  if (!image) {
    return NextResponse.json({ error: 'Image introuvable' }, { status: 404 });
  }
  const productId = (image as { product_id: string }).product_id;

  await supabase.from('product_images').update({ is_primary: false }).eq('product_id', productId);
  const { error } = await supabase
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', imageId);
  if (error) {
    console.error('[admin/images] principal impossible', { code: error.code });
    return NextResponse.json({ error: 'Opération impossible' }, { status: 500 });
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
  return NextResponse.json({ success: true });
}

/** DELETE /api/admin/products/images/[imageId] — supprime Storage + fiche. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
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

  const { imageId } = await params;
  if (!idParam.safeParse(imageId).success) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
  }

  const { data: image } = await supabase
    .from('product_images')
    .select('id, product_id, storage_path')
    .eq('id', imageId)
    .single();
  if (!image) {
    return NextResponse.json({ error: 'Image introuvable' }, { status: 404 });
  }

  const service = getServiceSupabase();
  if (service) {
    await service.storage
      .from(BUCKET)
      .remove([(image as { storage_path: string }).storage_path]);
  }
  const { error } = await supabase.from('product_images').delete().eq('id', imageId);
  if (error) {
    console.error('[admin/images] suppression impossible', { code: error.code });
    return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 });
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
  return NextResponse.json({ success: true });
}
