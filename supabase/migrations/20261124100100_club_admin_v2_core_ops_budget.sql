-- ============================================================================
-- Club Admin V2 (Part 2/2) — Gouvernance 5 rôles, Matrice 34 capacités,
-- Salons restreints par rôle, Postes Bénévoles & Budget Collaboratif
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rôle 'volunteer', rang canonique et table de policies par club
-- ----------------------------------------------------------------------------

ALTER TABLE public.club_members DROP CONSTRAINT IF EXISTS club_members_role_check;
ALTER TABLE public.club_members
  ADD CONSTRAINT club_members_role_check
  CHECK (role IN ('founder', 'admin', 'moderator', 'volunteer', 'member'));

ALTER TABLE public.club_role_capability_defaults DROP CONSTRAINT IF EXISTS club_role_capability_defaults_role_check;
ALTER TABLE public.club_role_capability_defaults
  ADD CONSTRAINT club_role_capability_defaults_role_check
  CHECK (role IN ('founder', 'admin', 'moderator', 'volunteer', 'member'));

CREATE OR REPLACE FUNCTION public.club_role_rank(p_role text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'founder' THEN 5
    WHEN 'admin' THEN 4
    WHEN 'moderator' THEN 3
    WHEN 'volunteer' THEN 2
    WHEN 'member' THEN 1
    ELSE 0
  END;
$$;

REVOKE ALL ON FUNCTION public.club_role_rank(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_role_rank(text) TO authenticated, anon;

-- Seed complet & idempotent des 35 capacités (34 admin + feed.post) × 5 rôles
INSERT INTO public.club_role_capability_defaults (role, capability, allowed)
SELECT r.role, c.capability,
  CASE
    WHEN r.role = 'founder' THEN true
    WHEN r.role = 'admin' THEN c.capability NOT IN (
      'club.delete'::public.club_capability,
      'club.transfer_ownership'::public.club_capability
    )
    WHEN r.role = 'moderator' THEN c.capability IN (
      'members.review_requests'::public.club_capability,
      'members.manage_invites'::public.club_capability,
      'salons.moderate_messages'::public.club_capability,
      'moderation.resolve_reports'::public.club_capability,
      'members.mute'::public.club_capability,
      'members.ban_or_kick'::public.club_capability,
      'highlights.moderate'::public.club_capability,
      'salons.post_announcements'::public.club_capability,
      'salons.post'::public.club_capability,
      'stories.publish_club'::public.club_capability,
      'stories.manage_highlights'::public.club_capability,
      'feed.post'::public.club_capability
    )
    WHEN r.role = 'volunteer' THEN c.capability IN (
      'salons.post'::public.club_capability,
      'feed.post'::public.club_capability,
      'events.manage_registrations'::public.club_capability,
      'volunteers.manage_shifts'::public.club_capability,
      'gear.manage_club_inventory'::public.club_capability,
      'gear.manage_standard_kits'::public.club_capability,
      'gear.approve_club_loans'::public.club_capability,
      'budget.view'::public.club_capability,
      'budget.propose_expense'::public.club_capability
    )
    WHEN r.role = 'member' THEN c.capability IN (
      'salons.post'::public.club_capability,
      'feed.post'::public.club_capability
    )
    ELSE false
  END
FROM (VALUES ('founder'), ('admin'), ('moderator'), ('volunteer'), ('member')) AS r(role)
CROSS JOIN unnest(enum_range(NULL::public.club_capability)) AS c(capability)
ON CONFLICT (role, capability) DO UPDATE
  SET allowed = EXCLUDED.allowed;

-- Table des policies par rôle personnalisées par club (niveau intermédiaire)
CREATE TABLE IF NOT EXISTS public.club_role_capability_policies (
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'moderator', 'volunteer', 'member')),
  capability public.club_capability NOT NULL,
  allowed boolean NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, role, capability)
);

CREATE INDEX IF NOT EXISTS idx_club_role_cap_policies_club
  ON public.club_role_capability_policies(club_id, role);

