-- ============================================================================
-- Migration Lot A01 + A03 :
-- 1. Enregistrement des variantes sportives débloquées (indoor, virtuel, natation,
--    ski alpin/fond/snowboard, escalade salle, rééducation) dans
--    public.explorer_sport_variants (S1.02, S1.09, S1.10, S1.11, S1.12).
-- 2. Table public.user_imported_routes pour l'import de tracés comme parcours
--    planifiés avec aperçu snap-to-trails et waypoints GPX <wpt> (K6.01, K6.03, K6.04).
-- ============================================================================

INSERT INTO public.explorer_sport_variants (sport, variant_id) VALUES
  ('course', 'course-tapis'),
  ('velo', 'velo-home-trainer'),
  ('velo', 'velo-virtuel'),
  ('kayak', 'natation-piscine'),
  ('kayak', 'natation-eau-libre'),
  ('kayak', 'rameur-indoor'),
  ('ski', 'ski-alpin'),
  ('ski', 'ski-fond'),
  ('ski', 'snowboard'),
  ('escalade', 'escalade-salle'),
  ('famille', 'rehab-mobilite'),
  ('rando', 'rehab-marche'),
  ('velo', 'rehab-velo-doux'),
  ('kayak', 'rehab-aquatique')
ON CONFLICT (sport, variant_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_imported_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  sport text NOT NULL DEFAULT 'rando',
  source text NOT NULL CHECK (source IN ('gpx', 'fit', 'tcx')),
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[a-f0-9]{64}$'),
  source_file_name text,
  geometry_mode text NOT NULL DEFAULT 'original' CHECK (geometry_mode IN ('original', 'snapped')),
  distance_km numeric NOT NULL DEFAULT 0 CHECK (distance_km >= 0),
  elevation_gain_m integer NOT NULL DEFAULT 0 CHECK (elevation_gain_m >= 0),
  original_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapped_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  waypoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'collective_anonymized')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_fingerprint)
);

CREATE INDEX IF NOT EXISTS user_imported_routes_user_idx
  ON public.user_imported_routes (user_id, created_at DESC);

ALTER TABLE public.user_imported_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_imported_routes_owner_select ON public.user_imported_routes;
CREATE POLICY user_imported_routes_owner_select
  ON public.user_imported_routes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR visibility = 'public');

DROP POLICY IF EXISTS user_imported_routes_owner_insert ON public.user_imported_routes;
CREATE POLICY user_imported_routes_owner_insert
  ON public.user_imported_routes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_imported_routes_owner_update ON public.user_imported_routes;
CREATE POLICY user_imported_routes_owner_update
  ON public.user_imported_routes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_imported_routes_owner_delete ON public.user_imported_routes;
CREATE POLICY user_imported_routes_owner_delete
  ON public.user_imported_routes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
