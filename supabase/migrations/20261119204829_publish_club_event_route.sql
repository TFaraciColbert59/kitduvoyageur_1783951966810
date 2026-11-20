-- Figer la géométrie du catalogue et publier la proposition dans la même transaction.
ALTER TABLE public.club_event_route_revisions
  ADD COLUMN canonical_revision_id uuid REFERENCES public.hiking_route_revisions(id) ON DELETE RESTRICT,
  ADD COLUMN route_name text,
  ADD COLUMN meeting_point text,
  ADD COLUMN previous_meeting jsonb,
  ALTER COLUMN elevation_gain_m DROP NOT NULL;
CREATE INDEX club_event_route_revisions_canonical_idx
  ON public.club_event_route_revisions (canonical_revision_id) WHERE canonical_revision_id IS NOT NULL;

CREATE FUNCTION club_private.active_event_route_participants(p_event_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS TABLE (user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH registered AS (
    SELECT r.user_id, r.invite_id
    FROM public.club_event_registrations AS r
    WHERE r.event_id = p_event_id AND r.status = 'registered'
      AND (p_user_id IS NULL OR r.user_id = p_user_id)
    UNION ALL
    SELECT old.user_id, NULL::uuid
    FROM public.club_event_participants AS old
    WHERE old.event_id = p_event_id
      AND (p_user_id IS NULL OR old.user_id = p_user_id)
      AND COALESCE(to_jsonb(old) ->> 'joined_at', to_jsonb(old) ->> 'created_at') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.club_event_registrations AS r
                      WHERE r.event_id = old.event_id AND r.user_id = old.user_id)
  )
  SELECT r.user_id
  FROM registered AS r
  JOIN public.club_events AS e ON e.id = p_event_id
  LEFT JOIN public.clubs AS c ON c.id = e.club_id
  LEFT JOIN public.club_members AS m ON m.club_id = e.club_id AND m.user_id = r.user_id
  WHERE e.cancelled_at IS NULL
    AND m.status IS DISTINCT FROM 'banned' AND m.status IS DISTINCT FROM 'removed'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks AS b
      WHERE (b.blocker_id = r.user_id AND
               (b.blocked_id = e.organizer_id OR (m.status IS DISTINCT FROM 'active' AND b.blocked_id = c.created_by)))
         OR (b.blocked_id = r.user_id AND
               (b.blocker_id = e.organizer_id OR (m.status IS DISTINCT FROM 'active' AND b.blocker_id = c.created_by)))
    )
    AND (
      ((e.club_id IS NULL OR c.privacy IN ('open', 'public') OR m.status = 'active')
        AND (e.visibility = 'public' OR (e.visibility = 'club_only' AND m.status = 'active')))
      OR EXISTS (
        SELECT 1 FROM public.club_invites AS i
        WHERE i.id = r.invite_id AND i.kind = 'event' AND i.target_id = e.id::text
          AND (i.club_id IS NULL OR i.club_id = e.club_id) AND i.revoked_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.user_blocks AS b
            WHERE (b.blocker_id = r.user_id AND b.blocked_id = i.created_by)
               OR (b.blocker_id = i.created_by AND b.blocked_id = r.user_id)
          )
      )
    );
$$;
REVOKE ALL ON FUNCTION club_private.active_event_route_participants(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION club_private.can_read_event_route(p_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.club_events AS e WHERE e.id = p_event_id
        AND (e.organizer_id = (SELECT auth.uid()) OR public.lkdv_is_club_moderator(e.club_id))
    )
    OR EXISTS (SELECT 1 FROM club_private.active_event_route_participants(p_event_id, (SELECT auth.uid())))
  );
$$;
REVOKE ALL ON FUNCTION club_private.can_read_event_route(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION club_private.can_read_event_route(uuid) TO authenticated;

DROP POLICY club_event_route_rev_read ON public.club_event_route_revisions;
CREATE POLICY club_event_route_rev_read ON public.club_event_route_revisions
  FOR SELECT TO authenticated USING (club_private.can_read_event_route(event_id));
DROP POLICY club_event_route_rev_insert ON public.club_event_route_revisions;
REVOKE INSERT, UPDATE, DELETE ON public.club_event_route_revisions FROM PUBLIC, anon, authenticated;

CREATE FUNCTION club_private.guard_event_route_revision()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
    (NEW.route_id, NEW.route_revision) IS DISTINCT FROM (OLD.route_id, OLD.route_revision)
    OR ((NEW.meeting_point, NEW.lat, NEW.lng) IS DISTINCT FROM (OLD.meeting_point, OLD.lat, OLD.lng)
      AND EXISTS (SELECT 1 FROM public.club_event_route_revisions AS r
                  WHERE r.event_id = OLD.id AND r.revision = OLD.route_revision AND r.canonical_revision_id IS NOT NULL))
  ) THEN
    RAISE EXCEPTION 'La révision du tracé passe par sa publication.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION club_private.guard_event_route_revision() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_event_route_revision
  BEFORE UPDATE OF route_id, route_revision, meeting_point, lat, lng ON public.club_events
  FOR EACH ROW EXECUTE FUNCTION club_private.guard_event_route_revision();

