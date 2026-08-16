-- ============================================================
-- KIT DU VOYAGEUR — Triggers de Notifications de Groupes
-- Migration: 20260816003000_group_system_triggers.sql
-- ============================================================

-- ─── 1. TRIGGER: NEW MEMBER JOINS ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_on_group_member_join()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_group_name TEXT;
  v_actor_name TEXT;
BEGIN
  -- Get group details
  SELECT owner_id, name INTO v_owner_id, v_group_name
  FROM public.travel_groups WHERE id = NEW.group_id;

  -- Get actor name
  SELECT full_name INTO v_actor_name
  FROM public.user_profiles WHERE id = NEW.user_id;

  -- Notify the group owner (organizer) if a member joins, and it's not the owner themselves
  IF v_owner_id IS NOT NULL AND v_owner_id <> NEW.user_id AND NEW.status::text = 'active' THEN
    PERFORM public.notify(
      v_owner_id,
      'group_invite', -- using group_invite type
      v_group_name,
      COALESCE(v_actor_name, 'Un voyageur') || ' a rejoint votre groupe',
      NEW.user_id,
      'group',
      NEW.group_id,
      '/groupes/' || NEW.group_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_group_member_join_notify
  AFTER INSERT OR UPDATE OF status ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_on_group_member_join();


-- ─── 2. TRIGGER: TASK ASSIGNMENTS ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_on_group_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_group_name TEXT;
  v_creator_name TEXT;
BEGIN
  -- Get group name
  SELECT name INTO v_group_name FROM public.travel_groups WHERE id = NEW.group_id;
  
  -- Get creator name
  SELECT full_name INTO v_creator_name FROM public.user_profiles WHERE id = NEW.created_by;

  -- Send notification if assigned_to is set and different from the creator
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_to IS NULL OR OLD.assigned_to <> NEW.assigned_to) THEN
    PERFORM public.notify(
      NEW.assigned_to,
      'group_task_assigned',
      v_group_name,
      COALESCE(v_creator_name, 'L''organisateur') || ' vous a assigné la tâche : "' || NEW.title || '"',
      NEW.created_by,
      'group',
      NEW.group_id,
      '/groupes/' || NEW.group_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_group_task_assigned_notify
  AFTER INSERT OR UPDATE OF assigned_to ON public.group_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_on_group_task_assigned();


-- ─── 3. TRIGGER: SHARED EXPENSES ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_on_group_expense_added()
RETURNS TRIGGER AS $$
DECLARE
  v_group_name TEXT;
  v_payer_name TEXT;
  v_user_id UUID;
BEGIN
  -- Get group name
  SELECT name INTO v_group_name FROM public.travel_groups WHERE id = NEW.group_id;

  -- Get payer name
  SELECT full_name INTO v_payer_name FROM public.user_profiles WHERE id = NEW.paid_by;

  -- Loop through the split_between array of UUIDs
  IF NEW.split_between IS NOT NULL THEN
    FOREACH v_user_id IN ARRAY NEW.split_between LOOP
      -- Notify if the user is in the split and not the payer
      IF v_user_id <> NEW.paid_by THEN
        PERFORM public.notify(
          v_user_id,
          'group_expense_added',
          v_group_name,
          COALESCE(v_payer_name, 'Un membre') || ' a ajouté une dépense : "' || NEW.title || '" (' || NEW.amount || ' €)',
          NEW.paid_by,
          'group',
          NEW.group_id,
          '/groupes/' || NEW.group_id
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_group_expense_added_notify
  AFTER INSERT ON public.group_expenses
  FOR EACH ROW EXECUTE FUNCTION public.trg_on_group_expense_added();
