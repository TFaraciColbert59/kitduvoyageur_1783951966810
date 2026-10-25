-- Rollback 20260921150000 — retire le remplacement réel de défi.
-- Le consommateur conserve sa dérivation additive de `challenge_progress`
-- (projection sans risque de perte) : un rollback ne détruit pas l'existant.
DROP FUNCTION IF EXISTS public.replace_progression_challenge(uuid);
