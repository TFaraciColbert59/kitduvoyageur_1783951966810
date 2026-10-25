-- ============================================================
-- Explorer: explore_trails view — READ-ONLY frontend view
-- Timestamp: 20260717130000
--
-- IMPORTANT: This migration only ensures the explore_trails view
-- exists and is accessible. It does NOT modify any tables,
-- does NOT insert any data, and does NOT alter hiking_trails.
--
-- The real data is already present in the hiking_trails table.
--
-- Source: public.hiking_trails
-- Consumer: /explorer frontend page via Supabase JS client
-- ============================================================

DROP VIEW IF EXISTS public.explore_trails CASCADE;

CREATE OR REPLACE VIEW public.explore_trails AS
SELECT
  id,
  name,
  geojson                                                    AS geometry,
  COALESCE(distance_km, 0)                                   AS distance_km,
  COALESCE(duration_hours, 0)                                AS duration_hours,
  COALESCE(difficulty, 'moderate')                           AS difficulty,
  COALESCE(elevation_gain_m, 0)                              AS elevation_gain,
  -- Adventure scores derived from difficulty and elevation
  GREATEST(20, LEAST(100,
    CASE COALESCE(difficulty, 'moderate')
      WHEN 'easy'     THEN 55
      WHEN 'moderate' THEN 70
      WHEN 'hard'     THEN 82
      WHEN 'expert'   THEN 92
      ELSE 65
    END
    + COALESCE(elevation_gain_m, 0) / 100
  ))                                                         AS adventure_score,
  GREATEST(40, LEAST(100, 60 + COALESCE(elevation_gain_m, 0) / 80))
                                                             AS nature_score,
  GREATEST(30, LEAST(100, 50 + COALESCE(elevation_gain_m, 0) / 60))
                                                             AS panorama_score,
  CASE COALESCE(difficulty, 'moderate')
    WHEN 'easy'     THEN 90
    WHEN 'moderate' THEN 70
    WHEN 'hard'     THEN 45
    WHEN 'expert'   THEN 25
    ELSE 60
  END                                                        AS accessibility_score,
  CASE COALESCE(difficulty, 'moderate')
    WHEN 'easy'     THEN 30
    WHEN 'moderate' THEN 55
    WHEN 'hard'     THEN 78
    WHEN 'expert'   THEN 95
    ELSE 50
  END                                                        AS challenge_score,
  50                                                         AS services_score,
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
