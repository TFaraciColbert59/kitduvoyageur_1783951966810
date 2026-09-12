-- CHANTIER ATLAS — Phase 6 — Bornes défensives DANS la RPC.
--
-- La RPC est exposée à anon/authenticated via PostgREST : les gardes HTTP
-- (clamp 20°, rate limit, longueur de recherche) ne protègent pas les appels
-- directs à /rest/v1/rpc/trails_in_viewport. On borne donc l'emprise et la
-- recherche au niveau SQL, pour que TOUTE voie soit bornée (invariant sécurité).
--
-- Rappel : la fonction n'est pas inlinée (Function Scan vérifié dans la preuve
-- Phase 1) — les CTE n'ont donc aucun coût de plan ; la preuve d'usage de
-- l'index GIST reste la requête de base équivalente (docs/atlas/phase1-proof).

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
  WITH raw AS (
    SELECT
      GREATEST(p_min_lng, -180)::double precision AS min_lng,
      LEAST(p_max_lng, 180)::double precision AS max_lng,
      GREATEST(p_min_lat, -85)::double precision AS min_lat,
      LEAST(p_max_lat, 85)::double precision AS max_lat
  ),
  clamped AS (
    SELECT
      CASE
        WHEN max_lng - min_lng > 20 THEN GREATEST(LEAST((min_lng + max_lng) / 2 - 10, 180), -180)
        ELSE min_lng
      END AS min_lng,
      CASE
        WHEN max_lng - min_lng > 20 THEN LEAST(GREATEST((min_lng + max_lng) / 2 + 10, -180), 180)
        ELSE max_lng
      END AS max_lng,
      CASE
        WHEN max_lat - min_lat > 20 THEN GREATEST(LEAST((min_lat + max_lat) / 2 - 10, 85), -85)
        ELSE min_lat
      END AS min_lat,
      CASE
        WHEN max_lat - min_lat > 20 THEN LEAST(GREATEST((min_lat + max_lat) / 2 + 10, -85), 85)
        ELSE max_lat
      END AS max_lat
    FROM raw
  ),
  env AS (
    SELECT ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326) AS box FROM clamped
  ),
  bounds AS (
    SELECT
      LEAST(GREATEST(p_limit, 1), 300) AS lim,
      CASE
        WHEN p_zoom >= 14 THEN 0.00015
        WHEN p_zoom >= 11 THEN 0.0006
        WHEN p_zoom >= 8  THEN 0.0025
        WHEN p_zoom >= 4  THEN 0.012
        ELSE 0.05
      END AS default_tol
  )
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
        GREATEST(p_simplify_tolerance, bounds.default_tol)
      )
    )::jsonb AS geometry
  FROM public.hiking_routes r
  CROSS JOIN env
  CROSS JOIN bounds
  LEFT JOIN public.trail_metadata m ON m.trail_id = r.id
  LEFT JOIN public.trail_scores s ON s.trail_id = r.id
  WHERE r.geom IS NOT NULL
    AND r.geom && env.box
    AND ST_Intersects(r.geom, env.box)
    AND (p_include_short OR COALESCE(r.distance_km, 0) >= p_min_dist)
    AND (p_max_dist IS NULL OR (r.distance_km IS NOT NULL AND r.distance_km <= p_max_dist))
    AND (p_difficulty IS NULL OR m.difficulty ILIKE '%' || LEFT(p_difficulty, 40) || '%')
    AND (p_search IS NULL OR r.name ILIKE '%' || LEFT(p_search, 100) || '%')
  ORDER BY r.distance_km DESC NULLS LAST
  LIMIT (SELECT lim FROM bounds);
$$;

REVOKE ALL ON FUNCTION public.trails_in_viewport(
  double precision, double precision, double precision, double precision,
  smallint, double precision, double precision, double precision,
  text, text, boolean, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trails_in_viewport(
  double precision, double precision, double precision, double precision,
  smallint, double precision, double precision, double precision,
  text, text, boolean, integer
) TO anon, authenticated, service_role;
