-- Retour arrière : expressions de politiques d'origine (relevées en production le 01/11/2026) et index recréés.
ALTER POLICY story_comments_insert_own ON public.story_comments WITH CHECK (author_id = auth.uid());
ALTER POLICY story_comments_delete_own ON public.story_comments USING (author_id = auth.uid());

ALTER POLICY activity_sessions_owner_read ON public.activity_sessions
  USING ((user_id = auth.uid()) OR ((share_level = 'followers'::text) AND (status = 'live'::text)
    AND (EXISTS (SELECT 1 FROM public.user_follows f WHERE f.follower_id = auth.uid() AND f.following_id = activity_sessions.user_id))
    AND (EXISTS (SELECT 1 FROM public.user_follows f2 WHERE f2.follower_id = activity_sessions.user_id AND f2.following_id = auth.uid()))));
ALTER POLICY activity_sessions_owner_write ON public.activity_sessions WITH CHECK (user_id = auth.uid());
ALTER POLICY activity_sessions_owner_update ON public.activity_sessions USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER POLICY activity_points_owner_read ON public.activity_points
  USING (EXISTS (SELECT 1 FROM public.activity_sessions s WHERE s.id = activity_points.session_id AND s.user_id = auth.uid()));
ALTER POLICY activity_points_owner_write ON public.activity_points
  WITH CHECK (EXISTS (SELECT 1 FROM public.activity_sessions s WHERE s.id = activity_points.session_id AND s.user_id = auth.uid()));

ALTER POLICY sos_alerts_owner_rw ON public.sos_alerts USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_admin_regions_geo_geom ON public.admin_regions_geo USING gist (geometry);
CREATE INDEX IF NOT EXISTS hiking_routes_geom_gix ON public.hiking_routes USING gist (geom);
