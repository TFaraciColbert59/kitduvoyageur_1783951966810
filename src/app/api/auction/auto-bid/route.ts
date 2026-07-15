import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'non_authentifie' }, { status: 401 });
    }

    const body = await req.json();
    const { listing_id, plafond_cents } = body;

    if (!listing_id || typeof plafond_cents !== 'number') {
      return NextResponse.json({ error: 'parametres_invalides' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('set_auto_bid', {
      p_listing_id: listing_id,
      p_bidder_id: user.id,
      p_plafond_cents: plafond_cents,
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
    console.error('[auction/auto-bid] error:', err);
    return NextResponse.json({ error: 'erreur_serveur' }, { status: 500 });
  }
}
