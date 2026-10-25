-- Rollback 20260921200000 — retire les index et la purge de rétention.
DROP FUNCTION IF EXISTS public.purge_progression_logs(integer, integer);
DROP INDEX IF EXISTS public.territory_change_log_created_idx;
DROP INDEX IF EXISTS public.leaderboard_access_log_created_idx;
DROP INDEX IF EXISTS public.progression_outbox_user_idx;
DROP INDEX IF EXISTS public.progression_decisions_user_action_effective_idx;
DROP INDEX IF EXISTS public.progression_events_user_effective_idx;
