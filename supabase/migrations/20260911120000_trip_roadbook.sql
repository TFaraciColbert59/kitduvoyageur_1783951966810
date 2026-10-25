-- ============================================================
-- ROADBOOK — feuille de route du voyageur
-- 1. trip_steps.start_time : heure de passage/arrivée (taxi, avion, repas…)
-- 2. trip_items.day_number : matériel requis pour un jour donné
-- ============================================================

ALTER TABLE public.trip_steps
  ADD COLUMN IF NOT EXISTS start_time TIME;

COMMENT ON COLUMN public.trip_steps.start_time IS
  'Heure locale de passage/arrivée de l''étape (roadbook) — NULL si non planifiée.';

ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS day_number INT;

ALTER TABLE public.trip_items
  DROP CONSTRAINT IF EXISTS trip_items_day_number_check;

ALTER TABLE public.trip_items
  ADD CONSTRAINT trip_items_day_number_check
  CHECK (day_number IS NULL OR day_number >= 1);

COMMENT ON COLUMN public.trip_items.day_number IS
  'Jour du voyage pour lequel ce matériel est requis (roadbook) — NULL si voyage entier.';

CREATE INDEX IF NOT EXISTS idx_trip_items_day
  ON public.trip_items(trip_id, day_number)
  WHERE day_number IS NOT NULL;
