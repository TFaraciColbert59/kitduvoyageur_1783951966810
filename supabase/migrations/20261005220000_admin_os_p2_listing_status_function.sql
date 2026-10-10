-- ============================================================================
-- ADMIN OS P2-02 — set_listing_status() : restriction graduée marketplace.
-- DOWN: DROP FUNCTION IF EXISTS public.set_listing_status(uuid, text, text);
-- Voie UNIQUE de changement de statut admin (aucune policy UPDATE admin sur
-- listings) : has_permission('marketplace.listing.restrict') + statut
-- allowlisté + reason ≥ 10, atomique. Statuts : actif / restreinte / suspendue.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_listing_status(
  p_listing_id uuid,
  p_status text,
  p_reason text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reason text;
BEGIN
  IF p_status NOT IN ('actif', 'restreinte', 'suspendue') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;
  v_reason := btrim(coalesce(p_reason, ''));
  IF char_length(v_reason) < 10 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_permission('marketplace.listing.restrict') THEN
    RAISE EXCEPTION 'listing_forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.listings
     SET statut = p_status,
         updated_at = now()
   WHERE id = p_listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
  END IF;
  RETURN p_status;
END;
$$;

REVOKE ALL ON FUNCTION public.set_listing_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_listing_status(uuid, text, text) TO authenticated;
