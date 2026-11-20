-- Exécuter dans une transaction. Une révision publiée doit garder sa géométrie.
LOCK TABLE public.club_events IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.club_event_route_revisions WHERE canonical_revision_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Le retour arrière détacherait des géométries publiées.';
  END IF;
END;
$$;

DROP FUNCTION public.publish_club_event_route(uuid, integer, bigint, text);
DROP FUNCTION club_private.publish_club_event_route(uuid, integer, bigint, text);
DROP TRIGGER guard_event_route_revision ON public.club_events;
DROP FUNCTION club_private.guard_event_route_revision();
DROP POLICY club_event_route_rev_read ON public.club_event_route_revisions;
CREATE POLICY club_event_route_rev_read ON public.club_event_route_revisions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.club_events AS e WHERE e.id = event_id AND public.lkdv_is_club_member(e.club_id))
  );
CREATE POLICY club_event_route_rev_insert ON public.club_event_route_revisions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.club_events AS e WHERE e.id = event_id AND public.lkdv_is_club_moderator(e.club_id))
  );
GRANT INSERT, UPDATE, DELETE ON public.club_event_route_revisions TO authenticated;
DROP FUNCTION club_private.can_read_event_route(uuid);
DROP FUNCTION club_private.active_event_route_participants(uuid, uuid);
ALTER TABLE public.club_event_route_revisions
  ALTER COLUMN elevation_gain_m SET NOT NULL,
  DROP COLUMN previous_meeting,
  DROP COLUMN meeting_point,
  DROP COLUMN route_name,
  DROP COLUMN canonical_revision_id;
