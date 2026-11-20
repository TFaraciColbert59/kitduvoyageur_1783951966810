-- Rollback for 20261120220000_perf_rls_initplan_spatial_indexes.sql

ALTER POLICY "activity_lifecycle_records_owner_delete" ON public."activity_lifecycle_records" USING ((user_id = auth.uid()));
ALTER POLICY "activity_lifecycle_records_owner_insert" ON public."activity_lifecycle_records" WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "activity_lifecycle_records_owner_read" ON public."activity_lifecycle_records" USING ((user_id = auth.uid()));
ALTER POLICY "activity_lifecycle_records_owner_update" ON public."activity_lifecycle_records" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "club_matches_insert" ON public."club_activity_matches" WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "club_matches_read" ON public."club_activity_matches" USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_activity_matches.event_id) AND lkdv_is_club_moderator(e.club_id))))));
ALTER POLICY "club_matches_update" ON public."club_activity_matches" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "club_challenge_progress_read" ON public."club_challenge_progress" USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM club_challenges c
  WHERE ((c.id = club_challenge_progress.challenge_id) AND (c.club_id IS NOT NULL) AND lkdv_is_club_member(c.club_id))))));
ALTER POLICY "club_challenge_progress_update" ON public."club_challenge_progress" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "club_challenge_progress_write" ON public."club_challenge_progress" WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "club_messages_author_delete" ON public."club_channel_messages" USING ((lkdv_is_club_moderator(club_id) OR (author_id = auth.uid())));
ALTER POLICY "club_messages_author_update" ON public."club_channel_messages" USING ((lkdv_is_club_moderator(club_id) OR (author_id = auth.uid()))) WITH CHECK ((lkdv_is_club_moderator(club_id) OR (author_id = auth.uid())));
ALTER POLICY "club_messages_member_insert" ON public."club_channel_messages" WITH CHECK (((author_id = auth.uid()) AND lkdv_is_club_member(club_id)));
ALTER POLICY "club_reports_member_insert" ON public."club_content_reports" WITH CHECK (((reporter_id = auth.uid()) AND lkdv_is_club_member(club_id)));
ALTER POLICY "club_event_attendance_insert" ON public."club_event_attendance" WITH CHECK (((user_id = auth.uid()) AND consent_granted));
ALTER POLICY "club_event_attendance_read" ON public."club_event_attendance" USING ((((user_id = auth.uid()) AND consent_granted) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_event_attendance.event_id) AND lkdv_is_club_moderator(e.club_id))))));
ALTER POLICY "club_event_regs_insert" ON public."club_event_registrations" WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "club_event_regs_read" ON public."club_event_registrations" USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_event_registrations.event_id) AND lkdv_is_club_moderator(e.club_id))))));
ALTER POLICY "club_event_regs_update" ON public."club_event_registrations" USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_event_registrations.event_id) AND lkdv_is_club_moderator(e.club_id)))))) WITH CHECK (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_event_registrations.event_id) AND lkdv_is_club_moderator(e.club_id))))));
ALTER POLICY "club_event_route_sync_read" ON public."club_event_route_sync" USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_event_route_sync.event_id) AND lkdv_is_club_moderator(e.club_id))))));
ALTER POLICY "club_event_route_sync_update" ON public."club_event_route_sync" USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_event_route_sync.event_id) AND lkdv_is_club_moderator(e.club_id)))))) WITH CHECK (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM club_events e
  WHERE ((e.id = club_event_route_sync.event_id) AND lkdv_is_club_moderator(e.club_id))))));