-- ----------------------------------------------------------------------------
-- 2. Résolution 3 niveaux (override > club_role_policy > global_default)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.club_has_capability(
  p_club_id uuid,
  p_user_id uuid,
  p_capability public.club_capability
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN false
    WHEN EXISTS (
      SELECT 1
      FROM public.club_members m
      LEFT JOIN public.clubs c ON c.id = m.club_id
      WHERE m.club_id = p_club_id
        AND m.user_id = p_user_id
        AND m.status = 'active'
        AND (m.role = 'founder' OR c.created_by = p_user_id)
    ) THEN true
    ELSE COALESCE((
      SELECT COALESCE(
        o.allowed,
        p.allowed,
        d.allowed,
        false
      )
      FROM public.club_members m
      LEFT JOIN public.club_role_capability_defaults d
        ON d.role = m.role AND d.capability = p_capability
      LEFT JOIN public.club_role_capability_policies p
        ON p.club_id = m.club_id AND p.role = m.role AND p.capability = p_capability
      LEFT JOIN public.club_member_capability_overrides o
        ON o.club_id = m.club_id AND o.user_id = m.user_id AND o.capability = p_capability
      WHERE m.club_id = p_club_id
        AND m.user_id = p_user_id
        AND m.status = 'active'
      LIMIT 1
    ), false)
  END;
$$;

REVOKE ALL ON FUNCTION public.club_has_capability(uuid, uuid, public.club_capability) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_has_capability(uuid, uuid, public.club_capability) TO authenticated;

CREATE OR REPLACE FUNCTION public.club_get_viewer_capabilities(p_club_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    array_agg(c.cap::text ORDER BY c.cap::text),
    ARRAY[]::text[]
  )
  FROM unnest(enum_range(NULL::public.club_capability)) AS c(cap)
  WHERE auth.uid() IS NOT NULL
    AND public.club_has_capability(p_club_id, auth.uid(), c.cap);
$$;

REVOKE ALL ON FUNCTION public.club_get_viewer_capabilities(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_get_viewer_capabilities(uuid) TO authenticated;

-- Helper interne : rôle effectif d'un membre actif (tenant compte de created_by = founder)
CREATE OR REPLACE FUNCTION public.club_actor_effective_role(p_club_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN NULL
    WHEN EXISTS (
      SELECT 1 FROM public.clubs c
      JOIN public.club_members m ON m.club_id = c.id AND m.user_id = p_user_id
      WHERE c.id = p_club_id AND c.created_by = p_user_id AND m.status = 'active'
    ) THEN 'founder'
    ELSE (
      SELECT m.role
      FROM public.club_members m
      WHERE m.club_id = p_club_id
        AND m.user_id = p_user_id
        AND m.status = 'active'
      LIMIT 1
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.club_actor_effective_role(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_actor_effective_role(uuid, uuid) TO authenticated;

-- RLS sur club_role_capability_policies
ALTER TABLE public.club_role_capability_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_role_cap_policies_read" ON public.club_role_capability_policies;
CREATE POLICY "club_role_cap_policies_read"
  ON public.club_role_capability_policies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_role_capability_policies.club_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS "club_role_cap_policies_write" ON public.club_role_capability_policies;
CREATE POLICY "club_role_cap_policies_write"
  ON public.club_role_capability_policies FOR ALL
  TO authenticated
  USING (
    public.club_actor_effective_role(club_id, auth.uid()) = 'founder'
    OR (
      public.club_has_capability(club_id, auth.uid(), 'permissions.delegate'::public.club_capability)
      AND public.club_has_capability(club_id, auth.uid(), capability)
      AND public.club_role_rank(public.club_actor_effective_role(club_id, auth.uid())) > public.club_role_rank(role)
    )
  )
  WITH CHECK (
    public.club_actor_effective_role(club_id, auth.uid()) = 'founder'
    OR (
      public.club_has_capability(club_id, auth.uid(), 'permissions.delegate'::public.club_capability)
      AND public.club_has_capability(club_id, auth.uid(), capability)
      AND public.club_role_rank(public.club_actor_effective_role(club_id, auth.uid())) > public.club_role_rank(role)
    )
  );

-- Durcir RLS sur club_member_capability_overrides (anti-escalade + rang strict)
DROP POLICY IF EXISTS "club_member_cap_overrides_write" ON public.club_member_capability_overrides;
CREATE POLICY "club_member_cap_overrides_write"
  ON public.club_member_capability_overrides FOR ALL
  TO authenticated
  USING (
    user_id <> auth.uid()
    AND (
      public.club_actor_effective_role(club_id, auth.uid()) = 'founder'
      OR (
        public.club_has_capability(club_id, auth.uid(), 'permissions.delegate'::public.club_capability)
        AND public.club_has_capability(club_id, auth.uid(), capability)
        AND public.club_role_rank(public.club_actor_effective_role(club_id, auth.uid()))
          > public.club_role_rank(public.club_actor_effective_role(club_id, user_id))
      )
    )
  )
  WITH CHECK (
    user_id <> auth.uid()
    AND (
      public.club_actor_effective_role(club_id, auth.uid()) = 'founder'
      OR (
        public.club_has_capability(club_id, auth.uid(), 'permissions.delegate'::public.club_capability)
        AND public.club_has_capability(club_id, auth.uid(), capability)
        AND public.club_role_rank(public.club_actor_effective_role(club_id, auth.uid()))
          > public.club_role_rank(public.club_actor_effective_role(club_id, user_id))
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Correctifs lkdv_is_club_moderator, guard trigger, transfert atomique,
--    suppression club & annulation sortie
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lkdv_is_club_moderator(p_club uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = p_club
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('founder', 'admin', 'moderator')
  );
$$;

REVOKE ALL ON FUNCTION public.lkdv_is_club_moderator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lkdv_is_club_moderator(uuid) TO authenticated;

-- Policy DELETE sur clubs réservée au Fondateur (club.delete)
DROP POLICY IF EXISTS "clubs_founder_delete" ON public.clubs;
CREATE POLICY "clubs_founder_delete"
  ON public.clubs FOR DELETE
  TO authenticated
  USING (public.club_has_capability(id, auth.uid(), 'club.delete'::public.club_capability));

-- Refonte complète de guard_club_member_privileged_columns()
CREATE OR REPLACE FUNCTION public.guard_club_member_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_role text;
  actor_rank integer := 0;
  old_rank integer := 0;
  new_rank integer := 0;
  actor_can_manage_roles boolean := false;
  actor_can_ban boolean := false;
  actor_can_mute boolean := false;
  other_active_admins integer;
BEGIN
  -- Bypass service_role / SQL editor / RPC atomique SECURITY DEFINER
  IF actor IS NULL OR current_setting('lkdv.bypass_member_guard', true) = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Fix cascade DELETE : autoriser la suppression du fondateur quand le club est en cours de suppression
    IF OLD.role = 'founder' AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = OLD.club_id) THEN
      RAISE EXCEPTION 'club_members: le fondateur du club ne peut pas être supprimé'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  actor_role := public.club_actor_effective_role(NEW.club_id, actor);
  actor_rank := public.club_role_rank(actor_role);

  -- Révocation respectée sur Admin : seul 'founder' contourne club_has_capability
  actor_can_manage_roles := (actor_role = 'founder')
    OR public.club_has_capability(NEW.club_id, actor, 'members.manage_roles'::public.club_capability);
  actor_can_ban := (actor_role = 'founder')
    OR public.club_has_capability(NEW.club_id, actor, 'members.ban_or_kick'::public.club_capability);
  actor_can_mute := (actor_role = 'founder')
    OR public.club_has_capability(NEW.club_id, actor, 'members.mute'::public.club_capability);

  IF TG_OP = 'INSERT' THEN
    IF actor_can_manage_roles THEN
      IF actor_role IS DISTINCT FROM 'founder'
         AND actor_rank <= public.club_role_rank(NEW.role) THEN
        RAISE EXCEPTION 'club_members: hiérarchie stricte violée pour l''insertion de rôle'
          USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.role IN ('founder', 'admin') AND EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = NEW.club_id AND c.created_by = actor
    ) THEN
      RETURN NEW;
    END IF;
    IF NEW.user_id IS DISTINCT FROM actor
       OR NEW.role IS DISTINCT FROM 'member'
       OR NEW.status IS DISTINCT FROM 'active'
       OR NEW.can_manage_stories IS DISTINCT FROM false
       OR NEW.can_manage_gear IS DISTINCT FROM false
       OR NEW.is_certified_leader IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'club_members: insertion réservée à sa propre adhésion simple (member/active)'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE : identité immuable
  IF NEW.club_id IS DISTINCT FROM OLD.club_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
    RAISE EXCEPTION 'club_members: club, utilisateur et date d''adhésion sont immuables'
      USING ERRCODE = '42501';
  END IF;

  old_rank := public.club_role_rank(OLD.role);
  new_rank := public.club_role_rank(NEW.role);

  -- 1) Changement de rôle ou attributs d'équipe (members.manage_roles + rang strict)
  IF (NEW.role IS DISTINCT FROM OLD.role)
     OR (NEW.can_manage_stories IS DISTINCT FROM OLD.can_manage_stories)
     OR (NEW.can_manage_gear IS DISTINCT FROM OLD.can_manage_gear)
     OR (NEW.is_certified_leader IS DISTINCT FROM OLD.is_certified_leader) THEN
    IF NOT actor_can_manage_roles THEN
      RAISE EXCEPTION 'club_members: modification de rôle ou permissions réservée aux détenteurs de members.manage_roles'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.user_id = actor AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'club_members: impossible de modifier son propre rôle'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.role = 'founder' AND NEW.role <> 'founder' THEN
      RAISE EXCEPTION 'club_members: le fondateur ne peut pas être rétrogradé'
        USING ERRCODE = '42501';
    END IF;
    IF actor_role IS DISTINCT FROM 'founder' AND (actor_rank <= old_rank OR actor_rank <= new_rank) THEN
      RAISE EXCEPTION 'club_members: hiérarchie stricte violée pour le changement de rôle'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2) Changement de statut (ban / kick / réintégration -> members.ban_or_kick + rang strict)
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT actor_can_ban THEN
      RAISE EXCEPTION 'club_members: modification de statut réservée aux détenteurs de members.ban_or_kick'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.role = 'founder' AND NEW.status <> 'active' THEN
      RAISE EXCEPTION 'club_members: le fondateur ne peut pas être banni ou retiré'
        USING ERRCODE = '42501';
    END IF;
    IF actor_rank <= old_rank THEN
      RAISE EXCEPTION 'club_members: hiérarchie stricte violée pour la modération de statut'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3) Changement de sourdine (muted_until -> members.mute + rang strict)
  IF NEW.muted_until IS DISTINCT FROM OLD.muted_until THEN
    IF NOT actor_can_mute THEN
      RAISE EXCEPTION 'club_members: mise en sourdine réservée aux détenteurs de members.mute'
        USING ERRCODE = '42501';
    END IF;
    IF actor_rank <= old_rank THEN
      RAISE EXCEPTION 'club_members: hiérarchie stricte violée pour la mise en sourdine'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 4) Protection du dernier administrateur/fondateur actif
  IF OLD.role IN ('founder', 'admin') AND OLD.status = 'active'
     AND (NEW.role NOT IN ('founder', 'admin') OR NEW.status <> 'active')
     AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = OLD.club_id) THEN
    SELECT count(*) INTO other_active_admins
    FROM public.club_members cm
    WHERE cm.club_id = OLD.club_id
      AND cm.id <> OLD.id
      AND cm.role IN ('founder', 'admin')
      AND cm.status = 'active';
    IF other_active_admins = 0 THEN
      RAISE EXCEPTION 'club_members: le dernier administrateur ne peut pas être rétrogradé ou banni'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- RPC atomique SECURITY DEFINER pour le transfert de propriété
CREATE OR REPLACE FUNCTION public.club_transfer_ownership(
  p_club_id uuid,
  p_new_founder_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_club public.clubs%ROWTYPE;
  v_target public.club_members%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;
  IF p_new_founder_id IS NULL OR p_new_founder_id = v_actor THEN
    RAISE EXCEPTION 'Nouveau fondateur invalide.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_club FROM public.clubs WHERE id = p_club_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Club introuvable.' USING ERRCODE = 'P0002';
  END IF;

  IF v_club.created_by IS DISTINCT FROM v_actor
     AND NOT EXISTS (
       SELECT 1 FROM public.club_members m
       WHERE m.club_id = p_club_id AND m.user_id = v_actor AND m.role = 'founder' AND m.status = 'active'
     ) THEN
    RAISE EXCEPTION 'Seul le fondateur actuel peut transférer la propriété du club.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_target
  FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_new_founder_id AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Le successeur doit être un membre actif du club.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('lkdv.bypass_member_guard', '1', true);

  UPDATE public.clubs
  SET created_by = p_new_founder_id
  WHERE id = p_club_id;

  UPDATE public.club_members
  SET role = 'founder', can_manage_stories = true, can_manage_gear = true
  WHERE club_id = p_club_id AND user_id = p_new_founder_id;

  UPDATE public.club_members
  SET role = 'admin', can_manage_stories = true, can_manage_gear = true
  WHERE club_id = p_club_id AND user_id = v_actor;

  INSERT INTO public.club_permission_audit (
    club_id, actor_id, target_user_id, action, old_value, new_value
  ) VALUES (
    p_club_id,
    v_actor,
    p_new_founder_id,
    'transfer_ownership',
    jsonb_build_object('founder_id', v_actor),
    jsonb_build_object('founder_id', p_new_founder_id)
  );

  RETURN jsonb_build_object('clubId', p_club_id, 'previousFounderId', v_actor, 'newFounderId', p_new_founder_id);
END;
$$;

REVOKE ALL ON FUNCTION public.club_transfer_ownership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_transfer_ownership(uuid, uuid) TO authenticated;

-- Fix cancel_club_event : autorise aussi les détenteurs de events.edit_or_cancel_any
CREATE OR REPLACE FUNCTION club_private.cancel_club_event(p_event_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  e public.club_events%ROWTYPE;
  changed_at timestamptz;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO e FROM public.club_events AS ev
  WHERE ev.id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sortie introuvable.' USING ERRCODE = 'P0002';
  END IF;

  IF e.organizer_id IS DISTINCT FROM actor
     AND NOT public.club_has_capability(e.club_id, actor, 'events.edit_or_cancel_any'::public.club_capability) THEN
    RAISE EXCEPTION 'Action réservée à l’organisateur ou aux détenteurs de events.edit_or_cancel_any.'
      USING ERRCODE = '42501';
  END IF;

  IF e.cancelled_at IS NOT NULL THEN
    RETURN e.cancelled_at;
  END IF;

  changed_at := clock_timestamp();
  UPDATE public.club_events
  SET cancelled_at = changed_at, cancelled_by = actor, participants_count = 0
  WHERE id = e.id;

  UPDATE public.club_invites AS i SET revoked_at = changed_at
  WHERE i.kind = 'event' AND i.target_id = e.id::text
    AND (i.club_id IS NULL OR i.club_id = e.club_id) AND i.revoked_at IS NULL;

  RETURN changed_at;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Audit étendu (target_user_id nullable + target_role + triggers policies/overrides)
-- ----------------------------------------------------------------------------

ALTER TABLE public.club_permission_audit
  ALTER COLUMN target_user_id DROP NOT NULL;

ALTER TABLE public.club_permission_audit
  ADD COLUMN IF NOT EXISTS target_role text;

DROP POLICY IF EXISTS "club_permission_audit_read" ON public.club_permission_audit;
CREATE POLICY "club_permission_audit_read"
  ON public.club_permission_audit FOR SELECT
  TO authenticated
  USING (
    public.club_has_capability(club_id, auth.uid(), 'members.view_audit_log'::public.club_capability)
    OR public.club_has_capability(club_id, auth.uid(), 'members.manage_roles'::public.club_capability)
    OR public.club_has_capability(club_id, auth.uid(), 'permissions.delegate'::public.club_capability)
  );

CREATE OR REPLACE FUNCTION public.log_club_capability_override_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.club_permission_audit (
      club_id, actor_id, target_user_id, action, old_value, new_value
    ) VALUES (
      OLD.club_id,
      auth.uid(),
      OLD.user_id,
      'member_override_reset',
      jsonb_build_object('capability', OLD.capability::text, 'allowed', OLD.allowed),
      NULL
    );
    RETURN OLD;
  END IF;

  INSERT INTO public.club_permission_audit (
    club_id, actor_id, target_user_id, action, old_value, new_value
  ) VALUES (
    NEW.club_id,
    COALESCE(auth.uid(), NEW.granted_by),
    NEW.user_id,
    'member_override_change',
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('capability', OLD.capability::text, 'allowed', OLD.allowed) ELSE NULL END,
    jsonb_build_object('capability', NEW.capability::text, 'allowed', NEW.allowed)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_club_capability_override_change ON public.club_member_capability_overrides;
CREATE TRIGGER trg_log_club_capability_override_change
  AFTER INSERT OR UPDATE OR DELETE ON public.club_member_capability_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.log_club_capability_override_change();

CREATE OR REPLACE FUNCTION public.log_club_role_policy_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.club_permission_audit (
      club_id, actor_id, target_user_id, target_role, action, old_value, new_value
    ) VALUES (
      OLD.club_id,
      auth.uid(),
      NULL,
      OLD.role,
      'role_policy_reset',
      jsonb_build_object('role', OLD.role, 'capability', OLD.capability::text, 'allowed', OLD.allowed),
      NULL
    );
    RETURN OLD;
  END IF;

  INSERT INTO public.club_permission_audit (
    club_id, actor_id, target_user_id, target_role, action, old_value, new_value
  ) VALUES (
    NEW.club_id,
    COALESCE(auth.uid(), NEW.updated_by),
    NULL,
    NEW.role,
    'role_policy_change',
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('role', OLD.role, 'capability', OLD.capability::text, 'allowed', OLD.allowed) ELSE NULL END,
    jsonb_build_object('role', NEW.role, 'capability', NEW.capability::text, 'allowed', NEW.allowed)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_club_role_policy_change ON public.club_role_capability_policies;
CREATE TRIGGER trg_log_club_role_policy_change
  AFTER INSERT OR UPDATE OR DELETE ON public.club_role_capability_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.log_club_role_policy_change();

-- ----------------------------------------------------------------------------
-- 5. Salons administrables & privés par rôle (min_role)
-- ----------------------------------------------------------------------------

ALTER TABLE public.club_channels
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS min_role text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

ALTER TABLE public.club_channels DROP CONSTRAINT IF EXISTS club_channels_min_role_check;
ALTER TABLE public.club_channels
  ADD CONSTRAINT club_channels_min_role_check
  CHECK (min_role IN ('founder', 'admin', 'moderator', 'volunteer', 'member'));

CREATE INDEX IF NOT EXISTS idx_club_channels_club_pos
  ON public.club_channels(club_id, position, created_at);

DROP POLICY IF EXISTS club_channels_member_read ON public.club_channels;
CREATE POLICY club_channels_member_read ON public.club_channels
  FOR SELECT TO authenticated
  USING (
    public.club_role_rank(public.club_actor_effective_role(club_id, auth.uid()))
      >= public.club_role_rank(min_role)
  );

DROP POLICY IF EXISTS club_channels_moderator_write ON public.club_channels;
CREATE POLICY club_channels_moderator_write ON public.club_channels
  FOR INSERT TO authenticated
  WITH CHECK (
    public.club_has_capability(club_id, auth.uid(), 'salons.create'::public.club_capability)
  );

DROP POLICY IF EXISTS club_channels_admin_update ON public.club_channels;
CREATE POLICY club_channels_admin_update ON public.club_channels
  FOR UPDATE TO authenticated
  USING (
    public.club_has_capability(club_id, auth.uid(), 'salons.edit_settings'::public.club_capability)
    OR public.club_has_capability(club_id, auth.uid(), 'salons.archive_or_delete'::public.club_capability)
  )
  WITH CHECK (
    public.club_has_capability(club_id, auth.uid(), 'salons.edit_settings'::public.club_capability)
    OR public.club_has_capability(club_id, auth.uid(), 'salons.archive_or_delete'::public.club_capability)
  );

DROP POLICY IF EXISTS club_channels_admin_delete ON public.club_channels;
CREATE POLICY club_channels_admin_delete ON public.club_channels
  FOR DELETE TO authenticated
  USING (
    public.club_has_capability(club_id, auth.uid(), 'salons.archive_or_delete'::public.club_capability)
  );

DROP POLICY IF EXISTS club_messages_member_read ON public.club_channel_messages;
CREATE POLICY club_messages_member_read ON public.club_channel_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_channels ch
      WHERE ch.id = club_channel_messages.channel_id
        AND ch.club_id = club_channel_messages.club_id
        AND public.club_role_rank(public.club_actor_effective_role(ch.club_id, auth.uid()))
          >= public.club_role_rank(ch.min_role)
    )
  );

DROP POLICY IF EXISTS club_messages_member_insert ON public.club_channel_messages;
CREATE POLICY club_messages_member_insert ON public.club_channel_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.club_channels ch
      JOIN public.club_members m
        ON m.club_id = ch.club_id AND m.user_id = auth.uid() AND m.status = 'active'
      WHERE ch.id = club_channel_messages.channel_id
        AND ch.club_id = club_channel_messages.club_id
        AND ch.archived_at IS NULL
        AND (m.muted_until IS NULL OR m.muted_until <= now())
        AND public.club_role_rank(public.club_actor_effective_role(ch.club_id, auth.uid()))
          >= public.club_role_rank(ch.min_role)
        AND (
          (
            NOT ch.read_only_for_members
            AND public.club_has_capability(ch.club_id, auth.uid(), 'salons.post'::public.club_capability)
          )
          OR public.club_has_capability(ch.club_id, auth.uid(), 'salons.post_announcements'::public.club_capability)
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 6. Opérations Grands Événements : Postes & Affectations Bénévoles
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.club_event_volunteer_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  zone_label text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer NOT NULL DEFAULT 4 CHECK (capacity >= 1 AND capacity <= 500),
  instructions text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.club_event_volunteer_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.club_event_volunteer_shifts(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'confirmed', 'checked_in', 'declined')),
  checked_in_at timestamptz,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_volunteer_shifts_event
  ON public.club_event_volunteer_shifts(club_id, event_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_club_volunteer_assignments_shift
  ON public.club_event_volunteer_assignments(shift_id, status);
CREATE INDEX IF NOT EXISTS idx_club_volunteer_assignments_user
  ON public.club_event_volunteer_assignments(club_id, user_id);

ALTER TABLE public.club_event_volunteer_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_event_volunteer_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_volunteer_shifts_read" ON public.club_event_volunteer_shifts;
CREATE POLICY "club_volunteer_shifts_read"
  ON public.club_event_volunteer_shifts FOR SELECT
  TO authenticated
  USING (
    public.club_has_capability(club_id, auth.uid(), 'volunteers.manage_shifts'::public.club_capability)
    OR EXISTS (
      SELECT 1 FROM public.club_event_volunteer_assignments a
      WHERE a.shift_id = club_event_volunteer_shifts.id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "club_volunteer_shifts_write" ON public.club_event_volunteer_shifts;
CREATE POLICY "club_volunteer_shifts_write"
  ON public.club_event_volunteer_shifts FOR ALL
  TO authenticated
  USING (
    public.club_has_capability(club_id, auth.uid(), 'volunteers.manage_shifts'::public.club_capability)
  )
  WITH CHECK (
    public.club_has_capability(club_id, auth.uid(), 'volunteers.manage_shifts'::public.club_capability)
  );

DROP POLICY IF EXISTS "club_volunteer_assignments_read" ON public.club_event_volunteer_assignments;
CREATE POLICY "club_volunteer_assignments_read"
  ON public.club_event_volunteer_assignments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.club_has_capability(club_id, auth.uid(), 'volunteers.manage_shifts'::public.club_capability)
  );

DROP POLICY IF EXISTS "club_volunteer_assignments_write" ON public.club_event_volunteer_assignments;
CREATE POLICY "club_volunteer_assignments_write"
  ON public.club_event_volunteer_assignments FOR ALL
  TO authenticated
  USING (
    public.club_has_capability(club_id, auth.uid(), 'volunteers.manage_shifts'::public.club_capability)
  )
  WITH CHECK (
    public.club_has_capability(club_id, auth.uid(), 'volunteers.manage_shifts'::public.club_capability)
  );

-- ----------------------------------------------------------------------------
-- 7. Budget Collaboratif (global club ou par événement)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.club_budget_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.club_events(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('income', 'expense')),
  category text NOT NULL CHECK (char_length(category) BETWEEN 1 AND 80),
  label text NOT NULL CHECK (char_length(label) BETWEEN 2 AND 160),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'paid', 'rejected')),
  notes text,
  receipt_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_budget_entries_club
  ON public.club_budget_entries(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_budget_entries_event
  ON public.club_budget_entries(club_id, event_id);

ALTER TABLE public.club_budget_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_budget_entries_read" ON public.club_budget_entries;
CREATE POLICY "club_budget_entries_read"
  ON public.club_budget_entries FOR SELECT
  TO authenticated
  USING (
    public.club_has_capability(club_id, auth.uid(), 'budget.view'::public.club_capability)
    OR public.club_has_capability(club_id, auth.uid(), 'budget.approve_and_manage'::public.club_capability)
  );

DROP POLICY IF EXISTS "club_budget_entries_insert" ON public.club_budget_entries;
CREATE POLICY "club_budget_entries_insert"
  ON public.club_budget_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.club_has_capability(club_id, auth.uid(), 'budget.approve_and_manage'::public.club_capability)
      OR (
        public.club_has_capability(club_id, auth.uid(), 'budget.propose_expense'::public.club_capability)
        AND status = 'proposed'
      )
    )
  );

DROP POLICY IF EXISTS "club_budget_entries_update" ON public.club_budget_entries;
CREATE POLICY "club_budget_entries_update"
  ON public.club_budget_entries FOR UPDATE
  TO authenticated
  USING (
    public.club_has_capability(club_id, auth.uid(), 'budget.approve_and_manage'::public.club_capability)
    OR (created_by = auth.uid() AND status = 'proposed')
  )
  WITH CHECK (
    public.club_has_capability(club_id, auth.uid(), 'budget.approve_and_manage'::public.club_capability)
    OR (created_by = auth.uid() AND status = 'proposed')
  );

DROP POLICY IF EXISTS "club_budget_entries_delete" ON public.club_budget_entries;
CREATE POLICY "club_budget_entries_delete"
  ON public.club_budget_entries FOR DELETE
  TO authenticated
  USING (
    public.club_has_capability(club_id, auth.uid(), 'budget.approve_and_manage'::public.club_capability)
    OR (created_by = auth.uid() AND status = 'proposed')
  );
