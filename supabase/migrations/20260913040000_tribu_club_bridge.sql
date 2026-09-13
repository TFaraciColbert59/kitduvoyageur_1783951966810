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
