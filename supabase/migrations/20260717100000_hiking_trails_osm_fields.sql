-- Migration: Add OSM fields to hiking_trails for Overpass API seeding
-- Adds osm_id (unique constraint for upsert deduplication) and gps_points_count

-- Add osm_id column for OSM deduplication
ALTER TABLE public.hiking_trails
ADD COLUMN IF NOT EXISTS osm_id BIGINT;

-- Add gps_points_count for GPS quality tracking
ALTER TABLE public.hiking_trails
ADD COLUMN IF NOT EXISTS gps_points_count INTEGER DEFAULT 0;

-- Unique index on osm_id (allows upsert by osm_id, NULL values are excluded)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hiking_trails_osm_id
ON public.hiking_trails (osm_id)
WHERE osm_id IS NOT NULL;

-- Index for source filtering (find OSM-imported trails quickly)
CREATE INDEX IF NOT EXISTS idx_hiking_trails_source
ON public.hiking_trails (source);

-- Index for bbox spatial queries
CREATE INDEX IF NOT EXISTS idx_hiking_trails_start_coords
ON public.hiking_trails (start_lat, start_lng)
WHERE start_lat IS NOT NULL AND start_lng IS NOT NULL;

-- Log this migration
DO $$
BEGIN
  RAISE NOTICE 'hiking_trails: added osm_id (BIGINT, unique), gps_points_count (INTEGER)';
  RAISE NOTICE 'Unique index on osm_id allows upsert deduplication from Overpass API';
END $$;
