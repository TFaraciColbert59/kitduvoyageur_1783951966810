-- ============================================================
-- TRIBU — M2 : policies par commande (Phase 0)
-- ============================================================
-- Remplace les `*_member_all` (toute ecriture pour tout membre,
-- observer inclus) et les lectures publiques enfants (`*_select_public_or_member`,
-- presentes en prod uniquement) par des policies par commande :
--   SELECT  : membre actif (observer inclus, lecture seule)
--   INSERT  : capacite contribute + proprietaire (colonne personne)
--   UPDATE/DELETE : ma ligne (avec contribute) OU capacite manage_*
-- ============================================================

-- ── 0. Purge des policies historiques (par nom, idempotent) ─────────────────
DROP POLICY IF EXISTS "expenses_member_all" ON public.group_expenses;
DROP POLICY IF EXISTS "kit_items_member_all" ON public.group_kit_items;
DROP POLICY IF EXISTS "tasks_member_all" ON public.group_tasks;
DROP POLICY IF EXISTS "polls_member_all" ON public.group_polls;
DROP POLICY IF EXISTS "album_member_all" ON public.group_album;
DROP POLICY IF EXISTS "expenses_select_public_or_member" ON public.group_expenses;
DROP POLICY IF EXISTS "kit_items_select_public_or_member" ON public.group_kit_items;
DROP POLICY IF EXISTS "tasks_select_public_or_member" ON public.group_tasks;
DROP POLICY IF EXISTS "polls_select_public_or_member" ON public.group_polls;
DROP POLICY IF EXISTS "members_select_public_or_member" ON public.group_members;
DROP POLICY IF EXISTS "messages_select_public_or_member" ON public.group_messages;
DROP POLICY IF EXISTS "votes_select_public_or_member" ON public.group_poll_votes;
DROP POLICY IF EXISTS "invitations_public_read_by_token" ON public.group_invitations;

-- ── 1. travel_groups : lecture pending/active + update par capacite ─────────
DROP POLICY IF EXISTS "groups_public_read" ON public.travel_groups;
CREATE POLICY "groups_public_read" ON public.travel_groups
  FOR SELECT TO public
  USING (
    visibility = 'public'::public.group_visibility
    OR owner_id = auth.uid()
    OR public.is_group_member(id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = travel_groups.id
        AND gm.user_id = auth.uid()
        AND gm.status IN ('pending', 'active')
    )
  );

DROP POLICY IF EXISTS "groups_organizer_update" ON public.travel_groups;
CREATE POLICY "groups_organizer_update" ON public.travel_groups
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.group_member_has_capability(id, auth.uid(), 'manage_info')
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.group_member_has_capability(id, auth.uid(), 'manage_info')
  );

-- ── 2. group_members : self-join non privilegie, invitation par capacite ────
DROP POLICY IF EXISTS "members_join_group" ON public.group_members;
CREATE POLICY "members_join_group" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'::public.group_member_role
    AND status IN ('pending'::public.group_member_status, 'active'::public.group_member_status)
    AND (
      EXISTS (SELECT 1 FROM public.travel_groups g WHERE g.id = group_id AND g.visibility = 'public')
      OR EXISTS (SELECT 1 FROM public.travel_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "members_organizer_insert" ON public.group_members;
CREATE POLICY "members_organizer_insert" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.group_member_has_capability(group_id, auth.uid(), 'invite_members')
    AND role = 'member'::public.group_member_role
    AND status IN ('pending'::public.group_member_status, 'active'::public.group_member_status)
  );

DROP POLICY IF EXISTS "members_update_own" ON public.group_members;
CREATE POLICY "members_update_own" ON public.group_members
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.group_member_has_capability(group_id, auth.uid(), 'manage_members')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.group_member_has_capability(group_id, auth.uid(), 'manage_members')
  );

DROP POLICY IF EXISTS "members_delete_own" ON public.group_members;
CREATE POLICY "members_delete_own" ON public.group_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.group_member_has_capability(group_id, auth.uid(), 'manage_members')
  );

-- ── 3. group_messages : ecriture par contribute, moderation par capacite ────
DROP POLICY IF EXISTS "messages_member_insert" ON public.group_messages;
CREATE POLICY "messages_member_insert" ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.group_member_has_capability(group_id, auth.uid(), 'contribute')
  );

DROP POLICY IF EXISTS "messages_own_update" ON public.group_messages;
CREATE POLICY "messages_own_update" ON public.group_messages
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
    OR public.group_member_has_capability(group_id, auth.uid(), 'moderate_messages')
  )
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    AND (
      user_id = auth.uid()
      OR public.group_member_has_capability(group_id, auth.uid(), 'moderate_messages')
    )
  );

