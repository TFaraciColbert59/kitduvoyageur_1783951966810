import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Minimum Trust Score required to sell occasion items
const TRUST_SCORE_MIN_OCCASION = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vendeur_id = searchParams.get('vendeur_id');

  if (!vendeur_id) {
    return NextResponse.json({ error: 'vendeur_id requis' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, trust_score, display_name')
      .eq('id', vendeur_id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { authorized: false, reason: 'Profil vendeur introuvable' },
        { status: 404 }
      );
    }

    const trust_score = data.trust_score ?? 0;
    const authorized = trust_score >= TRUST_SCORE_MIN_OCCASION;

    return NextResponse.json({
      authorized,
      trust_score,
      minimum_required: TRUST_SCORE_MIN_OCCASION,
      reason: authorized
        ? null
        : `Trust Score insuffisant (${trust_score}/${TRUST_SCORE_MIN_OCCASION} minimum requis pour vendre en occasion)`,
    });
  } catch {
    return NextResponse.json(
      { authorized: false, reason: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
