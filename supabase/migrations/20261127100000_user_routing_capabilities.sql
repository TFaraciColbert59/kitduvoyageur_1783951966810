-- Explorer v2 — Personalized, Multimodal & Explainable POI Routing Capabilities
-- Additive, non-breaking schema evolution with strict owner-only RLS.

BEGIN;

-- 1. Granular per-sport capability & technical grade limits
CREATE TABLE IF NOT EXISTS public.user_sport_capabilities (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport text NOT NULL CHECK (
    sport IN (
      'rando',
      'trail',
      'course',
      'velo',
      'gravel',
      'vtt',
      'ski',
      'raquettes',
      'kayak',
      'packraft',
      'sup',
      'escalade',
      'bivouac'
    )
  ),
  practiced boolean NOT NULL DEFAULT true,
  experience_level text NOT NULL DEFAULT 'debutant' CHECK (
    experience_level IN ('debutant', 'intermediaire', 'avance', 'expert')
  ),
  sac_max_grade smallint NOT NULL DEFAULT 2 CHECK (sac_max_grade BETWEEN 1 AND 6),
  mtb_max_grade smallint NOT NULL DEFAULT 1 CHECK (mtb_max_grade BETWEEN 0 AND 5),
  whitewater_max_grade smallint NOT NULL DEFAULT 0 CHECK (whitewater_max_grade BETWEEN 0 AND 6),
  via_ferrata_ok boolean NOT NULL DEFAULT false,
  winter_avalanche_trained boolean NOT NULL DEFAULT false,
  max_comfortable_dplus_m integer CHECK (max_comfortable_dplus_m IS NULL OR max_comfortable_dplus_m BETWEEN 50 AND 12000),
  max_comfortable_km numeric(6,2) CHECK (max_comfortable_km IS NULL OR max_comfortable_km BETWEEN 1 AND 500),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sport)
);

ALTER TABLE public.user_sport_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_sport_capabilities_owner_all ON public.user_sport_capabilities;
CREATE POLICY user_sport_capabilities_owner_all
  ON public.user_sport_capabilities
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. User locomotion & vehicle / craft assets (strictly gates multimodal & non-foot routes)
CREATE TABLE IF NOT EXISTS public.user_locomotion_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_kind text NOT NULL CHECK (
    asset_kind IN (
      'foot',
      'road_bike',
      'gravel_bike',
      'mtb',
      'ebike',
      'car',
      'van_4x4',
      'motorcycle',
      'kayak',
      'packraft',
      'sup',
      'ski_touring',
      'snowshoes',
      'public_transit'
    )
  ),
  label text,
  product_ownership_id uuid REFERENCES public.product_ownership(id) ON DELETE SET NULL,
  battery_wh integer CHECK (battery_wh IS NULL OR battery_wh BETWEEN 50 AND 3000),
  range_km integer CHECK (range_km IS NULL OR range_km BETWEEN 5 AND 1500),
  weight_g integer CHECK (weight_g IS NULL OR weight_g BETWEEN 100 AND 5000000),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_locomotion_assets_user_active
  ON public.user_locomotion_assets (user_id, is_active);

ALTER TABLE public.user_locomotion_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_locomotion_assets_owner_all ON public.user_locomotion_assets;
CREATE POLICY user_locomotion_assets_owner_all
  ON public.user_locomotion_assets
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Daily biometric / subjective wellness snapshots (feeds ExplorerReadiness)
CREATE TABLE IF NOT EXISTS public.user_wellness_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  sleep_hours numeric(4,2) CHECK (sleep_hours IS NULL OR sleep_hours BETWEEN 0 AND 24),
  sleep_quality smallint CHECK (sleep_quality IS NULL OR sleep_quality BETWEEN 1 AND 5),
  resting_hr_bpm smallint CHECK (resting_hr_bpm IS NULL OR resting_hr_bpm BETWEEN 25 AND 140),
  hrv_ms numeric(6,2) CHECK (hrv_ms IS NULL OR hrv_ms BETWEEN 5 AND 300),
  soreness_level smallint CHECK (soreness_level IS NULL OR soreness_level BETWEEN 0 AND 10),
  subjective_energy smallint CHECK (subjective_energy IS NULL OR subjective_energy BETWEEN 1 AND 5),
  rehab_pain_level smallint CHECK (rehab_pain_level IS NULL OR rehab_pain_level BETWEEN 0 AND 10),
  rehab_body_zone text
);

CREATE INDEX IF NOT EXISTS idx_user_wellness_snapshots_user_recent
  ON public.user_wellness_snapshots (user_id, recorded_at DESC);

