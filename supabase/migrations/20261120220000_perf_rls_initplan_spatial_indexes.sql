-- Performance P1: Fix all 46 auth_rls_initplan policies, optimize explorer_place GiST scan, add hot FK indexes.
-- Rollback: supabase/migrations_down/20261120220000_perf_rls_initplan_spatial_indexes.down.sql

-- 1. Wrap bare auth.uid()/auth.role()/auth.jwt() in (SELECT auth.*()) for InitPlan caching
ALTER POLICY "activity_lifecycle_records_owner_delete" ON public."activity_lifecycle_records" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "activity_lifecycle_records_owner_insert" ON public."activity_lifecycle_records" WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "activity_lifecycle_records_owner_read" ON public."activity_lifecycle_records" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "activity_lifecycle_records_owner_update" ON public."activity_lifecycle_records" USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "club_matches_insert" ON public."club_activity_matches" WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "club_matches_read" ON public."club_activity_matches" USING (((user_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_activity_matches.event_id) AND lkdv_is_club_moderator(e.club_id))))));
ALTER POLICY "club_matches_update" ON public."club_activity_matches" USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "club_challenge_progress_read" ON public."club_challenge_progress" USING (((user_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM club_challenges c
  WHERE ((c.id = club_challenge_progress.challenge_id) AND (c.club_id IS NOT NULL) AND lkdv_is_club_member(c.club_id))))));
ALTER POLICY "club_challenge_progress_update" ON public."club_challenge_progress" USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "club_challenge_progress_write" ON public."club_challenge_progress" WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "club_messages_author_delete" ON public."club_channel_messages" USING ((lkdv_is_club_moderator(club_id) OR (author_id = (SELECT auth.uid()))));
ALTER POLICY "club_messages_author_update" ON public."club_channel_messages" USING ((lkdv_is_club_moderator(club_id) OR (author_id = (SELECT auth.uid())))) WITH CHECK ((lkdv_is_club_moderator(club_id) OR (author_id = (SELECT auth.uid()))));
ALTER POLICY "club_messages_member_insert" ON public."club_channel_messages" WITH CHECK (((author_id = (SELECT auth.uid())) AND lkdv_is_club_member(club_id)));
ALTER POLICY "club_reports_member_insert" ON public."club_content_reports" WITH CHECK (((reporter_id = (SELECT auth.uid())) AND lkdv_is_club_member(club_id)));
ALTER POLICY "club_event_attendance_insert" ON public."club_event_attendance" WITH CHECK (((user_id = (SELECT auth.uid())) AND consent_granted));
ALTER POLICY "club_event_attendance_read" ON public."club_event_attendance" USING ((((user_id = (SELECT auth.uid())) AND consent_granted) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_event_attendance.event_id) AND lkdv_is_club_moderator(e.club_id))))));
ALTER POLICY "club_event_regs_insert" ON public."club_event_registrations" WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "club_event_regs_read" ON public."club_event_registrations" USING (((user_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_event_registrations.event_id) AND lkdv_is_club_moderator(e.club_id))))));
ALTER POLICY "club_event_regs_update" ON public."club_event_registrations" USING (((user_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_event_registrations.event_id) AND lkdv_is_club_moderator(e.club_id)))))) WITH CHECK (((user_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_event_registrations.event_id) AND lkdv_is_club_moderator(e.club_id))))));
ALTER POLICY "club_event_route_sync_read" ON public."club_event_route_sync" USING (((user_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_event_route_sync.event_id) AND lkdv_is_club_moderator(e.club_id))))));
-- Les installations où les décisions passent par le RPC ont déjà retiré ces deux policies.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'club_event_route_sync'
      AND policyname = 'club_event_route_sync_update'
  ) THEN
    ALTER POLICY "club_event_route_sync_update" ON public."club_event_route_sync" USING (((user_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
       FROM club_events e
      WHERE ((e.id = club_event_route_sync.event_id) AND lkdv_is_club_moderator(e.club_id)))))) WITH CHECK (((user_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
       FROM club_events e
      WHERE ((e.id = club_event_route_sync.event_id) AND lkdv_is_club_moderator(e.club_id))))));
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'club_event_route_sync'
      AND policyname = 'club_event_route_sync_write'
  ) THEN
    ALTER POLICY "club_event_route_sync_write" ON public."club_event_route_sync" WITH CHECK ((user_id = (SELECT auth.uid())));
  END IF;
