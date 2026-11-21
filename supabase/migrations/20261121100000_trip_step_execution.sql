-- Le Compas garde le plan. Le journal terrain enregistre chaque transition et
-- son contexte au moment de la saisie, même si l’étape planifiée est supprimée.
CREATE TABLE trip_private.trip_step_execution_events (
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  step_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  operation_id uuid NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('started', 'arrived', 'completed', 'skipped', 'postponed', 'cancelled')),
  source text NOT NULL CHECK (source = 'manual'),
  occurred_at timestamptz NOT NULL,
  actual_started_at timestamptz,
  actual_arrived_at timestamptz,
  actual_completed_at timestamptz,
  note text CHECK (char_length(note) <= 500),
  planned_title text NOT NULL,
  planned_day_number integer NOT NULL,
  planned_order_index integer NOT NULL,
  planned_start_time time,
  planned_updated_at timestamptz NOT NULL,
  PRIMARY KEY (trip_id, step_id, version),
  UNIQUE (trip_id, operation_id)
);

CREATE INDEX trip_step_execution_events_actor_idx
  ON trip_private.trip_step_execution_events (actor_id) WHERE actor_id IS NOT NULL;

ALTER TABLE trip_private.trip_step_execution_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON trip_private.trip_step_execution_events FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION trip_private.record_trip_step_execution(
  p_trip_id uuid,
  p_step_id uuid,
  p_operation_id uuid,
  p_expected_version integer,
  p_expected_plan_updated_at timestamptz,
  p_status text,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  step public.trip_steps%ROWTYPE;
  latest trip_private.trip_step_execution_events%ROWTYPE;
  recorded trip_private.trip_step_execution_events%ROWTYPE;
  cleaned_note text := nullif(btrim(p_note, E' \t\r\n'), '');
  changed_at timestamptz;
  started_at timestamptz;
  arrived_at timestamptz;
BEGIN
  IF actor IS NULL OR NOT public.can_edit_trip(p_trip_id) THEN
    RAISE EXCEPTION 'Modification réservée aux éditeurs du voyage.' USING ERRCODE = '42501';
  END IF;
  IF p_step_id IS NULL OR p_operation_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 0
    OR p_expected_plan_updated_at IS NULL
    OR p_status IS NULL OR p_status NOT IN ('started', 'arrived', 'completed', 'skipped', 'postponed', 'cancelled')
    OR char_length(cleaned_note) > 500
  THEN
    RAISE EXCEPTION 'Action terrain invalide.' USING ERRCODE = '22023';
  END IF;

  -- Même ordre de prise des verrous qu’une suppression de voyage. Le verrou
  -- sur l’étape sérialise les commandes et fige la version du plan observée.
  PERFORM 1 FROM public.trips AS t WHERE t.id = p_trip_id FOR KEY SHARE;
  SELECT s.* INTO step FROM public.trip_steps AS s
  WHERE s.trip_id = p_trip_id AND s.id = p_step_id FOR NO KEY UPDATE;

  IF NOT public.can_edit_trip(p_trip_id) THEN
    RAISE EXCEPTION 'Modification réservée aux éditeurs du voyage.' USING ERRCODE = '42501';
  END IF;

  SELECT e.* INTO recorded FROM trip_private.trip_step_execution_events AS e
  WHERE e.trip_id = p_trip_id AND e.operation_id = p_operation_id;
  IF FOUND THEN
    IF recorded.step_id <> p_step_id OR recorded.actor_id IS DISTINCT FROM actor
      OR recorded.status <> p_status OR recorded.note IS DISTINCT FROM cleaned_note
    THEN
      RAISE EXCEPTION 'Cette opération terrain a déjà été utilisée.' USING ERRCODE = 'PT409';
    END IF;
  ELSE
    IF step.id IS NULL THEN
      RAISE EXCEPTION 'Étape introuvable dans ce voyage.' USING ERRCODE = 'PT404';
    END IF;
    IF step.updated_at IS DISTINCT FROM p_expected_plan_updated_at THEN
      RAISE EXCEPTION 'Le plan de cette étape a changé. Actualise son suivi.' USING ERRCODE = 'PT409';
    END IF;

    SELECT e.* INTO latest FROM trip_private.trip_step_execution_events AS e
    WHERE e.trip_id = p_trip_id AND e.step_id = p_step_id
    ORDER BY e.version DESC LIMIT 1;
    IF coalesce(latest.version, 0) <> p_expected_version THEN
      RAISE EXCEPTION 'Cette étape a changé. Actualise son suivi.' USING ERRCODE = 'PT409';
    END IF;
    IF NOT (CASE coalesce(latest.status, 'pending')
      WHEN 'pending' THEN p_status IN ('started', 'arrived', 'skipped', 'postponed', 'cancelled')
      WHEN 'started' THEN p_status IN ('arrived', 'completed', 'skipped', 'postponed', 'cancelled')
      WHEN 'arrived' THEN p_status IN ('completed', 'skipped', 'postponed', 'cancelled')
      WHEN 'postponed' THEN p_status IN ('started', 'arrived', 'skipped', 'cancelled')
      ELSE false
    END) THEN
      RAISE EXCEPTION 'Cette action ne correspond plus à l’état de l’étape.' USING ERRCODE = 'PT409';
    END IF;

    changed_at := greatest(clock_timestamp(), latest.occurred_at);
    -- Une reprise ouvre une tentative. Les instants de la précédente restent
    -- dans le journal, à leur version. Une arrivée directe ne déduit pas de départ.
    IF latest.status IS DISTINCT FROM 'postponed' OR p_status NOT IN ('started', 'arrived') THEN
      started_at := latest.actual_started_at;
      arrived_at := latest.actual_arrived_at;
    END IF;
    IF p_status = 'started' THEN started_at := changed_at; END IF;
    IF p_status = 'arrived' THEN arrived_at := changed_at; END IF;

    INSERT INTO trip_private.trip_step_execution_events (
      trip_id, step_id, version, operation_id, actor_id, status, source, occurred_at,
      actual_started_at, actual_arrived_at, actual_completed_at, note,
      planned_title, planned_day_number, planned_order_index, planned_start_time, planned_updated_at
    ) VALUES (
      p_trip_id, p_step_id, p_expected_version + 1, p_operation_id, actor, p_status, 'manual', changed_at,
      started_at, arrived_at, CASE WHEN p_status = 'completed' THEN changed_at END, cleaned_note,
      step.title, step.day_number, step.order_index, step.start_time, step.updated_at
    )
    ON CONFLICT (trip_id, operation_id) DO NOTHING
    RETURNING * INTO recorded;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cette opération terrain a déjà été utilisée.' USING ERRCODE = 'PT409';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'step_id', recorded.step_id, 'status', recorded.status, 'version', recorded.version,
    'occurred_at', recorded.occurred_at, 'note', recorded.note,
    'actual_started_at', recorded.actual_started_at, 'actual_arrived_at', recorded.actual_arrived_at,
    'actual_completed_at', recorded.actual_completed_at,
    'archived', step.id IS NULL, 'planned_title', recorded.planned_title,
    'planned_day_number', recorded.planned_day_number, 'planned_start_time', recorded.planned_start_time
  );
