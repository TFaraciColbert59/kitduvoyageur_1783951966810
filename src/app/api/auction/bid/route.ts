import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'non_authentifie' }, { status: 401 });
    }

    const body = await req.json();
    const { listing_id, montant_cents, is_auto_bid } = body;

    if (!listing_id || typeof montant_cents !== 'number') {
      return NextResponse.json({ error: 'parametres_invalides' }, { status: 400 });
    }

    // Call server-side function that validates Trust Score, increment, and auction status
    const { data, error } = await supabase.rpc('place_bid', {
      p_listing_id: listing_id,
      p_bidder_id: user.id,
      p_montant_cents: montant_cents,
      p_is_auto_bid: is_auto_bid ?? false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data?.success) {
      const statusCode = data?.error === 'trust_score_insufficient' ? 403 : 400;
      return NextResponse.json(data, { status: statusCode });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[auction/bid] error:', err);
    return NextResponse.json({ error: 'erreur_serveur' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const listing_id = searchParams.get('listing_id');

    if (!listing_id) {
      return NextResponse.json({ error: 'listing_id_requis' }, { status: 400 });
    }

    const { data: bids, error } = await supabase
      .from('auction_bids')
      .select('id, montant_cents, is_auto_bid, created_at, bidder_id')
      .eq('listing_id', listing_id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bids: bids ?? [] });
  } catch (err) {
    console.error('[auction/bid GET] error:', err);
    return NextResponse.json({ error: 'erreur_serveur' }, { status: 500 });
  }
}
