import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publicSignature, signatureText } from '@/features/identity/fieldSignature';

export const dynamic = 'force-dynamic';

/**
 * EMPREINTE PUBLIQUE — lecture respectant le consentement (ADR-010, Lot C).
 * GET /api/identity/signature?userId=<uuid>
 *
 * Deux verrous (défense en profondeur) :
 *  1. SQL : fonction SECURITY DEFINER get_user_signature() qui vérifie
 *     user_profiles.signature_visibility (défaut 'private') — renvoie '{}' sinon.
 *  2. Applicatif : publicSignature() applique le plancher (3 sorties).
 * Résultat RÉPONSE : objet JSON vide si non autorisé OU sous le plancher.
 * Aucun coordonnée, aucun nom — uniquement des agrégats + texte descriptif.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId requis' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc('get_user_signature', { p_target: userId });
  const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;

  // Au moins un champ non vide hors clé inconnue → on filtre par le plancher.
  const row = {
    total_outings: typeof raw.total_outings === 'number' ? raw.total_outings : 0,
    total_km: typeof raw.total_km === 'number' ? raw.total_km : 0,
    total_dplus_m: typeof raw.total_dplus_m === 'number' ? raw.total_dplus_m : 0,
    max_altitude_gain_m: typeof raw.max_altitude_gain_m === 'number' ? raw.max_altitude_gain_m : 0,
    distinct_months: typeof raw.distinct_months === 'number' ? raw.distinct_months : 0,
    distinct_regions: typeof raw.distinct_regions === 'number' ? raw.distinct_regions : 0,
    max_autonomy_days: typeof raw.max_autonomy_days === 'number' ? raw.max_autonomy_days : 0,
    off_trail_share: typeof raw.off_trail_share === 'number' ? raw.off_trail_share : 0,
  };

  // Objet vide → soit cible inconnue, soit consentement 'private', soit plancher non atteint.
  if (Object.values(raw).every((v) => v === 0) || Object.keys(raw).length === 0) {
    return NextResponse.json({ signature: null, label: 'pas encore d’empreinte' });
  }

  const pub = publicSignature(row);
  if (!pub) {
    return NextResponse.json({ signature: null, label: 'lignée jeune' });
  }

  return NextResponse.json({
    signature: pub,
    text: signatureText(pub, []), // régions gérées côté affichage (fragment du profil)
    label: null,
  });
}