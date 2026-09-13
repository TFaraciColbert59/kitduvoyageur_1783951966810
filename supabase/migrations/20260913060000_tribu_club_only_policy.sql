-- ============================================================
-- TRIBU — M6 : lecture des groupes club_only (membres du club)
-- ============================================================

DROP POLICY IF EXISTS "groups_club_read" ON public.travel_groups;
CREATE POLICY "groups_club_read" ON public.travel_groups
  FOR SELECT TO authenticated
  USING (
    visibility = 'club_only'::public.group_visibility
    AND parent_club_id IS NOT NULL
    AND public.is_club_member(parent_club_id, auth.uid())
  );
