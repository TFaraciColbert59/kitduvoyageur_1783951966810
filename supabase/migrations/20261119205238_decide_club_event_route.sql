-- Une réception ne vaut pas adoption. La décision de chaque version reste historisée.
ALTER TABLE public.club_event_route_sync
  ADD COLUMN adopted_revision integer CHECK (adopted_revision > 0);

CREATE TABLE public.club_event_route_decisions (
  event_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  adopted boolean NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id, revision),
  FOREIGN KEY (event_id, revision)
    REFERENCES public.club_event_route_revisions(event_id, revision) ON DELETE CASCADE
);
CREATE INDEX club_event_route_decisions_user_idx ON public.club_event_route_decisions (user_id);
CREATE INDEX club_event_route_decisions_revision_idx ON public.club_event_route_decisions (event_id, revision);

ALTER TABLE public.club_event_route_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_event_route_decisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.club_event_route_decisions TO authenticated;
CREATE POLICY club_event_route_decisions_own ON public.club_event_route_decisions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY club_event_route_sync_write ON public.club_event_route_sync;
DROP POLICY club_event_route_sync_update ON public.club_event_route_sync;
REVOKE INSERT, UPDATE, DELETE ON public.club_event_route_sync FROM PUBLIC, anon, authenticated;

CREATE FUNCTION club_private.save_event_route_state(p_event_id uuid, p_revision integer, p_adopt boolean)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  e public.club_events%ROWTYPE;
  current_revision public.club_event_route_revisions%ROWTYPE;
  state public.club_event_route_sync%ROWTYPE;
  recorded_choice boolean;
  adopted integer;
  pending integer;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;
  IF p_adopt IS NOT NULL AND (p_revision IS NULL OR p_revision < 1) THEN
    RAISE EXCEPTION 'Révision invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO e FROM public.club_events AS ev WHERE ev.id = p_event_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM club_private.active_event_route_participants(e.id, actor)
  ) THEN
    RAISE EXCEPTION 'Ce parcours n’est plus accessible.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO current_revision FROM public.club_event_route_revisions AS r
  WHERE r.event_id = e.id AND r.revision = e.route_revision;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucune révision publiée.' USING ERRCODE = 'P0002';
  END IF;
  IF p_revision IS NOT NULL AND p_revision <> current_revision.revision THEN
    RAISE EXCEPTION 'Le parcours a changé. Actualise la fiche avant de répondre.' USING ERRCODE = '40001';
  END IF;

  SELECT d.adopted INTO recorded_choice FROM public.club_event_route_decisions AS d
  WHERE d.event_id = e.id AND d.user_id = actor AND d.revision = current_revision.revision;
  IF p_adopt IS NOT NULL THEN
    IF current_revision.canonical_revision_id IS NULL THEN
      RAISE EXCEPTION 'La géométrie de cette révision n’est pas disponible.' USING ERRCODE = '55000';
    END IF;
    IF recorded_choice IS NOT NULL AND recorded_choice <> p_adopt THEN
      RAISE EXCEPTION 'Une décision est déjà enregistrée pour ce parcours.' USING ERRCODE = '40001';
    END IF;
    IF recorded_choice IS NULL THEN
      INSERT INTO public.club_event_route_decisions(event_id, user_id, revision, adopted)
      VALUES (e.id, actor, current_revision.revision, p_adopt);
      recorded_choice := p_adopt;
    END IF;
  END IF;

  SELECT max(d.revision) INTO adopted FROM public.club_event_route_decisions AS d
  WHERE d.event_id = e.id AND d.user_id = actor AND d.adopted;
  IF recorded_choice IS NULL AND current_revision.requires_participant_decision THEN
    pending := current_revision.revision;
  END IF;

  INSERT INTO public.club_event_route_sync (
    event_id, user_id, last_synced_revision, pending_revision, decision_required, revoked, synced_at, adopted_revision
  ) VALUES (e.id, actor, current_revision.revision, pending, pending IS NOT NULL, false, clock_timestamp(), adopted)
  ON CONFLICT (event_id, user_id) DO UPDATE SET
    last_synced_revision = EXCLUDED.last_synced_revision, pending_revision = EXCLUDED.pending_revision,
    decision_required = EXCLUDED.decision_required, revoked = false,
    synced_at = EXCLUDED.synced_at, adopted_revision = EXCLUDED.adopted_revision
  RETURNING * INTO state;
  RETURN to_jsonb(state);
END;
$$;

CREATE FUNCTION public.save_event_route_state(
  p_event_id uuid, p_revision integer DEFAULT NULL, p_adopt boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT club_private.save_event_route_state(p_event_id, p_revision, p_adopt);
$$;
REVOKE ALL ON FUNCTION club_private.save_event_route_state(uuid, integer, boolean),
  public.save_event_route_state(uuid, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION club_private.save_event_route_state(uuid, integer, boolean),
  public.save_event_route_state(uuid, integer, boolean) TO authenticated;

CREATE FUNCTION public.get_club_event_route_trace(p_event_id uuid, p_revision integer)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT public.st_asgeojson(c.geom)::jsonb
  FROM public.club_event_route_revisions AS r
  JOIN public.hiking_route_revisions AS c ON c.id = r.canonical_revision_id
  WHERE r.event_id = p_event_id AND r.revision = p_revision;
$$;
REVOKE ALL ON FUNCTION public.get_club_event_route_trace(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_club_event_route_trace(uuid, integer) TO authenticated;

CREATE FUNCTION trip_private.trip_club_route_updates(p_trip_id uuid)
RETURNS TABLE (event_id uuid, event_title text, revision integer, route_name text, adopted_revision integer, decision_pending boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT e.id, e.title, r.revision, r.route_name, s.adopted_revision,
    r.requires_participant_decision
      AND EXISTS (SELECT 1 FROM club_private.active_event_route_participants(e.id, (SELECT auth.uid())))
      AND d.revision IS NULL
  FROM trip_private.visible_event_trip_links AS l
  JOIN public.club_events AS e ON e.id = l.event_id
  JOIN public.club_event_route_revisions AS r ON r.event_id = e.id AND r.revision = e.route_revision
  LEFT JOIN public.club_event_route_sync AS s ON s.event_id = e.id AND s.user_id = (SELECT auth.uid())
  LEFT JOIN public.club_event_route_decisions AS d ON d.event_id = e.id AND d.user_id = (SELECT auth.uid())
    AND d.revision = r.revision
  WHERE l.trip_id = p_trip_id AND l.source_kind = 'club_event' AND r.canonical_revision_id IS NOT NULL
  ORDER BY r.updated_at DESC, e.id;
$$;

CREATE FUNCTION public.get_trip_club_route_updates(p_trip_id uuid)
RETURNS TABLE (event_id uuid, event_title text, revision integer, route_name text, adopted_revision integer, decision_pending boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT * FROM trip_private.trip_club_route_updates(p_trip_id);
$$;
REVOKE ALL ON FUNCTION trip_private.trip_club_route_updates(uuid), public.get_trip_club_route_updates(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION trip_private.trip_club_route_updates(uuid), public.get_trip_club_route_updates(uuid)
  TO authenticated;
