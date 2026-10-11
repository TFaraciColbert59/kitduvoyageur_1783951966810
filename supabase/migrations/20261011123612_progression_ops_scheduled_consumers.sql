-- ============================================================================
-- T04 (réconcilié) — Consumers de progression planifiés, journalisés et
-- bornés. Aucun nouveau barème, aucun gain économique nouveau.
--
-- Contexte : la migration 20261011121250 a planifié deux jobs simples
-- (`progression-outbox-consume`, `progression-leaderboard-refresh`) déjà
-- observés en production. Cette migration additive :
--   1. répare le retry du consumer leaderboard (l'EXCEPTION annulait
--      `attempts`, permettant une boucle infinie) avec backoff/plafond/dead ;
--   2. ajoute un schéma interne `progression_ops` + journal `job_runs` ;
--   3. exécute les consumers via un wrapper `progression_ops.run_job` possédé
--      par un rôle de job NOLOGIN/NOINHERIT/NOBYPASSRLS ;
--   4. remplace les deux jobs simples par les jobs journalisés (les noms
--      historiques sont désactivés, le job de purge quotidien est conservé).
--
-- Contrainte plateforme documentée : les jobs pg_cron s'exécutent sous le rôle
-- `postgres` qui les crée (`cron.schedule_in_database` refuse un username
-- différent sans superuser) ; le confinement passe par SECURITY DEFINER,
-- l'absence de grants anon/authenticated et le schéma non exposé.
-- ============================================================================
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron requis : aucune planification simulée';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lkdv_progression_job') THEN
    CREATE ROLE lkdv_progression_job NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
GRANT lkdv_progression_job TO postgres;

CREATE SCHEMA IF NOT EXISTS progression_ops;
REVOKE ALL ON SCHEMA progression_ops FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA progression_ops TO lkdv_progression_job, service_role;
GRANT USAGE ON SCHEMA public TO lkdv_progression_job;

-- 1. Réparation du retry legacy avant son activation planifiée. L'EXCEPTION
-- annule la sous-transaction : incrémenter attempts par id dans le handler.
ALTER TABLE public.leaderboard_refresh_queue
  ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.leaderboard_refresh_queue DROP CONSTRAINT IF EXISTS leaderboard_refresh_queue_status_check;
ALTER TABLE public.leaderboard_refresh_queue ADD CONSTRAINT leaderboard_refresh_queue_status_check
  CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'dead'));

CREATE OR REPLACE FUNCTION public.refresh_leaderboard_batch(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_row record; v_processed integer := 0; v_failed integer := 0;
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 1000));
BEGIN
  FOR v_row IN
    SELECT id, user_id, season_id, attempts FROM public.leaderboard_refresh_queue
    WHERE status IN ('pending', 'failed') AND available_at <= now() AND attempts < 5
    ORDER BY created_at ASC LIMIT v_limit FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      UPDATE public.leaderboard_refresh_queue SET status='processing', attempts=v_row.attempts+1 WHERE id=v_row.id;
      PERFORM public.refresh_leaderboard_for_user(v_row.user_id, v_row.season_id);
      UPDATE public.leaderboard_refresh_queue SET status='processed', processed_at=now(), last_error=NULL
      WHERE id=v_row.id AND status='processing';
      v_processed := v_processed+1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.leaderboard_refresh_queue
      SET status=CASE WHEN v_row.attempts+1 >= 5 THEN 'dead' ELSE 'failed' END,
          attempts=v_row.attempts+1, last_error=SQLERRM, processed_at=now(),
          available_at=now() + interval '1 minute' * power(2, least(v_row.attempts+1, 6))
      WHERE id=v_row.id;
      v_failed := v_failed+1;
    END;
  END LOOP;
  RETURN jsonb_build_object('processed',v_processed,'failed',v_failed);
