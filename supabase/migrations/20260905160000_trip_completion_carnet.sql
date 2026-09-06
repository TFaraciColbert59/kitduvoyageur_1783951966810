-- ==============================================================================
-- CHANTIER 8 — BOUCLE DE FIN : VOYAGE VÉCU -> CARNET COMMUNAUTAIRE & REX
-- Migration: 20260905160000_trip_completion_carnet.sql
-- ==============================================================================

-- 1. Lien direct carnet -> trip
ALTER TABLE public.carnets
  ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_carnets_trip_id ON public.carnets(trip_id);

-- 2. Lien direct avis de lieu -> trip (preuve terrain certifiée suite au voyage)
ALTER TABLE public.place_reviews
  ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_place_reviews_trip_id ON public.place_reviews(trip_id);
