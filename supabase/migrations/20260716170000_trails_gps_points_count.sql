-- ============================================================
-- Ensure trails table has gps_points_count column
-- and proper indexes for the sync-trails pipeline
-- Timestamp: 20260716170000
-- ============================================================

-- Add gps_points_count column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trails' AND column_name = 'gps_points_count'
  ) THEN
    ALTER TABLE public.trails ADD COLUMN gps_points_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add elevation_gain column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trails' AND column_name = 'elevation_gain'
  ) THEN
    ALTER TABLE public.trails ADD COLUMN elevation_gain INTEGER;
  END IF;
END $$;

-- Add surface column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trails' AND column_name = 'surface'
  ) THEN
    ALTER TABLE public.trails ADD COLUMN surface TEXT;
  END IF;
END $$;

-- Add waymarking column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trails' AND column_name = 'waymarking'
  ) THEN
    ALTER TABLE public.trails ADD COLUMN waymarking TEXT;
  END IF;
END $$;

-- Update gps_points_count from existing geojson data
UPDATE public.trails
SET gps_points_count = jsonb_array_length(geojson->'coordinates')
WHERE geojson IS NOT NULL
  AND jsonb_typeof(geojson->'coordinates') = 'array'
  AND (gps_points_count IS NULL OR gps_points_count = 0);

-- Index for gps_points_count filtering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'trails' AND indexname = 'idx_trails_gps_points'
  ) THEN
    CREATE INDEX idx_trails_gps_points ON public.trails(gps_points_count)
    WHERE gps_points_count >= 20;
  END IF;
END $$;

-- Ensure anon can insert/update trails (needed for sync-trails route)
DROP POLICY IF EXISTS "anon_write_trails_v2" ON public.trails;
CREATE POLICY "anon_write_trails_v2" ON public.trails
FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_write_trails" ON public.trails;
CREATE POLICY "authenticated_write_trails" ON public.trails
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
  RAISE NOTICE 'Trails table updated: gps_points_count column ready for sync-trails pipeline.';
END $$;
