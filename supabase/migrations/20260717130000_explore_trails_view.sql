-- ============================================================
-- Explorer: explore_trails view — READ-ONLY frontend view
-- Timestamp: 20260717130000
--
-- IMPORTANT: This migration only ensures the explore_trails view
-- exists and is accessible. It does NOT modify any tables,
-- does NOT insert any data, and does NOT alter hiking_trails.
--
-- The real data (1173+ OSM itineraries) is already present in
-- the hiking_trails table, populated by the OSM import pipeline.
--
-- Source: public.hiking_trails (OSM data)
-- Consumer: /explorer frontend page via Supabase JS client
-- ============================================================

-- Ensure the explore_trails view exists and exposes all fields
-- needed by the frontend ExploreTrail interface.
-- Uses CREATE OR REPLACE so it is safe to re-run.
CREATE OR REPLACE VIEW public.explore_trails AS
SELECT
  id,
  name,
  ref,
  network,
  geojson                                                    AS geometry,
  COALESCE(distance_km, 0)                                   AS distance_km,
  COALESCE(duration_hours, 0)                                AS duration_hours,
  COALESCE(difficulty, 'moderate')                           AS difficulty,
  COALESCE(elevation_gain_m, 0)                              AS elevation_gain,
  terrain_type,
  COALESCE(family_friendly, false)                           AS family_friendly,
  season,
  ai_description,
  -- Adventure scores: use stored value if present, otherwise derive from difficulty/elevation
  CASE WHEN adventure_score > 0 THEN adventure_score
       ELSE GREATEST(20, LEAST(100,
         CASE difficulty
           WHEN 'easy'     THEN 55
           WHEN 'moderate' THEN 70
           WHEN 'hard'     THEN 82
           WHEN 'expert'   THEN 92
           ELSE 65
         END
         + COALESCE(elevation_gain_m, 0) / 100
       ))
  END                                                        AS adventure_score,
  CASE WHEN nature_score > 0 THEN nature_score
       ELSE GREATEST(40, LEAST(100, 60 + COALESCE(elevation_gain_m, 0) / 80))
  END                                                        AS nature_score,
  CASE WHEN panorama_score > 0 THEN panorama_score
       ELSE GREATEST(30, LEAST(100, 50 + COALESCE(elevation_gain_m, 0) / 60))
  END                                                        AS panorama_score,
  CASE WHEN accessibility_score > 0 THEN accessibility_score
       ELSE CASE difficulty
              WHEN 'easy'     THEN 90
              WHEN 'moderate' THEN 70
              WHEN 'hard'     THEN 45
              WHEN 'expert'   THEN 25
              ELSE 60
            END
  END                                                        AS accessibility_score,
  CASE WHEN challenge_score > 0 THEN challenge_score
       ELSE CASE difficulty
              WHEN 'easy'     THEN 30
              WHEN 'moderate' THEN 55
              WHEN 'hard'     THEN 78
              WHEN 'expert'   THEN 95
              ELSE 50
            END
  END                                                        AS challenge_score,
  CASE WHEN services_score > 0 THEN services_score
       ELSE 50
  END                                                        AS services_score,
  -- POI flags
  COALESCE(has_water, false)     AS water,
  COALESCE(has_refuge, false)    AS refuge,
  COALESCE(has_camping, false)   AS camping,
  COALESCE(has_peak, false)      AS peak,
  COALESCE(has_viewpoint, false) AS viewpoint,
  COALESCE(has_parking, false)   AS parking,
  -- Coordinates for map centering and auto-zoom
  start_lat,
  start_lng,
  bbox_min_lat,
  bbox_min_lng,
  bbox_max_lat,
  bbox_max_lng
FROM public.hiking_trails
WHERE geojson IS NOT NULL;

-- Grant public read access on the view
GRANT SELECT ON public.explore_trails TO anon, authenticated;
