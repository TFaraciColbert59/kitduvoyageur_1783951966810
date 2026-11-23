-- ============================================================================
-- Club Hierarchy, Capabilities Matrix & Club Gear Inventory (Option A + 2)
-- ============================================================================

-- 1. Expand club_members roles & capability columns
ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS can_manage_stories boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_gear boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_certified_leader boolean NOT NULL DEFAULT false;

ALTER TABLE public.club_members DROP CONSTRAINT IF EXISTS club_members_role_check;
ALTER TABLE public.club_members
  ADD CONSTRAINT club_members_role_check
  CHECK (role IN ('founder', 'admin', 'moderator', 'member'));

-- Backfill founder role for club creators
UPDATE public.club_members m
SET role = 'founder',
    can_manage_stories = true,
    can_manage_gear = true
FROM public.clubs c
WHERE m.club_id = c.id
  AND m.user_id = c.created_by
  AND m.status = 'active'
  AND m.role <> 'founder';

-- Ensure admins also have gear & story flags by default if not set
UPDATE public.club_members
SET can_manage_gear = true,
    can_manage_stories = true
WHERE role IN ('founder', 'admin')
  AND status = 'active'
  AND (can_manage_gear = false OR can_manage_stories = false);

-- 2. Club capability enum & matrix (aligned with Tribu pattern)
DO $$ BEGIN
  CREATE TYPE public.club_capability AS ENUM (
    'club.delete',
    'club.transfer_ownership',
    'club.edit_settings',
    'members.manage_roles',
    'permissions.delegate',
    'members.review_requests',
    'members.manage_invites',
    'members.mute',
    'members.ban_or_kick',
    'salons.moderate_messages',
    'events.create_official',
    'events.edit_or_cancel_any',
    'events.manage_routes',
    'gear.manage_club_inventory',
    'gear.manage_standard_kits',
    'gear.approve_club_loans',
    'collections.curate_routes',
    'highlights.moderate',
    'stories.publish_club',
    'stories.manage_highlights',
    'feed.post',
    'salons.post'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.club_role_capability_defaults (
  role text NOT NULL CHECK (role IN ('founder', 'admin', 'moderator', 'member')),
  capability public.club_capability NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role, capability)
);

CREATE TABLE IF NOT EXISTS public.club_member_capability_overrides (
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  capability public.club_capability NOT NULL,
  allowed boolean NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id, capability)
);

CREATE INDEX IF NOT EXISTS idx_club_member_cap_overrides_user
  ON public.club_member_capability_overrides(user_id);

-- Seed default capabilities per canonical role
INSERT INTO public.club_role_capability_defaults (role, capability, allowed)
SELECT r.role, c.capability,
  CASE
    WHEN r.role = 'founder' THEN true
    WHEN r.role = 'admin' THEN c.capability NOT IN ('club.delete'::public.club_capability, 'club.transfer_ownership'::public.club_capability)
    WHEN r.role = 'moderator' THEN c.capability IN (
      'members.review_requests'::public.club_capability,
      'members.manage_invites'::public.club_capability,
      'members.mute'::public.club_capability,
      'members.ban_or_kick'::public.club_capability,
      'salons.moderate_messages'::public.club_capability,
      'events.create_official'::public.club_capability,
      'events.manage_routes'::public.club_capability,
      'collections.curate_routes'::public.club_capability,
      'highlights.moderate'::public.club_capability,
      'stories.publish_club'::public.club_capability,
      'stories.manage_highlights'::public.club_capability,
      'feed.post'::public.club_capability,
      'salons.post'::public.club_capability
    )
    WHEN r.role = 'member' THEN c.capability IN (
      'feed.post'::public.club_capability,
      'salons.post'::public.club_capability
    )
    ELSE false
  END
FROM (VALUES ('founder'), ('admin'), ('moderator'), ('member')) AS r(role)
CROSS JOIN unnest(enum_range(NULL::public.club_capability)) AS c(capability)
ON CONFLICT (role, capability) DO NOTHING;

-- Sync existing can_manage_stories = true overrides for members
INSERT INTO public.club_member_capability_overrides (club_id, user_id, capability, allowed)
SELECT m.club_id, m.user_id, cap.capability, true
FROM public.club_members m
CROSS JOIN (VALUES
  ('stories.publish_club'::public.club_capability),
  ('stories.manage_highlights'::public.club_capability)
) AS cap(capability)
WHERE m.status = 'active' AND m.role = 'member' AND m.can_manage_stories = true
ON CONFLICT (club_id, user_id, capability) DO NOTHING;

