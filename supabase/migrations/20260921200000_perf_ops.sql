-- ============================================================================
-- P4 — Performance et exploitation du moteur de progression.
-- Additif, aucun changement fonctionnel : index des requêtes chaudes + rétention.
--
-- Vérifications préalables sur base locale `lkdv-test-db` (pg_indexes, 20/09/2026) :
--   • progression_events     : (user_id, created_at DESC) existe ;
--                              (user_id, effective_at DESC) manquant.
--   • progression_decisions  : aucun index hors PK (idempotency_key) → les
--                              plafonds glissants balaient toute la table.
--   • progression_outbox     : index partiels (status, available_at) et
--                              (processed_at) existants ; aucun index user_id.
--   • leaderboard_refresh_queue : (status, created_at) existe et sert déjà le
--                              lot du cron comme la sonde pending → l'index
--                              partiel demandé serait redondant, non créé
--                              (preuve EXPLAIN dans docs/progression/PERFORMANCE.md).
--   • leaderboard_access_log : (user_id, created_at DESC) existe ;
--                              (created_at) manquant pour la purge.
--   • territory_change_log   : (user_id, created_at DESC) existe à l'identique ;
--                              (created_at) ajouté pour la purge de rétention.
-- ============================================================================

-- 1) Journal de progression : lectures par utilisateur ordonnées par date d'effet
--    métier (`effective_at`), indépendantes de la date d'insertion (`created_at`).
CREATE INDEX IF NOT EXISTS progression_events_user_effective_idx
  ON public.progression_events (user_id, effective_at DESC);

-- 2) Décisions : plafonds glissants quotidiens/hebdomadaires/saison
--    (`award_progression_gain` : user_id = … AND action_type = … AND effective_at > …).
CREATE INDEX IF NOT EXISTS progression_decisions_user_action_effective_idx
  ON public.progression_decisions (user_id, action_type, effective_at DESC);

-- 3) Outbox : diagnostic/rejeu ciblé par utilisateur (la table est bornée par la
--    purge outbox à 90 jours). Le lot du cron garde son index partiel.
CREATE INDEX IF NOT EXISTS progression_outbox_user_idx
  ON public.progression_outbox (user_id);

-- 4) Rétention : suppression par fenêtre glissante sur la date de création.
CREATE INDEX IF NOT EXISTS leaderboard_access_log_created_idx
  ON public.leaderboard_access_log (created_at);

CREATE INDEX IF NOT EXISTS territory_change_log_created_idx
  ON public.territory_change_log (created_at);

-- 5) Purge de rétention des journaux. Paramètres bornés [1, 3650] jours.
--    Réservée au service_role : jamais exposée aux clients.
CREATE OR REPLACE FUNCTION public.purge_progression_logs(
  p_access_days INTEGER DEFAULT 30,
  p_territory_days INTEGER DEFAULT 180
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_access_days INTEGER := GREATEST(1, LEAST(COALESCE(p_access_days, 30), 3650));
  v_territory_days INTEGER := GREATEST(1, LEAST(COALESCE(p_territory_days, 180), 3650));
  v_access_deleted INTEGER := 0;
  v_territory_deleted INTEGER := 0;
BEGIN
  DELETE FROM public.leaderboard_access_log
  WHERE created_at < now() - (v_access_days || ' days')::interval;
  GET DIAGNOSTICS v_access_deleted = ROW_COUNT;

  DELETE FROM public.territory_change_log
  WHERE created_at < now() - (v_territory_days || ' days')::interval;
  GET DIAGNOSTICS v_territory_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'leaderboard_access_log', v_access_deleted,
    'territory_change_log', v_territory_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_progression_logs(integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_progression_logs(integer, integer)
  TO service_role;

COMMENT ON FUNCTION public.purge_progression_logs(integer, integer) IS
  'P4 — purge de rétention des journaux (leaderboard_access_log, territory_change_log). '
  'Fenêtres bornées 1..3650 jours, service_role uniquement.';
