-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: gear_items full schema + occasion_offers + auction_items drop
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PART A: Add missing columns to gear_items ────────────────────────────────
ALTER TABLE public.gear_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manuel'
    CHECK (source IN ('achat','kit','manuel','occasion')),
  ADD COLUMN IF NOT EXISTS origin_order_id uuid REFERENCES public.orders(id),
  ADD COLUMN IF NOT EXISTS origin_kit_id uuid REFERENCES public.kits(id),
  ADD COLUMN IF NOT EXISTS is_listed_for_sale boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS acquired_at date DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS transferred_to_user_id uuid REFERENCES auth.users(id);

-- ── PART E: Drop auction_items ────────────────────────────────────────────────
DROP TABLE IF EXISTS public.auction_items CASCADE;

-- ── PART F1: Add missing columns to occasion_items ───────────────────────────
ALTER TABLE public.occasion_items
  ADD COLUMN IF NOT EXISTS gear_item_id uuid REFERENCES public.gear_items(id),
  ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_released_at timestamptz;

-- ── PART F2: Create occasion_offers table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.occasion_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_item_id uuid REFERENCES public.occasion_items(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES auth.users(id) NOT NULL,
  offered_price numeric NOT NULL,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.occasion_offers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Acheteur et vendeur voient les offres les concernant"
    ON public.occasion_offers FOR SELECT
    USING (
      auth.uid() = buyer_id
      OR auth.uid() = (
        SELECT seller_id FROM public.occasion_items WHERE id = occasion_item_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "L'acheteur crée ses offres"
    ON public.occasion_offers FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Le vendeur répond aux offres"
    ON public.occasion_offers FOR UPDATE
    USING (
      auth.uid() = (
        SELECT seller_id FROM public.occasion_items WHERE id = occasion_item_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
