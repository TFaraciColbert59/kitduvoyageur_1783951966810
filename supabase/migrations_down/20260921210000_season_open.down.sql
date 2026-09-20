-- Rollback 20260921210000 — retire l'ouverture contrôlée des saisons.
DROP FUNCTION IF EXISTS public.open_progression_season(text, integer, text, timestamptz, timestamptz);