END;
$$;

CREATE FUNCTION public.record_trip_step_execution(
  p_trip_id uuid,
  p_step_id uuid,
  p_operation_id uuid,
  p_expected_version integer,
  p_expected_plan_updated_at timestamptz,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT trip_private.record_trip_step_execution(
    p_trip_id, p_step_id, p_operation_id, p_expected_version, p_expected_plan_updated_at, p_status, p_note
  );
$$;

CREATE FUNCTION trip_private.read_trip_step_execution(p_trip_id uuid)
RETURNS TABLE (
  step_id uuid,
  status text,
  version integer,
  occurred_at timestamptz,
  actual_started_at timestamptz,
  actual_arrived_at timestamptz,
  actual_completed_at timestamptz,
  note text,
  archived boolean,
  planned_title text,
  planned_day_number integer,
  planned_start_time time
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  can_edit boolean := public.can_edit_trip(p_trip_id);
BEGIN
  IF actor IS NULL OR NOT (
    can_edit
    OR EXISTS (
      SELECT 1 FROM public.trip_participants AS p
      WHERE p.trip_id = p_trip_id AND p.user_id = actor AND p.status = 'confirmed'
    )
    OR EXISTS (
      SELECT 1 FROM trip_private.visible_event_trip_links AS l WHERE l.trip_id = p_trip_id
    )
  ) THEN
    RAISE EXCEPTION 'Suivi réservé aux membres autorisés du voyage.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT latest.step_id, latest.status, latest.version, latest.occurred_at,
    latest.actual_started_at, latest.actual_arrived_at, latest.actual_completed_at,
    CASE WHEN can_edit THEN latest.note END,
    s.id IS NULL, latest.planned_title, latest.planned_day_number, latest.planned_start_time
  FROM (
    SELECT DISTINCT ON (e.step_id) e.*
    FROM trip_private.trip_step_execution_events AS e
    WHERE e.trip_id = p_trip_id
    ORDER BY e.step_id DESC, e.version DESC
  ) AS latest
  LEFT JOIN public.trip_steps AS s ON s.trip_id = latest.trip_id AND s.id = latest.step_id
  ORDER BY coalesce(s.day_number, latest.planned_day_number),
    coalesce(s.order_index, latest.planned_order_index), s.id IS NULL, latest.step_id;
END;
$$;

CREATE FUNCTION public.read_trip_step_execution(p_trip_id uuid)
RETURNS TABLE (
  step_id uuid,
  status text,
  version integer,
  occurred_at timestamptz,
  actual_started_at timestamptz,
  actual_arrived_at timestamptz,
  actual_completed_at timestamptz,
  note text,
  archived boolean,
  planned_title text,
  planned_day_number integer,
  planned_start_time time
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT * FROM trip_private.read_trip_step_execution(p_trip_id);
$$;

REVOKE ALL ON FUNCTION trip_private.record_trip_step_execution(uuid, uuid, uuid, integer, timestamptz, text, text),
  public.record_trip_step_execution(uuid, uuid, uuid, integer, timestamptz, text, text),
  trip_private.read_trip_step_execution(uuid), public.read_trip_step_execution(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION trip_private.record_trip_step_execution(uuid, uuid, uuid, integer, timestamptz, text, text),
  public.record_trip_step_execution(uuid, uuid, uuid, integer, timestamptz, text, text),
  trip_private.read_trip_step_execution(uuid), public.read_trip_step_execution(uuid)
  TO authenticated;
