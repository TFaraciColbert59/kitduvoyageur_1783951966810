-- Rollback 20260920105000 — retire le rebuild et la compensation canonique.
DROP FUNCTION IF EXISTS public.reverse_progression_fraud_canonical(uuid,text);
DROP FUNCTION IF EXISTS public.rebuild_progression_from_ledger(uuid);
