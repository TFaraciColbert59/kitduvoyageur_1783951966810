-- ============================================================
-- GPS Geometry Validation: add gps_points_count column
-- and index for fast GPS-valid trail queries
-- Timestamp: 20260716140000
-- ============================================================

-- Add gps_points_count column to trails for quick GPS validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trails' AND column_name = 'gps_points_count'
  ) THEN
    ALTER TABLE public.trails ADD COLUMN gps_points_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Backfill gps_points_count from existing geojson data
UPDATE public.trails
SET gps_points_count = jsonb_array_length(geojson->'coordinates')
WHERE geojson IS NOT NULL
  AND geojson->>'type' = 'LineString'
  AND gps_points_count = 0;

-- Index for filtering trails with valid GPS (≥10 points)
CREATE INDEX IF NOT EXISTS idx_trails_gps_valid
  ON public.trails(gps_points_count)
  WHERE gps_points_count >= 10;

-- Index for geojson existence check
CREATE INDEX IF NOT EXISTS idx_trails_has_geojson
  ON public.trails((geojson IS NOT NULL))
  WHERE geojson IS NOT NULL;

-- Composite index for map viewport queries with GPS validation
CREATE INDEX IF NOT EXISTS idx_trails_bbox_gps
  ON public.trails(start_lat, start_lng, gps_points_count)
  WHERE gps_points_count >= 10;
