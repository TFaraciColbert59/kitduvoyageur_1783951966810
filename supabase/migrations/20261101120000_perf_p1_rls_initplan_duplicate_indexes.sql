-- Mission Fusée, phase 1, lot 1 (risque nul) — à appliquer par Tony (SQL Editor), rollback :
-- supabase/migrations_down/20261101120000_perf_p1_rls_initplan_duplicate_indexes.down.sql
--
-- 1) Advisor auth_rls_initplan : 8 politiques réévaluaient auth.uid() pour chaque ligne.
--    `(select auth.uid())` est évalué une fois par requête (InitPlan). Même sémantique, mêmes
--    noms, rôles et commandes : seul le texte des expressions change (ALTER POLICY).
-- 2) Advisor duplicate_index : 2 paires d'index GiST identiques ; on garde le plus utilisé
--    (idx_scan relevé le 01/11/2026) et on retire l'autre, qui ralentit chaque écriture.

-- story_comments
ALTER POLICY story_comments_insert_own ON public.story_comments
  WITH CHECK (author_id = (select auth.uid()));
ALTER POLICY story_comments_delete_own ON public.story_comments
  USING (author_id = (select auth.uid()));

-- activity_sessions
ALTER POLICY activity_sessions_owner_read ON public.activity_sessions
  USING (
    (user_id = (select auth.uid()))
    OR (
      share_level = 'followers'::text
      AND status = 'live'::text
      AND EXISTS (
        SELECT 1 FROM public.user_follows f
        WHERE f.follower_id = (select auth.uid()) AND f.following_id = activity_sessions.user_id
      )
      AND EXISTS (
        SELECT 1 FROM public.user_follows f2
        WHERE f2.follower_id = activity_sessions.user_id AND f2.following_id = (select auth.uid())
      )
    )
  );
ALTER POLICY activity_sessions_owner_write ON public.activity_sessions
  WITH CHECK (user_id = (select auth.uid()));
ALTER POLICY activity_sessions_owner_update ON public.activity_sessions
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- activity_points
ALTER POLICY activity_points_owner_read ON public.activity_points
  USING (EXISTS (
    SELECT 1 FROM public.activity_sessions s
    WHERE s.id = activity_points.session_id AND s.user_id = (select auth.uid())
  ));
ALTER POLICY activity_points_owner_write ON public.activity_points
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.activity_sessions s
    WHERE s.id = activity_points.session_id AND s.user_id = (select auth.uid())
  ));

-- sos_alerts
ALTER POLICY sos_alerts_owner_rw ON public.sos_alerts
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Index en double (tables petites : verrou bref, pas besoin de CONCURRENTLY)
-- admin_regions_geo : garde admin_regions_geo_geom_gix (2 324 scans, 1,4 Mo), retire le doublon (2 scans, 4,1 Mo)
DROP INDEX IF EXISTS public.idx_admin_regions_geo_geom;
-- hiking_routes : garde idx_hiking_routes_geom (16 669 scans), retire le doublon (4 718 scans)
DROP INDEX IF EXISTS public.hiking_routes_geom_gix;
