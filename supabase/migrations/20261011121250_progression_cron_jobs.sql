-- ============================================================================
-- T04 — Planification observée des traitements de progression (pg_cron).
--
-- Constat prod du 2026-10-11 : pg_cron 1.6.4 installé, mais AUCUN job
-- progression/classement (seuls purge-essais-anonymes et ops-daily-report).
-- pg_net n'est pas installé : la planification ne peut pas appeler HTTP, elle
-- exécute donc directement les fonctions SQL `SECURITY DEFINER`.
--
-- Écart documenté (contrainte plateforme) : `cron.schedule_in_database` refuse
-- un username différent sans superuser ; les migrations distantes tournent sous
-- `postgres` (non superuser). Les jobs s'exécutent donc sous le rôle qui les
-- crée, et le confinement des privilèges passe par les fonctions SECURITY
-- DEFINER (exécutables par la planification et service_role uniquement, toutes
-- révoquées pour PUBLIC/anon/authenticated).
--
-- Lots bornés : outbox 50/run (~5 min), leaderboard 100/run (~15 min),
-- purge outbox 90 jours une fois par jour. Retard > 15 min ou lignes `dead`
-- = état dégradé (voir scripts/ops/progression_outbox_health.mjs).
-- ============================================================================

-- Planification idempotente (rejouable : remplace le job du même nom).
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

  PERFORM cron.schedule(
    'progression-outbox-consume', '*/5 * * * *',
    'SELECT public.process_progression_outbox(50)');

  PERFORM cron.schedule(
    'progression-outbox-purge', '13 4 * * *',
    'SELECT public.purge_progression_outbox(90)');

  PERFORM cron.schedule(
    'progression-leaderboard-refresh', '*/15 * * * *',
    'SELECT public.refresh_leaderboard_batch(100)');
END
$$;
