-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-001 — club_members : fermeture des voies ALL permissives
-- Chantier communauté (audit 2026-10-12) — P0 sécurité d'autorisation
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit F-001, statut D) : deux policies héritées FOR ALL PERMISSIVE
--   - "Auth manage club_members"          USING/WITH CHECK (auth.uid() = user_id)  [roles public]
--   - "users_manage_own_memberships"      USING/WITH CHECK (user_id = auth.uid())  [authenticated]
-- sont OR-combinées avec les policies fines et permettent à tout utilisateur
-- connecté de muter SA propre adhésion : role='admin', status='active' après
-- exclusion, club_id déplacé. Aucun trigger ne protégeait ces colonnes.
--
-- Correctif :
--   1) suppression des voies générales et des doublons SELECT (F-029 ciblé) ;
--   2) réaffirmation des policies de commande (self-join / créateur / modération / départ) ;
--   3) trigger de protection des colonnes privilégiées (rôle, statut, club,
--      utilisateur, joined_at) — défense en profondeur même si une policy
--      future était ajoutée par erreur.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Voies ALL héritées (escalade de privilèges) ─────────────────────────
DROP POLICY IF EXISTS "Auth manage club_members" ON public.club_members;
DROP POLICY IF EXISTS "users_manage_own_memberships" ON public.club_members;
DROP POLICY IF EXISTS "auth_manage_own_membership" ON public.club_members;
DROP POLICY IF EXISTS club_members_manage ON public.club_members;

-- ── 2) Doublons SELECT identiques USING (true) : n'en conserver qu'un ──────
DROP POLICY IF EXISTS club_members_read ON public.club_members;
DROP POLICY IF EXISTS public_read_club_members ON public.club_members;
DROP POLICY IF EXISTS "Public read club_members" ON public.club_members;
CREATE POLICY "Public read club_members" ON public.club_members
  FOR SELECT TO public
  USING (true);

-- ── 3) Policies de commande réaffirmées (idempotent) ───────────────────────

-- 3a) INSERT self-join : sa propre adhésion simple, club ouvert uniquement.
DROP POLICY IF EXISTS club_members_self_join ON public.club_members;
CREATE POLICY club_members_self_join ON public.club_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_members.club_id
        AND c.privacy = 'open'
    )
  );

-- 3b) INSERT créateur : auto-adhésion admin du club qu'il vient de créer.
DROP POLICY IF EXISTS club_members_creator_admin ON public.club_members;
CREATE POLICY club_members_creator_admin ON public.club_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'admin'
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_members.club_id
        AND c.created_by = auth.uid()
    )
  );

-- 3c) INSERT modération : un admin/modérateur actif admet un membre.
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

-- 3d) UPDATE modération : rôle/statut réservés admin/modérateur actif du club.
DROP POLICY IF EXISTS club_members_admin_moderate ON public.club_members;
CREATE POLICY club_members_admin_moderate ON public.club_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'moderator')
    )
  );

-- 3e) DELETE : quitter un club = supprimer sa propre adhésion.
DROP POLICY IF EXISTS club_members_self_delete ON public.club_members;
CREATE POLICY club_members_self_delete ON public.club_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── 4) Trigger de protection des colonnes privilégiées ─────────────────────
CREATE OR REPLACE FUNCTION public.guard_club_member_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_is_club_admin boolean := false;
BEGIN
  -- Backend / service-role / migrations : aucun JWT utilisateur (sub absent),
  -- laisser passer. La RLS reste la garde primaire pour anon/authenticated ;
  -- le trigger est la garde secondaire dès lors qu'une identité est posée.
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  actor_is_club_admin := EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = NEW.club_id
      AND cm.user_id = actor
      AND cm.status = 'active'
      AND cm.role IN ('admin', 'moderator')
  );

  IF TG_OP = 'INSERT' THEN
    IF NOT actor_is_club_admin THEN
      -- Créateur du club : auto-adhésion admin autorisée.
      IF NEW.role = 'admin' AND EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = NEW.club_id AND c.created_by = actor
      ) THEN
        RETURN NEW;
      END IF;
      -- Tout autre utilisateur : uniquement sa propre adhésion simple.
      IF NEW.user_id IS DISTINCT FROM actor
         OR NEW.role IS DISTINCT FROM 'member'
         OR NEW.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'club_members: insertion réservée à sa propre adhésion simple (member/active)'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE : identité de l'adhésion immuable.
  IF NEW.club_id IS DISTINCT FROM OLD.club_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
    RAISE EXCEPTION 'club_members: club, utilisateur et date d''adhésion sont immuables'
      USING ERRCODE = '42501';
  END IF;

  -- UPDATE : rôle et statut réservés aux admins/modérateurs actifs du club.
  IF (NEW.role IS DISTINCT FROM OLD.role)
     OR (NEW.status IS DISTINCT FROM OLD.status) THEN
    IF NOT actor_is_club_admin THEN
      RAISE EXCEPTION 'club_members: modification de rôle ou statut réservée aux admins/modérateurs du club'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_club_member_privileged_columns ON public.club_members;
CREATE TRIGGER guard_club_member_privileged_columns
  BEFORE INSERT OR UPDATE ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_club_member_privileged_columns();

COMMENT ON FUNCTION public.guard_club_member_privileged_columns() IS
  'F-001 : protège rôle/statut/club/user/joined_at des adhésions club contre toute mutation non autorisée (défense en profondeur au-dessus de la RLS).';
