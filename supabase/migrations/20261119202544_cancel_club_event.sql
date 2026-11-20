-- L’annulation garde la fiche, les inscriptions sources et l’historique terrain.
ALTER TABLE public.club_events
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT club_events_cancelled_count CHECK (cancelled_at IS NULL OR participants_count IS NOT DISTINCT FROM 0);

CREATE FUNCTION club_private.guard_club_event_cancellation()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
    (TG_OP = 'INSERT' AND (NEW.cancelled_at IS NOT NULL OR NEW.cancelled_by IS NOT NULL))
    OR (TG_OP = 'UPDATE' AND (NEW.cancelled_at, NEW.cancelled_by) IS DISTINCT FROM (OLD.cancelled_at, OLD.cancelled_by))
  ) THEN
    RAISE EXCEPTION 'L’état d’annulation passe par la transaction de sortie.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION club_private.guard_club_event_cancellation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_club_event_cancellation
BEFORE INSERT OR UPDATE OF cancelled_at, cancelled_by ON public.club_events
FOR EACH ROW EXECUTE FUNCTION club_private.guard_club_event_cancellation();

CREATE FUNCTION club_private.reject_invite_to_cancelled_club_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  cancelled timestamptz;
BEGIN
  IF NEW.kind = 'event'
     AND NEW.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT e.cancelled_at INTO cancelled
    FROM public.club_events AS e WHERE e.id = NEW.target_id::uuid FOR SHARE;
    IF cancelled IS NOT NULL THEN
      RAISE EXCEPTION 'Cette sortie est annulée.' USING ERRCODE = '55000', DETAIL = 'club_event_cancelled';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION club_private.reject_invite_to_cancelled_club_event() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER reject_invite_to_cancelled_club_event
BEFORE INSERT ON public.club_invites
FOR EACH ROW EXECUTE FUNCTION club_private.reject_invite_to_cancelled_club_event();

