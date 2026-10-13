-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: A-104 — un club actif conserve toujours un administrateur
-- Chantier communauté (audit 2026-10-12) — P1 gouvernance des clubs
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit A-104) : rien n'empêchait le dernier admin de se rétrograder,
-- de se bannir ou de quitter son club — laissant une communauté active sans
-- responsable (impossible à modérer, invitations bloquées).
--
-- Correctif : garde étendue du trigger existant —
--   - UPDATE : rétrograder/bannir le dernier admin actif → refus ;
--   - DELETE : quitter en étant le dernier admin actif → refus.
-- La suppression du CLUB entier n'est jamais bloquée (la cascade intervient
-- alors que la ligne club n'existe plus → garde neutralisée).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_club_member_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_is_club_admin boolean := false;
  other_active_admins integer := 0;
BEGIN
  -- Backend / service-role / migrations : aucune identité, laisser passer.
  IF actor IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- ── DELETE : le dernier admin actif ne peut pas quitter un club vivant ──
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'admin' AND OLD.status = 'active'
       AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = OLD.club_id) THEN
      SELECT count(*) INTO other_active_admins
        FROM public.club_members cm
       WHERE cm.club_id = OLD.club_id
         AND cm.id <> OLD.id
         AND cm.role = 'admin'
         AND cm.status = 'active';
      IF other_active_admins = 0 THEN
        RAISE EXCEPTION 'club_members: le dernier administrateur ne peut pas quitter le club'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN OLD;
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

    -- A-104 : préserver au moins un admin actif dans un club vivant.
    IF OLD.role = 'admin' AND OLD.status = 'active'
       AND (NEW.role <> 'admin' OR NEW.status <> 'active')
       AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = OLD.club_id) THEN
      SELECT count(*) INTO other_active_admins
        FROM public.club_members cm
       WHERE cm.club_id = OLD.club_id
         AND cm.id <> OLD.id
         AND cm.role = 'admin'
         AND cm.status = 'active';
      IF other_active_admins = 0 THEN
        RAISE EXCEPTION 'club_members: le dernier administrateur ne peut pas être rétrogradé ou banni'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_club_member_privileged_columns ON public.club_members;
CREATE TRIGGER guard_club_member_privileged_columns
  BEFORE INSERT OR UPDATE OR DELETE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_club_member_privileged_columns();

COMMENT ON FUNCTION public.guard_club_member_privileged_columns() IS
  'F-001 + A-104 : protège rôle/statut/club/identité ET garantit un administrateur actif tant que le club existe.';
