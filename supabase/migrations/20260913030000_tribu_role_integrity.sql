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

-- ── References croisees : payeur / assigne doivent etre membres actifs ──────
-- Valide `paid_by` (expenses) et `assigned_to` (kit) a l'insertion ou lors
-- d'un CHANGEMENT de cible. Un manager peut donc toujours regler/editer une
-- ligne dont la cible historique a quitte le groupe, mais pas re-affecter
-- cette ligne a un non-membre.
CREATE OR REPLACE FUNCTION public.enforce_reference_member_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target UUID;
  v_old_target UUID;
BEGIN
  IF TG_TABLE_NAME = 'group_expenses' THEN
    v_target := NEW.paid_by;
    v_old_target := OLD.paid_by;
  ELSIF TG_TABLE_NAME = 'group_kit_items' THEN
    v_target := NEW.assigned_to;
    v_old_target := OLD.assigned_to;
  ELSE
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND v_target IS NOT DISTINCT FROM v_old_target THEN
    RETURN NEW;
  END IF;

  IF v_target IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.group_members m
    WHERE m.group_id = NEW.group_id
      AND m.user_id = v_target
      AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'target_not_active_member' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_expense_payer_member_trg ON public.group_expenses;
CREATE TRIGGER enforce_expense_payer_member_trg
  BEFORE INSERT OR UPDATE ON public.group_expenses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reference_member_active();

DROP TRIGGER IF EXISTS enforce_kit_assignee_member_trg ON public.group_kit_items;
CREATE TRIGGER enforce_kit_assignee_member_trg
  BEFORE INSERT OR UPDATE ON public.group_kit_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reference_member_active();
