-- ============================================================================
-- Phase 5: Permission Audit Log & Remaining RLS Hardening
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.club_permission_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_permission_audit_club
  ON public.club_permission_audit(club_id, created_at DESC);

ALTER TABLE public.club_permission_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_permission_audit_read"
  ON public.club_permission_audit FOR SELECT
  USING (
    public.club_has_capability(club_id, auth.uid(), 'members.manage_roles'::public.club_capability)
    OR public.club_has_capability(club_id, auth.uid(), 'permissions.delegate'::public.club_capability)
  );

CREATE OR REPLACE FUNCTION public.log_club_member_permission_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role)
     OR (NEW.status IS DISTINCT FROM OLD.status)
     OR (NEW.can_manage_stories IS DISTINCT FROM OLD.can_manage_stories)
     OR (NEW.can_manage_gear IS DISTINCT FROM OLD.can_manage_gear)
     OR (NEW.is_certified_leader IS DISTINCT FROM OLD.is_certified_leader)
     OR (NEW.muted_until IS DISTINCT FROM OLD.muted_until) THEN
    INSERT INTO public.club_permission_audit (
      club_id,
      actor_id,
      target_user_id,
      action,
      old_value,
      new_value
    ) VALUES (
      NEW.club_id,
      auth.uid(),
      NEW.user_id,
      CASE
        WHEN NEW.role IS DISTINCT FROM OLD.role THEN 'role_change'
        WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status_change'
        WHEN NEW.muted_until IS DISTINCT FROM OLD.muted_until THEN 'mute_change'
        ELSE 'pole_change'
      END,
      jsonb_build_object(
        'role', OLD.role,
        'status', OLD.status,
        'can_manage_stories', OLD.can_manage_stories,
        'can_manage_gear', OLD.can_manage_gear,
        'is_certified_leader', OLD.is_certified_leader,
        'muted_until', OLD.muted_until
      ),
      jsonb_build_object(
        'role', NEW.role,
        'status', NEW.status,
        'can_manage_stories', NEW.can_manage_stories,
        'can_manage_gear', NEW.can_manage_gear,
        'is_certified_leader', NEW.is_certified_leader,
        'muted_until', NEW.muted_until
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_club_member_permission_change ON public.club_members;
CREATE TRIGGER trg_log_club_member_permission_change
  AFTER UPDATE ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.log_club_member_permission_change();

-- Harden club_join_requests_select & club_messages_member_insert
ALTER POLICY "club_join_requests_select" ON public.club_join_requests
  USING (
    auth.uid() = user_id
    OR public.club_has_capability(club_id, auth.uid(), 'members.review_requests'::public.club_capability)
  );
