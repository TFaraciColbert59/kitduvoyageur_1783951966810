-- Migration: 20260715110000_new_product_stock_fields.sql
-- Adds stock_statut and reappro_date columns to products and listings tables
-- for the "Fiche Produit — Type Neuf" feature.

-- ── 1. ENUM for stock status ───────────────────────────────────────────────────
DROP TYPE IF EXISTS public.stock_statut_type CASCADE;
CREATE TYPE public.stock_statut_type AS ENUM ('en_stock', 'rupture', 'reappro');

-- ── 2. Add columns to products table (if it exists) ───────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS stock_statut public.stock_statut_type DEFAULT 'en_stock'::public.stock_statut_type,
      ADD COLUMN IF NOT EXISTS reappro_date TIMESTAMPTZ;
  END IF;
END $$;

-- ── 3. Add columns to listings table (if it exists) ───────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'listings'
  ) THEN
    ALTER TABLE public.listings
      ADD COLUMN IF NOT EXISTS stock_statut public.stock_statut_type DEFAULT 'en_stock'::public.stock_statut_type,
      ADD COLUMN IF NOT EXISTS reappro_date TIMESTAMPTZ;
  END IF;
END $$;

-- ── 4. Indexes ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_products_stock_statut ON public.products(stock_statut);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'listings'
  ) THEN
    -- listing_type is the actual enum column (neuf/kit/occasion/enchere/location)
    CREATE INDEX IF NOT EXISTS idx_listings_occasion_check
      ON public.listings(produit_id, listing_type, statut)
      WHERE listing_type = 'occasion' AND statut = 'actif';
  END IF;
END $$;

-- ── 5. Helper function: get cheapest active occasion listing for a product ─────
CREATE OR REPLACE FUNCTION public.get_occasion_listing_for_product(p_produit_id UUID)
RETURNS TABLE(listing_slug TEXT, listing_prix_cents INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    'occasion-' || l.id::TEXT AS listing_slug,
    l.prix_cents AS listing_prix_cents
  FROM public.listings l
  WHERE l.produit_id::text = p_produit_id::text
    AND l.listing_type::text = 'occasion'
    AND l.statut = 'actif'
  ORDER BY l.prix_cents ASC
  LIMIT 1;
$$;
