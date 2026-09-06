import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  AffiliateLink,
  AffiliatePartner,
  AffiliateCategory,
  AffiliateConversion,
} from '@/features/affiliation/types/affiliate.types';
import { hashSessionForRgpd } from '@/features/affiliation/engine/affiliateEngine';
import type { AffiliatePostbackPayload } from '@/features/affiliation/schemas/affiliate.schema';

/**
 * Récupère les liens d'affiliation actifs pour un pays ou une catégorie
 */
export async function getAffiliateLinks(options?: {
  countryCode?: string;
  category?: AffiliateCategory;
  limit?: number;
}): Promise<AffiliateLink[]> {
  const supabase = await createClient();

  let query = supabase
    .from('affiliate_links')
    .select(`
      id, slug, partner_id, category, country_code, title, destination_name,
      target_url, tracking_params, is_active, created_at, updated_at,
      partner:affiliate_partners(id, slug, name, network, website_url, commission_rate_desc, is_active, created_at)
    `)
    .eq('is_active', true);

  if (options?.countryCode) {
    query = query.eq('country_code', options.countryCode.toUpperCase());
  }

  if (options?.category) {
    query = query.eq('category', options.category);
  }

  query = query.order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getAffiliateLinks] Erreur Supabase :', error);
    return [];
  }

  return (data || []).map((row: any) => {
    const partnerData = Array.isArray(row.partner) ? row.partner[0] : row.partner;
    return {
      id: row.id,
      slug: row.slug,
      partner_id: row.partner_id,
      partner: partnerData as unknown as AffiliatePartner,
      category: row.category as AffiliateCategory,
      country_code: row.country_code,
      title: row.title,
      destination_name: row.destination_name,
      target_url: row.target_url,
      tracking_params: row.tracking_params || {},
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}

/**
 * Récupère un lien d'affiliation spécifique par son slug
 */
export async function getAffiliateLinkBySlug(
  slug: string
): Promise<AffiliateLink | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('affiliate_links')
    .select(`
      id, slug, partner_id, category, country_code, title, destination_name,
      target_url, tracking_params, is_active, created_at, updated_at,
      partner:affiliate_partners(id, slug, name, network, website_url, commission_rate_desc, is_active, created_at)
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  const partnerData = Array.isArray(data.partner) ? data.partner[0] : data.partner;

  return {
    id: data.id,
    slug: data.slug,
    partner_id: data.partner_id,
    partner: partnerData as unknown as AffiliatePartner,
    category: data.category as AffiliateCategory,
    country_code: data.country_code,
    title: data.title,
    destination_name: data.destination_name,
    target_url: data.target_url,
    tracking_params: (data.tracking_params as Record<string, string>) || {},
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Enregistre un clic d'affiliation sortant avec minimisation RGPD (ROADMAP §5.3)
 */
export async function logAffiliateClick(
  linkId: string,
  options: {
    userId?: string;
    tripId?: string;
    ip?: string;
    userAgent?: string;
    referrer?: string;
  }
): Promise<{ clickId: string }> {
  const supabase = await createClient();

  const sessionHash = hashSessionForRgpd(
    options.ip || '127.0.0.1',
    options.userAgent || 'unknown'
  );

  const { data, error } = await supabase
    .from('affiliate_clicks')
    .insert({
      link_id: linkId,
      user_id: options.userId || null,
      trip_id: options.tripId || null,
      session_hash: sessionHash,
      user_agent: options.userAgent ? options.userAgent.slice(0, 255) : null,
      referrer: options.referrer ? options.referrer.slice(0, 500) : null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[logAffiliateClick] Erreur lors de l’enregistrement du clic :', error);
    return { clickId: '' };
  }

  return { clickId: data.id };
}

/**
 * Enregistre une conversion issue du webhook postback Travelpayouts
 */
export async function recordAffiliateConversion(
  payload: AffiliatePostbackPayload
): Promise<AffiliateConversion | null> {
  const supabase = await createClient();

  // Identifier le partenaire
  const { data: partner, error: partErr } = await supabase
    .from('affiliate_partners')
    .select('id')
    .eq('slug', payload.partner_slug)
    .single();

  if (partErr || !partner) {
    throw new Error(`Partenaire affilié inconnu : ${payload.partner_slug}`);
  }

  const { data, error } = await supabase
    .from('affiliate_conversions')
    .upsert(
      {
        partner_id: partner.id,
        external_sub_id: payload.sub_id,
        amount_cents: payload.amount_cents,
        currency: payload.currency,
        status: payload.status,
        payload: payload.raw_payload || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'partner_id,external_sub_id' }
    )
    .select('*')
    .single();

  if (error) {
    console.error('[recordAffiliateConversion] Erreur :', error);
    return null;
  }

  return {
    id: data.id,
    partner_id: data.partner_id,
    external_sub_id: data.external_sub_id,
    amount_cents: data.amount_cents,
    currency: data.currency,
    status: data.status,
    payload: data.payload || {},
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}
