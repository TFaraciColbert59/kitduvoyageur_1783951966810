-- CHANTIER ATLAS — Phase 1 — Data layer de l'explorateur unifié
--
-- Objectif : remplacer le filtre viewport non indexé sur explore_trails.start_lat/start_lng
-- par une RPC PostGIS indexée (idx_hiking_routes_geom) + vues matérialisées de densité.
--
-- ATLAS-R2 : géo via ST_Intersects sur colonne indexée GIST.
-- ATLAS-R1 : migration additive et idempotente.

-- ── 0) Index expression sur le point de départ (attribution pays) ─────────────
-- ST_GeometryN et ST_StartPoint sont IMMUTABLE : index d'expression valide.
CREATE INDEX IF NOT EXISTS idx_hiking_routes_startpoint
  ON public.hiking_routes
  USING gist ((ST_StartPoint(ST_GeometryN(geom, 1))));

-- ── 1) RPC viewport indexée ────────────────────────────────────────────────────
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
  WITH env AS (
    SELECT ST_MakeEnvelope(
      GREATEST(p_min_lng, -180)::double precision,
      GREATEST(p_min_lat, -85)::double precision,
      LEAST(p_max_lng, 180)::double precision,
      LEAST(p_max_lat, 85)::double precision,
      4326
    ) AS box
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
    AND (p_difficulty IS NULL OR m.difficulty ILIKE '%' || p_difficulty || '%')
    AND (p_search IS NULL OR r.name ILIKE '%' || p_search || '%')
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

-- ── 2) Vues matérialisées de densité ──────────────────────────────────────────

-- 2a) Centroïdes pays (remplace la dépendance aux countries_geo.geometry points NULL)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.country_centroids AS
SELECT
  c.iso_a2,
  c.name,
  ROUND(ST_Y(ST_Centroid(c.geometry))::numeric, 5) AS lat,
  ROUND(ST_X(ST_Centroid(c.geometry))::numeric, 5) AS lng
FROM public.countries_geo c
WHERE c.geometry IS NOT NULL
  AND GeometryType(c.geometry) IN ('POLYGON', 'MULTIPOLYGON');

CREATE UNIQUE INDEX IF NOT EXISTS idx_country_centroids_iso_a2
  ON public.country_centroids (iso_a2);

-- 2b) Densité de randonnées par pays
CREATE MATERIALIZED VIEW IF NOT EXISTS public.country_trail_density AS
SELECT
  c.iso_a2,
  c.name,
  COUNT(r.id)::bigint AS trail_count,
  COALESCE(SUM(r.distance_km), 0)::numeric(14,1) AS total_distance_km,
  ROUND(AVG(s.adventure_score)::numeric, 1) AS avg_adventure_score,
  ROUND(AVG(s.nature_score)::numeric, 1) AS avg_nature_score,
  ROUND(AVG(s.panorama_score)::numeric, 1) AS avg_panorama_score,
  ROUND(ST_Y(ST_Centroid(c.geometry))::numeric, 5) AS centroid_lat,
  ROUND(ST_X(ST_Centroid(c.geometry))::numeric, 5) AS centroid_lng
FROM public.countries_geo c
LEFT JOIN public.hiking_routes r
  ON r.geom IS NOT NULL
 AND ST_Contains(c.geometry, ST_StartPoint(ST_GeometryN(r.geom, 1)))
LEFT JOIN public.trail_scores s ON s.trail_id = r.id
WHERE c.geometry IS NOT NULL
  AND GeometryType(c.geometry) IN ('POLYGON', 'MULTIPOLYGON')
GROUP BY c.iso_a2, c.name, c.geometry;

CREATE UNIQUE INDEX IF NOT EXISTS idx_country_trail_density_iso_a2
  ON public.country_trail_density (iso_a2);

-- 2c) Densité par cellule geohash-5 (palier région)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.trail_density_geohash5 AS
SELECT
  ST_GeoHash(ST_StartPoint(ST_GeometryN(r.geom, 1)), 5) AS geohash,
  COUNT(*)::bigint AS trail_count,
  ROUND(AVG(r.distance_km)::numeric, 1) AS avg_distance_km,
  ROUND(AVG(s.adventure_score)::numeric, 1) AS avg_adventure_score,
  ROUND(ST_Y(ST_Centroid(ST_Collect(ST_StartPoint(ST_GeometryN(r.geom, 1)))))::numeric, 5) AS center_lat,
  ROUND(ST_X(ST_Centroid(ST_Collect(ST_StartPoint(ST_GeometryN(r.geom, 1)))))::numeric, 5) AS center_lng
FROM public.hiking_routes r
LEFT JOIN public.trail_scores s ON s.trail_id = r.id
WHERE r.geom IS NOT NULL
GROUP BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trail_density_geohash5_geohash
  ON public.trail_density_geohash5 (geohash);

-- 2d) Droits de lecture publique (matviews sans RLS : grants explicites)
REVOKE ALL ON public.country_centroids FROM PUBLIC;
REVOKE ALL ON public.country_trail_density FROM PUBLIC;
REVOKE ALL ON public.trail_density_geohash5 FROM PUBLIC;
GRANT SELECT ON public.country_centroids TO anon, authenticated, service_role;
GRANT SELECT ON public.country_trail_density TO anon, authenticated, service_role;
GRANT SELECT ON public.trail_density_geohash5 TO anon, authenticated, service_role;

-- ── 3) Rafraîchissement gardé (pattern refresh_kit_conservation) ──────────────
CREATE OR REPLACE FUNCTION public.refresh_atlas_density()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.country_centroids;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.country_centroids;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.country_trail_density;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.country_trail_density;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.trail_density_geohash5;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.trail_density_geohash5;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_atlas_density() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_atlas_density() TO service_role;
