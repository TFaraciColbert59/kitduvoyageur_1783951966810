import { NextRequest } from 'next/server';
import { z } from 'zod';

import { logAdminAction } from '@/server/admin/audit';
import { checkCsrfToken } from '@/server/admin/csrf';
import { requireAdmin } from '@/server/admin/requireAdmin';
import { fail, ok } from '@/server/admin/respond';
import { stockMoveSchema } from '@/server/admin/productSchemas';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { readCorrelationId } from '@/lib/observability/correlation';

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
  const body = stockMoveSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return fail('invalid_body', 'Requête invalide', 400, correlationId ?? undefined);
  }

  const { data: product, error: readError } = await supabase
    .from('shop_products')
    .select('id, slug, name, stock')
    .eq('id', id)
    .single();
  if (readError || !product) {
    return fail('not_found', 'Produit introuvable', 404, correlationId ?? undefined);
  }
  const before = (product as { stock: number }).stock ?? 0;
  const after = before + body.data.quantity_change;
  if (after < 0) {
    return fail('negative_stock', 'Stock résultant négatif', 400, correlationId ?? undefined);
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
    return fail('stock_move_failed', 'Mouvement impossible', 500, correlationId ?? undefined);
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
  return ok({ success: true, data: { before, after } }, { correlationId: correlationId ?? undefined });
}
