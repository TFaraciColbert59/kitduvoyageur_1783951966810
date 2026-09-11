-- ==============================================================================
-- A10 (10.4) — RPC transactionnelles : sessions GPS et bundles de plans
--
-- Audit 31bdb279 items #5, #8, #9 : la persistance séquentielle (upsert
-- passages → insert observations → update session) pouvait dupliquer les
-- observations sur rejeu, rattacher une observation au mauvais passage
-- (aller-retour sur un même segment) et laisser un plan incomplet.
--
--   • Index unique partiel performance_observations(passage_id,
--     processor_version) WHERE passage_id IS NOT NULL : idempotence réelle.
--   • persist_processed_hike_session(...) : upsert passages (clé complète
--     session+segment+direction+entrée+version), rattachement des observations
--     PAR CLÉ COMPLÈTE (segmentId|direction|enteredAt), upsert observations,
--     statut session `processed` + qualité — le tout atomique.
--   • create_adventure_plan_bundle(...) : plan + version + runs + décisions
--     insérés dans une seule transaction.
--
-- Migration additive et idempotente. SECURITY DEFINER + search_path verrouillé,
-- REVOKE anon/authenticated, GRANT service_role.
-- ==============================================================================

-- ── 1. Idempotence des observations par passage + version de traitement ──────
-- Réparation préalable : d'éventuels doublons stricts sur la clé d'idempotence
-- (mêmes passage_id + processor_version) sont réduits à la ligne la plus
-- récente avant la création de l'index unique partiel.
DELETE FROM public.performance_observations a
USING public.performance_observations b
WHERE a.passage_id IS NOT NULL
  AND a.passage_id = b.passage_id
  AND a.processor_version = b.processor_version
  AND a.id <> b.id
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_performance_observations_passage_version
  ON public.performance_observations(passage_id, processor_version)
  WHERE passage_id IS NOT NULL;

COMMENT ON INDEX public.idx_performance_observations_passage_version IS
  'A10 — une observation au plus par passage et par version de traitement : '
  'rejeu idempotent du pipeline GPS (audit #5).';