DROP POLICY IF EXISTS "messages_own_delete" ON public.group_messages;
CREATE POLICY "messages_own_delete" ON public.group_messages
  FOR DELETE TO authenticated
  USING (
    (user_id = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
    OR public.group_member_has_capability(group_id, auth.uid(), 'moderate_messages')
  );

-- ── 4. group_expenses ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "expenses_select_member" ON public.group_expenses;
CREATE POLICY "expenses_select_member" ON public.group_expenses
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "expenses_insert_contribute" ON public.group_expenses;
CREATE POLICY "expenses_insert_contribute" ON public.group_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.group_member_has_capability(group_id, auth.uid(), 'contribute')
    AND (
      paid_by IS NULL
      OR paid_by = auth.uid()
      OR (
        public.group_member_has_capability(group_id, auth.uid(), 'manage_expenses')
        AND EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = group_expenses.group_id
            AND gm.user_id = group_expenses.paid_by
            AND gm.status = 'active'
        )
      )
    )
  );

DROP POLICY IF EXISTS "expenses_update_own_or_manage" ON public.group_expenses;
CREATE POLICY "expenses_update_own_or_manage" ON public.group_expenses
  FOR UPDATE TO authenticated
  USING (
    (paid_by = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
    OR public.group_member_has_capability(group_id, auth.uid(), 'manage_expenses')
  )
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    AND (
      paid_by = auth.uid()
      OR public.group_member_has_capability(group_id, auth.uid(), 'manage_expenses')
    )
  );

DROP POLICY IF EXISTS "expenses_delete_own_or_manage" ON public.group_expenses;
CREATE POLICY "expenses_delete_own_or_manage" ON public.group_expenses
  FOR DELETE TO authenticated
  USING (
    (paid_by = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
    OR public.group_member_has_capability(group_id, auth.uid(), 'manage_expenses')
  );

-- ── 5. group_kit_items ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "kit_items_select_member" ON public.group_kit_items;
CREATE POLICY "kit_items_select_member" ON public.group_kit_items
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "kit_items_insert_contribute" ON public.group_kit_items;
CREATE POLICY "kit_items_insert_contribute" ON public.group_kit_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.group_member_has_capability(group_id, auth.uid(), 'contribute')
    AND (
      assigned_to IS NULL
      OR assigned_to = auth.uid()
      OR (
        public.group_member_has_capability(group_id, auth.uid(), 'manage_kit')
        AND EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = group_kit_items.group_id
            AND gm.user_id = group_kit_items.assigned_to
            AND gm.status = 'active'
        )
      )
    )
  );

DROP POLICY IF EXISTS "kit_items_update_own_or_manage" ON public.group_kit_items;
CREATE POLICY "kit_items_update_own_or_manage" ON public.group_kit_items
  FOR UPDATE TO authenticated
  USING (
    (assigned_to = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
    OR public.group_member_has_capability(group_id, auth.uid(), 'manage_kit')
  )
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    AND (
      assigned_to = auth.uid()
      OR public.group_member_has_capability(group_id, auth.uid(), 'manage_kit')
    )
  );

DROP POLICY IF EXISTS "kit_items_delete_own_or_manage" ON public.group_kit_items;
CREATE POLICY "kit_items_delete_own_or_manage" ON public.group_kit_items
  FOR DELETE TO authenticated
  USING (
    (assigned_to = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
    OR public.group_member_has_capability(group_id, auth.uid(), 'manage_kit')
  );

-- ── 6. group_tasks ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks_select_member" ON public.group_tasks;
CREATE POLICY "tasks_select_member" ON public.group_tasks
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "tasks_insert_contribute" ON public.group_tasks;
CREATE POLICY "tasks_insert_contribute" ON public.group_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.group_member_has_capability(group_id, auth.uid(), 'contribute')
    AND (created_by = auth.uid() OR public.group_member_has_capability(group_id, auth.uid(), 'manage_tasks'))
  );

