-- ==============================================================================
-- Migration : 20260909120000_trips_kit_id.sql
-- HUB V5 — Fusion Équipement/Matériel : chaque voyage peut référencer le
-- kit matériel « sélectionné » (trips.kit_id → materiel_kits.id).
-- ==============================================================================

BEGIN;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS kit_id UUID REFERENCES public.materiel_kits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trips_kit_id ON public.trips(kit_id);

COMMIT;
