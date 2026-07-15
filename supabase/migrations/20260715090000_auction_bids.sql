-- ============================================================
-- KIT DU VOYAGEUR — Auction Bids & Auto-Bids
-- ============================================================

-- 1. TABLES

CREATE TABLE IF NOT EXISTS public.auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  montant_cents INTEGER NOT NULL,
  is_auto_bid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.auction_auto_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  plafond_cents INTEGER NOT NULL,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. INDEXES

CREATE INDEX IF NOT EXISTS idx_auction_bids_listing_id ON public.auction_bids(listing_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder_id ON public.auction_bids(bidder_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_created_at ON public.auction_bids(listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_auto_bids_listing_id ON public.auction_auto_bids(listing_id);
CREATE INDEX IF NOT EXISTS idx_auction_auto_bids_bidder_id ON public.auction_auto_bids(bidder_id);

-- Unique: one active auto-bid per user per listing
CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_auto_bids_unique_active
  ON public.auction_auto_bids(listing_id, bidder_id)
  WHERE actif = TRUE;

-- 3. FUNCTIONS

-- Check if user has sufficient Trust Score to bid (min 40)
CREATE OR REPLACE FUNCTION public.can_user_bid(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = user_uuid AND trust_score >= 40
  );
$$;

-- Check if user has sufficient Trust Score to sell via auction (min 60)
CREATE OR REPLACE FUNCTION public.can_user_sell_auction(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = user_uuid AND trust_score >= 60
  );
$$;

-- Place a bid: validates Trust Score, increment, and auction status server-side
CREATE OR REPLACE FUNCTION public.place_bid(
  p_listing_id UUID,
  p_bidder_id UUID,
  p_montant_cents INTEGER,
  p_is_auto_bid BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing RECORD;
  v_trust_score INTEGER;
  v_min_next INTEGER;
  v_bid_id UUID;
BEGIN
  -- Fetch listing
  SELECT enchere_actuelle_cents, increment_min_cents, date_fin_enchere, statut, vendeur_id
  INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id AND listing_type = 'enchere'::public.listing_type;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'listing_not_found');
  END IF;

  -- Check auction is still active
  IF v_listing.statut != 'actif' OR v_listing.date_fin_enchere < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'auction_closed');
  END IF;

  -- Seller cannot bid on own listing
  IF v_listing.vendeur_id = p_bidder_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_bid_own_listing');
  END IF;

  -- Check Trust Score
  SELECT trust_score INTO v_trust_score
  FROM public.user_profiles
  WHERE id = p_bidder_id;

  IF v_trust_score IS NULL OR v_trust_score < 40 THEN
    RETURN jsonb_build_object('success', false, 'error', 'trust_score_insufficient', 'required', 40, 'current', COALESCE(v_trust_score, 0));
  END IF;

  -- Check minimum increment
  v_min_next := v_listing.enchere_actuelle_cents + v_listing.increment_min_cents;
  IF p_montant_cents < v_min_next THEN
    RETURN jsonb_build_object('success', false, 'error', 'below_minimum', 'minimum_cents', v_min_next);
  END IF;

  -- Insert bid
  INSERT INTO public.auction_bids (listing_id, bidder_id, montant_cents, is_auto_bid)
  VALUES (p_listing_id, p_bidder_id, p_montant_cents, p_is_auto_bid)
  RETURNING id INTO v_bid_id;

  -- Update listing current bid and bidder count
  UPDATE public.listings
  SET
    enchere_actuelle_cents = p_montant_cents,
    nombre_encherisseurs = nombre_encherisseurs + 1,
    updated_at = NOW()
  WHERE id = p_listing_id;

  RETURN jsonb_build_object('success', true, 'bid_id', v_bid_id, 'montant_cents', p_montant_cents);
END;
$$;

-- Upsert auto-bid ceiling
CREATE OR REPLACE FUNCTION public.set_auto_bid(
  p_listing_id UUID,
  p_bidder_id UUID,
  p_plafond_cents INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing RECORD;
  v_trust_score INTEGER;
BEGIN
  SELECT enchere_actuelle_cents, increment_min_cents, date_fin_enchere, statut, vendeur_id
  INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id AND listing_type = 'enchere'::public.listing_type;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'listing_not_found');
  END IF;

  IF v_listing.statut != 'actif' OR v_listing.date_fin_enchere < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'auction_closed');
  END IF;

  IF v_listing.vendeur_id = p_bidder_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_bid_own_listing');
  END IF;

  SELECT trust_score INTO v_trust_score FROM public.user_profiles WHERE id = p_bidder_id;
  IF v_trust_score IS NULL OR v_trust_score < 40 THEN
    RETURN jsonb_build_object('success', false, 'error', 'trust_score_insufficient', 'required', 40, 'current', COALESCE(v_trust_score, 0));
  END IF;

  IF p_plafond_cents <= v_listing.enchere_actuelle_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'plafond_too_low');
  END IF;

  INSERT INTO public.auction_auto_bids (listing_id, bidder_id, plafond_cents, actif)
  VALUES (p_listing_id, p_bidder_id, p_plafond_cents, TRUE)
  ON CONFLICT (listing_id, bidder_id) DO UPDATE
    SET plafond_cents = EXCLUDED.plafond_cents, actif = TRUE, updated_at = NOW()
  WHERE public.auction_auto_bids.actif = TRUE;

  RETURN jsonb_build_object('success', true, 'plafond_cents', p_plafond_cents);
END;
$$;

-- Get comparable sales for AI price suggestion
CREATE OR REPLACE FUNCTION public.get_comparable_sales(
  p_produit_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
  montant_cents INTEGER,
  closed_at TIMESTAMPTZ,
  nombre_encherisseurs INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    enchere_actuelle_cents AS montant_cents,
    date_fin_enchere AS closed_at,
    nombre_encherisseurs
  FROM public.listings
  WHERE
    produit_id = p_produit_id
    AND listing_type = 'enchere'::public.listing_type
    AND statut = 'cloture'
    AND enchere_actuelle_cents > 0
  ORDER BY date_fin_enchere DESC
  LIMIT p_limit;
$$;

-- 4. RLS

ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_auto_bids ENABLE ROW LEVEL SECURITY;

-- Bids: public can read (anonymized in app), authenticated can insert own bids
DROP POLICY IF EXISTS "auction_bids_public_read" ON public.auction_bids;
CREATE POLICY "auction_bids_public_read" ON public.auction_bids
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auction_bids_user_insert" ON public.auction_bids;
CREATE POLICY "auction_bids_user_insert" ON public.auction_bids
  FOR INSERT TO authenticated
  WITH CHECK (bidder_id = auth.uid());

-- Auto-bids: only owner can read/manage
DROP POLICY IF EXISTS "auction_auto_bids_owner" ON public.auction_auto_bids;
CREATE POLICY "auction_auto_bids_owner" ON public.auction_auto_bids
  FOR ALL TO authenticated
  USING (bidder_id = auth.uid())
  WITH CHECK (bidder_id = auth.uid());
