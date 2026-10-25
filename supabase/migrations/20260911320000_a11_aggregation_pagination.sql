-- ==============================================================================
-- A11 — Intelligence collective : pagination déterministe de l'agrégation
--
-- Répond au constat #24 (limite globale de 5 000 passages monopolise le lot :
-- les segments très fréquentés peuvent écraser les autres) de l'audit.
--
-- Additif et idempotent. L'autorité DDL reste
-- `20260911133000_a1_collective_aggregates.sql` ; la fonction reprend la
-- signature de `20260911160000_a4_aggregation_support.sql` (même type de
-- retour, remplacement pur, aucun appelant cassé) :
--
--   • plafond déterministe par segment : les 500 passages éligibles les plus
--     récents (row_number() partitionné, départage stable par id) ;
--   • plafond global : 5 000 passages maximum retenus par exécution
--     (row_number() global, ordre déterministe) ;
--   • service_role uniquement, SECURITY DEFINER, search_path verrouillé.
-- ==============================================================================

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
  WITH eligible AS (
    SELECT
      p.segment_id,
      p.exited_at,
      p.id,
      row_number() OVER (
        PARTITION BY p.segment_id
        ORDER BY p.exited_at DESC, p.id DESC
      ) AS segment_rank
    FROM public.session_segment_passages p
    JOIN public.hike_sessions hs ON hs.id = p.session_id
    WHERE p.eligible_for_collective = true
      AND hs.processing_status = 'processed'
      AND p.exited_at >= now() - coalesce(p_since, interval '90 days')
  ),
  capped AS (
    -- Plafond déterministe par segment : un segment très fréquenté ne peut
    -- plus monopoliser le lot avec ses milliers de passages.
    SELECT segment_id, exited_at, id
    FROM eligible
    WHERE segment_rank <= 500
  ),
  ranked AS (
    SELECT
      segment_id,
      exited_at,
      id,
      row_number() OVER (
        ORDER BY exited_at DESC, segment_id, id
      ) AS global_rank
    FROM capped
  ),
  retained AS (
    -- Plafond global inchangé : au plus 5 000 passages par exécution, avec un
    -- ordre total stable (récence, puis segment, puis id).
    SELECT segment_id, exited_at
    FROM ranked
    WHERE global_rank <= 5000
  )
  SELECT
    r.segment_id,
    max(r.exited_at) AS last_exited_at,
    count(*) AS eligible_passage_count
  FROM retained r
  GROUP BY r.segment_id
  ORDER BY max(r.exited_at) DESC, r.segment_id
  LIMIT least(greatest(coalesce(p_limit, 500), 1), 2000);
$$;

COMMENT ON FUNCTION public.a4_recent_eligible_segments(interval, integer) IS
  'A4/A11 — segments portant des passages éligibles récents (eligible_for_collective, '
  'session traitée), plafonnés de façon déterministe : 500 passages maximum par '
  'segment (les plus récents, départage par id) puis 5 000 passages maximum au '
  'total. Agrégats uniquement, jamais d''identité. Réservé au traitement serveur '
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
