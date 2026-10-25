-- ==============================================================================
-- A1 — M4 : intelligence collective (agrégats anonymes par segment)
-- segment_condition_buckets + segment_collective_aggregates
-- Niveau 3 : écriture service_role uniquement.
-- Seuil public : distinct_user_count >= 5 (aucune donnée individuelle publique).
-- ==============================================================================

-- ── 1. Référentiel des conditions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.segment_condition_buckets (
  id text PRIMARY KEY,
  label_fr text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.segment_condition_buckets (id, label_fr) VALUES
  ('dry', 'Sec'),
  ('wet', 'Humide'),
  ('snow', 'Neige'),
  ('ice', 'Glace'),
  ('day', 'Jour'),
  ('night', 'Nuit'),
  ('ascent', 'Montée'),
  ('descent', 'Descente'),
  ('light_pack', 'Sac léger'),
  ('heavy_pack', 'Sac lourd')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.segment_condition_buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "segment_condition_buckets_select_public" ON public.segment_condition_buckets;
CREATE POLICY "segment_condition_buckets_select_public"
  ON public.segment_condition_buckets FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "segment_condition_buckets_all_service" ON public.segment_condition_buckets;
CREATE POLICY "segment_condition_buckets_all_service"
  ON public.segment_condition_buckets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 2. Agrégats collectifs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.segment_collective_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id bigint NOT NULL REFERENCES public.trail_segments(id) ON DELETE CASCADE,
  condition_bucket text NOT NULL REFERENCES public.segment_condition_buckets(id),
  direction text NOT NULL CHECK (direction IN ('forward', 'reverse')),
  passage_count integer NOT NULL DEFAULT 0 CHECK (passage_count >= 0),
  distinct_user_count integer NOT NULL DEFAULT 0 CHECK (distinct_user_count >= 0),
  weighted_median_slowdown numeric,
  p25_slowdown numeric,
  p50_slowdown numeric,
  p75_slowdown numeric,
  p90_slowdown numeric,
  effort_score numeric CHECK (effort_score IS NULL OR effort_score BETWEEN 0 AND 100),
  technical_score numeric CHECK (technical_score IS NULL OR technical_score BETWEEN 0 AND 100),
  fatigue_score numeric CHECK (fatigue_score IS NULL OR fatigue_score BETWEEN 0 AND 100),
  orientation_score numeric CHECK (orientation_score IS NULL OR orientation_score BETWEEN 0 AND 100),
  slowdown_score numeric CHECK (slowdown_score IS NULL OR slowdown_score BETWEEN 0 AND 100),
  collective_difficulty numeric
    CHECK (collective_difficulty IS NULL OR collective_difficulty BETWEEN 0 AND 100),
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  processor_version text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT segment_collective_aggregates_unique UNIQUE (
    segment_id, condition_bucket, direction, processor_version
  )
);

COMMENT ON TABLE public.segment_collective_aggregates IS
  'Niveau 3 — agrégats collectifs anonymes par segment/condition/sens. '
  'Seuil d''exposition publique : distinct_user_count >= 5. Jamais d''identité.';

CREATE INDEX IF NOT EXISTS idx_segment_collective_aggregates_segment
  ON public.segment_collective_aggregates(segment_id, direction);
CREATE INDEX IF NOT EXISTS idx_segment_collective_aggregates_public
  ON public.segment_collective_aggregates(segment_id, condition_bucket, direction)
  WHERE distinct_user_count >= 5;

ALTER TABLE public.segment_collective_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segment_collective_aggregates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "segment_collective_aggregates_select_threshold" ON public.segment_collective_aggregates;
CREATE POLICY "segment_collective_aggregates_select_threshold"
  ON public.segment_collective_aggregates FOR SELECT TO public
  USING (distinct_user_count >= 5);

DROP POLICY IF EXISTS "segment_collective_aggregates_all_service" ON public.segment_collective_aggregates;
CREATE POLICY "segment_collective_aggregates_all_service"
  ON public.segment_collective_aggregates FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 3. Vue publique filtrée (confort de lecture, même seuil) ─────────────────
CREATE OR REPLACE VIEW public.segment_collective_public
WITH (security_invoker = true) AS
SELECT
  a.segment_id,
  a.condition_bucket,
  a.direction,
  a.passage_count,
  a.distinct_user_count,
  a.weighted_median_slowdown,
  a.p50_slowdown,
  a.p90_slowdown,
  a.effort_score,
  a.technical_score,
  a.fatigue_score,
  a.collective_difficulty,
  a.confidence,
  a.computed_at
FROM public.segment_collective_aggregates a
WHERE a.distinct_user_count >= 5;

COMMENT ON VIEW public.segment_collective_public IS
  'Vue publique des agrégats collectifs — seuil >= 5 utilisateurs distincts, sans identité.';

GRANT SELECT ON public.segment_collective_public TO anon, authenticated;
