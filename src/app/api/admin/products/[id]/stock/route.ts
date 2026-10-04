import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { stockMoveSchema } from '@/server/admin/productSchemas';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idParam = z.string().uuid();

/**
 * POST /api/admin/products/[id]/stock — mouvement de stock tracé.
 * Recalcule before/after depuis le stock courant et journalise.
 */
export async function POST(
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
  const body = stockMoveSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      {
        error: 'Requête invalide',
        fields: body.error.issues.map((i) => i.path.join('.')),
      },
      { status: 400 }
    );
  }

  const { data: product, error: readError } = await supabase
    .from('shop_products')
    .select('id, slug, name, stock')
    .eq('id', id)
    .single();
  if (readError || !product) {
    return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  }
  const before = (product as { stock: number }).stock ?? 0;
  const after = before + body.data.quantity_change;
  if (after < 0) {
    return NextResponse.json({ error: 'Stock résultant négatif' }, { status: 400 });
  }

  // Écriture atomique via RPC (pas de lost-update concurrent) ; la trace
  // stock_movements est créée dans la même transaction serveur.
  const { error: rpcError } = await supabase.rpc('increment_stock', {
    p_product_id: id,
    p_quantity: body.data.quantity_change,
    p_reference_type: body.data.movement_type,
    p_reference_id: body.data.reference_id,
    p_user_id: user.id,
    p_notes: body.data.notes || body.data.movement_type,
  });
  if (rpcError) {
    console.error('[admin/stock] mouvement impossible', { code: rpcError.code });
    return NextResponse.json({ error: 'Mouvement impossible' }, { status: 500 });
  }

  await logAdminAction({
    action: 'products.stock',
    actor_id: user.id,
    target_table: 'shop_products',
    target_id: id,
    diff: {
      movement_type: body.data.movement_type,
      quantity_change: body.data.quantity_change,
      before,
      after,
    },
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    user_agent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ success: true, data: { before, after } });
}