END;
$$;
ALTER POLICY "club_invites_creator_insert" ON public."club_invites" WITH CHECK ((created_by = (SELECT auth.uid())));
ALTER POLICY "club_invites_creator_read" ON public."club_invites" USING (((created_by = (SELECT auth.uid())) OR ((club_id IS NOT NULL) AND lkdv_is_club_moderator(club_id))));
ALTER POLICY "club_invites_creator_update" ON public."club_invites" USING (((created_by = (SELECT auth.uid())) OR ((club_id IS NOT NULL) AND lkdv_is_club_moderator(club_id)))) WITH CHECK (((created_by = (SELECT auth.uid())) OR ((club_id IS NOT NULL) AND lkdv_is_club_moderator(club_id))));
ALTER POLICY "club_activity_invites_insert" ON public."club_recorded_activity_invites" WITH CHECK ((owner_user_id = (SELECT auth.uid())));
ALTER POLICY "club_activity_invites_read" ON public."club_recorded_activity_invites" USING (((owner_user_id = (SELECT auth.uid())) OR (invitee_user_id = (SELECT auth.uid()))));
ALTER POLICY "club_activity_invites_update" ON public."club_recorded_activity_invites" USING (((owner_user_id = (SELECT auth.uid())) OR (invitee_user_id = (SELECT auth.uid())))) WITH CHECK (((owner_user_id = (SELECT auth.uid())) OR (invitee_user_id = (SELECT auth.uid()))));
ALTER POLICY "heatmap_contribution_preferences_delete_own" ON public."heatmap_contribution_preferences" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "heatmap_contribution_preferences_insert_own" ON public."heatmap_contribution_preferences" WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "heatmap_contribution_preferences_select_own" ON public."heatmap_contribution_preferences" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "heatmap_contribution_preferences_update_own" ON public."heatmap_contribution_preferences" USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "kit_placed_badges_delete_own" ON public."kit_placed_badges" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "kit_placed_badges_insert_own" ON public."kit_placed_badges" WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "kit_placed_badges_select_group" ON public."kit_placed_badges" USING (((user_id = (SELECT auth.uid())) OR can_read_member_kit(user_id, kit_id)));
ALTER POLICY "kit_placed_badges_select_own" ON public."kit_placed_badges" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "kit_placed_badges_update_own" ON public."kit_placed_badges" USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "materiel_kit_items_select_group" ON public."materiel_kit_items" USING (((user_id = (SELECT auth.uid())) OR can_read_member_kit(user_id, kit_id)));
ALTER POLICY "materiel_kits_select_group" ON public."materiel_kits" USING (((user_id = (SELECT auth.uid())) OR can_read_member_kit(user_id, id)));
ALTER POLICY "offline_sync_operations_insert_finish_rpc" ON public."offline_sync_operations" WITH CHECK (((kind = 'activity.finish'::text) AND ((SELECT auth.uid()) = user_id) AND (CURRENT_USER = ( SELECT pg_get_userbyid(p.proowner) AS pg_get_userbyid
   FROM pg_proc p
  WHERE (p.oid = ('finish_activity_session_idempotent(uuid,text)'::regprocedure)::oid)))));
ALTER POLICY "offline_sync_operations_insert_own" ON public."offline_sync_operations" WITH CHECK ((((SELECT auth.uid()) = user_id) AND (kind <> 'activity.finish'::text)));
ALTER POLICY "offline_sync_operations_select_finish_rpc" ON public."offline_sync_operations" USING ((((SELECT auth.uid()) = user_id) AND (CURRENT_USER = ( SELECT pg_get_userbyid(p.proowner) AS pg_get_userbyid
   FROM pg_proc p
  WHERE (p.oid = ('finish_activity_session_idempotent(uuid,text)'::regprocedure)::oid)))));
