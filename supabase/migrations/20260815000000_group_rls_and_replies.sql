-- ============================================================
-- Chantier groupes — durcissement RLS + réponses commentaires
-- ============================================================
-- Corrige les erreurs « new row violates row-level security policy »
-- sur group_kit_items, group_expenses, group_polls, group_messages
-- et unifie les policies selon appartenance + rôle (organizer/owner).
-- N'ayant jamais désactivé RLS : policies recréées proprement.
-- ============================================================

-- ── 0. Fonctions d'appartenance (robustes, search_path sécurisé) ──────────
-- DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid);
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND status = 'active'
  )
$$;

-- DROP FUNCTION IF EXISTS public.is_group_organizer(uuid, uuid);
CREATE OR REPLACE FUNCTION public.is_group_organizer(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND status = 'active'
      AND role IN ('organizer', 'co_organizer')
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_group_organizer(uuid, uuid) TO authenticated, anon;

-- ── 1. travel_groups ──────────────────────────────────────────────────────
ALTER TABLE public.travel_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_public_read" ON public.travel_groups;
CREATE POLICY "groups_public_read" ON public.travel_groups
  FOR SELECT TO public
  USING (
    visibility = 'public'::public.group_visibility
    OR owner_id = auth.uid()
    OR public.is_group_member(id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = id AND gm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "groups_auth_insert" ON public.travel_groups;
CREATE POLICY "groups_auth_insert" ON public.travel_groups
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "groups_organizer_update" ON public.travel_groups;
CREATE POLICY "groups_organizer_update" ON public.travel_groups
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_group_organizer(id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_group_organizer(id, auth.uid()));

DROP POLICY IF EXISTS "groups_owner_delete" ON public.travel_groups;
CREATE POLICY "groups_owner_delete" ON public.travel_groups
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ── 2. group_members ──────────────────────────────────────────────────────
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_own_group" ON public.group_members;
CREATE POLICY "members_read_own_group" ON public.group_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_group_member(group_id, auth.uid())
  );

DROP POLICY IF EXISTS "members_join_group" ON public.group_members;
CREATE POLICY "members_join_group" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.travel_groups g WHERE g.id = group_id AND g.visibility = 'public')
      OR EXISTS (SELECT 1 FROM public.travel_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
    )
  );

-- Un organisateur peut ajouter un membre (ou une invitation en 'pending')
DROP POLICY IF EXISTS "members_organizer_insert" ON public.group_members;
CREATE POLICY "members_organizer_insert" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_organizer(group_id, auth.uid()));

DROP POLICY IF EXISTS "members_update_own" ON public.group_members;
CREATE POLICY "members_update_own" ON public.group_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_organizer(group_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_group_organizer(group_id, auth.uid()));

DROP POLICY IF EXISTS "members_delete_own" ON public.group_members;
CREATE POLICY "members_delete_own" ON public.group_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_organizer(group_id, auth.uid()));

-- ── 3. group_messages ─────────────────────────────────────────────────────
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_member_read" ON public.group_messages;
CREATE POLICY "messages_member_read" ON public.group_messages
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "messages_member_insert" ON public.group_messages;
CREATE POLICY "messages_member_insert" ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "messages_own_update" ON public.group_messages;
CREATE POLICY "messages_own_update" ON public.group_messages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_organizer(group_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_group_organizer(group_id, auth.uid()));

DROP POLICY IF EXISTS "messages_own_delete" ON public.group_messages;
CREATE POLICY "messages_own_delete" ON public.group_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_organizer(group_id, auth.uid()));

-- ── 4. group_expenses ─────────────────────────────────────────────────────
ALTER TABLE public.group_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_member_all" ON public.group_expenses;
-- Tout membre peut consulter/ajouter/modifier/supprimer la caisse commune.
-- Le payeur peut être n'importe quel membre (pas seulement auth.uid()).
CREATE POLICY "expenses_member_all" ON public.group_expenses
  FOR ALL TO authenticated
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    AND (paid_by IS NULL OR paid_by = auth.uid() OR public.is_group_member(group_id, auth.uid()))
  );

