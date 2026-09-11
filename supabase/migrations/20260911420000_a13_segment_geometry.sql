-- ==============================================================================
-- A13 (S1) — Géométries de segments pour l'ETA réelle bout-en-bout
--
-- Le flux ETA réel (server/routePrediction.ts) mappe une polyline de route sur
-- les segments OSM (`a2_match_track_candidates`), puis a besoin de la géométrie
-- complète des segments retenus pour calculer leurs caractéristiques (A2
-- `computeSegmentFeatures`) avant prédiction (A3).
--
--   • a13_segment_geometries(p_ids bigint[]) : un seul appel pour tout un lot
--     de segments — `= ANY(p_ids)`, ordre stable par id, GeoJSON + tags OSM ;
--   • bornée à 500 ids par appel : au-delà, exception explicite (jamais de
--     troncature silencieuse) ;
--   • STABLE + SECURITY INVOKER : lecture OSM publique, RLS appliquée, aucune
--     écriture possible (fonction stable) ;
--   • lecture seule ouverte à anon / authenticated / service_role.
--
-- Migration additive et idempotente. Aucune donnée inventée : les colonnes
-- absentes restent NULL.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.a13_segment_geometries(p_ids bigint[])
RETURNS TABLE (
  id bigint,
  geojson jsonb,
  surface text,
  sac_scale text,
  highway text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF p_ids IS NOT NULL AND cardinality(p_ids) > 500 THEN
    RAISE EXCEPTION 'a13_segment_geometries: 500 ids maximum par appel (reçu %)',
      cardinality(p_ids);
  END IF;

  RETURN QUERY
  SELECT
    ts.id,
    ST_AsGeoJSON(ts.geom)::jsonb AS geojson,
    ts.surface,
    ts.sac_scale,
    ts.highway
  FROM public.trail_segments AS ts
  WHERE ts.id = ANY (COALESCE(p_ids, '{}'::bigint[]))
  ORDER BY ts.id;
END;
$fn$;

COMMENT ON FUNCTION public.a13_segment_geometries(bigint[]) IS
  'A13 (S1) — géométrie GeoJSON et tags OSM (surface, sac_scale, highway) d''un '
  'lot de segments trail_segments (max 500 ids par appel, = ANY). STABLE, '
  'SECURITY INVOKER : données OSM publiques, RLS appliquée, lecture seule '
  'ouverte à anon / authenticated / service_role.';

REVOKE ALL ON FUNCTION public.a13_segment_geometries(bigint[]) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.a13_segment_geometries(bigint[]) TO anon;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.a13_segment_geometries(bigint[])
  TO authenticated, service_role;
