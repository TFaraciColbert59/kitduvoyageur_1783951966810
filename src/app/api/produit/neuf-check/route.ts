import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const produit_id = searchParams.get('produit_id');

  if (!produit_id) {
    return NextResponse.json({ error: 'produit_id requis' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('listings')
      .select('id, prix_cents, listing_type')
      .eq('produit_id', produit_id)
      .eq('listing_type', 'neuf')
      .eq('statut', 'actif')
      .order('prix_cents', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ listing: null });
    }

    return NextResponse.json({
      listing: {
        slug: `neuf-${data.id}`,
        prix_cents: data.prix_cents,
      },
    });
  } catch {
    return NextResponse.json({ listing: null });
  }
}
