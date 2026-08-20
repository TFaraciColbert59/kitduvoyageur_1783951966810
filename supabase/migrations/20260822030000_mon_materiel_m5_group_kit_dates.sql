-- ============================================================================
-- LKDV — Mon Matériel v3 : M5 — engagement de groupe (start_date / end_date)
-- La table group_kit_items existe déjà (20260716000000) avec `assigned_to`.
-- On ajoute la fenêtre de réservation pour le widget « Engagements de groupe ».
-- Idempotent, aucune suppression de données.
-- ============================================================================

ALTER TABLE public.group_kit_items
  ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE public.group_kit_items
  ADD COLUMN IF NOT EXISTS end_date DATE;

CREATE INDEX IF NOT EXISTS idx_group_kit_items_dates
  ON public.group_kit_items(start_date, end_date)
  WHERE start_date IS NOT NULL OR end_date IS NOT NULL;