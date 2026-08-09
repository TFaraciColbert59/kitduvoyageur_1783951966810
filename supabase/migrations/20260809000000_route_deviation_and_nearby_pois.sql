-- Prompt #3 (sortie d'itinéraire) + Prompt #10 (boussole augmentée)
-- Fonctions PostGIS SECURITY INVOKER, lecture seule (anon), cohérentes avec le pattern get_nearby_trails.

-- Distance/direction de l'utilisateur vers le tracé le plus proche d'une randonnée.
CREATE OR REPLACE FUNCTION public.get_route_deviation(
  p_route_id bigint,
  p_lat double precision,
  p_lon double precision
)
RETURNS TABLE(
  distance_m numeric,
  closest_lat double precision,
  closest_lon double precision,
  bearing_deg numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    ST_Distance(h.geom::geography, p.pt::geography) AS distance_m,
    ST_Y(ST_ClosestPoint(h.geom, p.pt)) AS closest_lat,
    ST_X(ST_ClosestPoint(h.geom, p.pt)) AS closest_lon,
    degrees(ST_Azimuth(p.pt, ST_ClosestPoint(h.geom, p.pt))) AS bearing_deg
  FROM public.hiking_routes h,
       LATERAL (SELECT ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326) AS pt) p
  WHERE h.id = p_route_id;
$$;

-- POIs només proches de la position (boussole augmentée, Prompt #10).
CREATE OR REPLACE FUNCTION public.get_nearby_named_pois(
  p_lat double precision,
  p_lon double precision,
  p_radius_m integer DEFAULT 15000
)
RETURNS TABLE (
  id bigint,
  name text,
  category text,
  distance_m numeric,
  bearing_deg numeric,
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
    ST_Distance(tp.geom::geography, p.pt::geography) AS distance_m,
    degrees(ST_Azimuth(p.pt, tp.geom)) AS bearing_deg,
    tp.tags->>'ele' AS elevation_m
  FROM public.trail_pois tp,
       LATERAL (SELECT ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326) AS pt) p
  WHERE tp.name IS NOT NULL
    AND tp.category IN ('peak', 'viewpoint', 'waterfall', 'shelter', 'refuge')
    AND ST_DWithin(tp.geom::geography, p.pt::geography, p_radius_m)
  ORDER BY ST_Distance(tp.geom::geography, p.pt::geography)
  LIMIT 20;
$$;