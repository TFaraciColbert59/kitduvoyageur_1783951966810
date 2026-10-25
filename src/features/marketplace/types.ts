export type MarketplaceMode = 'vente' | 'location' | 'pret';
export type ListingStatus = 'published' | 'withdrawn' | 'hidden';
export type TransactionStatus =
  'requested' | 'accepted' | 'active' | 'return_pending' | 'completed' | 'cancelled' | 'disputed';
export interface MarketplaceListing {
  id: string;
  item_id?: string;
  owner_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  condition: string | null;
  photo_url: string | null;
  mode: MarketplaceMode;
  description: string;
  public_location: string;
  price_cents: number;
  deposit_cents: number;
  status: ListingStatus;
  created_at: string;
}
export interface MarketplaceTransaction {
  id: string;
  listing_id: string;
  item_id: string;
  owner_id: string;
  buyer_id: string;
  mode: MarketplaceMode;
  status: TransactionStatus;
  listing_snapshot: MarketplaceListing;
  price_cents: number;
  deposit_cents: number;
  start_date: string | null;
  end_date: string | null;
  tracking_code: string | null;
  created_at: string;
  updated_at: string;
}
export interface MarketplaceReview {
  id: string;
  listing_id: string;
  transaction_id: string;
  author_id: string;
  subject_id: string;
  rating: number;
  comment: string;
  created_at: string;
}
export type TransactionAction =
  'accept' | 'handover' | 'receive' | 'return' | 'complete_return' | 'cancel' | 'dispute';
