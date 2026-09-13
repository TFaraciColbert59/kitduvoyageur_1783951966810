-- ============================================================
-- TRIBU — M1 : capacites de groupe
-- ============================================================
-- Couche additive : les roles existants (TRIBU-R3) restent inchanges,
-- une matrice de capacites leur est associee, avec overrides par membre.
-- Priorite : override > defaut de role > false.
-- ============================================================

-- ── 1. Enum des capacites ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.group_capability AS ENUM (
    'manage_info', 'manage_members', 'manage_expenses', 'manage_tasks',
    'manage_kit', 'manage_polls', 'manage_album', 'moderate_messages',
    'invite_members', 'contribute'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Tables ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_role_capability_defaults (
  role public.group_member_role NOT NULL,
  capability public.group_capability NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (role, capability)
);

CREATE TABLE IF NOT EXISTS public.group_member_capability_overrides (
  group_id UUID NOT NULL REFERENCES public.travel_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  capability public.group_capability NOT NULL,
  allowed BOOLEAN NOT NULL,
  PRIMARY KEY (group_id, user_id, capability)
);

-- ── 3. Matrice par defaut (seed, jamais ecrasee une fois posee) ──────────────
INSERT INTO public.group_role_capability_defaults (role, capability, allowed)
SELECT r.role, c.capability,
  CASE
    WHEN r.role IN ('organizer'::public.group_member_role, 'co_organizer'::public.group_member_role) THEN true
    WHEN r.role = 'member'::public.group_member_role THEN c.capability = 'contribute'::public.group_capability
    ELSE false
  END
FROM (VALUES
  ('organizer'::public.group_member_role),
  ('co_organizer'::public.group_member_role),
  ('member'::public.group_member_role),
  ('observer'::public.group_member_role)
) AS r(role)
CROSS JOIN (VALUES
  ('manage_info'::public.group_capability),
  ('manage_members'::public.group_capability),
  ('manage_expenses'::public.group_capability),
  ('manage_tasks'::public.group_capability),
  ('manage_kit'::public.group_capability),
  ('manage_polls'::public.group_capability),
  ('manage_album'::public.group_capability),
  ('moderate_messages'::public.group_capability),
  ('invite_members'::public.group_capability),
  ('contribute'::public.group_capability)
) AS c(capability)
ON CONFLICT (role, capability) DO NOTHING;

-- ── 4. Fonction de resolution des capacites ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.group_member_has_capability(
  p_group_id UUID,
  p_user_id UUID,
  p_capability public.group_capability
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.group_members m
      WHERE m.group_id = p_group_id
        AND m.user_id = p_user_id
        AND m.status = 'active'
    ) THEN false
    ELSE COALESCE(
      (SELECT o.allowed FROM public.group_member_capability_overrides o
        WHERE o.group_id = p_group_id
          AND o.user_id = p_user_id
          AND o.capability = p_capability),
      (SELECT d.allowed FROM public.group_members m
        JOIN public.group_role_capability_defaults d ON d.role = m.role
        WHERE m.group_id = p_group_id
          AND m.user_id = p_user_id
          AND m.status = 'active'
          AND d.capability = p_capability),
      false
    )
  END
$$;

GRANT EXECUTE ON FUNCTION public.group_member_has_capability(UUID, UUID, public.group_capability)
  TO authenticated, anon;

-- ── 5. RLS des nouvelles tables ──────────────────────────────────────────────
ALTER TABLE public.group_role_capability_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_member_capability_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capability_defaults_read" ON public.group_role_capability_defaults;
CREATE POLICY "capability_defaults_read" ON public.group_role_capability_defaults
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "capability_overrides_read" ON public.group_member_capability_overrides;
CREATE POLICY "capability_overrides_read" ON public.group_member_capability_overrides
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.group_member_has_capability(group_id, auth.uid(), 'manage_members')
  );

DROP POLICY IF EXISTS "capability_overrides_manage" ON public.group_member_capability_overrides;
CREATE POLICY "capability_overrides_manage" ON public.group_member_capability_overrides
  FOR ALL TO authenticated
  USING (public.group_member_has_capability(group_id, auth.uid(), 'manage_members'))
  WITH CHECK (public.group_member_has_capability(group_id, auth.uid(), 'manage_members'));

GRANT SELECT ON public.group_role_capability_defaults TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_member_capability_overrides TO authenticated, service_role;

-- ── 6. Durcissement search_path des fonctions d'acces existantes ─────────────
ALTER FUNCTION public.is_group_member(UUID, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_group_organizer(UUID, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.lkv_can(UUID, TEXT, UUID, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_moderateur() SET search_path = public, pg_temp;

DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.is_group_public(UUID) SET search_path = public, pg_temp';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