-- ── 5. group_kit_items ────────────────────────────────────────────────────
ALTER TABLE public.group_kit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kit_items_member_all" ON public.group_kit_items;
CREATE POLICY "kit_items_member_all" ON public.group_kit_items
  FOR ALL TO authenticated
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

-- ── 6. group_tasks ────────────────────────────────────────────────────────
ALTER TABLE public.group_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_member_all" ON public.group_tasks;
CREATE POLICY "tasks_member_all" ON public.group_tasks
  FOR ALL TO authenticated
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

-- ── 7. group_polls ────────────────────────────────────────────────────────
ALTER TABLE public.group_polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "polls_member_all" ON public.group_polls;
CREATE POLICY "polls_member_all" ON public.group_polls
  FOR ALL TO authenticated
  USING (
    public.is_group_member(group_id, auth.uid())
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    AND (created_by = auth.uid() OR public.is_group_organizer(group_id, auth.uid()))
  );

-- ── 8. group_poll_votes ───────────────────────────────────────────────────
ALTER TABLE public.group_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "votes_member_all" ON public.group_poll_votes;
-- SELECT : tout membre voit les votes (comptage correct des pourcentages).
-- INSERT/UPDATE/DELETE : uniquement ses propres votes.
DROP POLICY IF EXISTS "votes_select_member" ON public.group_poll_votes;
CREATE POLICY "votes_select_member" ON public.group_poll_votes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_polls p
      WHERE p.id = poll_id AND public.is_group_member(p.group_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "votes_member_own" ON public.group_poll_votes;
CREATE POLICY "votes_member_own" ON public.group_poll_votes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "votes_update_own" ON public.group_poll_votes;
CREATE POLICY "votes_update_own" ON public.group_poll_votes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.group_polls p
      WHERE p.id = poll_id AND public.is_group_organizer(p.group_id, auth.uid())
  ))
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "votes_delete_own" ON public.group_poll_votes;
CREATE POLICY "votes_delete_own" ON public.group_poll_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.group_polls p
      WHERE p.id = poll_id AND public.is_group_organizer(p.group_id, auth.uid())
  ));

-- ── 9. group_album ────────────────────────────────────────────────────────
ALTER TABLE public.group_album ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "album_member_all" ON public.group_album;
CREATE POLICY "album_member_all" ON public.group_album
  FOR ALL TO authenticated
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (uploaded_by = auth.uid() AND public.is_group_member(group_id, auth.uid()));

-- ── 10. group_invitations ────────────────────────────────────────────────
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations_organizer_manage" ON public.group_invitations;
CREATE POLICY "invitations_organizer_manage" ON public.group_invitations
  FOR ALL TO authenticated
  USING (invited_by = auth.uid() OR public.is_group_organizer(group_id, auth.uid()))
  WITH CHECK (invited_by = auth.uid() AND public.is_group_organizer(group_id, auth.uid()));

DROP POLICY IF EXISTS "invitations_public_read_by_token" ON public.group_invitations;
CREATE POLICY "invitations_public_read_by_token" ON public.group_invitations
  FOR SELECT TO public
  USING (true);

-- ── 11. Réponses imbriquées (commentaires) ───────────────────────────────
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE;

ALTER TABLE public.club_topic_replies
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.club_topic_replies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON public.post_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_club_topic_replies_parent ON public.club_topic_replies(parent_id);

-- Invitations : cibler également directement un utilisateur existant
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- ── 13. Messages du groupe : pièces jointes + partage de position ──────────
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS location jsonb;

-- ── 14. Bucket de stockage pour les médias de groupe ───────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-media',
  'group-media',
  true,
  10485760,
  ARRAY['image/png','image/jpeg','image/gif','image/webp','video/mp4','video/quicktime','application/gpx+xml','application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;