ALTER POLICY "progression_goals_owner_all" ON public."progression_goals" USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "user_content_mutes_delete_own" ON public."user_content_mutes" USING ((muter_id = (SELECT auth.uid())));
ALTER POLICY "user_content_mutes_insert_own" ON public."user_content_mutes" WITH CHECK (((muter_id = (SELECT auth.uid())) AND (muted_id <> (SELECT auth.uid())) AND (NOT is_anonymous_session()) AND (EXISTS ( SELECT 1
   FROM user_follows f
  WHERE ((f.follower_id = (SELECT auth.uid())) AND (f.following_id = user_content_mutes.muted_id))))));
ALTER POLICY "user_content_mutes_select_own" ON public."user_content_mutes" USING ((muter_id = (SELECT auth.uid())));

-- 2. Hot-table missing FK indexes (verified via get_advisors + pg_stat_user_tables)
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON public.activities (user_id);
CREATE INDEX IF NOT EXISTS idx_carnet_collaborators_user_id ON public.carnet_collaborators (user_id);
CREATE INDEX IF NOT EXISTS idx_hike_sessions_activity_session_id ON public.hike_sessions (activity_session_id) WHERE activity_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hike_session_photos_user_id ON public.hike_session_photos (user_id);
CREATE INDEX IF NOT EXISTS idx_club_events_organizer_id ON public.club_events (organizer_id);
CREATE INDEX IF NOT EXISTS idx_club_event_registrations_user_id ON public.club_event_registrations (user_id);
CREATE INDEX IF NOT EXISTS idx_materiel_loans_product_ownership_id ON public.materiel_loans (product_ownership_id);
CREATE INDEX IF NOT EXISTS idx_alerts_product_ownership_id ON public.alerts (product_ownership_id);
CREATE INDEX IF NOT EXISTS idx_group_members_invited_by ON public.group_members (invited_by) WHERE invited_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_tasks_assigned_to ON public.group_tasks (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_tasks_created_by ON public.group_tasks (created_by);
CREATE INDEX IF NOT EXISTS idx_activity_sessions_route_id ON public.activity_sessions (route_id) WHERE route_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_places_author_id ON public.places (author_id) WHERE author_id IS NOT NULL;

-- 3. Optimize explorer_place(): single GiST bounding-box scan on geo_pois (inlined box literal) + single CTE scan on near_place
CREATE OR REPLACE FUNCTION public.explorer_place(p_lat double precision, p_lng double precision)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET statement_timeout TO '2500ms'
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with near_place as materialized (
    select p.name, p.kind, p.ele_m, p.country_code
      from public.geo_places p
     order by point(p.lon::double precision, p.lat::double precision) <-> point(p_lng, p_lat) asc
     limit 1
  ),
  poi_counts as (
    select
      count(*) filter (where g.subtype in ('drinking_water','spring')) as water,
      count(*) filter (where g.subtype in ('alpine_hut','wilderness_hut','shelter')) as refuges
    from public.geo_pois g
    where point(g.lon::double precision, g.lat::double precision) <@
          box(point(p_lng - 0.16, p_lat - 0.11), point(p_lng + 0.16, p_lat + 0.11))
      and g.subtype in ('drinking_water','spring','alpine_hut','wilderness_hut','shelter')
  ),
  counts as (
    select
      (select count(*) from public.hiking_routes h
        where h.geom is not null
          and h.geom && st_setsrid(st_makeenvelope(p_lng - 0.16, p_lat - 0.11, p_lng + 0.16, p_lat + 0.11, 4326), 4326)) as routes,
      (select water from poi_counts) as water,
      (select refuges from poi_counts) as refuges,
      (select count(*) from public.terrain_reports t
        where t.status = 'active'
          and t.lat between p_lat - 0.11 and p_lat + 0.11
          and t.lng between p_lng - 0.16 and p_lng + 0.16) as reports
  )
  select jsonb_build_object(
    'regionName', np.name,
    'placeName', np.name,
    'countryCode', np.country_code,
    'elevationM', np.ele_m,
    'counts', jsonb_build_object(
      'routes', c.routes, 'water', c.water, 'refuges', c.refuges, 'reports', c.reports
    )
  )
  from counts c
  left join near_place np on true;
$function$;
