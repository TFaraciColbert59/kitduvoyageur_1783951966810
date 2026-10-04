import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const BUCKET = 'product-images';

/**
 * POST /api/admin/products/upload — téléversement d'un visuel produit.
 * Multipart : product_id (uuid), alt (≤255), file (jpeg/png/webp ≤5 Mo).
 * Écriture Storage via service_role (jamais depuis le navigateur).
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdmin('products.write');
  if (!gate.ok) return gate.response;
  const { supabase, user } = gate.ctx;

  if (!(await checkCsrfToken(req))) {
    return NextResponse.json({ error: 'Jeton CSRF invalide' }, { status: 403 });
  }
  const limited = await enforceRateLimit(user.id, {
    scope: 'admin-products-upload',
    limit: 20,
    windowMs: 60_000,
    failMode: 'closed',
  });
  if (limited) return limited;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Formulaire illisible' }, { status: 400 });
  }

  const productId = form.get('product_id');
  const alt = form.get('alt');
  const file = form.get('file');
  if (
    typeof productId !== 'string' ||
    !z.string().uuid().safeParse(productId).success ||
    !(file instanceof File)
  ) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json({ error: 'Type de fichier refusé' }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Fichier trop volumineux (5 Mo max)' }, { status: 400 });
  }
  const altText = typeof alt === 'string' ? alt.slice(0, 255) : '';

  const { data: product } = await supabase
    .from('shop_products')
    .select('id')
    .eq('id', productId)
    .single();
  if (!product) {
    return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: 'Stockage indisponible' }, { status: 503 });
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `${productId}/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error('[admin/upload] téléversement impossible', { code: uploadError });
    return NextResponse.json({ error: 'Téléversement impossible' }, { status: 500 });
  }

  const { data: urlData } = service.storage.from(BUCKET).getPublicUrl(storagePath);
  const { count } = await supabase
    .from('product_images')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);

  const { data: row, error: rowError } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      storage_path: storagePath,
      url: urlData.publicUrl,
      alt: altText,
      is_primary: (count ?? 0) === 0,
      sort_order: count ?? 0,
    })
    .select('*')
    .single();
  if (rowError) {
    await service.storage.from(BUCKET).remove([storagePath]);
    console.error('[admin/upload] fiche impossible', { code: rowError.code });
    return NextResponse.json({ error: 'Fiche image impossible' }, { status: 500 });
  }

  await logAdminAction({
    action: 'products.image.upload',
    actor_id: user.id,
    target_table: 'product_images',
    target_id: (row as { id: string }).id,
    diff: { product_id: productId, storage_path: storagePath },
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ success: true, data: row }, { status: 201 });
}
