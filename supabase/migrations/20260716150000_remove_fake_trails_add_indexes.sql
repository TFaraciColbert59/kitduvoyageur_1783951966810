-- ============================================================
-- Remove fake hardcoded trails (geojson IS NULL)
-- These were injected by the fallback system and have no real GPS data.
-- Only real OSM trails with geojson LineString should remain.
-- Timestamp: 20260716150000
-- ============================================================

-- Delete all trails that have no real GPS geometry (geojson is null)
-- These are the 20 hardcoded fallback trails that were never real data
DELETE FROM public.trails
WHERE geojson IS NULL;

-- Also remove any trails with empty/invalid geojson coordinates
DELETE FROM public.trails
WHERE geojson IS NOT NULL
  AND (
    jsonb_typeof(geojson->'coordinates') != 'array'
    OR jsonb_array_length(geojson->'coordinates') < 10
  );

-- Update gps_points_count for existing trails that have geojson
UPDATE public.trails
SET gps_points_count = jsonb_array_length(geojson->'coordinates')
WHERE geojson IS NOT NULL
  AND jsonb_typeof(geojson->'coordinates') = 'array'
  AND gps_points_count = 0;

-- Add index on geojson IS NOT NULL for fast filtering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trails'
      AND indexname = 'idx_trails_has_geojson'
  ) THEN
    CREATE INDEX idx_trails_has_geojson ON public.trails(id)
    WHERE geojson IS NOT NULL;
  END IF;
END $$;

-- Add index on start_lat/start_lng for bbox queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'trails'
      AND indexname = 'idx_trails_bbox_coords'
  ) THEN
    CREATE INDEX idx_trails_bbox_coords ON public.trails(start_lat, start_lng);
  END IF;
END $$;