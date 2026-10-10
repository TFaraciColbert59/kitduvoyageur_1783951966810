import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import {
  parseOrderBody,
  buildOrderLines,
  type CatalogProduct,
} from '@/features/checkout/serverPricing';
import { createOrder } from '@/features/loyalty/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ShopProductRow = { id: string; slug: string; name: string; price_eur: number | string };

/**
 * POST /api/orders — création de commande virement (prix et livraison
 * recalculés serveur depuis `shop_products` ; le trigger reste seul créditeur).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const limited = await enforceRateLimit(user.id, {
      scope: 'orders-create',
      limit: 20,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (limited) return limited;

    const parsed = parseOrderBody(await req.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const service = getServiceSupabase();
    if (!service) {
      return NextResponse.json({ error: 'service_indisponible' }, { status: 503 });
    }

    const slugs = Array.from(new Set(parsed.value.lines.map((line) => line.slug)));
    const { data: rows, error } = await service
      .from('shop_products')
      .select('id, slug, name, price_eur, available')
      .eq('available', true)
      .in('slug', slugs);

    if (error) {
      console.error('[orders] product lookup failed:', error.message);
      return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
    }

    const productsBySlug = new Map<string, CatalogProduct>();
    for (const row of (rows ?? []) as ShopProductRow[]) {
      productsBySlug.set(row.slug, {
        id: row.id,
        slug: row.slug,
        name: row.name,
        priceEur: Number(row.price_eur),
      });
    }

    const built = buildOrderLines(parsed.value.lines, productsBySlug);
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: 400 });
    }

    const outcome = await createOrder(user.id, {
      lines: built.lines,
      subtotalEur: built.subtotalEur,
      shippingOption: parsed.value.shippingOption,
      shipping: parsed.value.shipping,
    });
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    return NextResponse.json({ success: true, ...outcome.data });
  } catch (err) {
    console.error('[orders] Unexpected error:', err);
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 });
  }
}
