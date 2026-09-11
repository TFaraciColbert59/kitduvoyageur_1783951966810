-- ==============================================================================
-- A1 — M6 : AdventurePlan — source de vérité versionnée (ADR-AI-001)
-- adventure_plans + adventure_plan_versions + adventure_plan_decisions + adventure_engine_runs
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.adventure_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  title text,
  intent jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  current_version integer NOT NULL DEFAULT 0 CHECK (current_version >= 0),
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  monitoring_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.adventure_plans IS
  'Source de vérité de l''aventure complète (ADR-AI-001). Les versions sont immuables.';

CREATE INDEX IF NOT EXISTS idx_adventure_plans_owner
  ON public.adventure_plans(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_adventure_plans_trip
  ON public.adventure_plans(trip_id);

ALTER TABLE public.adventure_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adventure_plans_select_access" ON public.adventure_plans;
CREATE POLICY "adventure_plans_select_access"
  ON public.adventure_plans FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR (trip_id IS NOT NULL AND public.can_read_trip(trip_id))
  );

DROP POLICY IF EXISTS "adventure_plans_insert_owner" ON public.adventure_plans;
CREATE POLICY "adventure_plans_insert_owner"
  ON public.adventure_plans FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "adventure_plans_update_owner" ON public.adventure_plans;
CREATE POLICY "adventure_plans_update_owner"
  ON public.adventure_plans FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "adventure_plans_delete_owner" ON public.adventure_plans;
CREATE POLICY "adventure_plans_delete_owner"
  ON public.adventure_plans FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "adventure_plans_all_service" ON public.adventure_plans;
CREATE POLICY "adventure_plans_all_service"
  ON public.adventure_plans FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_adventure_plans_updated_at ON public.adventure_plans;
CREATE TRIGGER trg_adventure_plans_updated_at
  BEFORE UPDATE ON public.adventure_plans
  FOR EACH ROW EXECUTE FUNCTION public.adventure_touch_updated_at();

-- ── Versions immuables ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.adventure_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.adventure_plans(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  snapshot jsonb NOT NULL,
  reason text NOT NULL,
  generated_by text NOT NULL,
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adventure_plan_versions_unique UNIQUE (plan_id, version)
);

COMMENT ON TABLE public.adventure_plan_versions IS
  'Versions immuables d''un AdventurePlan : snapshot complet + raison + auteur.';

CREATE INDEX IF NOT EXISTS idx_adventure_plan_versions_plan
  ON public.adventure_plan_versions(plan_id, version DESC);

ALTER TABLE public.adventure_plan_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adventure_plan_versions_select_access" ON public.adventure_plan_versions;
CREATE POLICY "adventure_plan_versions_select_access"
  ON public.adventure_plan_versions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adventure_plans p
      WHERE p.id = adventure_plan_versions.plan_id
        AND (
          p.owner_id = auth.uid()
          OR (p.trip_id IS NOT NULL AND public.can_read_trip(p.trip_id))
        )
    )
  );

DROP POLICY IF EXISTS "adventure_plan_versions_all_service" ON public.adventure_plan_versions;
CREATE POLICY "adventure_plan_versions_all_service"
  ON public.adventure_plan_versions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Décisions (proposition -> confirmation -> exécution) ─────────────────────
CREATE TABLE IF NOT EXISTS public.adventure_plan_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.adventure_plans(id) ON DELETE CASCADE,
  decision_type text NOT NULL CHECK (decision_type IN (
    'payment', 'cancellation', 'safety_change', 'location_share', 'group_change', 'other'
  )),
  proposal text NOT NULL,
  impact jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_confirmation boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'confirmed', 'rejected', 'expired')),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.adventure_plan_decisions IS
  'Journal de décisions : proposition, impact, confirmation requise, décision. '
  'Aucune action coûteuse ou de sécurité sans confirmation explicite.';

CREATE INDEX IF NOT EXISTS idx_adventure_plan_decisions_plan
  ON public.adventure_plan_decisions(plan_id, status);

ALTER TABLE public.adventure_plan_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adventure_plan_decisions_select_access" ON public.adventure_plan_decisions;
CREATE POLICY "adventure_plan_decisions_select_access"
  ON public.adventure_plan_decisions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adventure_plans p
      WHERE p.id = adventure_plan_decisions.plan_id
        AND (
          p.owner_id = auth.uid()
          OR (p.trip_id IS NOT NULL AND public.can_read_trip(p.trip_id))
        )
    )
  );

DROP POLICY IF EXISTS "adventure_plan_decisions_insert_owner" ON public.adventure_plan_decisions;
CREATE POLICY "adventure_plan_decisions_insert_owner"
  ON public.adventure_plan_decisions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.adventure_plans p
      WHERE p.id = adventure_plan_decisions.plan_id AND p.owner_id = auth.uid()
    )
    AND (decided_by IS NULL OR decided_by = auth.uid())
  );

DROP POLICY IF EXISTS "adventure_plan_decisions_update_owner" ON public.adventure_plan_decisions;
CREATE POLICY "adventure_plan_decisions_update_owner"
  ON public.adventure_plan_decisions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adventure_plans p
      WHERE p.id = adventure_plan_decisions.plan_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (decided_by IS NULL OR decided_by = auth.uid());

DROP POLICY IF EXISTS "adventure_plan_decisions_all_service" ON public.adventure_plan_decisions;
CREATE POLICY "adventure_plan_decisions_all_service"
  ON public.adventure_plan_decisions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Exécutions de moteurs (observabilité, ADR-AI-005) ────────────────────────
CREATE TABLE IF NOT EXISTS public.adventure_engine_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.adventure_plans(id) ON DELETE SET NULL,
  engine_id text NOT NULL,
  engine_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  input_hash text,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

COMMENT ON TABLE public.adventure_engine_runs IS
  'Observabilité des moteurs : id, version, statut, durée, warnings, erreur. '
  'Aucune donnée santé brute journalisée.';

CREATE INDEX IF NOT EXISTS idx_adventure_engine_runs_plan
  ON public.adventure_engine_runs(plan_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_adventure_engine_runs_engine
  ON public.adventure_engine_runs(engine_id, started_at DESC);

ALTER TABLE public.adventure_engine_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adventure_engine_runs_select_access" ON public.adventure_engine_runs;
CREATE POLICY "adventure_engine_runs_select_access"
  ON public.adventure_engine_runs FOR SELECT TO authenticated
  USING (
    plan_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.adventure_plans p
      WHERE p.id = adventure_engine_runs.plan_id
        AND (
          p.owner_id = auth.uid()
          OR (p.trip_id IS NOT NULL AND public.can_read_trip(p.trip_id))
        )
    )
  );

DROP POLICY IF EXISTS "adventure_engine_runs_all_service" ON public.adventure_engine_runs;
CREATE POLICY "adventure_engine_runs_all_service"
  ON public.adventure_engine_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