ALTER TABLE public.user_wellness_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_wellness_snapshots_owner_all ON public.user_wellness_snapshots;
CREATE POLICY user_wellness_snapshots_owner_all
  ON public.user_wellness_snapshots
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Additive physiological & altitude baseline columns
ALTER TABLE IF EXISTS public.user_physiology
  ADD COLUMN IF NOT EXISTS height_cm smallint CHECK (height_cm IS NULL OR height_cm BETWEEN 100 AND 250),
  ADD COLUMN IF NOT EXISTS vo2max_ml_kg_min numeric(5,2) CHECK (vo2max_ml_kg_min IS NULL OR vo2max_ml_kg_min BETWEEN 20 AND 95),
  ADD COLUMN IF NOT EXISTS vma_kmh numeric(4,2) CHECK (vma_kmh IS NULL OR vma_kmh BETWEEN 6 AND 26),
  ADD COLUMN IF NOT EXISTS mobility_profile text NOT NULL DEFAULT 'standard' CHECK (
    mobility_profile IN ('standard', 'famille', 'senior', 'pmr')
  );

ALTER TABLE IF EXISTS public.user_traveller
  ADD COLUMN IF NOT EXISTS home_altitude_m integer CHECK (home_altitude_m IS NULL OR home_altitude_m BETWEEN -400 AND 5500);

-- 5. Relax user_performance_profiles.activity_type CHECK from hiking-only to multi-sport
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'user_performance_profiles'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%activity_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_performance_profiles DROP CONSTRAINT %I', constraint_name);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_performance_profiles'
  ) THEN
    ALTER TABLE public.user_performance_profiles
      ADD CONSTRAINT user_performance_profiles_activity_type_check
      CHECK (
        activity_type IN (
          'hiking',
          'trail',
          'running',
          'road_bike',
          'gravel',
          'mtb',
          'ski_touring',
          'kayak'
        )
      );
  END IF;
END $$;

-- 6. Extend standardized gear_functions with granular alpine / winter / nautical / cycling safety gear
--    default_zone must match gear_functions_default_zone_check: ('worn','lid','main','front','sides','hip','back')
INSERT INTO public.gear_functions (id, family, label_fr, default_zone, access_priority, is_vital_default, shape_kind)
VALUES
  ('avalanche_dva', 'Sécurité & soin', 'Kit DVA / Pelle / Sonde', 'front', 2, true, 'box'),
  ('crampons_axe', 'Orientation & outils', 'Crampons & Piolet', 'front', 1, false, 'poles'),
  ('via_ferrata_kit', 'Orientation & outils', 'Longe & Baudrier Via Ferrata', 'main', 1, false, 'sack'),
  ('helmet_alpine', 'Sécurité & soin', 'Casque Alpinisme / Escalade', 'front', 1, false, 'hat'),
  ('helmet_bike', 'Sécurité & soin', 'Casque Vélo / VTT', 'worn', 2, false, 'hat'),
  ('watercraft', 'Nautique', 'Embarcation (Kayak / Packraft / SUP)', 'back', 0, false, 'roll'),
  ('pfd_vest', 'Nautique', 'Gilet d''aide à la flottabilité (VFI)', 'worn', 2, true, 'jacket'),
  ('wetsuit', 'Nautique', 'Combinaison néoprène / étanche', 'main', 1, false, 'jacket'),
  ('bike_repair', 'Vélo', 'Kit réparation vélo (chambre, pompe, multi-outil)', 'hip', 2, false, 'box'),
  ('snowshoes', 'Hiver', 'Raquettes à neige', 'front', 1, false, 'poles'),
  ('skis_touring', 'Hiver', 'Skis de randonnée & peaux', 'sides', 1, false, 'poles')
ON CONFLICT (id) DO NOTHING;

-- 7. Shared server cache for Overpass OSM corridor subgraphs (protects Overpass from 429)
CREATE TABLE IF NOT EXISTS public.osm_corridor_cache (
  cache_key text PRIMARY KEY,
  south numeric(8,5) NOT NULL,
  west numeric(8,5) NOT NULL,
  north numeric(8,5) NOT NULL,
  east numeric(8,5) NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_osm_corridor_cache_expires
  ON public.osm_corridor_cache (expires_at);

ALTER TABLE public.osm_corridor_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS osm_corridor_cache_public_read ON public.osm_corridor_cache;
CREATE POLICY osm_corridor_cache_public_read
  ON public.osm_corridor_cache
  FOR SELECT
  USING (true);

COMMIT;
