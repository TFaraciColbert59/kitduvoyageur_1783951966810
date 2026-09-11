-- ==============================================================================
-- A2 — Traitement GPS, segmentation et map-matching (Phase 2)
-- M10 : RPC candidats de segments + claim des sessions à traiter.
-- Migration additive et idempotente. RLS inchangée.
--
--   • a2_segment_candidates(lat, lng, radius) : segments proches (GIST),
--     distance géographique, azimut et tags OSM — STABLE, SECURITY INVOKER,
--     lecture de données OSM publiques (authenticated / service_role).
--   • a2_claim_pending_sessions(limit) : réserve atomiquement des sessions
--     `pending` (SKIP LOCKED) — SECURITY DEFINER, service_role uniquement.
-- Aucun agrégat collectif n'est publié ici (Phase 4).
-- ==============================================================================

-- ── 1. Candidats de segments autour d'un point ────────────────────────────────
CREATE OR REPLACE FUNCTION public.a2_segment_candidates(
  p_lat float8,
  p_lng float8,
  p_radius_m float8 DEFAULT 50
)
RETURNS TABLE (
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
  WITH search_point AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS geog
  )
  SELECT
    ts.id AS segment_id,
    ST_Distance(ts.geom::geography, sp.geog) AS distance_m,
    degrees(ST_Azimuth(ST_StartPoint(ts.geom), ST_EndPoint(ts.geom)))::float8 AS bearing_deg,
    ts.highway,
    ts.surface,
    ts.sac_scale
  FROM public.trail_segments ts
  CROSS JOIN search_point sp
  WHERE ST_DWithin(ts.geom::geography, sp.geog, greatest(p_radius_m, 0.1))
  ORDER BY distance_m
  LIMIT 5;
$$;

COMMENT ON FUNCTION public.a2_segment_candidates(float8, float8, float8) IS
  'A2 — segments trail_segments proches d''un point (rayon m), triés par '
  'distance croissante (max 5) avec azimut et tags OSM. STABLE, invoker : '
  'les données OSM sont publiques, la RLS reste appliquée.';

REVOKE ALL ON FUNCTION public.a2_segment_candidates(float8, float8, float8) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.a2_segment_candidates(float8, float8, float8) FROM anon;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.a2_segment_candidates(float8, float8, float8)
  TO authenticated, service_role;

-- ── 2. Claim atomique des sessions à traiter (traitement serveur) ─────────────
CREATE OR REPLACE FUNCTION public.a2_claim_pending_sessions(p_limit integer DEFAULT 5)
RETURNS SETOF public.hike_sessions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.hike_sessions
  SET processing_status = 'processing',
      updated_at = now()
  WHERE id IN (
    SELECT id FROM public.hike_sessions
    WHERE processing_status = 'pending'
    ORDER BY started_at
    LIMIT greatest(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

COMMENT ON FUNCTION public.a2_claim_pending_sessions(integer) IS
  'A2 — réserve atomiquement jusqu''à p_limit sessions hike_sessions '
  'processing_status = pending (SKIP LOCKED) en les passant à processing. '
  'Réservé au traitement serveur (service_role).';

REVOKE ALL ON FUNCTION public.a2_claim_pending_sessions(integer) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.a2_claim_pending_sessions(integer) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.a2_claim_pending_sessions(integer) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.a2_claim_pending_sessions(integer) TO service_role;
