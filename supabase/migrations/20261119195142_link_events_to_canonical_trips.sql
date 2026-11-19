-- Les références d'événement conservent leurs identifiants et pointent sur un voyage existant.
CREATE TABLE trip_private.event_trip_links (
  club_event_id uuid UNIQUE REFERENCES public.club_events(id) ON DELETE CASCADE,
  community_event_id uuid UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT event_trip_link_one_source CHECK (num_nonnulls(club_event_id, community_event_id) = 1)
);
CREATE INDEX event_trip_links_trip_id_idx ON trip_private.event_trip_links (trip_id);
CREATE INDEX event_trip_links_organizer_id_idx ON trip_private.event_trip_links (organizer_id);
REVOKE ALL ON trip_private.event_trip_links FROM PUBLIC, anon, authenticated;

CREATE VIEW trip_private.visible_event_trip_links AS
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
WHERE t.status <> 'cancelled' AND t.slug IS NOT NULL
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
REVOKE ALL ON trip_private.visible_event_trip_links FROM PUBLIC, anon, authenticated;

CREATE FUNCTION trip_private.resolve_event_trip(p_source_kind text, p_event_id uuid)
RETURNS TABLE (id uuid, slug text, title text, organizer_id uuid, route_revision integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT l.trip_id, l.slug, l.title, l.organizer_id, l.route_revision
  FROM trip_private.visible_event_trip_links AS l
  WHERE l.source_kind = p_source_kind AND l.event_id = p_event_id;
$$;

CREATE FUNCTION trip_private.set_event_trip(p_source_kind text, p_event_id uuid, p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  organizer uuid;
  event_cancelled boolean;
BEGIN
  IF p_source_kind = 'club_event' THEN
    SELECT e.organizer_id, false INTO organizer, event_cancelled
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

CREATE FUNCTION public.resolve_event_trip(p_source_kind text, p_event_id uuid)
RETURNS TABLE (id uuid, slug text, title text, organizer_id uuid, route_revision integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT * FROM trip_private.resolve_event_trip(p_source_kind, p_event_id);
$$;

CREATE FUNCTION public.set_event_trip(p_source_kind text, p_event_id uuid, p_trip_id uuid)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$
  SELECT trip_private.set_event_trip(p_source_kind, p_event_id, p_trip_id);
$$;

REVOKE ALL ON FUNCTION trip_private.resolve_event_trip(text, uuid), public.resolve_event_trip(text, uuid),
  trip_private.set_event_trip(text, uuid, uuid), public.set_event_trip(text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION trip_private.resolve_event_trip(text, uuid), public.resolve_event_trip(text, uuid),
  trip_private.set_event_trip(text, uuid, uuid), public.set_event_trip(text, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION trip_private.confirmed_trip_overview(p_slug text)
RETURNS TABLE (
  id uuid, slug text, title text, user_id uuid,
  status public.trip_status, start_date date, end_date date,
  primary_activity public.trip_activity_type, difficulty public.trip_difficulty,
  destination_name text, destination_country_code text, cover_image_url text,
  budget_currency public.trip_budget_currency,
  created_at timestamptz, updated_at timestamptz,
  participant_user_id uuid, participant_role text, steps jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH viewer AS (
    SELECT auth.uid() AS id
  ), eligible AS (
    SELECT p.trip_id, p.role, 0 AS priority
    FROM public.trip_participants AS p
    JOIN viewer AS v ON p.user_id = v.id
    WHERE p.status = 'confirmed'
    UNION ALL
    SELECT l.trip_id, 'member', 1
    FROM trip_private.visible_event_trip_links AS l
  ), affiliation AS (
    SELECT DISTINCT ON (trip_id) trip_id, role, priority
    FROM eligible
    ORDER BY trip_id, priority
  )
  SELECT t.id, t.slug, t.title, t.user_id,
    t.status, t.start_date, t.end_date, t.primary_activity, t.difficulty,
    t.destination_name, t.destination_country_code, t.cover_image_url, t.budget_currency,
    t.created_at, t.updated_at, v.id, p.role,
    COALESCE((
      SELECT jsonb_agg(
        CASE WHEN p_slug IS NULL
          THEN jsonb_build_object('distance_km', s.distance_km, 'elevation_gain_m', s.elevation_gain_m)
          ELSE jsonb_build_object(
            'id', s.id, 'trip_id', s.trip_id, 'day_number', s.day_number, 'order_index', s.order_index,
            'title', s.title, 'location_name', s.location_name, 'latitude', s.latitude, 'longitude', s.longitude,
            'start_time', s.start_time, 'transport_mode', s.transport_mode, 'distance_km', s.distance_km,
            'elevation_gain_m', s.elevation_gain_m, 'elevation_loss_m', s.elevation_loss_m,
            'created_at', s.created_at, 'updated_at', s.updated_at
          )
        END ORDER BY s.day_number, s.order_index, s.id
      )
      FROM public.trip_steps AS s
      WHERE s.trip_id = t.id
    ), '[]'::jsonb)
  FROM affiliation AS p
  JOIN public.trips AS t ON t.id = p.trip_id
  CROSS JOIN viewer AS v
  WHERE (t.visibility = 'private' OR (p_slug IS NULL AND p.priority = 1))
    AND t.user_id <> v.id
    AND (p_slug IS NULL OR t.slug = p_slug)
    AND NOT EXISTS (
      SELECT 1 FROM public.trip_collaborators AS c
      WHERE c.trip_id = t.id AND c.user_id = v.id
    );
$$;
