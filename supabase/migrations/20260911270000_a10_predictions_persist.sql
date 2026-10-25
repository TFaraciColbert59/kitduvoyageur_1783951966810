-- ==============================================================================
-- A10 (10.9) — Profil réel injecté et prédictions persistées
--
-- Audit 31bdb279 item #13 : l'ETA n'était pas réellement personnalisée (aucun
-- profil chargé, aucune prédiction persistée).
--
--   • persist_adventure_predictions(p_plan_id, p_user_id, p_segments, p_route)
--     upsert idempotent des `segment_predictions` (clé user+segment+contexte+
--     version, context_hash = 'uniform_from_blueprint' tant que le routage
--     réel n'est pas branché — note a11) et des `route_predictions` (clé
--     user+plan+stratégie+version) ;
--   • unicité des route_predictions par (user, plan, stratégie, version) ;
--   • SECURITY DEFINER + search_path verrouillé, service_role uniquement.
--
-- Migration additive et idempotente. Aucune donnée inventée : les pseudo-
-- segments uniformes du blueprint sans géométrie réelle sont ignorés (JOIN
-- sur trail_segments) en attendant le routage map-matché (a11).
-- ==============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_route_predictions_unique
  ON public.route_predictions(user_id, plan_id, strategy, model_version)
  WHERE plan_id IS NOT NULL;

COMMENT ON INDEX public.idx_route_predictions_unique IS
  'A10 — idempotence des prédictions de route par (user, plan, stratégie, modèle).';

