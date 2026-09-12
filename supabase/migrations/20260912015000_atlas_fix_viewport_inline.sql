-- CHANTIER ATLAS — Phase 1 (correctif) — RPC inlinable + EXPLAIN forçable
--
-- Constat sur le remote (2026-09-12) :
--   - EXPLAIN ANALYZE via la RPC affichait seulement « Function Scan » car les CTE
--     empêchent l'inlining des fonctions SQL → impossible de prouver l'index GIST.
--   - hiking_routes ne contient que 1 169 lignes en prod (pas 115 000) : le planner
--     choisit légitimement un Seq Scan ; la preuve d'utilisabilité de l'index se fait
--     donc avec enable_seqscan = off.
--
-- Correctifs :
--   1. trails_in_viewport réécrite SANS CTE (expressions inline → inlining possible).
--   2. atlas_debug_explain(text, boolean) : permet de forcer enable_seqscan=off
--      pour la capture de preuve (fonction temporaire, service_role uniquement).

-- 1) RPC viewport sans CTE (même signature, même type de retour)
CREATE OR REPLACE FUNCTION public.trails_in_viewport(
  p_min_lng double precision,
  p_min_lat double precision,
  p_max_lng double precision,
  p_max_lat double precision,
  p_zoom smallint DEFAULT 14,
  p_simplify_tolerance double precision DEFAULT 0,
  p_min_dist double precision DEFAULT 2.0,
  p_max_dist double precision DEFAULT NULL,
  p_difficulty text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_include_short boolean DEFAULT false,
  p_limit integer DEFAULT 300
)
RETURNS TABLE (
  id text,
  name text,
  start_lat double precision,
  start_lng double precision,
  distance_km numeric,
  duration_hours numeric,
  difficulty text,
  elevation_gain integer,
  adventure_score numeric,
  nature_score numeric,
  panorama_score numeric,
  ref text,
  network text,
  terrain_type text,
  family_friendly boolean,
  season text,
  ai_description text,
  geometry jsonb
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    r.id::text,
    r.name,
    ST_Y(ST_StartPoint(ST_GeometryN(r.geom, 1))) AS start_lat,
    ST_X(ST_StartPoint(ST_GeometryN(r.geom, 1))) AS start_lng,
    r.distance_km,
    m.duration_hours,
    m.difficulty,
    m.elevation_gain,
    s.adventure_score,
    s.nature_score,
    s.panorama_score,
    r.ref,
    r.network,
    m.terrain_type,
    m.family_friendly,
    m.season,
    m.ai_description,
    ST_AsGeoJSON(
      ST_SimplifyPreserveTopology(
        r.geom,
        GREATEST(
          p_simplify_tolerance,
          CASE
            WHEN p_zoom >= 14 THEN 0.00015
            WHEN p_zoom >= 11 THEN 0.0006
            WHEN p_zoom >= 8  THEN 0.0025
            WHEN p_zoom >= 4  THEN 0.012
            ELSE 0.05
          END
        )
      )
    )::jsonb AS geometry
  FROM public.hiking_routes r
  LEFT JOIN public.trail_metadata m ON m.trail_id = r.id
  LEFT JOIN public.trail_scores s ON s.trail_id = r.id
  WHERE r.geom IS NOT NULL
    AND r.geom && ST_MakeEnvelope(
      GREATEST(p_min_lng, -180)::double precision,
      GREATEST(p_min_lat, -85)::double precision,
      LEAST(p_max_lng, 180)::double precision,
      LEAST(p_max_lat, 85)::double precision,
      4326
    )
    AND ST_Intersects(r.geom, ST_MakeEnvelope(
      GREATEST(p_min_lng, -180)::double precision,
      GREATEST(p_min_lat, -85)::double precision,
      LEAST(p_max_lng, 180)::double precision,
      LEAST(p_max_lat, 85)::double precision,
      4326
    ))
    AND (p_include_short OR COALESCE(r.distance_km, 0) >= p_min_dist)
    AND (p_max_dist IS NULL OR (r.distance_km IS NOT NULL AND r.distance_km <= p_max_dist))
    AND (p_difficulty IS NULL OR m.difficulty ILIKE '%' || p_difficulty || '%')
    AND (p_search IS NULL OR r.name ILIKE '%' || p_search || '%')
  ORDER BY r.distance_km DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit, 1), 300);
$$;

-- 2) EXPLAIN forçable (remplace la version 1 paramètre)
DROP FUNCTION IF EXISTS public.atlas_debug_explain(text);

CREATE OR REPLACE FUNCTION public.atlas_debug_explain(
  p_query text,
  p_disable_seqscan boolean DEFAULT false
)
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_disable_seqscan THEN
    SET LOCAL enable_seqscan = off;
  END IF;
  RETURN QUERY EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ' || p_query;
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_debug_explain(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_debug_explain(text, boolean) TO service_role;
