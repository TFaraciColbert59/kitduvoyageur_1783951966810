-- Rollback 20260920102000 — retire règles, décisions et niveau canonique.
DROP FUNCTION IF EXISTS public.progression_level_for(integer);
DROP TABLE IF EXISTS public.progression_decisions;
DROP TABLE IF EXISTS public.progression_rules;
