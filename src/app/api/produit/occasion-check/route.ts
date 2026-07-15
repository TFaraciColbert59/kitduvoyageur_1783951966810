import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/produit/occasion-check?produit_id=<id>
 *
 * Checks whether an active occasion listing exists for the same product model.
 * Returns { listing: { slug, prix_cents } } or { listing: null }.
 *
 * Looks up the `listings` table (unified listings from migration 20260714180000).
 * Falls back gracefully if the table or columns don't exist yet.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const produitId = searchParams.get('produit_id');

  if (!produitId) {
    return NextResponse.json({ listing: null }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // Query the unified listings table for an active occasion listing
    // that references the same produit_id (or same model via product reference)
    const { data, error } = await supabase
      .from('listings')
      .select('id, prix_cents, statut, listing_type')
      .eq('produit_id', produitId)
      .eq('listing_type', 'occasion')
      .eq('statut', 'actif')
      .order('prix_cents', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ listing: null });
    }

    return NextResponse.json({
      listing: {
        slug: `occasion-${data.id}`,
        prix_cents: data.prix_cents,
      },
    });
  } catch {
    // Graceful fallback — banner simply won't show
    return NextResponse.json({ listing: null });
  }
}
