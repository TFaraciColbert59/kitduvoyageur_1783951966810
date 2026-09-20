-- Rollback 20260921120000 — retire la clôture de saison.
-- Les statuts de saison déjà passés à `completed` ne sont jamais rouverts.
DROP FUNCTION IF EXISTS public.close_progression_season(text);
