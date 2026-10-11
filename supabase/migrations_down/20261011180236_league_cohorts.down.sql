-- T36 — Retour arrière : retire la fonction et la table des cohortes.
DROP FUNCTION IF EXISTS public.create_league_cohorts(text, integer);
DROP TABLE IF EXISTS public.progression_league_cohorts;

