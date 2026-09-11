-- ==============================================================================
-- A4 — Intelligence collective des sentiers (Phase 4)
-- Support d'agrégation : index partiel passages + RPC segments éligibles.
-- Migration additive et idempotente. Aucune donnée individuelle exposée.
--
--   • idx_session_segment_passages_collective_recent : accélère la lecture des
--     passages éligibles récents par segment. `exited_at` est l'horodatage
--     d'observation retenu pour un passage (aligné sur
--     performance_observations.observed_at via passage_id).
--   • a4_recent_eligible_segments(since, limit) : segments portant des passages
--     éligibles récents, sessions terminées. RPC STABLE, SECURITY DEFINER avec
--     search_path verrouillé, réservée à service_role (REVOKE anon/authenticated).
-- L'index performance_observations(user_id, observed_at) existe déjà (A1).
-- ==============================================================================

-- ── 1. Index partiel des passages éligibles récents ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_session_segment_passages_collective_recent
  ON public.session_segment_passages(segment_id, exited_at DESC)
  WHERE eligible_for_collective = true;

COMMENT ON INDEX public.idx_session_segment_passages_collective_recent IS
  'A4 — passages éligibles au collectif, par segment, du plus récent au plus '
  'ancien (exited_at = horodatage d''observation du passage).';

-- ── 2. Segments à agréger (passages éligibles récents) ───────────────────────
CREATE OR REPLACE FUNCTION public.a4_recent_eligible_segments(
  p_since interval DEFAULT '90 days',
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  segment_id bigint,
  last_exited_at timestamptz,
  eligible_passage_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.segment_id,
    max(p.exited_at) AS last_exited_at,
    count(*) AS eligible_passage_count
  FROM public.session_segment_passages p
  JOIN public.hike_sessions hs ON hs.id = p.session_id
  WHERE p.eligible_for_collective = true
    AND hs.processing_status = 'processed'
    AND p.exited_at >= now() - coalesce(p_since, interval '90 days')
  GROUP BY p.segment_id
  ORDER BY max(p.exited_at) DESC
  LIMIT least(greatest(coalesce(p_limit, 500), 1), 2000);
$$;

COMMENT ON FUNCTION public.a4_recent_eligible_segments(interval, integer) IS
  'A4 — segments portant des passages éligibles récents (eligible_for_collective, '
  'session traitée), avec dernier horodatage d''observation et volume de passages. '
  'Agrégats uniquement, jamais d''identité. Réservé au traitement serveur '
  '(service_role), search_path verrouillé.';

REVOKE ALL ON FUNCTION public.a4_recent_eligible_segments(interval, integer) FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.a4_recent_eligible_segments(interval, integer) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.a4_recent_eligible_segments(interval, integer) FROM authenticated;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.a4_recent_eligible_segments(interval, integer)
  TO service_role;
