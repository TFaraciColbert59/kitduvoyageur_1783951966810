-- ==============================================================================
-- A10 (10.6) — Map-matching batch PostGIS
--
-- Audit 31bdb279 item #7 : le traitement appelait `a2_segment_candidates` pour
-- chaque coordonnée arrondie distincte (jusqu'à des milliers de RPC
-- séquentielles : timeout du cron, coût BDD, contention Postgres).
--
--   • a2_match_track_candidates(p_points jsonb, p_radius_m float8) : un seul
--     appel pour toute la trace échantillonnée. Développe le tableau JSON,
--     filtre par boîte englobante GIST (`geom && ST_Expand`) puis
--     `ST_DWithin(geom::geography, ...)` en LATERAL, et ne garde que les 5
--     meilleurs candidats par point (row_number).
--
-- Migration additive et idempotente. Données OSM publiques : SECURITY INVOKER
-- (RLS appliquée), authenticated / service_role.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.a2_match_track_candidates(
  p_points jsonb,
  p_radius_m float8 DEFAULT 35
)
RETURNS TABLE (
  point_index integer,
  segment_id bigint,
  distance_m float8,
  bearing_deg float8,
  highway text,
  surface text,
  sac_scale text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH input AS (
    SELECT
      (ordinality - 1)::integer AS point_index,
      (point->>'lat')::float8 AS lat,
      (point->>'lng')::float8 AS lng,
      ST_SetSRID(
        ST_MakePoint((point->>'lng')::float8, (point->>'lat')::float8),
        4326
      )::geography AS geog
    FROM jsonb_array_elements(COALESCE(p_points, '[]'::jsonb))
      WITH ORDINALITY AS entry(point, ordinality)
  ),
  ranked AS (
    SELECT
      i.point_index,
      ts.id AS segment_id,
      ST_Distance(ts.geom::geography, i.geog) AS distance_m,
      degrees(ST_Azimuth(ST_StartPoint(ts.geom), ST_EndPoint(ts.geom)))::float8 AS bearing_deg,
      ts.highway,
      ts.surface,
      ts.sac_scale,
      row_number() OVER (
        PARTITION BY i.point_index
        ORDER BY ST_Distance(ts.geom::geography, i.geog)
      ) AS distance_rank
    FROM input i
    JOIN LATERAL (
      SELECT segment.*
      FROM public.trail_segments segment
      WHERE
        -- Pré-filtre GIST (index idx_trail_segments_geom) : boîte en degrés
        -- corrigée en longitude par cos(latitude), puis distance précise.
        segment.geom && ST_Expand(
          i.geog::geometry,
          (greatest(p_radius_m, 0.1) / 111320.0)
            / greatest(cos(radians(i.lat)), 0.01)
        )
        AND ST_DWithin(segment.geom::geography, i.geog, greatest(p_radius_m, 0.1))
    ) AS ts ON true
  )
  SELECT
    ranked.point_index,
    ranked.segment_id,
    ranked.distance_m,
    ranked.bearing_deg,
    ranked.highway,
    ranked.surface,
    ranked.sac_scale
  FROM ranked
  WHERE ranked.distance_rank <= 5
  ORDER BY ranked.point_index, ranked.distance_m;
$$;

COMMENT ON FUNCTION public.a2_match_track_candidates(jsonb, float8) IS
  'A10 — candidats trail_segments pour toute une trace en un appel : entrée '
  'jsonb [{ lat, lng }, …], pré-filtre GIST (ST_Expand) + ST_DWithin '
  'géographique, 5 candidats max par point triés par distance. Remplace la '
  'boucle N+1 de a2_segment_candidates. Données OSM publiques : invoker, '
  'authenticated / service_role.';

REVOKE ALL ON FUNCTION public.a2_match_track_candidates(jsonb, float8) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.a2_match_track_candidates(jsonb, float8) FROM anon;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.a2_match_track_candidates(jsonb, float8)
  TO authenticated, service_role;
