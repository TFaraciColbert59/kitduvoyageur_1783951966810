-- Enrich club_events with SortieFormV2 domain columns + bridge trigger + multi-modal Aller/Retour transports
ALTER TABLE public.club_events
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS level text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS distance_km numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS elevation_gain_m integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS elevation_loss_m integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_altitude_m integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS duration_label text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS safety_checklist text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS safety_notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kit_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS standard_kit_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cover_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trace_geojson jsonb DEFAULT NULL;

ALTER TABLE public.club_topics
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.club_events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_club_topics_event_id ON public.club_topics(event_id) WHERE event_id IS NOT NULL;

ALTER TABLE public.club_channels
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.club_events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_club_channels_event_id ON public.club_channels(event_id) WHERE event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_public_events_to_club_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
  v_starts timestamptz;
BEGIN
  IF NEW.club_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_starts := COALESCE(NEW.starts_at, (NEW.event_date::text || 'T08:00:00Z')::timestamptz, now());
  IF NEW.meeting_geom IS NOT NULL THEN
    v_lat := ST_Y(NEW.meeting_geom::geometry);
    v_lng := ST_X(NEW.meeting_geom::geometry);
  ELSIF NEW.location_geom IS NOT NULL THEN
    v_lat := ST_Y(NEW.location_geom::geometry);
    v_lng := ST_X(NEW.location_geom::geometry);
  END IF;

  INSERT INTO public.club_events (
    id, club_id, organizer_id, title, description, event_date, starts_at, ends_at,
    location, meeting_point, lat, lng, max_participants, participants_count,
    sport, format, visibility, waitlist_enabled,
    level, distance_km, elevation_gain_m, duration_label,
    safety_checklist, safety_notes, kit_id, cover_url, recurrence
  )
  VALUES (
    NEW.id, NEW.club_id, NEW.organizer_id, NEW.title, NEW.description, v_starts, v_starts, NEW.ends_at,
    NEW.location, NEW.meeting_point, v_lat, v_lng, COALESCE(NEW.max_participants, 12), COALESCE(NEW.current_participants, 1),
    COALESCE(NEW.activity, 'hiking'), 'trail_outing', 'club_only', COALESCE(NEW.waitlist_enabled, true),
    NEW.level, NEW.distance_km, NEW.elevation_gain_m, NEW.duration,
    NEW.safety_checklist, NEW.safety_notes, NEW.kit_id, NEW.cover_image, NEW.recurrence
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    event_date = EXCLUDED.event_date,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    location = EXCLUDED.location,
    meeting_point = EXCLUDED.meeting_point,
    lat = COALESCE(EXCLUDED.lat, public.club_events.lat),
    lng = COALESCE(EXCLUDED.lng, public.club_events.lng),
    max_participants = EXCLUDED.max_participants,
    waitlist_enabled = EXCLUDED.waitlist_enabled,
    level = EXCLUDED.level,
    distance_km = EXCLUDED.distance_km,
    elevation_gain_m = EXCLUDED.elevation_gain_m,
    duration_label = EXCLUDED.duration_label,
    safety_checklist = EXCLUDED.safety_checklist,
    safety_notes = EXCLUDED.safety_notes,
    kit_id = EXCLUDED.kit_id,
    cover_url = COALESCE(EXCLUDED.cover_url, public.club_events.cover_url),
    recurrence = EXCLUDED.recurrence;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_public_events_to_club_events ON public.events;
CREATE TRIGGER trg_sync_public_events_to_club_events
  AFTER INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_public_events_to_club_events();

CREATE TABLE IF NOT EXISTS public.club_event_transports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'aller_retour' CHECK (direction IN ('aller_retour', 'aller', 'retour')),
  mode text NOT NULL DEFAULT 'carpool' CHECK (mode IN ('carpool', 'minibus_club', 'train', 'bus', 'bike', 'foot')),
  outbound_from_label text NOT NULL,
  outbound_from_lat double precision DEFAULT NULL,
  outbound_from_lng double precision DEFAULT NULL,
  outbound_departure_at timestamptz DEFAULT NULL,
  outbound_to_label text DEFAULT NULL,
  return_from_label text DEFAULT NULL,
  return_from_lat double precision DEFAULT NULL,
  return_from_lng double precision DEFAULT NULL,
  return_departure_at timestamptz DEFAULT NULL,
  return_to_label text DEFAULT NULL,
  seats_total integer NOT NULL DEFAULT 3 CHECK (seats_total >= 0 AND seats_total <= 50),
  gear_notes text DEFAULT NULL,
  cost_share_cents integer NOT NULL DEFAULT 0 CHECK (cost_share_cents >= 0),
  notes text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_event_transports_event ON public.club_event_transports(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_club_event_transports_club ON public.club_event_transports(club_id);

CREATE TABLE IF NOT EXISTS public.club_event_transport_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_id uuid NOT NULL REFERENCES public.club_event_transports(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leg text NOT NULL DEFAULT 'aller_retour' CHECK (leg IN ('aller_retour', 'aller', 'retour')),
  pickup_note text DEFAULT NULL,
  has_bulky_gear boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transport_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_event_transport_bookings_transport ON public.club_event_transport_bookings(transport_id);
CREATE INDEX IF NOT EXISTS idx_club_event_transport_bookings_event ON public.club_event_transport_bookings(event_id);

ALTER TABLE public.club_event_transports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_event_transport_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS club_event_transports_select ON public.club_event_transports;
CREATE POLICY club_event_transports_select ON public.club_event_transports
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS club_event_transports_insert ON public.club_event_transports;
CREATE POLICY club_event_transports_insert ON public.club_event_transports
  FOR INSERT WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS club_event_transports_update ON public.club_event_transports;
CREATE POLICY club_event_transports_update ON public.club_event_transports
  FOR UPDATE USING (auth.uid() = organizer_id);

DROP POLICY IF EXISTS club_event_transports_delete ON public.club_event_transports;
CREATE POLICY club_event_transports_delete ON public.club_event_transports
  FOR DELETE USING (auth.uid() = organizer_id);

DROP POLICY IF EXISTS club_event_transport_bookings_select ON public.club_event_transport_bookings;
CREATE POLICY club_event_transport_bookings_select ON public.club_event_transport_bookings
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS club_event_transport_bookings_write ON public.club_event_transport_bookings;
CREATE POLICY club_event_transport_bookings_write ON public.club_event_transport_bookings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
