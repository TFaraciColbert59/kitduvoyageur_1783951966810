-- ==============================================================================
-- A11 — Observabilité des moteurs (audit #34)
--
-- `adventure_engine_runs` journalisait déjà id/version/statut/durée/warnings,
-- mais `started_at` et `finished_at` étaient alimentés avec le même `now`, et
-- aucun identifiant de corrélation ni version de pipeline n'existait.
--
-- Ajouts (additifs, idempotents) :
--   - correlation_id : identifiant commun à TOUS les runs d'une génération ;
--   - pipeline_version : version globale du pipeline (ex. `a11-v1`) ;
--   - external_calls : durées/statuts des appels externes (jsonb, [] par défaut) ;
--   - fallback_count : nombre de replis explicites constatés par run.
--
-- La RPC `create_adventure_plan_bundle` est remplacée pour propager ces champs
-- depuis les lignes JSON des runs (aucun autre changement de comportement).
-- Aucune donnée santé. Additive et idempotente.
-- ==============================================================================

ALTER TABLE public.adventure_engine_runs
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS pipeline_version text,
  ADD COLUMN IF NOT EXISTS external_calls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fallback_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'adventure_engine_runs_fallback_count_check'
  ) THEN
    ALTER TABLE public.adventure_engine_runs
      ADD CONSTRAINT adventure_engine_runs_fallback_count_check
      CHECK (fallback_count >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.adventure_engine_runs.correlation_id IS
  'A11 — identifiant de corrélation commun à tous les runs d''une génération.';
COMMENT ON COLUMN public.adventure_engine_runs.pipeline_version IS
  'A11 — version globale du pipeline d''orchestration (ex. a11-v1).';
COMMENT ON COLUMN public.adventure_engine_runs.external_calls IS
  'A11 — appels externes du run : [{ name, status, durationMs }] (jamais de secret).';
COMMENT ON COLUMN public.adventure_engine_runs.fallback_count IS
  'A11 — nombre de replis explicites journalisés par le run (cold_profile, source absente…).';

CREATE INDEX IF NOT EXISTS idx_adventure_engine_runs_correlation
  ON public.adventure_engine_runs(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- ── RPC bundle : propage les nouveaux champs d'observabilité ─────────────────
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
    error, started_at, finished_at,
    correlation_id, pipeline_version, external_calls, fallback_count
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
    (NULLIF(r->>'finished_at', ''))::timestamptz,
    NULLIF(r->>'correlation_id', ''),
    NULLIF(r->>'pipeline_version', ''),
    COALESCE(r->'external_calls', '[]'::jsonb),
    COALESCE((r->>'fallback_count')::integer, 0)
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
  'A10/A11 — insertion atomique d''un AdventurePlan, de sa version initiale, '
  'de ses runs de moteurs (observabilité corrélée) et de ses décisions. '
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
