-- ============================================================================
-- T04 — Retour arrière : retire les jobs de progression.
-- Ne touche à aucune donnée de progression (journaux, droits, projections).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'progression-outbox-consume') THEN
    PERFORM cron.unschedule('progression-outbox-consume');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'progression-outbox-purge') THEN
    PERFORM cron.unschedule('progression-outbox-purge');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'progression-leaderboard-refresh') THEN
    PERFORM cron.unschedule('progression-leaderboard-refresh');
  END IF;
END
$$;
