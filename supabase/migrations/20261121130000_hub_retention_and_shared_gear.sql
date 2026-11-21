-- ============================================================================
-- Migration additive : Rétention/purge éphémère (P01-15), taille de groupe
-- canonique (P02-09), attribution d'objets partagés (P07-38) et index FK (P01-10).
-- ============================================================================

-- 1. Index FK ciblés sur les tables HUB (P01-10)
CREATE INDEX IF NOT EXISTS idx_trip_lifecycle_events_actor
  ON public.trip_lifecycle_events (actor_id);

CREATE INDEX IF NOT EXISTS idx_trip_safety_contacts_owner
  ON public.trip_safety_contacts (owner_id);

CREATE INDEX IF NOT EXISTS idx_hub_field_reports_trip
  ON public.hub_field_reports (trip_id)
  WHERE trip_id IS NOT NULL;

-- 2. Taille de groupe canonique sans doublon (P02-09)
CREATE OR REPLACE FUNCTION public.get_trip_effective_party_size(p_trip_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH members AS (
    SELECT t.user_id AS uid
    FROM public.trips t
    WHERE t.id = p_trip_id
    UNION
    SELECT tc.user_id AS uid
    FROM public.trip_collaborators tc
    WHERE tc.trip_id = p_trip_id AND tc.user_id IS NOT NULL
    UNION
    SELECT tp.user_id AS uid
    FROM public.trip_participants tp
    WHERE tp.trip_id = p_trip_id AND tp.status = 'confirmed' AND tp.user_id IS NOT NULL
  )
  SELECT count(DISTINCT uid)::integer FROM members;
$$;

REVOKE ALL ON FUNCTION public.get_trip_effective_party_size(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trip_effective_party_size(uuid) TO authenticated;

-- 3. Attribution d'un objet partagé du kit à un porteur (P07-38)
CREATE OR REPLACE FUNCTION public.assign_trip_shared_item(
  p_trip_id uuid,
  p_item_id uuid,
  p_owner_id uuid
)
RETURNS TABLE (id uuid, owner_id uuid, ownership text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_edit_trip(p_trip_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  UPDATE public.trip_items ti
  SET ownership = 'shared',
      owner_id = p_owner_id,
      updated_at = now()
  WHERE ti.id = p_item_id
    AND ti.trip_id = p_trip_id
  RETURNING ti.id, ti.owner_id, ti.ownership;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_trip_shared_item(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_trip_shared_item(uuid, uuid, uuid) TO authenticated;

-- 4. Purge déterministe des données éphémères expirées (P01-15, P08-05)
CREATE OR REPLACE FUNCTION public.purge_expired_hub_ephemeral_data(
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE (purged_positions integer, purged_reports integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos integer := 0;
  v_rep integer := 0;
BEGIN
  DELETE FROM public.trip_live_positions
  WHERE expires_at < (p_now - interval '24 hours');
  GET DIAGNOSTICS v_pos = ROW_COUNT;

  DELETE FROM public.hub_field_reports
  WHERE expires_at < (p_now - interval '30 days');
  GET DIAGNOSTICS v_rep = ROW_COUNT;

  RETURN QUERY SELECT v_pos, v_rep;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_hub_ephemeral_data(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_hub_ephemeral_data(timestamptz) TO service_role;
