-- ==============================================================================
-- A1 — M3 : Profil Terrain personnel (versionné)
-- user_performance_profiles + user_performance_profile_versions
-- Additif et idempotent. RLS : propriétaire en lecture, service_role en écriture.
-- Aucune donnée de santé connectée (Phase 3 utilisera GPS + déclaratif).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_performance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'hiking'
    CHECK (activity_type IN ('hiking')),
  model_version text NOT NULL,
  flat_speed_kmh numeric CHECK (flat_speed_kmh IS NULL OR flat_speed_kmh > 0),
  ascent_speed_m_per_h numeric CHECK (ascent_speed_m_per_h IS NULL OR ascent_speed_m_per_h >= 0),
  descent_speed_m_per_h numeric CHECK (descent_speed_m_per_h IS NULL OR descent_speed_m_per_h >= 0),
  grade_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  surface_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  fatigue_curve jsonb NOT NULL DEFAULT '{}'::jsonb,
  pause_model jsonb NOT NULL DEFAULT '{}'::jsonb,
  pack_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  heat_response jsonb,
  cold_response jsonb,
  altitude_response jsonb,
  calibration_level text NOT NULL DEFAULT 'cold'
    CHECK (calibration_level IN ('cold', 'calibration', 'personalization', 'contextualization')),
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_count integer NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
  trained_at timestamptz,
  valid_until timestamptz,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_performance_profiles_unique UNIQUE (user_id, activity_type)
);

COMMENT ON TABLE public.user_performance_profiles IS
  'Profil Terrain : paramètres appris (allures plat/montée/descente, courbes, pauses, '
  'portage, confiance). Versionné par model_version et par snapshots.';

CREATE INDEX IF NOT EXISTS idx_user_performance_profiles_user
  ON public.user_performance_profiles(user_id);

ALTER TABLE public.user_performance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_performance_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "performance_profiles_select_own" ON public.user_performance_profiles;
CREATE POLICY "performance_profiles_select_own"
  ON public.user_performance_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "performance_profiles_all_service" ON public.user_performance_profiles;
CREATE POLICY "performance_profiles_all_service"
  ON public.user_performance_profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_user_performance_profiles_updated_at ON public.user_performance_profiles;
CREATE TRIGGER trg_user_performance_profiles_updated_at
  BEFORE UPDATE ON public.user_performance_profiles
  FOR EACH ROW EXECUTE FUNCTION public.adventure_touch_updated_at();

-- ── Versions (audit des évolutions du profil) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_performance_profile_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.user_performance_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'hiking',
  model_version text NOT NULL,
  snapshot jsonb NOT NULL,
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_count integer NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
  reason text NOT NULL DEFAULT 'recompute',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_performance_profile_versions_unique UNIQUE (profile_id, model_version)
);

COMMENT ON TABLE public.user_performance_profile_versions IS
  'Historique immuable des versions du Profil Terrain (snapshot + confiance + raison).';

CREATE INDEX IF NOT EXISTS idx_user_performance_profile_versions_profile
  ON public.user_performance_profile_versions(profile_id, created_at DESC);

ALTER TABLE public.user_performance_profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_performance_profile_versions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "performance_profile_versions_select_own" ON public.user_performance_profile_versions;
CREATE POLICY "performance_profile_versions_select_own"
  ON public.user_performance_profile_versions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "performance_profile_versions_all_service" ON public.user_performance_profile_versions;
CREATE POLICY "performance_profile_versions_all_service"
  ON public.user_performance_profile_versions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
