-- Rollback 20260920109000 — retire agrégats, file, journaux et RPC de classement.
DROP TRIGGER IF EXISTS on_user_season_progress_leaderboard_refresh ON public.user_season_progress;
DROP FUNCTION IF EXISTS public.get_leaderboard(uuid, text, integer, integer, uuid);
DROP FUNCTION IF EXISTS public.refresh_leaderboard_batch(integer);
DROP FUNCTION IF EXISTS public.refresh_leaderboard_for_user(uuid, text);
DROP FUNCTION IF EXISTS public.enqueue_leaderboard_refresh();
DROP TABLE IF EXISTS public.leaderboard_access_log;
DROP TABLE IF EXISTS public.territory_change_log;
DROP TABLE IF EXISTS public.leaderboard_refresh_queue;
DROP TABLE IF EXISTS public.progression_leaderboard_agg;
DELETE FROM public.feature_flags WHERE id = 'local_leaderboard_active';