CREATE FUNCTION club_private.cancel_club_event(p_event_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  e public.club_events%ROWTYPE;
  changed_at timestamptz;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO e FROM public.club_events AS ev
  WHERE ev.id = p_event_id AND ev.organizer_id = actor FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action réservée à l’organisateur.' USING ERRCODE = '42501';
  END IF;
  IF e.cancelled_at IS NOT NULL THEN
    RETURN e.cancelled_at;
  END IF;

  changed_at := clock_timestamp();
  UPDATE public.club_events
  SET cancelled_at = changed_at, cancelled_by = actor, participants_count = 0
  WHERE id = e.id;
  UPDATE public.club_invites AS i SET revoked_at = changed_at
  WHERE i.kind = 'event' AND i.target_id = e.id::text
    AND (i.club_id IS NULL OR i.club_id = e.club_id) AND i.revoked_at IS NULL;

  RETURN changed_at;
END;
$$;

CREATE FUNCTION public.cancel_club_event(p_event_id uuid)
RETURNS timestamptz
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT club_private.cancel_club_event(p_event_id);
$$;
REVOKE ALL ON FUNCTION club_private.cancel_club_event(uuid), public.cancel_club_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION club_private.cancel_club_event(uuid), public.cancel_club_event(uuid) TO authenticated;

-- La vérification d’état prend le même verrou que l’inscription et sa promotion.
ALTER FUNCTION club_private.transact_club_event_registration(uuid, boolean, text, text)
  RENAME TO transact_open_club_event_registration;
REVOKE ALL ON FUNCTION club_private.transact_open_club_event_registration(uuid, boolean, text, text)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION club_private.transact_club_event_registration(
  p_event_id uuid, p_attending boolean, p_pace_group_id text, p_invite_token text
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  cancelled timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;
  IF p_attending IS NULL THEN
    RAISE EXCEPTION 'Réponse d’inscription invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT e.cancelled_at INTO cancelled FROM public.club_events AS e WHERE e.id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sortie introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF cancelled IS NOT NULL THEN
    IF p_attending THEN
      RAISE EXCEPTION 'Cette sortie est annulée.' USING ERRCODE = '55000', DETAIL = 'club_event_cancelled';
    END IF;
    RETURN jsonb_build_object('registration', NULL, 'event_cancelled', true);
  END IF;
  RETURN club_private.transact_open_club_event_registration(p_event_id, p_attending, p_pace_group_id, p_invite_token);
END;
$$;
REVOKE ALL ON FUNCTION club_private.transact_club_event_registration(uuid, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION club_private.transact_club_event_registration(uuid, boolean, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.transact_club_event_registration(
  p_event_id uuid, p_attending boolean, p_pace_group_id text DEFAULT NULL, p_invite_token text DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT club_private.transact_club_event_registration(p_event_id, p_attending, p_pace_group_id, p_invite_token);
$$;

CREATE OR REPLACE VIEW public.club_event_registrations_effective
WITH (security_invoker = true)
AS
SELECT r.event_id, r.user_id,
       CASE WHEN e.cancelled_at IS NOT NULL THEN 'cancelled' ELSE r.status END AS status,
       r.pace_group_id, r.invited_by_user_id, r.invite_id, r.registered_at,
       GREATEST(r.updated_at, e.cancelled_at) AS updated_at
FROM public.club_event_registrations AS r
JOIN public.club_events AS e ON e.id = r.event_id
UNION ALL
SELECT p.event_id, p.user_id,
       CASE WHEN e.cancelled_at IS NOT NULL THEN 'cancelled' ELSE 'registered' END,
       NULL::text, NULL::uuid, NULL::uuid, stamp.rsvp_at, GREATEST(stamp.rsvp_at, e.cancelled_at)
FROM public.club_event_participants AS p
JOIN public.club_events AS e ON e.id = p.event_id
CROSS JOIN LATERAL (
  SELECT COALESCE((to_jsonb(p) ->> 'joined_at')::timestamptz, (to_jsonb(p) ->> 'created_at')::timestamptz) AS rsvp_at
) AS stamp
WHERE stamp.rsvp_at IS NOT NULL
  AND ((SELECT auth.uid()) = p.user_id OR public.lkdv_is_club_moderator(e.club_id))
  AND NOT EXISTS (
    SELECT 1 FROM public.club_event_registrations AS r
    WHERE r.event_id = p.event_id AND r.user_id = p.user_id
  );

CREATE OR REPLACE VIEW trip_private.visible_event_trip_links AS
WITH viewer AS (SELECT auth.uid() AS id)
SELECT 'club_event'::text AS source_kind, e.id AS event_id, t.id AS trip_id,
       t.slug, t.title, l.organizer_id,
       CASE WHEN e.route_id IS NOT NULL THEN e.route_revision END AS route_revision
FROM trip_private.event_trip_links AS l
JOIN public.club_events AS e ON e.id = l.club_event_id AND e.organizer_id = l.organizer_id
JOIN public.trips AS t ON t.id = l.trip_id AND t.user_id = l.organizer_id
LEFT JOIN public.clubs AS c ON c.id = e.club_id
CROSS JOIN viewer AS v
LEFT JOIN public.club_members AS m ON m.club_id = e.club_id AND m.user_id = v.id
WHERE e.cancelled_at IS NULL AND t.status <> 'cancelled' AND t.slug IS NOT NULL
  AND (v.id = l.organizer_id OR (
    m.status IS DISTINCT FROM 'banned'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks AS b
      WHERE (b.blocker_id = v.id AND (
               b.blocked_id = e.organizer_id OR
               (m.status IS DISTINCT FROM 'active' AND b.blocked_id = c.created_by)))
         OR (b.blocked_id = v.id AND (
               b.blocker_id = e.organizer_id OR
               (m.status IS DISTINCT FROM 'active' AND b.blocker_id = c.created_by)))
    )
    AND EXISTS (
      SELECT 1 FROM public.club_event_registrations_effective AS r
      WHERE r.event_id = e.id AND r.user_id = v.id AND r.status = 'registered'
        AND (
          ((e.club_id IS NULL OR c.privacy IN ('open', 'public') OR m.status = 'active')
            AND (e.visibility = 'public' OR (e.visibility = 'club_only' AND m.status = 'active')))
          OR EXISTS (
            SELECT 1 FROM public.club_invites AS i
            WHERE i.id = r.invite_id AND i.kind = 'event' AND i.target_id = e.id::text
              AND (i.club_id IS NULL OR i.club_id = e.club_id) AND i.revoked_at IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM public.user_blocks AS b
                WHERE (b.blocker_id = v.id AND b.blocked_id = i.created_by)
                   OR (b.blocker_id = i.created_by AND b.blocked_id = v.id)
              )
          )
        )
    )
  ))
UNION ALL
SELECT 'community_event'::text, e.id, t.id, t.slug, t.title, l.organizer_id, NULL::integer
FROM trip_private.event_trip_links AS l
JOIN public.events AS e ON e.id = l.community_event_id AND e.organizer_id = l.organizer_id
JOIN public.trips AS t ON t.id = l.trip_id AND t.user_id = l.organizer_id
CROSS JOIN viewer AS v
WHERE e.status IS DISTINCT FROM 'cancelled' AND t.status <> 'cancelled' AND t.slug IS NOT NULL
  AND (v.id = l.organizer_id OR (
    EXISTS (
      SELECT 1 FROM public.event_participants AS p
      WHERE p.event_id = e.id AND p.user_id = v.id AND p.status = 'confirmed'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks AS b
      WHERE (b.blocker_id = v.id AND b.blocked_id = e.organizer_id)
         OR (b.blocker_id = e.organizer_id AND b.blocked_id = v.id)
    )
  ));

CREATE OR REPLACE FUNCTION trip_private.set_event_trip(p_source_kind text, p_event_id uuid, p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  organizer uuid;
  event_cancelled boolean;
BEGIN
  IF p_source_kind = 'club_event' THEN
    SELECT e.organizer_id, e.cancelled_at IS NOT NULL INTO organizer, event_cancelled
    FROM public.club_events AS e WHERE e.id = p_event_id AND e.organizer_id = actor FOR UPDATE;
  ELSIF p_source_kind = 'community_event' THEN
    SELECT e.organizer_id, e.status = 'cancelled' INTO organizer, event_cancelled
    FROM public.events AS e WHERE e.id = p_event_id AND e.organizer_id = actor FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'Type de sortie invalide.' USING ERRCODE = '22023';
  END IF;

  IF organizer IS NULL THEN
    RAISE EXCEPTION 'Action réservée à l’organisateur.' USING ERRCODE = '42501';
  END IF;

  IF p_trip_id IS NULL THEN
    DELETE FROM trip_private.event_trip_links AS l
    WHERE (p_source_kind = 'club_event' AND l.club_event_id = p_event_id)
       OR (p_source_kind = 'community_event' AND l.community_event_id = p_event_id);
    RETURN;
  END IF;

  IF event_cancelled THEN
    RAISE EXCEPTION 'Cette sortie est annulée.' USING ERRCODE = '55000';
  END IF;

  PERFORM 1 FROM public.trips AS t WHERE t.id = p_trip_id AND t.user_id = actor
    AND t.status <> 'cancelled' AND t.slug IS NOT NULL FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aventure indisponible.' USING ERRCODE = '42501';
  END IF;

  IF p_source_kind = 'club_event' THEN
    INSERT INTO trip_private.event_trip_links (club_event_id, trip_id, organizer_id)
    VALUES (p_event_id, p_trip_id, actor)
    ON CONFLICT (club_event_id) DO UPDATE SET trip_id = EXCLUDED.trip_id, organizer_id = EXCLUDED.organizer_id;
  ELSE
    INSERT INTO trip_private.event_trip_links (community_event_id, trip_id, organizer_id)
    VALUES (p_event_id, p_trip_id, actor)
    ON CONFLICT (community_event_id) DO UPDATE SET trip_id = EXCLUDED.trip_id, organizer_id = EXCLUDED.organizer_id;
  END IF;
END;
$$;
