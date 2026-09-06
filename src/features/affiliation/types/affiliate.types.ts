export type AffiliateCategory =
  | 'flight'
  | 'hotel'
  | 'activity'
  | 'insurance'
  | 'esim'
  | 'transport'
  | 'gear';

export interface AffiliatePartner {
  id: string;
  slug: string;
  name: string;
  network: string;
  website_url?: string | null;
  commission_rate_desc?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AffiliateLink {
  id: string;
  slug: string;
  partner_id: string;
  partner?: AffiliatePartner;
  category: AffiliateCategory;
  country_code?: string | null;
  title: string;
  destination_name?: string | null;
  target_url: string;
  tracking_params: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AffiliateClick {
  id: string;
  link_id: string;
  user_id?: string | null;
  trip_id?: string | null;
  session_hash: string;
  user_agent?: string | null;
  referrer?: string | null;
  created_at: string;
}

export interface AffiliateConversion {
  id: string;
  partner_id: string;
  external_sub_id: string;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'rejected';
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
