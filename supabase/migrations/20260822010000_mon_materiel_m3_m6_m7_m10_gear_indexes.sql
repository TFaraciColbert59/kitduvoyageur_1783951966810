-- ============================================================================
-- LKDV — Mon Matériel v3 : M3/M6/M7/M10 — index & colonnes gear_items
--   * M3 : index sur next_maintenance_date (champ déjà présent)
--   * M6 : index sur is_listed_for_sale (champ déjà présent)
--   * M7 : index sur purchase_price (champ déjà présent)
--   * M10 : last_used_at TIMESTAMPTZ + index (détection objets dormants)
-- Idempotent, aucune suppression de données.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_gear_items_next_maintenance
  ON public.gear_items(next_maintenance_date)
  WHERE next_maintenance_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gear_items_is_listed_for_sale
  ON public.gear_items(is_listed_for_sale)
  WHERE is_listed_for_sale = true;

CREATE INDEX IF NOT EXISTS idx_gear_items_purchase_price
  ON public.gear_items(purchase_price);

ALTER TABLE public.gear_items
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_gear_items_last_used_at
  ON public.gear_items(last_used_at)
  WHERE last_used_at IS NOT NULL;