-- 3. Unified capability resolver
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
      SELECT 1 FROM public.clubs c
      WHERE c.id = p_club_id AND c.created_by = p_user_id
    ) THEN true
    ELSE COALESCE((
      SELECT COALESCE(
        o.allowed,
        d.allowed,
        false
      )
      FROM public.club_members m
      LEFT JOIN public.club_role_capability_defaults d
        ON d.role = m.role AND d.capability = p_capability
      LEFT JOIN public.club_member_capability_overrides o
        ON o.club_id = m.club_id AND o.user_id = m.user_id AND o.capability = p_capability
      WHERE m.club_id = p_club_id
        AND m.user_id = p_user_id
        AND m.status = 'active'
      LIMIT 1
    ), false)
  END;
$$;

-- RLS on capability tables
ALTER TABLE public.club_role_capability_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_member_capability_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_role_cap_defaults_read" ON public.club_role_capability_defaults;
CREATE POLICY "club_role_cap_defaults_read"
  ON public.club_role_capability_defaults FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "club_member_cap_overrides_read" ON public.club_member_capability_overrides;
CREATE POLICY "club_member_cap_overrides_read"
  ON public.club_member_capability_overrides FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.club_has_capability(club_id, auth.uid(), 'permissions.delegate'::public.club_capability)
  );

DROP POLICY IF EXISTS "club_member_cap_overrides_write" ON public.club_member_capability_overrides;
CREATE POLICY "club_member_cap_overrides_write"
  ON public.club_member_capability_overrides FOR ALL
  USING (
    public.club_has_capability(club_id, auth.uid(), 'permissions.delegate'::public.club_capability)
  )
  WITH CHECK (
    public.club_has_capability(club_id, auth.uid(), 'permissions.delegate'::public.club_capability)
    AND user_id <> auth.uid()
  );

-- 4. Harden club_members guard trigger (prevent moderator escalation & founder demotion)
CREATE OR REPLACE FUNCTION public.guard_club_member_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_role text;
  actor_can_manage_roles boolean := false;
  other_active_admins integer;
BEGIN
  -- Service role / SQL editor bypass
  IF actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'founder' THEN
      RAISE EXCEPTION 'club_members: le fondateur du club ne peut pas être supprimé'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  SELECT m.role INTO actor_role
  FROM public.club_members m
  WHERE m.club_id = NEW.club_id
    AND m.user_id = actor
    AND m.status = 'active'
  LIMIT 1;

  IF EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = NEW.club_id AND c.created_by = actor) THEN
    actor_role := 'founder';
  END IF;

  actor_can_manage_roles := actor_role IN ('founder', 'admin')
    OR public.club_has_capability(NEW.club_id, actor, 'members.manage_roles'::public.club_capability);

  IF TG_OP = 'INSERT' THEN
    IF NOT actor_can_manage_roles THEN
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

  -- UPDATE : colonnes privilégiées réservées aux admins/fondateur (plus de moderator!)
  IF (NEW.role IS DISTINCT FROM OLD.role)
     OR (NEW.status IS DISTINCT FROM OLD.status)
     OR (NEW.can_manage_stories IS DISTINCT FROM OLD.can_manage_stories)
     OR (NEW.can_manage_gear IS DISTINCT FROM OLD.can_manage_gear)
     OR (NEW.is_certified_leader IS DISTINCT FROM OLD.is_certified_leader) THEN

    IF NOT actor_can_manage_roles THEN
      RAISE EXCEPTION 'club_members: modification de rôle ou permissions réservée à la direction du club'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.user_id = actor AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'club_members: impossible de modifier son propre rôle'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.role = 'founder' AND (NEW.role <> 'founder' OR NEW.status <> 'active') THEN
      RAISE EXCEPTION 'club_members: le fondateur ne peut pas être rétrogradé ou banni'
        USING ERRCODE = '42501';
    END IF;

    IF (OLD.role = 'admin' OR NEW.role IN ('founder', 'admin')) AND actor_role <> 'founder' THEN
      RAISE EXCEPTION 'club_members: seul le fondateur peut nommer ou rétrograder un administrateur'
        USING ERRCODE = '42501';
    END IF;

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
  END IF;

  RETURN NEW;
END;
$$;

-- Tighten club_members_g02_moderator_* & clubs_g02_moderator_update so moderators cannot escalate
DROP POLICY IF EXISTS "club_members_g02_moderator_insert" ON public.club_members;
DROP POLICY IF EXISTS "club_members_g02_moderator_update" ON public.club_members;
DROP POLICY IF EXISTS "club_members_g02_moderator_delete" ON public.club_members;
DROP POLICY IF EXISTS "clubs_g02_moderator_update" ON public.clubs;

