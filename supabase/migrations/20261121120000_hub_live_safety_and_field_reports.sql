-- ============================================================================
-- Migration additive : Cycle de vie métier, positions live persistantes,
-- contacts de sécurité persistés et signalements terrain réels (P02/P03/P05/P07/P08).
-- ============================================================================

-- 1. Journal atomique du cycle de vie d'un voyage (P02-04, P02-05, P08-01, P08-08)
CREATE TABLE IF NOT EXISTS public.trip_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  from_state text NOT NULL,
  to_state text NOT NULL CHECK (to_state IN ('draft','planned','ready','active','paused','completed','recount','cancelled')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_lifecycle_events_trip_occurred
  ON public.trip_lifecycle_events (trip_id, occurred_at DESC);

ALTER TABLE public.trip_lifecycle_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_lifecycle_events_select ON public.trip_lifecycle_events;
CREATE POLICY trip_lifecycle_events_select ON public.trip_lifecycle_events
  FOR SELECT TO authenticated
  USING (public.can_read_trip(trip_id));

REVOKE INSERT, UPDATE, DELETE ON public.trip_lifecycle_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.transition_trip_lifecycle(
  p_trip_id uuid,
  p_to_state text,
  p_operation_id uuid,
  p_note text DEFAULT NULL
)
RETURNS public.trip_lifecycle_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_trip record;
  v_existing public.trip_lifecycle_events;
  v_from text;
  v_db_status text;
  v_inserted public.trip_lifecycle_events;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_edit_trip(p_trip_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_to_state NOT IN ('draft','planned','ready','active','paused','completed','recount','cancelled') THEN
    RAISE EXCEPTION 'INVALID_LIFECYCLE_STATE' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.trip_lifecycle_events
  WHERE trip_id = p_trip_id AND operation_id = p_operation_id;

  IF FOUND THEN
    IF v_existing.to_state <> p_to_state THEN
      RAISE EXCEPTION 'OPERATION_ID_CONFLICT' USING ERRCODE = '40001';
    END IF;
    RETURN v_existing;
  END IF;

  SELECT id, status INTO v_trip
  FROM public.trips
  WHERE id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRIP_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT to_state INTO v_from
  FROM public.trip_lifecycle_events
  WHERE trip_id = p_trip_id
  ORDER BY occurred_at DESC, id DESC
  LIMIT 1;

  v_from := COALESCE(v_from, COALESCE(v_trip.status::text, 'draft'));

  -- Mapping vers la colonne status existante de trips sans casser les valeurs historiques
  v_db_status := CASE p_to_state
    WHEN 'ready' THEN 'planned'
    WHEN 'paused' THEN 'active'
    WHEN 'recount' THEN 'completed'
    ELSE p_to_state
  END;

  IF v_db_status IN ('draft','planned','active','completed','cancelled') THEN
    UPDATE public.trips SET status = v_db_status::trip_status, updated_at = now() WHERE id = p_trip_id;
  END IF;

  INSERT INTO public.trip_lifecycle_events (trip_id, actor_id, operation_id, from_state, to_state, note)
  VALUES (p_trip_id, v_actor, p_operation_id, v_from, p_to_state, NULLIF(trim(COALESCE(p_note, '')), ''))
  RETURNING * INTO v_inserted;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_trip_lifecycle(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_trip_lifecycle(uuid, text, uuid, text) TO authenticated;

-- 2. Positions live persistantes (P05-01, P05-02, P05-03, P07-50)
CREATE TABLE IF NOT EXISTS public.trip_live_positions (
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_revision integer,
  along_meters double precision CHECK (along_meters IS NULL OR along_meters >= 0),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon double precision NOT NULL CHECK (lon BETWEEN -180 AND 180),
  accuracy_m double precision CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  battery_pct smallint CHECK (battery_pct IS NULL OR battery_pct BETWEEN 0 AND 100),
  sharing_enabled boolean NOT NULL DEFAULT true,
  recorded_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_live_positions_trip_active
  ON public.trip_live_positions (trip_id, expires_at DESC)
  WHERE sharing_enabled = true;

ALTER TABLE public.trip_live_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_live_positions_own_read ON public.trip_live_positions;
CREATE POLICY trip_live_positions_own_read ON public.trip_live_positions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.trip_live_positions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.upsert_trip_live_position(
  p_trip_id uuid,
  p_lat double precision,
  p_lon double precision,
  p_recorded_at timestamptz,
  p_along_meters double precision DEFAULT NULL,
  p_route_revision integer DEFAULT NULL,
  p_accuracy_m double precision DEFAULT NULL,
  p_battery_pct smallint DEFAULT NULL,
  p_sharing_enabled boolean DEFAULT true,
  p_ttl_minutes integer DEFAULT 240
)
RETURNS public.trip_live_positions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_allowed boolean;
  v_ttl integer := GREATEST(5, LEAST(COALESCE(p_ttl_minutes, 240), 1440));
  v_row public.trip_live_positions;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT (
    public.can_read_trip(p_trip_id)
    OR EXISTS (
      SELECT 1 FROM public.trip_participants tp
      WHERE tp.trip_id = p_trip_id AND tp.user_id = v_actor AND tp.status = 'confirmed'
    )
  ) INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.trip_live_positions (
    trip_id, user_id, route_revision, along_meters, lat, lon,
    accuracy_m, battery_pct, sharing_enabled, recorded_at, expires_at, updated_at
  )
  VALUES (
    p_trip_id, v_actor, p_route_revision, p_along_meters, p_lat, p_lon,
    p_accuracy_m, p_battery_pct, COALESCE(p_sharing_enabled, true),
    p_recorded_at, p_recorded_at + make_interval(mins => v_ttl), now()
  )
  ON CONFLICT (trip_id, user_id) DO UPDATE
  SET
    route_revision = EXCLUDED.route_revision,
    along_meters = EXCLUDED.along_meters,
    lat = EXCLUDED.lat,
    lon = EXCLUDED.lon,
    accuracy_m = EXCLUDED.accuracy_m,
    battery_pct = EXCLUDED.battery_pct,
    sharing_enabled = EXCLUDED.sharing_enabled,
    recorded_at = EXCLUDED.recorded_at,
    expires_at = EXCLUDED.expires_at,
    updated_at = now()
  WHERE EXCLUDED.recorded_at >= public.trip_live_positions.recorded_at
     OR EXCLUDED.sharing_enabled = false;

  SELECT * INTO v_row
  FROM public.trip_live_positions
  WHERE trip_id = p_trip_id AND user_id = v_actor;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_trip_live_position(uuid, double precision, double precision, timestamptz, double precision, integer, double precision, smallint, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_trip_live_position(uuid, double precision, double precision, timestamptz, double precision, integer, double precision, smallint, boolean, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.read_trip_live_positions(p_trip_id uuid)
RETURNS TABLE (
  user_id uuid,
  route_revision integer,
  along_meters double precision,
  lat double precision,
  lon double precision,
  accuracy_m double precision,
  battery_pct smallint,
  recorded_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_allowed boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT (
    public.can_read_trip(p_trip_id)
    OR EXISTS (
      SELECT 1 FROM public.trip_participants tp
      WHERE tp.trip_id = p_trip_id AND tp.user_id = v_actor AND tp.status = 'confirmed'
    )
  ) INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.user_id, p.route_revision, p.along_meters, p.lat, p.lon,
    p.accuracy_m, p.battery_pct, p.recorded_at, p.expires_at
  FROM public.trip_live_positions p
  WHERE p.trip_id = p_trip_id
    AND p.sharing_enabled = true
    AND p.expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION public.read_trip_live_positions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_trip_live_positions(uuid) TO authenticated;

-- 3. Contacts de sécurité persistés en base (P05-01, P07-54)
CREATE TABLE IF NOT EXISTS public.trip_safety_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name text NOT NULL CHECK (char_length(trim(contact_name)) BETWEEN 1 AND 120),
  contact_channel text NOT NULL CHECK (contact_channel IN ('phone','sms','email')),
  contact_value text NOT NULL CHECK (char_length(trim(contact_value)) BETWEEN 3 AND 160),
  consent_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_safety_contacts_trip_owner
  ON public.trip_safety_contacts (trip_id, owner_id);

ALTER TABLE public.trip_safety_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_safety_contacts_owner_all ON public.trip_safety_contacts;
CREATE POLICY trip_safety_contacts_owner_all ON public.trip_safety_contacts
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 4. Signalements terrain réels avec expiration et confirmations (P03-26, P07-18)
CREATE TABLE IF NOT EXISTS public.hub_field_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('water_dry','water_ok','trail_closed','hazard','shelter_closed','snow_ice','mud','other')),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 140),
  details text CHECK (details IS NULL OR char_length(details) <= 800),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon double precision NOT NULL CHECK (lon BETWEEN -180 AND 180),
  confirmations_count integer NOT NULL DEFAULT 1 CHECK (confirmations_count >= 1),
  observed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_field_reports_active
  ON public.hub_field_reports (expires_at DESC, category);

CREATE TABLE IF NOT EXISTS public.hub_field_report_confirmations (
  report_id uuid NOT NULL REFERENCES public.hub_field_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, user_id)
);

ALTER TABLE public.hub_field_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_field_report_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_field_reports_read ON public.hub_field_reports;
CREATE POLICY hub_field_reports_read ON public.hub_field_reports
  FOR SELECT TO authenticated
  USING (expires_at > now() AND (trip_id IS NULL OR public.can_read_trip(trip_id) OR author_id = auth.uid()));

DROP POLICY IF EXISTS hub_field_reports_insert ON public.hub_field_reports;
CREATE POLICY hub_field_reports_insert ON public.hub_field_reports
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (trip_id IS NULL OR public.can_read_trip(trip_id)));

DROP POLICY IF EXISTS hub_field_report_confirmations_read ON public.hub_field_report_confirmations;
CREATE POLICY hub_field_report_confirmations_read ON public.hub_field_report_confirmations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.confirm_hub_field_report(p_report_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.hub_field_report_confirmations (report_id, user_id)
  VALUES (p_report_id, v_actor)
  ON CONFLICT (report_id, user_id) DO NOTHING;

  IF FOUND THEN
    UPDATE public.hub_field_reports
    SET confirmations_count = confirmations_count + 1
    WHERE id = p_report_id AND expires_at > now()
    RETURNING confirmations_count INTO v_count;
  ELSE
    SELECT confirmations_count INTO v_count
    FROM public.hub_field_reports
    WHERE id = p_report_id;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_hub_field_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_hub_field_report(uuid) TO authenticated;