CREATE FUNCTION club_private.publish_club_event_route(
  p_event_id uuid, p_expected_revision integer, p_route_id bigint, p_meeting_point text
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  e public.club_events%ROWTYPE;
  published public.club_event_route_revisions%ROWTYPE;
  pinned public.hiking_route_revisions%ROWTYPE;
  label text;
  elevation integer;
  distance numeric;
  meeting text;
  next_revision integer;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 0 OR p_route_id IS NULL OR p_route_id < 1
     OR char_length(p_meeting_point) > 200 THEN
    RAISE EXCEPTION 'Référence, révision ou rendez-vous invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO e FROM public.club_events AS ev
    WHERE ev.id = p_event_id
      AND (ev.organizer_id = actor OR public.lkdv_is_club_moderator(ev.club_id))
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Publication réservée à l’organisateur ou à la modération du club.' USING ERRCODE = '42501';
  END IF;
  IF e.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cette sortie est annulée.' USING ERRCODE = '55000';
  END IF;
  IF e.route_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'Le parcours a changé. Actualise la fiche avant de publier.' USING ERRCODE = '40001';
  END IF;

  SELECT * INTO pinned
  FROM public.hiking_route_revisions AS r
  WHERE r.route_id = p_route_id AND r.is_current AND r.quality = 'complete'
    AND r.geom IS NOT NULL AND NOT public.st_isempty(r.geom)
  ORDER BY r.revision_number DESC LIMIT 1 FOR SHARE;
  IF FOUND THEN
    distance := round(public.st_length(pinned.geom::public.geography)::numeric, 1);
  END IF;
  IF pinned.id IS NULL OR distance IS NULL OR distance <= 0 THEN
    RAISE EXCEPTION 'Tracé indisponible dans le catalogue.' USING ERRCODE = '22023';
  END IF;
  SELECT r.name INTO label FROM public.hiking_routes AS r WHERE r.id = p_route_id;
  SELECT max(m.elevation_gain) INTO elevation FROM public.trail_metadata AS m
    WHERE m.trail_id = p_route_id AND m.elevation_gain >= 0;
  meeting := CASE WHEN p_meeting_point IS NULL THEN e.meeting_point ELSE nullif(btrim(p_meeting_point), '') END;

  SELECT * INTO published FROM public.club_event_route_revisions AS r
  WHERE r.event_id = e.id AND r.revision = e.route_revision;
  IF published.canonical_revision_id = pinned.id AND meeting IS NOT DISTINCT FROM e.meeting_point THEN
    RETURN jsonb_build_object('event', to_jsonb(e), 'snapshot', to_jsonb(published));
  END IF;

  SELECT GREATEST(e.route_revision, COALESCE(max(r.revision), 0)) + 1 INTO next_revision
  FROM public.club_event_route_revisions AS r WHERE r.event_id = e.id;

  INSERT INTO public.club_event_route_revisions (
    event_id, revision, route_id, checksum, distance_m, elevation_gain_m, updated_by,
    requires_participant_decision, canonical_revision_id, route_name, meeting_point, previous_meeting
  ) VALUES (
    e.id, next_revision, p_route_id::text, pinned.geometry_hash, distance, elevation, actor,
    true, pinned.id, label, meeting,
    jsonb_build_object('place', e.meeting_point, 'lat', e.lat, 'lng', e.lng)
  ) RETURNING * INTO published;
  UPDATE public.club_events
  SET route_id = published.route_id, route_revision = published.revision,
    meeting_point = meeting,
    lat = CASE WHEN meeting IS NOT DISTINCT FROM e.meeting_point THEN e.lat END,
    lng = CASE WHEN meeting IS NOT DISTINCT FROM e.meeting_point THEN e.lng END
  WHERE id = e.id RETURNING * INTO e;

  PERFORM public.notify_activity(
    p.user_id, 'club_route_revision', 'social',
    'Nouveau parcours proposé', e.title || ' · révision ' || next_revision,
    actor, 'club_event', e.id, '/sorties/' || e.id::text || '?source=club#parcours')
  FROM club_private.active_event_route_participants(e.id) AS p;

  RETURN jsonb_build_object('event', to_jsonb(e), 'snapshot', to_jsonb(published));
END;
$$;
CREATE FUNCTION public.publish_club_event_route(
  p_event_id uuid, p_expected_revision integer, p_route_id bigint, p_meeting_point text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT club_private.publish_club_event_route(p_event_id, p_expected_revision, p_route_id, p_meeting_point);
$$;
REVOKE ALL ON FUNCTION club_private.publish_club_event_route(uuid, integer, bigint, text),
  public.publish_club_event_route(uuid, integer, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION club_private.publish_club_event_route(uuid, integer, bigint, text),
  public.publish_club_event_route(uuid, integer, bigint, text) TO authenticated;
