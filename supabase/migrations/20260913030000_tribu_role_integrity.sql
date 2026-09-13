-- ============================================================
-- TRIBU — M3 : integrite des roles (group_members)
-- ============================================================
-- Ferme deux escalades de la Phase 0 :
--   • auto-promotion de role par un membre (members_update_own) ;
--   • transitions de statut libres (pending -> left, active -> pending...).
-- Les transitions legitimes :
--   • invite  : pending -> active | rejected (self)
--   • organizer/co (manage_members) : tout changement de role/statut
--   • service_role / jobs (auth.uid() NULL) : libre
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_group_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Traitements systeme (service_role, migrations, jobs) : pas de JWT.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Identite ou role : reserve a manage_members.
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    IF NOT public.group_member_has_capability(OLD.group_id, auth.uid(), 'manage_members') THEN
      RAISE EXCEPTION 'role_change_forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Statut : seules les transitions d'invitation sont ouvertes au membre vise.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.user_id = auth.uid()
       AND OLD.status = 'pending'::public.group_member_status
       AND NEW.status IN ('active'::public.group_member_status, 'rejected'::public.group_member_status) THEN
      RETURN NEW;
    END IF;
    IF NOT public.group_member_has_capability(OLD.group_id, auth.uid(), 'manage_members') THEN
      RAISE EXCEPTION 'status_change_forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_group_role_change_trg ON public.group_members;
CREATE TRIGGER enforce_group_role_change_trg
  BEFORE UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_role_change();

-- ── Bootstrap : le createur d'un groupe devient organizer actif ─────────────
-- Sans cela, un groupe neuf serait orphelin (aucune policy enfant ouverte
-- a son proprietaire) et l'app devrait inserer le membership elle-meme
-- (fragile, silencieusement ignorable, dupliquee par chaque nouveau flux).
CREATE OR REPLACE FUNCTION public.seed_group_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.group_members (group_id, user_id, role, status)
    VALUES (NEW.id, NEW.owner_id, 'organizer', 'active')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_group_owner_membership_trg ON public.travel_groups;
CREATE TRIGGER seed_group_owner_membership_trg
  AFTER INSERT ON public.travel_groups
  FOR EACH ROW EXECUTE FUNCTION public.seed_group_owner_membership();
