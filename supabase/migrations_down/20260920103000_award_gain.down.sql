-- Rollback 20260920103000 — retire la fonction d'attribution canonique.
DROP FUNCTION IF EXISTS public.award_progression_gain(uuid,text,text,text,timestamptz,integer,jsonb,text,jsonb);
