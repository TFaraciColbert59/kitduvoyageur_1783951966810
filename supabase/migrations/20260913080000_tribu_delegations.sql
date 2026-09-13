-- ============================================================
-- TRIBU — M8 : delegations temporaires de role
-- ============================================================
-- Un membre actif peut deleguer un role qu'il detient (ou gerer les
-- delegations avec `manage_members`) pour une fenetre temporelle.
-- `group_member_has_capability` applique alors la matrice du role delegue
-- en plus, sans jamais ecraser un override explicite.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_role_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.travel_groups(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  delegated_role public.group_member_role NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_role_delegations_window CHECK (ends_at > starts_at),
  CONSTRAINT group_role_delegations_distinct CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_role_delegations_target
  ON public.group_role_delegations(group_id, to_user_id, ends_at);
CREATE INDEX IF NOT EXISTS idx_group_role_delegations_delegator
  ON public.group_role_delegations(from_user_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.group_role_delegations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delegations_read_member" ON public.group_role_delegations;
CREATE POLICY "delegations_read_member" ON public.group_role_delegations
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "delegations_insert_own" ON public.group_role_delegations;
CREATE POLICY "delegations_insert_own" ON public.group_role_delegations
  FOR INSERT TO authenticated
  WITH CHECK (
    from_user_id = auth.uid()
    AND public.is_group_member(group_id, auth.uid())
    AND (
      -- Le delegataire ne peut deleguer qu'un role qu'il detient...
      (delegated_role = 'member'::public.group_member_role)
      OR (delegated_role = 'observer'::public.group_member_role)
      OR (
        delegated_role IN ('organizer'::public.group_member_role, 'co_organizer'::public.group_member_role)
        AND public.is_group_organizer(group_id, auth.uid())
      )
      -- ...ou gerer les delegations du groupe.
      OR public.group_member_has_capability(group_id, auth.uid(), 'manage_members')
    )
    AND EXISTS (
      SELECT 1 FROM public.group_members m
      WHERE m.group_id = group_role_delegations.group_id
        AND m.user_id = group_role_delegations.to_user_id
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS "delegations_delete_own_or_manage" ON public.group_role_delegations;
CREATE POLICY "delegations_delete_own_or_manage" ON public.group_role_delegations
  FOR DELETE TO authenticated
  USING (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR public.group_member_has_capability(group_id, auth.uid(), 'manage_members')
  );

GRANT SELECT, INSERT, DELETE ON public.group_role_delegations TO authenticated, service_role;

-- ── Fonction de capacites : override > delegation active > role ─────────────
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
      (SELECT bool_or(d.allowed)
         FROM public.group_role_delegations del
         JOIN public.group_role_capability_defaults d
           ON d.role = del.delegated_role AND d.capability = p_capability
        WHERE del.group_id = p_group_id
          AND del.to_user_id = p_user_id
          AND del.starts_at <= now()
          AND del.ends_at > now()),
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
