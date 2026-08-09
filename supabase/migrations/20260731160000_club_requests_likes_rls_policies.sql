-- Chantier 15 — RLS : likes community_posts + flux d'adhésion aux clubs
-- Projet icxyvwzfjbflcbqukpfz — appliqué 2026-07-31

-- 1) Contrainte unique (club_id, user_id) nécessaire à l'upsert onConflict
DELETE FROM public.club_join_requests a
USING public.club_join_requests b
WHERE a.id < b.id AND a.club_id = b.club_id AND a.user_id = b.user_id;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'club_join_requests_club_user_key') THEN
    ALTER TABLE public.club_join_requests
      ADD CONSTRAINT club_join_requests_club_user_key UNIQUE (club_id, user_id);
  END IF;
END $$;

-- 2) club_join_requests : lecture — ses propres demandes OU membre actif du club (les admins/modérateurs sont membres)
DROP POLICY IF EXISTS club_join_requests_select ON public.club_join_requests;
CREATE POLICY club_join_requests_select ON public.club_join_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_join_requests.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

-- 3) club_join_requests : création — uniquement sa propre demande
DROP POLICY IF EXISTS club_join_requests_insert ON public.club_join_requests;
CREATE POLICY club_join_requests_insert ON public.club_join_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4) club_join_requests : modération — admin/modérateur du club (approbation/refus)
DROP POLICY IF EXISTS club_join_requests_moderate ON public.club_join_requests;
CREATE POLICY club_join_requests_moderate ON public.club_join_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_join_requests.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'moderator')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_join_requests.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'moderator')
    )
  );

-- 5) club_members : approbation d'une demande — l'admin/modérateur insère un membre
--    (role = 'member' uniquement pour éviter toute élévation de privilège)
DROP POLICY IF EXISTS club_members_admin_insert ON public.club_members;
CREATE POLICY club_members_admin_insert ON public.club_members
  FOR INSERT TO authenticated
  WITH CHECK (
    role = 'member'
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'moderator')
    )
  );

-- 6) community_posts : like par n'importe quel utilisateur connecté
--    Le code n'écrit QUE likes_count (communaute/page.tsx PostCard.handleLike).
--    REVOKE UPDATE global + GRANT colonne likes_count pour ne JAMAIS permettre
--    l'édition du contenu d'un post par un tiers (sans cela une policy USING(true)
--    ouvrirait toutes les colonnes).
REVOKE UPDATE ON public.community_posts FROM anon, authenticated;
GRANT UPDATE (likes_count) ON public.community_posts TO authenticated;

DROP POLICY IF EXISTS auth_like_community_posts ON public.community_posts;
CREATE POLICY auth_like_community_posts ON public.community_posts
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
