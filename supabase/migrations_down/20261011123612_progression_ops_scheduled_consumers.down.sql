-- ============================================================================
-- T04 (réconcilié) — Retour arrière des jobs journalisés.
--
-- Désactive les jobs `lkdv-progression-*-v1` et restaure les jobs simples de
-- 20261011121250 (lot borné direct). Conserve : schéma progression_ops,
-- journal job_runs, rôle lkdv_progression_job et la réparation du retry
-- leaderboard (aucune donnée de progression, aucun journal, aucun droit
-- n'est supprimé ni dévalué). Le job de purge quotidien reste actif.
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lkdv-progression-outbox-v1') THEN
    PERFORM cron.unschedule('lkdv-progression-outbox-v1');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lkdv-progression-leaderboard-v1') THEN
    PERFORM cron.unschedule('lkdv-progression-leaderboard-v1');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'progression-outbox-consume') THEN
    PERFORM cron.unschedule('progression-outbox-consume');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'progression-leaderboard-refresh') THEN
    PERFORM cron.unschedule('progression-leaderboard-refresh');
  END IF;

  PERFORM cron.schedule(
    'progression-outbox-consume', '*/5 * * * *',
    'SELECT public.process_progression_outbox(50)');
  PERFORM cron.schedule(
    'progression-leaderboard-refresh', '*/15 * * * *',
    'SELECT public.refresh_leaderboard_batch(100)');
END $$;