CREATE POLICY "clubs_direction_update"
  ON public.clubs FOR UPDATE
  USING (public.club_has_capability(id, auth.uid(), 'club.edit_settings'::public.club_capability))
  WITH CHECK (public.club_has_capability(id, auth.uid(), 'club.edit_settings'::public.club_capability));

-- 5. Club Gear Inventory & 4-step Loans (Option A + Hybride Léger + Caution Informative)
ALTER TABLE public.club_gear_items
  ALTER COLUMN owner_id DROP NOT NULL;

ALTER TABLE public.club_gear_items
  ADD COLUMN IF NOT EXISTS ownership_scope text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS quantity_total integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quantity_available integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS condition_status text NOT NULL DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS deposit_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_epi boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_inspected_at date,
  ADD COLUMN IF NOT EXISTS epi_expires_at date,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.club_gear_items DROP CONSTRAINT IF EXISTS club_gear_items_ownership_scope_check;
ALTER TABLE public.club_gear_items
  ADD CONSTRAINT club_gear_items_ownership_scope_check
  CHECK (ownership_scope IN ('club', 'member'));

ALTER TABLE public.club_gear_items DROP CONSTRAINT IF EXISTS club_gear_items_condition_status_check;
ALTER TABLE public.club_gear_items
  ADD CONSTRAINT club_gear_items_condition_status_check
  CHECK (condition_status IN ('new', 'good', 'worn', 'repair'));

ALTER TABLE public.club_gear_items DROP CONSTRAINT IF EXISTS club_gear_items_qty_check;
ALTER TABLE public.club_gear_items
  ADD CONSTRAINT club_gear_items_qty_check
  CHECK (quantity_total >= 1 AND quantity_available >= 0 AND quantity_available <= quantity_total);

ALTER TABLE public.club_gear_loans DROP CONSTRAINT IF EXISTS club_gear_loans_status_check;
ALTER TABLE public.club_gear_loans
  ADD CONSTRAINT club_gear_loans_status_check
  CHECK (status IN ('requested', 'approved', 'checked_out', 'returned', 'overdue', 'issue', 'declined', 'cancelled'));

ALTER TABLE public.club_gear_loans
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.club_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkout_condition text,
  ADD COLUMN IF NOT EXISTS return_condition text,
  ADD COLUMN IF NOT EXISTS condition_note text,
  ADD COLUMN IF NOT EXISTS handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checked_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_club_gear_items_scope
  ON public.club_gear_items(club_id, ownership_scope);

CREATE INDEX IF NOT EXISTS idx_club_gear_loans_club_status
  ON public.club_gear_loans(club_id, status);

-- 6. Fix buggy RLS policies from 20261122120000_clubs_strava_komoot_features.sql
DROP POLICY IF EXISTS "club_collections_read" ON public.club_collections;
DROP POLICY IF EXISTS "club_collections_insert" ON public.club_collections;
DROP POLICY IF EXISTS "club_collection_routes_read" ON public.club_collection_routes;
DROP POLICY IF EXISTS "club_collection_routes_insert" ON public.club_collection_routes;
DROP POLICY IF EXISTS "club_highlights_read" ON public.club_highlights;
DROP POLICY IF EXISTS "club_highlights_insert" ON public.club_highlights;
DROP POLICY IF EXISTS "club_gear_items_read" ON public.club_gear_items;
DROP POLICY IF EXISTS "club_gear_items_insert" ON public.club_gear_items;
DROP POLICY IF EXISTS "club_gear_items_update" ON public.club_gear_items;
DROP POLICY IF EXISTS "club_gear_loans_read" ON public.club_gear_loans;
DROP POLICY IF EXISTS "club_gear_loans_insert" ON public.club_gear_loans;
DROP POLICY IF EXISTS "club_gear_loans_update" ON public.club_gear_loans;
DROP POLICY IF EXISTS "club_standard_kits_read" ON public.club_standard_kits;
DROP POLICY IF EXISTS "club_standard_kits_insert" ON public.club_standard_kits;

CREATE POLICY "club_collections_read" ON public.club_collections FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_collections.club_id
      AND (c.privacy = 'open' OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = c.id AND m.user_id = auth.uid() AND m.status = 'active'))
  )
);
CREATE POLICY "club_collections_insert" ON public.club_collections FOR INSERT WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_collections.club_id AND m.user_id = auth.uid() AND m.status = 'active')
);

