-- ============================================================
-- Trails: add geojson column, unique osm_id constraint, metadata
-- Timestamp: 20260716130000
-- ============================================================

-- Add geojson column to trails if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trails' AND column_name = 'geojson'
  ) THEN
    ALTER TABLE public.trails ADD COLUMN geojson JSONB;
  END IF;
END $$;

-- Add metadata column to trails if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trails' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.trails ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
  END IF;
END $$;

-- Add is_loop column to trails if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trails' AND column_name = 'is_loop'
  ) THEN
    ALTER TABLE public.trails ADD COLUMN is_loop BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add duration_hours column to trails if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trails' AND column_name = 'duration_hours'
  ) THEN
    ALTER TABLE public.trails ADD COLUMN duration_hours NUMERIC(6,1);
  END IF;
END $$;

-- Add altitude_max column to trails if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trails' AND column_name = 'altitude_max'
  ) THEN
    ALTER TABLE public.trails ADD COLUMN altitude_max INTEGER;
  END IF;
END $$;

-- Add unique constraint on osm_id for upsert support (only for non-null values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'trails' AND indexname = 'idx_trails_osm_id_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_trails_osm_id_unique ON public.trails(osm_id) WHERE osm_id IS NOT NULL;
  END IF;
END $$;

-- Add unique constraint on osm_id for outdoor_points
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'outdoor_points' AND indexname = 'idx_outdoor_points_osm_id_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_outdoor_points_osm_id_unique ON public.outdoor_points(osm_id) WHERE osm_id IS NOT NULL;
  END IF;
END $$;

-- Index for geojson queries
CREATE INDEX IF NOT EXISTS idx_trails_start_coords ON public.trails(start_lat, start_lng);
CREATE INDEX IF NOT EXISTS idx_trails_name_search ON public.trails USING gin(to_tsvector('simple', coalesce(name, '')));

-- Allow authenticated users to insert/update trails (for sync)
DROP POLICY IF EXISTS "service_write_trails" ON public.trails;
CREATE POLICY "service_write_trails" ON public.trails
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_write_trails" ON public.trails;
CREATE POLICY "anon_write_trails" ON public.trails
FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_trails" ON public.trails;
CREATE POLICY "anon_update_trails" ON public.trails
FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_write_outdoor_points" ON public.outdoor_points;
CREATE POLICY "service_write_outdoor_points" ON public.outdoor_points
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_write_outdoor_points" ON public.outdoor_points;
CREATE POLICY "anon_write_outdoor_points" ON public.outdoor_points
FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_outdoor_points" ON public.outdoor_points;
CREATE POLICY "anon_update_outdoor_points" ON public.outdoor_points
FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_write_overpass_sync_log" ON public.overpass_sync_log;
CREATE POLICY "service_write_overpass_sync_log" ON public.overpass_sync_log
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_write_overpass_sync_log" ON public.overpass_sync_log;
CREATE POLICY "anon_write_overpass_sync_log" ON public.overpass_sync_log
FOR ALL TO anon USING (true) WITH CHECK (true);
