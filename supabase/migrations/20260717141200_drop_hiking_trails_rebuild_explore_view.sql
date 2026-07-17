-- ============================================================
-- Drop hiking_trails (8 fake rows) and rebuild explore_trails
-- on the real OSM data: hiking_routes + trail_metadata + trail_scores
--
-- hiking_routes  : 1 169 rows — geometry, distance, name, ref, network
-- trail_metadata : 1 163 rows — difficulty, duration, elevation, terrain
-- trail_scores   : 1 169 rows — adventure/nature/panorama/accessibility/challenge/services
--
-- Timestamp: 20260717141200
-- ============================================================

-- 1. Drop the old view that depended on hiking_trails
DROP VIEW IF EXISTS public.explore_trails;

-- 2. Drop all RLS policies on hiking_trails
DROP POLICY IF EXISTS "trails_public_read" ON public.hiking_trails;
DROP POLICY IF EXISTS "public_read_hiking_trails" ON public.hiking_trails;
DROP POLICY IF EXISTS "allow_read_hiking_trails" ON public.hiking_trails;
DROP POLICY IF EXISTS "hiking_trails_public_read" ON public.hiking_trails;
DROP POLICY IF EXISTS "authenticated_insert_hiking_trails" ON public.hiking_trails;
DROP POLICY IF EXISTS "authenticated_update_hiking_trails" ON public.hiking_trails;
DROP POLICY IF EXISTS "authenticated_delete_hiking_trails" ON public.hiking_trails;

-- 3. Drop indexes on hiking_trails
DROP INDEX IF EXISTS public.idx_hiking_trails_geojson;
DROP INDEX IF EXISTS public.idx_hiking_trails_difficulty;
DROP INDEX IF EXISTS public.idx_hiking_trails_distance;
DROP INDEX IF EXISTS public.idx_hiking_trails_region;
DROP INDEX IF EXISTS public.idx_hiking_trails_osm_id;
DROP INDEX IF EXISTS public.idx_hiking_trails_name;
DROP INDEX IF EXISTS public.idx_hiking_trails_bbox;
DROP INDEX IF EXISTS public.idx_hiking_trails_gps_points_count;
DROP INDEX IF EXISTS public.idx_hiking_trails_source;

-- 4. Drop the hiking_trails table (CASCADE handles any remaining dependents)
DROP TABLE IF EXISTS public.hiking_trails CASCADE;

-- 5. Rebuild explore_trails view on real OSM tables
--    - geometry: ST_AsGeoJSON converts PostGIS geom → GeoJSON object
--    - bbox: derived from ST_Envelope of the geometry
--    - start point: first point of the first linestring
CREATE OR REPLACE VIEW public.explore_trails AS
SELECT
  r.id::text                                                         AS id,
  COALESCE(r.name, 'Itinéraire ' || r.id::text)                     AS name,
  ST_AsGeoJSON(r.geom)::jsonb                                        AS geometry,
  COALESCE(r.distance_km, 0)                                         AS distance_km,
  COALESCE(m.duration_hours, 0)                                      AS duration_hours,
  COALESCE(m.difficulty, 'moderate')                                 AS difficulty,
  COALESCE(m.elevation_gain, 0)                                      AS elevation_gain,
  -- Real scores from trail_scores, fallback computed from difficulty+elevation
  COALESCE(s.adventure_score,
    GREATEST(20, LEAST(100,
      CASE COALESCE(m.difficulty, 'moderate')
        WHEN 'easy'     THEN 55
        WHEN 'moderate' THEN 70
        WHEN 'hard'     THEN 82
        WHEN 'expert'   THEN 92
        ELSE 65
      END + COALESCE(m.elevation_gain, 0) / 100
    ))
  )                                                                   AS adventure_score,
  COALESCE(s.nature_score,
    GREATEST(40, LEAST(100, 60 + COALESCE(m.elevation_gain, 0) / 80))
  )                                                                   AS nature_score,
  COALESCE(s.panorama_score,
    GREATEST(30, LEAST(100, 50 + COALESCE(m.elevation_gain, 0) / 60))
  )                                                                   AS panorama_score,
  COALESCE(s.accessibility_score,
    CASE COALESCE(m.difficulty, 'moderate')
      WHEN 'easy'     THEN 90
      WHEN 'moderate' THEN 70
      WHEN 'hard'     THEN 45
      WHEN 'expert'   THEN 25
      ELSE 60
    END
  )                                                                   AS accessibility_score,
  COALESCE(s.challenge_score,
    CASE COALESCE(m.difficulty, 'moderate')
      WHEN 'easy'     THEN 30
      WHEN 'moderate' THEN 55
      WHEN 'hard'     THEN 78
      WHEN 'expert'   THEN 95
      ELSE 50
    END
  )                                                                   AS challenge_score,
  COALESCE(s.services_score, 50)                                     AS services_score,
  -- Bounding box derived from geometry envelope
  ST_YMin(ST_Envelope(r.geom))                                       AS bbox_min_lat,
  ST_XMin(ST_Envelope(r.geom))                                       AS bbox_min_lng,
  ST_YMax(ST_Envelope(r.geom))                                       AS bbox_max_lat,
  ST_XMax(ST_Envelope(r.geom))                                       AS bbox_max_lng,
  -- Start point: first point of the geometry
  ST_Y(ST_StartPoint(ST_GeometryN(r.geom, 1)))                       AS start_lat,
  ST_X(ST_StartPoint(ST_GeometryN(r.geom, 1)))                       AS start_lng,
  -- Extra metadata for display
  r.ref,
  r.network,
  m.terrain_type,
  m.family_friendly,
  m.season,
  m.ai_description
FROM public.hiking_routes r
LEFT JOIN public.trail_metadata m ON m.trail_id = r.id
LEFT JOIN public.trail_scores   s ON s.trail_id = r.id
WHERE r.geom IS NOT NULL;

-- 6. Grant public read access on the view
GRANT SELECT ON public.explore_trails TO anon, authenticated;