CREATE POLICY "club_collection_routes_read" ON public.club_collection_routes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_collection_routes.club_id
      AND (c.privacy = 'open' OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = c.id AND m.user_id = auth.uid() AND m.status = 'active'))
  )
);
CREATE POLICY "club_collection_routes_insert" ON public.club_collection_routes FOR INSERT WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_collection_routes.club_id AND m.user_id = auth.uid() AND m.status = 'active')
);

CREATE POLICY "club_highlights_read" ON public.club_highlights FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_highlights.club_id
      AND (c.privacy = 'open' OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = c.id AND m.user_id = auth.uid() AND m.status = 'active'))
  )
);
CREATE POLICY "club_highlights_insert" ON public.club_highlights FOR INSERT WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_highlights.club_id AND m.user_id = auth.uid() AND m.status = 'active')
);

CREATE POLICY "club_gear_items_read" ON public.club_gear_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_gear_items.club_id
      AND (c.privacy = 'open' OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = c.id AND m.user_id = auth.uid() AND m.status = 'active'))
  )
);
CREATE POLICY "club_gear_items_insert" ON public.club_gear_items FOR INSERT WITH CHECK (
  (
    ownership_scope = 'member'
    AND auth.uid() = owner_id
    AND EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_gear_items.club_id AND m.user_id = auth.uid() AND m.status = 'active')
  )
  OR (
    ownership_scope = 'club'
    AND public.club_has_capability(club_gear_items.club_id, auth.uid(), 'gear.manage_club_inventory'::public.club_capability)
  )
);
CREATE POLICY "club_gear_items_update" ON public.club_gear_items FOR UPDATE USING (
  (ownership_scope = 'member' AND auth.uid() = owner_id)
  OR public.club_has_capability(club_gear_items.club_id, auth.uid(), 'gear.manage_club_inventory'::public.club_capability)
);

CREATE POLICY "club_gear_loans_read" ON public.club_gear_loans FOR SELECT USING (
  auth.uid() = borrower_id
  OR EXISTS (SELECT 1 FROM public.club_gear_items g WHERE g.id = club_gear_loans.gear_item_id AND g.owner_id = auth.uid())
  OR public.club_has_capability(club_gear_loans.club_id, auth.uid(), 'gear.approve_club_loans'::public.club_capability)
);
CREATE POLICY "club_gear_loans_insert" ON public.club_gear_loans FOR INSERT WITH CHECK (
  auth.uid() = borrower_id
  AND status = 'requested'
  AND EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = club_gear_loans.club_id AND m.user_id = auth.uid() AND m.status = 'active')
);
CREATE POLICY "club_gear_loans_update" ON public.club_gear_loans FOR UPDATE USING (
  (auth.uid() = borrower_id AND status IN ('requested', 'approved'))
  OR EXISTS (SELECT 1 FROM public.club_gear_items g WHERE g.id = club_gear_loans.gear_item_id AND g.ownership_scope = 'member' AND g.owner_id = auth.uid())
  OR public.club_has_capability(club_gear_loans.club_id, auth.uid(), 'gear.approve_club_loans'::public.club_capability)
) WITH CHECK (
  -- Emprunteur ne peut que annuler sa propre demande
  (
    auth.uid() = borrower_id
    AND status = 'cancelled'
    AND NOT public.club_has_capability(club_gear_loans.club_id, auth.uid(), 'gear.approve_club_loans'::public.club_capability)
    AND NOT EXISTS (SELECT 1 FROM public.club_gear_items g WHERE g.id = club_gear_loans.gear_item_id AND g.ownership_scope = 'member' AND g.owner_id = auth.uid())
  )
  OR EXISTS (SELECT 1 FROM public.club_gear_items g WHERE g.id = club_gear_loans.gear_item_id AND g.ownership_scope = 'member' AND g.owner_id = auth.uid())
  OR public.club_has_capability(club_gear_loans.club_id, auth.uid(), 'gear.approve_club_loans'::public.club_capability)
);

CREATE POLICY "club_standard_kits_read" ON public.club_standard_kits FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_standard_kits.club_id
      AND (c.privacy = 'open' OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = c.id AND m.user_id = auth.uid() AND m.status = 'active'))
  )
);
CREATE POLICY "club_standard_kits_insert" ON public.club_standard_kits FOR INSERT WITH CHECK (
  auth.uid() = created_by
  AND public.club_has_capability(club_standard_kits.club_id, auth.uid(), 'gear.manage_standard_kits'::public.club_capability)
);