CREATE OR REPLACE FUNCTION public.persist_adventure_predictions(
  p_plan_id uuid,
  p_user_id uuid,
  p_segments jsonb DEFAULT '[]'::jsonb,
  p_route jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_segments integer := 0;
  v_route integer := 0;
BEGIN
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'persist_adventure_predictions: plan_id obligatoire';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'persist_adventure_predictions: user_id obligatoire';
  END IF;

  -- 1. Prédictions de segment : upsert par (user, segment, contexte, modèle).
  --    Seuls les segments réellement présents dans trail_segments sont
  --    persistés (aucune géométrie inventée pour les pseudo-segments).
  INSERT INTO public.segment_predictions (
    user_id, segment_id, context_hash, predicted_duration_p50,
    predicted_duration_p90, predicted_effort, personal_difficulty,
    recommended_pause_s, confidence, model_version, computed_at, valid_until
  )
  SELECT
    p_user_id,
    i.segment_id,
    COALESCE(NULLIF(i.context_hash, ''), 'uniform_from_blueprint'),
    GREATEST(i.predicted_duration_p50, 1),
    GREATEST(i.predicted_duration_p90, GREATEST(i.predicted_duration_p50, 1)),
    i.predicted_effort,
    i.personal_difficulty,
    i.recommended_pause_s,
    COALESCE(i.confidence, '{}'::jsonb),
    COALESCE(NULLIF(i.model_version, ''), 'a10-v1'),
    COALESCE(i.computed_at, now()),
    i.valid_until
  FROM jsonb_to_recordset(COALESCE(p_segments, '[]'::jsonb)) AS i(
    segment_id bigint,
    context_hash text,
    predicted_duration_p50 integer,
    predicted_duration_p90 integer,
    predicted_effort numeric,
    personal_difficulty numeric,
    recommended_pause_s integer,
    confidence jsonb,
    model_version text,
    computed_at timestamptz,
    valid_until timestamptz
  )
  JOIN public.trail_segments t ON t.id = i.segment_id
  ON CONFLICT (user_id, segment_id, context_hash, model_version)
  DO UPDATE SET
    predicted_duration_p50 = EXCLUDED.predicted_duration_p50,
    predicted_duration_p90 = EXCLUDED.predicted_duration_p90,
    predicted_effort = EXCLUDED.predicted_effort,
    personal_difficulty = EXCLUDED.personal_difficulty,
    recommended_pause_s = EXCLUDED.recommended_pause_s,
    confidence = EXCLUDED.confidence,
    computed_at = EXCLUDED.computed_at,
    valid_until = EXCLUDED.valid_until;
  GET DIAGNOSTICS v_segments = ROW_COUNT;

  -- 2. Prédictions de route : upsert par (user, plan, stratégie, modèle).
  INSERT INTO public.route_predictions (
    user_id, plan_id, route_id, strategy, eta_p50, eta_p90,
    total_duration_p50_s, total_duration_p90_s, pace_p25_min_per_km,
    pace_p50_min_per_km, pace_p75_min_per_km, pauses_s, personal_difficulty,
    max_fatigue, turnaround_time, critical_segment_ids, warnings, confidence,
    model_version, computed_at
  )
  SELECT
    p_user_id,
    p_plan_id,
    i.route_id,
    i.strategy,
    i.eta_p50,
    i.eta_p90,
    GREATEST(i.total_duration_p50_s, 1),
    GREATEST(i.total_duration_p90_s, GREATEST(i.total_duration_p50_s, 1)),
    i.pace_p25_min_per_km,
    i.pace_p50_min_per_km,
    i.pace_p75_min_per_km,
    i.pauses_s,
    i.personal_difficulty,
    i.max_fatigue,
    i.turnaround_time,
    COALESCE(i.critical_segment_ids, '{}'::bigint[]),
    COALESCE(i.warnings, '[]'::jsonb),
    COALESCE(i.confidence, '{}'::jsonb),
    COALESCE(NULLIF(i.model_version, ''), 'a10-v1'),
    COALESCE(i.computed_at, now())
  FROM jsonb_to_recordset(COALESCE(p_route, '[]'::jsonb)) AS i(
    route_id bigint,
    strategy text,
    eta_p50 timestamptz,
    eta_p90 timestamptz,
    total_duration_p50_s integer,
    total_duration_p90_s integer,
    pace_p25_min_per_km numeric,
    pace_p50_min_per_km numeric,
    pace_p75_min_per_km numeric,
    pauses_s integer,
    personal_difficulty numeric,
    max_fatigue numeric,
    turnaround_time timestamptz,
    critical_segment_ids bigint[],
    warnings jsonb,
    confidence jsonb,
    model_version text,
    computed_at timestamptz
  )
  ON CONFLICT (user_id, plan_id, strategy, model_version) WHERE plan_id IS NOT NULL
  DO UPDATE SET
    eta_p50 = EXCLUDED.eta_p50,
    eta_p90 = EXCLUDED.eta_p90,
    total_duration_p50_s = EXCLUDED.total_duration_p50_s,
    total_duration_p90_s = EXCLUDED.total_duration_p90_s,
    pace_p25_min_per_km = EXCLUDED.pace_p25_min_per_km,
    pace_p50_min_per_km = EXCLUDED.pace_p50_min_per_km,
    pace_p75_min_per_km = EXCLUDED.pace_p75_min_per_km,
    pauses_s = EXCLUDED.pauses_s,
    personal_difficulty = EXCLUDED.personal_difficulty,
    max_fatigue = EXCLUDED.max_fatigue,
    turnaround_time = EXCLUDED.turnaround_time,
    critical_segment_ids = EXCLUDED.critical_segment_ids,
    warnings = EXCLUDED.warnings,
    confidence = EXCLUDED.confidence,
    computed_at = EXCLUDED.computed_at;
  GET DIAGNOSTICS v_route = ROW_COUNT;

  RETURN jsonb_build_object('segments', v_segments, 'route', v_route);
END;
$fn$;

COMMENT ON FUNCTION public.persist_adventure_predictions(uuid, uuid, jsonb, jsonb) IS
  'A10 — upsert idempotent des prédictions personnelles de segment et de route '
  '(model_version a10-v1, context_hash uniform_from_blueprint en attendant le '
  'routage réel a11). SECURITY DEFINER, service_role uniquement.';

REVOKE ALL ON FUNCTION public.persist_adventure_predictions(uuid, uuid, jsonb, jsonb) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.persist_adventure_predictions(uuid, uuid, jsonb, jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.persist_adventure_predictions(uuid, uuid, jsonb, jsonb) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.persist_adventure_predictions(uuid, uuid, jsonb, jsonb)
  TO service_role;