DROP POLICY IF EXISTS "tasks_update_own_or_manage" ON public.group_tasks;
CREATE POLICY "tasks_update_own_or_manage" ON public.group_tasks
  FOR UPDATE TO authenticated
  USING (
    public.group_member_has_capability(group_id, auth.uid(), 'manage_tasks')
    OR (created_by = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
    OR (assigned_to = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
  )
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    AND (
      created_by = auth.uid()
      OR assigned_to = auth.uid()
      OR public.group_member_has_capability(group_id, auth.uid(), 'manage_tasks')
    )
  );

DROP POLICY IF EXISTS "tasks_delete_own_or_manage" ON public.group_tasks;
CREATE POLICY "tasks_delete_own_or_manage" ON public.group_tasks
  FOR DELETE TO authenticated
  USING (
    public.group_member_has_capability(group_id, auth.uid(), 'manage_tasks')
    OR (created_by = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
  );

-- ── 7. group_polls ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "polls_select_member" ON public.group_polls;
CREATE POLICY "polls_select_member" ON public.group_polls
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "polls_insert_contribute" ON public.group_polls;
CREATE POLICY "polls_insert_contribute" ON public.group_polls
  FOR INSERT TO authenticated
  WITH CHECK (
    public.group_member_has_capability(group_id, auth.uid(), 'contribute')
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "polls_update_own_or_manage" ON public.group_polls;
CREATE POLICY "polls_update_own_or_manage" ON public.group_polls
  FOR UPDATE TO authenticated
  USING (
    public.group_member_has_capability(group_id, auth.uid(), 'manage_polls')
    OR (created_by = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
  )
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    AND (
      (created_by = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
      OR public.group_member_has_capability(group_id, auth.uid(), 'manage_polls')
    )
  );

DROP POLICY IF EXISTS "polls_delete_own_or_manage" ON public.group_polls;
CREATE POLICY "polls_delete_own_or_manage" ON public.group_polls
  FOR DELETE TO authenticated
  USING (
    public.group_member_has_capability(group_id, auth.uid(), 'manage_polls')
    OR (created_by = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
  );

-- ── 8. group_poll_votes : appartenance obligatoire, self-only ───────────────
DROP POLICY IF EXISTS "votes_member_own" ON public.group_poll_votes;
CREATE POLICY "votes_member_own" ON public.group_poll_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_polls p
      WHERE p.id = poll_id
        AND public.is_group_member(p.group_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "votes_update_own" ON public.group_poll_votes;
CREATE POLICY "votes_update_own" ON public.group_poll_votes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_polls p
      WHERE p.id = poll_id
        AND public.is_group_member(p.group_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "votes_delete_own" ON public.group_poll_votes;
CREATE POLICY "votes_delete_own" ON public.group_poll_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── 9. group_album ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "album_select_member" ON public.group_album;
CREATE POLICY "album_select_member" ON public.group_album
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "album_insert_contribute" ON public.group_album;
CREATE POLICY "album_insert_contribute" ON public.group_album
  FOR INSERT TO authenticated
  WITH CHECK (
    public.group_member_has_capability(group_id, auth.uid(), 'contribute')
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "album_update_own_or_manage" ON public.group_album;
CREATE POLICY "album_update_own_or_manage" ON public.group_album
  FOR UPDATE TO authenticated
  USING (
    public.group_member_has_capability(group_id, auth.uid(), 'manage_album')
    OR (uploaded_by = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
  )
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    AND (
      (uploaded_by = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
      OR public.group_member_has_capability(group_id, auth.uid(), 'manage_album')
    )
  );

DROP POLICY IF EXISTS "album_delete_own_or_manage" ON public.group_album;
CREATE POLICY "album_delete_own_or_manage" ON public.group_album
  FOR DELETE TO authenticated
  USING (
    public.group_member_has_capability(group_id, auth.uid(), 'manage_album')
    OR (uploaded_by = auth.uid() AND public.group_member_has_capability(group_id, auth.uid(), 'contribute'))
  );

-- ── 10. group_invitations : plus de lecture publique, capacite dediee ───────
DROP POLICY IF EXISTS "invitations_organizer_manage" ON public.group_invitations;
CREATE POLICY "invitations_organizer_manage" ON public.group_invitations
  FOR ALL TO authenticated
  USING (
    invited_by = auth.uid()
    OR public.group_member_has_capability(group_id, auth.uid(), 'invite_members')
  )
  WITH CHECK (
    invited_by = auth.uid()
    AND public.group_member_has_capability(group_id, auth.uid(), 'invite_members')
  );

-- ── 11. Découverte publique : agrégats sans lecture de lignes ───────────────
-- La fermeture des lectures enfants publiques (`*_select_public_or_member`)
-- prive les cartes « Bouteille à la mer » des compteurs pour les visiteurs.
-- Cet agrégat SECURITY DEFINER ne renvoie que des compteurs/sommes, jamais
-- de lignes, et uniquement pour les groupes explicitement publics.
CREATE OR REPLACE FUNCTION public.group_public_card_stats(p_group_ids UUID[])
RETURNS TABLE (
  group_id UUID,
  active_members INT,
  pending_members INT,
  total_expenses NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    g.id,
    COALESCE((
      SELECT count(*)::int FROM public.group_members gm
      WHERE gm.group_id = g.id AND gm.status = 'active'
    ), 0),
    COALESCE((
      SELECT count(*)::int FROM public.group_members gm
      WHERE gm.group_id = g.id AND gm.status = 'pending'
    ), 0),
    COALESCE((
      SELECT sum(e.amount) FROM public.group_expenses e
      WHERE e.group_id = g.id
    ), 0)::numeric
  FROM public.travel_groups g
  WHERE g.id = ANY(p_group_ids)
    AND g.visibility = 'public'::public.group_visibility
$$;

GRANT EXECUTE ON FUNCTION public.group_public_card_stats(UUID[]) TO authenticated, anon;
