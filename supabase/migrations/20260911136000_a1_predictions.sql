-- ==============================================================================
-- A1 — M7 : prédictions personnelles (segment et route)
-- RLS : propriétaire en lecture, service_role en écriture.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.segment_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  segment_id bigint NOT NULL REFERENCES public.trail_segments(id) ON DELETE CASCADE,
  context_hash text NOT NULL,
  predicted_duration_p50 integer NOT NULL CHECK (predicted_duration_p50 > 0),
  predicted_duration_p90 integer NOT NULL CHECK (predicted_duration_p90 > 0),
  predicted_effort numeric CHECK (predicted_effort IS NULL OR predicted_effort BETWEEN 0 AND 100),
  personal_difficulty numeric
    CHECK (personal_difficulty IS NULL OR personal_difficulty BETWEEN 0 AND 100),
  recommended_pause_s integer
    CHECK (recommended_pause_s IS NULL OR recommended_pause_s >= 0),
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_version text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  CONSTRAINT segment_predictions_p50_p90 CHECK (
    predicted_duration_p90 >= predicted_duration_p50
  ),
  CONSTRAINT segment_predictions_unique UNIQUE (
    user_id, segment_id, context_hash, model_version
  )
);

COMMENT ON TABLE public.segment_predictions IS
  'Prédiction personnelle par segment (P50/P90, effort, difficulté, pause). '
  'Écrite par les moteurs (Phase 3) via service_role.';

CREATE INDEX IF NOT EXISTS idx_segment_predictions_user
  ON public.segment_predictions(user_id, segment_id);

ALTER TABLE public.segment_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segment_predictions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "segment_predictions_select_own" ON public.segment_predictions;
CREATE POLICY "segment_predictions_select_own"
  ON public.segment_predictions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "segment_predictions_all_service" ON public.segment_predictions;
CREATE POLICY "segment_predictions_all_service"
  ON public.segment_predictions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Prédiction de route ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.route_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.adventure_plans(id) ON DELETE CASCADE,
  route_id bigint REFERENCES public.hiking_routes(id) ON DELETE SET NULL,
  strategy text NOT NULL CHECK (strategy IN ('comfort', 'recommended', 'fast')),
  eta_p50 timestamptz NOT NULL,
  eta_p90 timestamptz NOT NULL,
  total_duration_p50_s integer NOT NULL CHECK (total_duration_p50_s > 0),
  total_duration_p90_s integer NOT NULL CHECK (total_duration_p90_s > 0),
  pace_p25_min_per_km numeric,
  pace_p50_min_per_km numeric,
  pace_p75_min_per_km numeric,
  pauses_s integer CHECK (pauses_s IS NULL OR pauses_s >= 0),
  personal_difficulty numeric
    CHECK (personal_difficulty IS NULL OR personal_difficulty BETWEEN 0 AND 100),
  max_fatigue numeric CHECK (max_fatigue IS NULL OR max_fatigue BETWEEN 0 AND 100),
  turnaround_time timestamptz,
  critical_segment_ids bigint[] NOT NULL DEFAULT '{}'::bigint[],
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_version text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT route_predictions_eta_order CHECK (eta_p90 >= eta_p50),
  CONSTRAINT route_predictions_duration_order CHECK (total_duration_p90_s >= total_duration_p50_s)
);

COMMENT ON TABLE public.route_predictions IS
  'Prédiction de route par stratégie d''allure (confort/recommandée/rapide), '
  'avec fourchettes P50/P90 et alerte heure de demi-tour.';

CREATE INDEX IF NOT EXISTS idx_route_predictions_user
  ON public.route_predictions(user_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_predictions_plan
  ON public.route_predictions(plan_id);

ALTER TABLE public.route_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_predictions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "route_predictions_select_own" ON public.route_predictions;
CREATE POLICY "route_predictions_select_own"
  ON public.route_predictions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "route_predictions_all_service" ON public.route_predictions;
CREATE POLICY "route_predictions_all_service"
  ON public.route_predictions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
