-- ==============================================================================
-- A1 — M2 : données d'activité privées
-- Extension hike_sessions + session_segment_passages + performance_observations
-- Additif et idempotent. RLS : propriétaire en lecture, service_role en écriture.
-- ==============================================================================

-- ── 1. Extension de hike_sessions (traitement + visibilité) ──────────────────
ALTER TABLE public.hike_sessions
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS processor_version text,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS track_quality jsonb,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hike_sessions_processing_status_check'
      AND conrelid = 'public.hike_sessions'::regclass
  ) THEN
    ALTER TABLE public.hike_sessions
      ADD CONSTRAINT hike_sessions_processing_status_check
      CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hike_sessions_visibility_check'
      AND conrelid = 'public.hike_sessions'::regclass
  ) THEN
    ALTER TABLE public.hike_sessions
      ADD CONSTRAINT hike_sessions_visibility_check
      CHECK (visibility IN ('private', 'collective_anonymized'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hike_sessions_processing_status
  ON public.hike_sessions(processing_status)
  WHERE processing_status IN ('pending', 'processing');

DROP TRIGGER IF EXISTS trg_hike_sessions_updated_at ON public.hike_sessions;
CREATE TRIGGER trg_hike_sessions_updated_at
  BEFORE UPDATE ON public.hike_sessions
  FOR EACH ROW EXECUTE FUNCTION public.adventure_touch_updated_at();

-- ── 2. Passages par segment (Niveau 2 — privé dérivé) ────────────────────────
CREATE TABLE IF NOT EXISTS public.session_segment_passages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.hike_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  segment_id bigint NOT NULL REFERENCES public.trail_segments(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('forward', 'reverse')),
  entered_at timestamptz NOT NULL,
  exited_at timestamptz NOT NULL,
  duration_s integer NOT NULL CHECK (duration_s >= 0),
  moving_s integer CHECK (moving_s IS NULL OR moving_s >= 0),
  stopped_s integer CHECK (stopped_s IS NULL OR stopped_s >= 0),
  distance_m numeric NOT NULL CHECK (distance_m >= 0),
  gain_m numeric,
  loss_m numeric,
  pace_min_per_km numeric CHECK (pace_min_per_km IS NULL OR pace_min_per_km >= 0),
  gps_quality numeric CHECK (gps_quality IS NULL OR gps_quality BETWEEN 0 AND 1),
  map_match_quality numeric CHECK (map_match_quality IS NULL OR map_match_quality BETWEEN 0 AND 1),
  uturn_detected boolean NOT NULL DEFAULT false,
  off_route boolean NOT NULL DEFAULT false,
  eligible_for_collective boolean NOT NULL DEFAULT false,
  processor_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_segment_passages_interval CHECK (exited_at >= entered_at),
  CONSTRAINT session_segment_passages_idempotence UNIQUE (
    session_id, segment_id, direction, entered_at, processor_version
  )
);

COMMENT ON TABLE public.session_segment_passages IS
  'Niveau 2 — passages normalisés par segment, produits par le traitement serveur '
  '(Phase 2). Idempotence : session + segment + sens + entrée + version de traitement.';

CREATE INDEX IF NOT EXISTS idx_session_segment_passages_session
  ON public.session_segment_passages(session_id);
CREATE INDEX IF NOT EXISTS idx_session_segment_passages_user
  ON public.session_segment_passages(user_id);
CREATE INDEX IF NOT EXISTS idx_session_segment_passages_segment
  ON public.session_segment_passages(segment_id);
CREATE INDEX IF NOT EXISTS idx_session_segment_passages_collective
  ON public.session_segment_passages(segment_id, direction)
  WHERE eligible_for_collective = true;

ALTER TABLE public.session_segment_passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_segment_passages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_passages_select_own" ON public.session_segment_passages;
CREATE POLICY "session_passages_select_own"
  ON public.session_segment_passages FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.hike_sessions hs
      WHERE hs.id = session_segment_passages.session_id
        AND hs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_passages_all_service" ON public.session_segment_passages;
CREATE POLICY "session_passages_all_service"
  ON public.session_segment_passages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 3. Observations de performance (Niveau 2 — privé dérivé) ────────────────
CREATE TABLE IF NOT EXISTS public.performance_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.hike_sessions(id) ON DELETE CASCADE,
  passage_id uuid REFERENCES public.session_segment_passages(id) ON DELETE SET NULL,
  observed_at timestamptz NOT NULL,
  distance_m numeric NOT NULL CHECK (distance_m >= 0),
  duration_s integer NOT NULL CHECK (duration_s > 0),
  moving_s integer CHECK (moving_s IS NULL OR moving_s >= 0),
  gain_m numeric,
  loss_m numeric,
  mean_grade_pct numeric,
  max_grade_pct numeric,
  altitude_mean_m numeric,
  surface text,
  pack_weight_kg numeric CHECK (pack_weight_kg IS NULL OR pack_weight_kg >= 0),
  temperature_c numeric,
  weather text,
  declared_fatigue smallint CHECK (declared_fatigue IS NULL OR declared_fatigue BETWEEN 0 AND 10),
  perceived_difficulty smallint CHECK (perceived_difficulty IS NULL OR perceived_difficulty BETWEEN 0 AND 10),
  pace_min_per_km numeric CHECK (pace_min_per_km IS NULL OR pace_min_per_km >= 0),
  quality numeric CHECK (quality IS NULL OR quality BETWEEN 0 AND 1),
  processor_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.performance_observations IS
  'Niveau 2 — observations exploitables pour le Profil Terrain (Phase 3). '
  'Aucune donnée de santé connectée : uniquement dérivé de traces GPS et déclaratif.';

CREATE INDEX IF NOT EXISTS idx_performance_observations_user
  ON public.performance_observations(user_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_observations_session
  ON public.performance_observations(session_id);

ALTER TABLE public.performance_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_observations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "performance_observations_select_own" ON public.performance_observations;
CREATE POLICY "performance_observations_select_own"
  ON public.performance_observations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "performance_observations_all_service" ON public.performance_observations;
CREATE POLICY "performance_observations_all_service"
  ON public.performance_observations FOR ALL TO service_role
  USING (true) WITH CHECK (true);
