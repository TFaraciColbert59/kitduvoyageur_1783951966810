-- Rollback 20260920104000 — retire le consommateur et les projections par saison.
DROP FUNCTION IF EXISTS public.process_progression_outbox(integer);
DROP TABLE IF EXISTS public.user_season_progress;
ALTER TABLE public.progression_events
  DROP COLUMN IF EXISTS skill_allocations,
  DROP COLUMN IF EXISTS rules_version,
  DROP COLUMN IF EXISTS effective_at,
  DROP COLUMN IF EXISTS reward_transaction_id;
ALTER TABLE public.user_progression DROP COLUMN IF EXISTS current_season_id;
