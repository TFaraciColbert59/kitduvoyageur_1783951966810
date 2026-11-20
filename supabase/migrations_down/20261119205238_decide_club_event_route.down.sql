-- Exécuter dans une transaction et dans l’ordre inverse des migrations.
LOCK TABLE public.club_events IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.club_event_route_decisions) THEN
    RAISE EXCEPTION 'Le retour arrière supprimerait des décisions de parcours.';
  END IF;
END;
$$;

DROP FUNCTION public.get_trip_club_route_updates(uuid);
DROP FUNCTION trip_private.trip_club_route_updates(uuid);
DROP FUNCTION public.get_club_event_route_trace(uuid, integer);
DROP FUNCTION public.save_event_route_state(uuid, integer, boolean);
DROP FUNCTION club_private.save_event_route_state(uuid, integer, boolean);
DROP TABLE public.club_event_route_decisions;
ALTER TABLE public.club_event_route_sync DROP COLUMN adopted_revision;
GRANT INSERT, UPDATE, DELETE ON public.club_event_route_sync TO authenticated;
CREATE POLICY club_event_route_sync_write ON public.club_event_route_sync
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY club_event_route_sync_update ON public.club_event_route_sync
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.club_events AS e WHERE e.id = event_id AND public.lkdv_is_club_moderator(e.club_id)
    )
  ) WITH CHECK (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.club_events AS e WHERE e.id = event_id AND public.lkdv_is_club_moderator(e.club_id)
    )
  );
