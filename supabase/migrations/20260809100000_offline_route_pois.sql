-- Prompt #4 (mode hors-ligne) — pack hors-ligne d'une randonnée.
-- `trail_route_pois` n'existe pas : les POIs associés à une route sont
-- récupérés par proximité géographique (ST_DWithin sur la géométrie de la route),
-- cohérent avec get_nearby_named_pois (Prompt #3).
-- SECURITY INVOKER + SET search_path, lecture seule (anon).

-- POIs situés à moins de p_radius_m de la géométrie d'une randonnée.
CREATE OR REPLACE FUNCTION public.get_route_pois(
  p_route_id bigint,
  p_radius_m double PRECISION DEFAULT 2000
)
RETURNS TABLE (
  id bigint,
  name text,
  category text,
  distance_m double precision,
  elevation_m text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    tp.id,
    tp.name,
    tp.category,
    ST_Distance(tp.geom::geography, r.geom::geography) AS distance_m,
    tp.tags->>'ele' AS elevation_m
  FROM public.trail_pois tp
  JOIN public.hiking_routes r ON r.id = p_route_id
  WHERE tp.name IS NOT NULL
    AND ST_DWithin(tp.geom::geography, r.geom::geography, p_radius_m)
  ORDER BY distance_m
  LIMIT 50;
$$;

-- Bounding box d'une route agrandie de p_margin_m (500m par défaut) pour
-- calculer la liste de tuiles hors-ligne (Prompt #4, ÉTAPE 2).
CREATE OR REPLACE FUNCTION public.get_route_offline_bbox(
  p_route_id bigint,
  p_margin_m double PRECISION DEFAULT 500
)
RETURNS TABLE (
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    ST_YMin(e) AS min_lat,
    ST_XMin(e) AS min_lng,
    ST_YMax(e) AS max_lat,
    ST_XMax(e) AS max_lng
  FROM (
    SELECT ST_Envelope(ST_Buffer(geom::geography, p_margin_m)::geometry) AS e
    FROM public.hiking_routes
    WHERE id = p_route_id
  ) b;
$$;