import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/kits/my-royalties
 * « Ma part créateur » (Lot 6.5) : liste les parts de l'utilisateur connecté
 * (RLS `royalty_shares_select_own`), avec le contexte d'attribution.
 *
 * ⚠️ FEATURE GELÉE (Lot 6) : la part créateur n'est pas encore versable au
 * checkout (le crédit boutique n'est pas consommable). Tant que
 * `KIT_ROYALTY_ENABLED` n'est pas 'true' (défaut : désactivé), cette route
 * répond `enabled:false` SANS interroger la base — les tables du Lot 6 ne
 * sont d'ailleurs pas encore créées (migration exclue de la vague).
 */
export async function GET() {
  const royaltyEnabled = process.env.KIT_ROYALTY_ENABLED === 'true';
  if (!royaltyEnabled) {
    return NextResponse.json(
      { enabled: false, message: 'La part créateur arrive bientôt.' },
      { status: 200 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { data: shares, error } = await supabase
      .from('kit_royalty_shares')
      .select('*, kit_attributions!inner(kit_id, amount_cents, rate_bps, status, created_at)')
      .eq('beneficiary_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const { data: ledger } = await supabase
      .from('store_credit_ledger')
      .select('amount_cents, entry_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({ shares: shares ?? [], ledger: ledger ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}