-- ── 2. Persistance transactionnelle d'une session traitée ────────────────────
CREATE OR REPLACE FUNCTION public.persist_processed_hike_session(
  p_session_id uuid,
  p_passages jsonb,
  p_observations jsonb,
  p_processor_version text,
  p_track_quality jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_passages integer := 0;
  v_observations integer := 0;
  v_expected_observations integer := 0;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'persist_processed_hike_session: session obligatoire';
  END IF;
  IF p_processor_version IS NULL OR length(p_processor_version) = 0 THEN
    RAISE EXCEPTION 'persist_processed_hike_session: processor_version obligatoire';
  END IF;

  -- 1. Upsert des passages : clé complète (session, segment, direction, entrée, version).
  WITH input AS (
    SELECT *
    FROM jsonb_to_recordset(COALESCE(p_passages, '[]'::jsonb)) AS x(
      session_id uuid,
      user_id uuid,
      segment_id bigint,
      direction text,
      entered_at timestamptz,
      exited_at timestamptz,
      duration_s integer,
      moving_s integer,
      stopped_s integer,
      distance_m numeric,
      gain_m numeric,
      loss_m numeric,
      pace_min_per_km numeric,
      gps_quality numeric,
      map_match_quality numeric,
      uturn_detected boolean,
      off_route boolean,
      eligible_for_collective boolean
    )
  )
  INSERT INTO public.session_segment_passages (
    session_id, user_id, segment_id, direction, entered_at, exited_at,
    duration_s, moving_s, stopped_s, distance_m, gain_m, loss_m,
    pace_min_per_km, gps_quality, map_match_quality, uturn_detected,
    off_route, eligible_for_collective, processor_version
  )
  SELECT
    i.session_id, i.user_id, i.segment_id, i.direction, i.entered_at, i.exited_at,
    i.duration_s, i.moving_s, i.stopped_s, i.distance_m, i.gain_m, i.loss_m,
    i.pace_min_per_km, i.gps_quality, i.map_match_quality,
    COALESCE(i.uturn_detected, false), COALESCE(i.off_route, false),
    COALESCE(i.eligible_for_collective, false), p_processor_version
  FROM input i
  WHERE i.session_id = p_session_id
  ON CONFLICT (session_id, segment_id, direction, entered_at, processor_version)
  DO UPDATE SET
    exited_at = EXCLUDED.exited_at,
    duration_s = EXCLUDED.duration_s,
    moving_s = EXCLUDED.moving_s,
    stopped_s = EXCLUDED.stopped_s,
    distance_m = EXCLUDED.distance_m,
    gain_m = EXCLUDED.gain_m,
    loss_m = EXCLUDED.loss_m,
    pace_min_per_km = EXCLUDED.pace_min_per_km,
    gps_quality = EXCLUDED.gps_quality,
    map_match_quality = EXCLUDED.map_match_quality,
    uturn_detected = EXCLUDED.uturn_detected,
    off_route = EXCLUDED.off_route,
    eligible_for_collective = EXCLUDED.eligible_for_collective;
  GET DIAGNOSTICS v_passages = ROW_COUNT;

  -- 2. Observations rattachées par clé complète `segmentId|direction|enteredAt`.
  --    `passage_key` remplace toute file par segment_id (audit #8).
  WITH input AS (
    SELECT *
    FROM jsonb_to_recordset(COALESCE(p_observations, '[]'::jsonb)) AS o(
      user_id uuid,
      session_id uuid,
      passage_key text,
      observed_at timestamptz,
      distance_m numeric,
      duration_s integer,
      moving_s integer,
      gain_m numeric,
      loss_m numeric,
      mean_grade_pct numeric,
      max_grade_pct numeric,
      altitude_mean_m numeric,
      surface text,
      pack_weight_kg numeric,
      temperature_c numeric,
      weather text,
      declared_fatigue smallint,
      perceived_difficulty smallint,
      pace_min_per_km numeric,
      quality numeric
    )
  )
  INSERT INTO public.performance_observations (
    user_id, session_id, passage_id, observed_at, distance_m, duration_s,
    moving_s, gain_m, loss_m, mean_grade_pct, max_grade_pct, altitude_mean_m,
    surface, pack_weight_kg, temperature_c, weather, declared_fatigue,
    perceived_difficulty, pace_min_per_km, quality, processor_version
  )
  SELECT
    i.user_id,
    i.session_id,
    p.id,
    i.observed_at,
    i.distance_m,
    GREATEST(i.duration_s, 1),
    i.moving_s,
    i.gain_m,
    i.loss_m,
    i.mean_grade_pct,
    i.max_grade_pct,
    i.altitude_mean_m,
    i.surface,
    i.pack_weight_kg,
    i.temperature_c,
    i.weather,
    i.declared_fatigue,
    i.perceived_difficulty,
    i.pace_min_per_km,
    i.quality,
    p_processor_version
  FROM input i
  JOIN public.session_segment_passages p
    ON p.session_id = i.session_id
   AND p.segment_id = split_part(i.passage_key, '|', 1)::bigint
   AND p.direction = split_part(i.passage_key, '|', 2)
   AND p.entered_at = split_part(i.passage_key, '|', 3)::timestamptz
   AND p.processor_version = p_processor_version
  WHERE i.session_id = p_session_id
  ON CONFLICT (passage_id, processor_version) WHERE passage_id IS NOT NULL
  DO UPDATE SET
    observed_at = EXCLUDED.observed_at,
    distance_m = EXCLUDED.distance_m,
    duration_s = EXCLUDED.duration_s,
    moving_s = EXCLUDED.moving_s,
    gain_m = EXCLUDED.gain_m,
    loss_m = EXCLUDED.loss_m,
    mean_grade_pct = EXCLUDED.mean_grade_pct,
    max_grade_pct = EXCLUDED.max_grade_pct,
    altitude_mean_m = EXCLUDED.altitude_mean_m,
    surface = EXCLUDED.surface,
    pack_weight_kg = EXCLUDED.pack_weight_kg,
    temperature_c = EXCLUDED.temperature_c,
    weather = EXCLUDED.weather,
    declared_fatigue = EXCLUDED.declared_fatigue,
    perceived_difficulty = EXCLUDED.perceived_difficulty,
    pace_min_per_km = EXCLUDED.pace_min_per_km,
    quality = EXCLUDED.quality;
  GET DIAGNOSTICS v_observations = ROW_COUNT;

  -- Garde-fou : toute observation non rattachée annule la transaction entière.
  v_expected_observations := jsonb_array_length(COALESCE(p_observations, '[]'::jsonb));
  IF v_observations <> v_expected_observations THEN
    RAISE EXCEPTION
      'persist_processed_hike_session: % observation(s) attendue(s), % rattachée(s)',
      v_expected_observations, v_observations;
  END IF;

  -- 3. Session traitée + qualité, dans la même transaction.
  UPDATE public.hike_sessions
  SET processing_status = 'processed',
      processor_version = p_processor_version,
      processed_at = now(),
      track_quality = p_track_quality,
      updated_at = now()
  WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'persist_processed_hike_session: session % introuvable', p_session_id;
  END IF;

  RETURN jsonb_build_object(
    'passages', v_passages,
    'observations', v_observations
  );
END;
$fn$;

COMMENT ON FUNCTION public.persist_processed_hike_session(uuid, jsonb, jsonb, text, jsonb) IS
  'A10 — persistance atomique du traitement GPS : upsert des passages (clé '
  'complète session+segment+direction+entrée+version), rattachement des '
  'observations par clé complète segmentId|direction|enteredAt, upsert des '
  'observations (passage_id, processor_version) et statut session processed. '
  'SECURITY DEFINER, service_role uniquement.';

REVOKE ALL ON FUNCTION public.persist_processed_hike_session(uuid, jsonb, jsonb, text, jsonb) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.persist_processed_hike_session(uuid, jsonb, jsonb, text, jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.persist_processed_hike_session(uuid, jsonb, jsonb, text, jsonb) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.persist_processed_hike_session(uuid, jsonb, jsonb, text, jsonb)
  TO service_role;

-- ── 3. Bundle transactionnel plan + version + runs + décisions ───────────────
CREATE OR REPLACE FUNCTION public.create_adventure_plan_bundle(
  p_plan jsonb,
  p_version jsonb,
  p_runs jsonb DEFAULT '[]'::jsonb,
  p_decisions jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_plan_id uuid;
BEGIN
  IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' THEN
    RAISE EXCEPTION 'create_adventure_plan_bundle: plan jsonb objet obligatoire';
  END IF;
  IF p_version IS NULL OR jsonb_typeof(p_version) <> 'object' THEN
    RAISE EXCEPTION 'create_adventure_plan_bundle: version jsonb objet obligatoire';
  END IF;

  v_plan_id := COALESCE((NULLIF(p_plan->>'id', ''))::uuid, gen_random_uuid());

  INSERT INTO public.adventure_plans (
    id, owner_id, trip_id, title, intent, status, current_version,
    confidence, monitoring_rules, created_at, updated_at
  )
  VALUES (
    v_plan_id,
    (p_plan->>'owner_id')::uuid,
    (NULLIF(p_plan->>'trip_id', ''))::uuid,
    p_plan->>'title',
    COALESCE(p_plan->'intent', '{}'::jsonb),
    COALESCE(p_plan->>'status', 'draft'),
    COALESCE((p_plan->>'current_version')::integer, 0),
    COALESCE(p_plan->'confidence', '{}'::jsonb),
    COALESCE(p_plan->'monitoring_rules', '[]'::jsonb),
    COALESCE((p_plan->>'created_at')::timestamptz, now()),
    COALESCE((p_plan->>'updated_at')::timestamptz, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    intent = EXCLUDED.intent,
    status = EXCLUDED.status,
    current_version = EXCLUDED.current_version,
    confidence = EXCLUDED.confidence,
    monitoring_rules = EXCLUDED.monitoring_rules,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.adventure_plan_versions (
    plan_id, version, snapshot, reason, generated_by, confidence, created_at
  )
  VALUES (
    v_plan_id,
    COALESCE((p_version->>'version')::integer, 1),
    COALESCE(p_version->'snapshot', '{}'::jsonb),
    COALESCE(p_version->>'reason', 'Génération initiale'),
    COALESCE(p_version->>'generated_by', 'a6-orchestrator'),
    COALESCE(p_version->'confidence', '{}'::jsonb),
    COALESCE((p_version->>'created_at')::timestamptz, now())
  )
  ON CONFLICT (plan_id, version) DO NOTHING;

  INSERT INTO public.adventure_engine_runs (
    plan_id, engine_id, engine_version, status, duration_ms, warnings,
    error, started_at, finished_at
  )
  SELECT
    v_plan_id,
    r->>'engine_id',
    r->>'engine_version',
    r->>'status',
    (r->>'duration_ms')::integer,
    COALESCE(r->'warnings', '[]'::jsonb),
    r->>'error',
    COALESCE((r->>'started_at')::timestamptz, now()),
    (NULLIF(r->>'finished_at', ''))::timestamptz
  FROM jsonb_array_elements(COALESCE(p_runs, '[]'::jsonb)) AS r;

  INSERT INTO public.adventure_plan_decisions (
    plan_id, decision_type, proposal, impact, requires_confirmation,
    status, created_at
  )
  SELECT
    v_plan_id,
    d->>'decision_type',
    d->>'proposal',
    COALESCE(d->'impact', '[]'::jsonb),
    COALESCE((d->>'requires_confirmation')::boolean, true),
    COALESCE(d->>'status', 'proposed'),
    COALESCE((d->>'created_at')::timestamptz, now())
  FROM jsonb_array_elements(COALESCE(p_decisions, '[]'::jsonb)) AS d;

  RETURN v_plan_id;
END;
$fn$;

COMMENT ON FUNCTION public.create_adventure_plan_bundle(jsonb, jsonb, jsonb, jsonb) IS
  'A10 — insertion atomique d''un AdventurePlan, de sa version initiale, de '
  'ses runs de moteurs et de ses décisions. Retourne le plan_id. '
  'SECURITY DEFINER, service_role uniquement.';

REVOKE ALL ON FUNCTION public.create_adventure_plan_bundle(jsonb, jsonb, jsonb, jsonb) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.create_adventure_plan_bundle(jsonb, jsonb, jsonb, jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.create_adventure_plan_bundle(jsonb, jsonb, jsonb, jsonb) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.create_adventure_plan_bundle(jsonb, jsonb, jsonb, jsonb)
  TO service_role;
