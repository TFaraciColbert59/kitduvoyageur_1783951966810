import { requireAdminOrRedirect } from '@/features/admin/queries';
import { scoreSellerRisk, type RiskLevel } from '@/features/admin-os/marketplace/risk';

export interface ListingReviewItem {
  id: string;
  vendeur_id: string;
  vendeur_age_days: number;
  prix_cents: number;
  statut: string;
  listing_type: string;
  created_at: string;
  reports: number;
  disputes: number;
  risk_score: number;
  risk_level: RiskLevel;
  risk_indicators: string[];
}

/**
 * File de review marketplace : annonces non actives + nouveautés 7 j,
 * enrichies du score vendeur (signaux : âge compte, signalements et rejets
 * du moderation_queue sur ses annonces). RLS, réel, paginé serveur.
 */
export async function getMarketplaceReviewQueue(limit = 20): Promise<ListingReviewItem[]> {
  const { supabase } = await requireAdminOrRedirect('moderation.read');
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, vendeur_id, prix_cents, statut, listing_type, created_at, user_profiles(created_at, trust_score)'
    )
    .or(`statut.neq.actif,created_at.gte.${since}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`marketplace_queue_unreadable:${error.code}`);
  const rows = ((data ?? []) as {
    id: string;
    vendeur_id: string;
    prix_cents: number;
    statut: string;
    listing_type: string;
    created_at: string;
    user_profiles: { created_at: string; trust_score: number | null } | { created_at: string; trust_score: number | null }[] | null;
  }[]).map((r) => {
    const profile = Array.isArray(r.user_profiles) ? (r.user_profiles[0] ?? null) : r.user_profiles;
    return {
      ...r,
      vendeur_created_at: profile?.created_at ?? null,
      vendeur_trust: typeof profile?.trust_score === 'number' ? profile.trust_score : null,
    };
  });

  const ids = rows.map((r) => r.id);
  let mods: { contenu_id: string; statut: string }[] = [];
  if (ids.length > 0) {
    const { data: m } = await supabase
      .from('moderation_queue')
      .select('contenu_id, statut')
      .eq('contenu_type', 'listing')
      .in('contenu_id', ids);
    mods = (m ?? []) as { contenu_id: string; statut: string }[];
  }

  return rows.map((r) => {
    const reports = mods.filter((x) => x.contenu_id === r.id && x.statut === 'signale').length;
    const disputes = mods.filter((x) => x.contenu_id === r.id && x.statut === 'rejete').length;
    const ageDays = r.vendeur_created_at
      ? Math.max(0, Math.floor((Date.now() - Date.parse(r.vendeur_created_at)) / 86400000))
      : 0;
    const risk = scoreSellerRisk({
      accountAgeDays: ageDays,
      completedTx: 0,
      disputes,
      reports,
      activeListings: 1,
      trustScore: r.vendeur_trust,
    });
    return {
      id: r.id,
      vendeur_id: r.vendeur_id,
      vendeur_age_days: ageDays,
      prix_cents: r.prix_cents,
      statut: r.statut,
      listing_type: r.listing_type,
      created_at: r.created_at,
      reports,
      disputes,
      risk_score: risk.score,
      risk_level: risk.level,
      risk_indicators: risk.indicators,
    };
  });
}
