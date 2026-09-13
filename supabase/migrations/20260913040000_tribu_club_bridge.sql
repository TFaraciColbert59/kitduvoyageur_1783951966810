-- ============================================================
-- TRIBU — M4 : pont Club -> Groupe (colonne, index, helper)
-- ============================================================

ALTER TABLE public.travel_groups
  ADD COLUMN IF NOT EXISTS parent_club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_travel_groups_parent_club
  ON public.travel_groups(parent_club_id);

CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = p_user_id
      AND cm.status = 'active'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_club_member(UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_club_member(UUID, UUID) FROM PUBLIC, anon;

-- ── Garde d'insertion : un groupe club_only exige d'etre membre du club ─────
DROP POLICY IF EXISTS "groups_auth_insert" ON public.travel_groups;
CREATE POLICY "groups_auth_insert" ON public.travel_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      parent_club_id IS NULL
      OR public.is_club_member(parent_club_id, auth.uid())
    )
  );
