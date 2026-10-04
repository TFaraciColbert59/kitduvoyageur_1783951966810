-- ============================================================================
-- ADMIN REBUILD — Colonnes boutique étendues (gestion pro du catalogue)
-- ============================================================================
-- Strictement additif (ADD COLUMN IF NOT EXISTS, aucun backfill, aucun
-- DROP). Valeurs héritées du brouillon legacy (fournisseur, EAN, seuil,
-- tags, variantes, SEO, coûts) avec défauts sûrs.
-- ============================================================================

ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS supplier TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ean TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS min_stock INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS meta_title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cost_price_eur NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2);

CREATE INDEX IF NOT EXISTS idx_shop_products_supplier ON public.shop_products(supplier);
CREATE INDEX IF NOT EXISTS idx_shop_products_ean ON public.shop_products(ean);