ALTER POLICY "club_event_route_sync_write" ON public."club_event_route_sync" WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "club_invites_creator_insert" ON public."club_invites" WITH CHECK ((created_by = auth.uid()));
ALTER POLICY "club_invites_creator_read" ON public."club_invites" USING (((created_by = auth.uid()) OR ((club_id IS NOT NULL) AND lkdv_is_club_moderator(club_id))));
ALTER POLICY "club_invites_creator_update" ON public."club_invites" USING (((created_by = auth.uid()) OR ((club_id IS NOT NULL) AND lkdv_is_club_moderator(club_id)))) WITH CHECK (((created_by = auth.uid()) OR ((club_id IS NOT NULL) AND lkdv_is_club_moderator(club_id))));
ALTER POLICY "club_activity_invites_insert" ON public."club_recorded_activity_invites" WITH CHECK ((owner_user_id = auth.uid()));
ALTER POLICY "club_activity_invites_read" ON public."club_recorded_activity_invites" USING (((owner_user_id = auth.uid()) OR (invitee_user_id = auth.uid())));
ALTER POLICY "club_activity_invites_update" ON public."club_recorded_activity_invites" USING (((owner_user_id = auth.uid()) OR (invitee_user_id = auth.uid()))) WITH CHECK (((owner_user_id = auth.uid()) OR (invitee_user_id = auth.uid())));
ALTER POLICY "heatmap_contribution_preferences_delete_own" ON public."heatmap_contribution_preferences" USING ((user_id = auth.uid()));
ALTER POLICY "heatmap_contribution_preferences_insert_own" ON public."heatmap_contribution_preferences" WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "heatmap_contribution_preferences_select_own" ON public."heatmap_contribution_preferences" USING ((user_id = auth.uid()));
ALTER POLICY "heatmap_contribution_preferences_update_own" ON public."heatmap_contribution_preferences" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "kit_placed_badges_delete_own" ON public."kit_placed_badges" USING ((user_id = auth.uid()));
ALTER POLICY "kit_placed_badges_insert_own" ON public."kit_placed_badges" WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "kit_placed_badges_select_group" ON public."kit_placed_badges" USING (((user_id = auth.uid()) OR can_read_member_kit(user_id, kit_id)));
ALTER POLICY "kit_placed_badges_select_own" ON public."kit_placed_badges" USING ((user_id = auth.uid()));
ALTER POLICY "kit_placed_badges_update_own" ON public."kit_placed_badges" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "materiel_kit_items_select_group" ON public."materiel_kit_items" USING (((user_id = auth.uid()) OR can_read_member_kit(user_id, kit_id)));
ALTER POLICY "materiel_kits_select_group" ON public."materiel_kits" USING (((user_id = auth.uid()) OR can_read_member_kit(user_id, id)));
ALTER POLICY "offline_sync_operations_insert_finish_rpc" ON public."offline_sync_operations" WITH CHECK (((kind = 'activity.finish'::text) AND (auth.uid() = user_id) AND (CURRENT_USER = ( SELECT pg_get_userbyid(p.proowner) AS pg_get_userbyid
   FROM pg_proc p
  WHERE (p.oid = ('finish_activity_session_idempotent(uuid,text)'::regprocedure)::oid)))));
ALTER POLICY "offline_sync_operations_insert_own" ON public."offline_sync_operations" WITH CHECK (((auth.uid() = user_id) AND (kind <> 'activity.finish'::text)));
ALTER POLICY "offline_sync_operations_select_finish_rpc" ON public."offline_sync_operations" USING (((auth.uid() = user_id) AND (CURRENT_USER = ( SELECT pg_get_userbyid(p.proowner) AS pg_get_userbyid
   FROM pg_proc p
  WHERE (p.oid = ('finish_activity_session_idempotent(uuid,text)'::regprocedure)::oid)))));
ALTER POLICY "progression_goals_owner_all" ON public."progression_goals" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
ALTER POLICY "user_content_mutes_delete_own" ON public."user_content_mutes" USING ((muter_id = auth.uid()));
ALTER POLICY "user_content_mutes_insert_own" ON public."user_content_mutes" WITH CHECK (((muter_id = auth.uid()) AND (muted_id <> auth.uid()) AND (NOT is_anonymous_session()) AND (EXISTS ( SELECT 1
   FROM user_follows f
  WHERE ((f.follower_id = auth.uid()) AND (f.following_id = user_content_mutes.muted_id))))));
ALTER POLICY "user_content_mutes_select_own" ON public."user_content_mutes" USING ((muter_id = auth.uid()));
DROP INDEX IF EXISTS public.idx_activities_user_id;
DROP INDEX IF EXISTS public.idx_carnet_collaborators_user_id;
DROP INDEX IF EXISTS public.idx_hike_sessions_activity_session_id;
DROP INDEX IF EXISTS public.idx_hike_session_photos_user_id;
DROP INDEX IF EXISTS public.idx_club_events_organizer_id;
DROP INDEX IF EXISTS public.idx_club_event_registrations_user_id;
DROP INDEX IF EXISTS public.idx_materiel_loans_product_ownership_id;
DROP INDEX IF EXISTS public.idx_alerts_product_ownership_id;
DROP INDEX IF EXISTS public.idx_group_members_invited_by;
DROP INDEX IF EXISTS public.idx_group_tasks_assigned_to;
DROP INDEX IF EXISTS public.idx_group_tasks_created_by;
DROP INDEX IF EXISTS public.idx_activity_sessions_route_id;
DROP INDEX IF EXISTS public.idx_places_author_id;
