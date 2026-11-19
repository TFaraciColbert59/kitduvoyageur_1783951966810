-- Rétablir le code applicatif précédent avant le retour SQL. Les liaisons seules sont retirées.
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
  SELECT t.id, t.slug, t.title, t.user_id,
    t.status, t.start_date, t.end_date, t.primary_activity, t.difficulty,
    t.destination_name, t.destination_country_code, t.cover_image_url, t.budget_currency,
    t.created_at, t.updated_at, p.user_id, p.role,
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
  FROM public.trip_participants AS p
  JOIN public.trips AS t ON t.id = p.trip_id
  WHERE p.user_id = (SELECT auth.uid())
    AND p.status = 'confirmed'
    AND t.visibility = 'private'
    AND t.user_id <> p.user_id
    AND (p_slug IS NULL OR t.slug = p_slug)
    AND NOT EXISTS (
      SELECT 1 FROM public.trip_collaborators AS c
      WHERE c.trip_id = t.id AND c.user_id = p.user_id
    );
$$;

DROP FUNCTION public.set_event_trip(text, uuid, uuid);
DROP FUNCTION public.resolve_event_trip(text, uuid);
DROP FUNCTION trip_private.set_event_trip(text, uuid, uuid);
DROP FUNCTION trip_private.resolve_event_trip(text, uuid);
DROP VIEW trip_private.visible_event_trip_links;
DROP TABLE trip_private.event_trip_links;