END $$;
REVOKE ALL ON FUNCTION public.refresh_leaderboard_batch(integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_leaderboard_refresh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  INSERT INTO public.leaderboard_refresh_queue(user_id,season_id)
  VALUES(NEW.user_id,NEW.season_id)
  ON CONFLICT(user_id,season_id) DO UPDATE
    SET status='pending', attempts=0, created_at=now(), processed_at=NULL,
        available_at=now(), last_error=NULL
  WHERE public.leaderboard_refresh_queue.status <> 'pending';
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_leaderboard_refresh() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.process_progression_outbox(integer), public.refresh_leaderboard_batch(integer) TO lkdv_progression_job;

-- 2. Journal des exécutions (schéma interne, RLS + grants minimaux).
CREATE TABLE IF NOT EXISTS progression_ops.job_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job text NOT NULL CHECK (job IN ('outbox', 'leaderboard')),
  version text NOT NULL DEFAULT 'v1',
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'degraded', 'failed')),
  result jsonb,
  error text
);
ALTER TABLE progression_ops.job_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON progression_ops.job_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON progression_ops.job_runs TO lkdv_progression_job;
GRANT SELECT ON progression_ops.job_runs TO service_role;
GRANT USAGE ON SEQUENCE progression_ops.job_runs_id_seq TO lkdv_progression_job;
DROP POLICY IF EXISTS job_role_only ON progression_ops.job_runs;
CREATE POLICY job_role_only ON progression_ops.job_runs TO lkdv_progression_job USING (true) WITH CHECK (true);

-- 3. Wrapper borné et journalisé, possédé par le rôle de job.
CREATE OR REPLACE FUNCTION progression_ops.run_job(p_job text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, progression_ops AS $$
DECLARE v_run bigint; v_result jsonb;
BEGIN
  IF p_job NOT IN ('outbox', 'leaderboard') OR p_job IS NULL THEN
    RAISE EXCEPTION 'job non autorisé';
  END IF;
  INSERT INTO progression_ops.job_runs(job, status) VALUES(p_job, 'running') RETURNING id INTO v_run;
  BEGIN
    IF p_job = 'outbox' THEN
      v_result := public.process_progression_outbox(50);
    ELSE
      v_result := public.refresh_leaderboard_batch(100);
    END IF;
    UPDATE progression_ops.job_runs SET finished_at = clock_timestamp(), result = v_result,
      status = CASE WHEN COALESCE((v_result->>'failed')::int, 0) > 0 THEN 'degraded' ELSE 'succeeded' END WHERE id = v_run;
  EXCEPTION WHEN OTHERS THEN
    UPDATE progression_ops.job_runs SET finished_at = clock_timestamp(), status = 'failed', error = SQLERRM WHERE id = v_run;
    v_result := jsonb_build_object('failed', 1, 'job_error', true);
  END;
  RETURN v_result;
END $$;
-- Transfert de propriété puis retrait du CREATE.
GRANT CREATE ON SCHEMA progression_ops TO lkdv_progression_job;
ALTER FUNCTION progression_ops.run_job(text) OWNER TO lkdv_progression_job;
REVOKE CREATE ON SCHEMA progression_ops FROM lkdv_progression_job;
REVOKE ALL ON FUNCTION progression_ops.run_job(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION progression_ops.run_job(text) TO service_role, postgres;

-- 4. Bascule des jobs : désactive les jobs simples de 20261011121250,
-- conserve le job de purge, active les jobs journalisés.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'progression-outbox-consume') THEN
    PERFORM cron.unschedule('progression-outbox-consume');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'progression-leaderboard-refresh') THEN
    PERFORM cron.unschedule('progression-leaderboard-refresh');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lkdv-progression-outbox-v1') THEN
    PERFORM cron.unschedule('lkdv-progression-outbox-v1');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lkdv-progression-leaderboard-v1') THEN
    PERFORM cron.unschedule('lkdv-progression-leaderboard-v1');
  END IF;
END $$;

SELECT cron.schedule('lkdv-progression-outbox-v1', '*/5 * * * *',
  $$SET statement_timeout = '50s'; SELECT progression_ops.run_job('outbox');$$);
SELECT cron.schedule('lkdv-progression-leaderboard-v1', '*/15 * * * *',
  $$SET statement_timeout = '50s'; SELECT progression_ops.run_job('leaderboard');$$);

COMMIT;
