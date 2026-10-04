-- ============================================================================
-- ADMIN REBUILD P1 — Socle RBAC global : roles / permissions /
-- user_roles / role_permissions + has_permission() + backfill idempotent
-- ============================================================================
-- Remplace le modèle mono-rôle (`admin_roles` UNIQUE(user_id),
-- `user_profiles.role` TEXT) par un RBAC multi-rôles avec permissions
-- fines, deny-by-default (FORCE RLS + REVOKE ALL).
-- Backfill idempotent (ON CONFLICT DO NOTHING) depuis les deux sources
-- historiques. `is_admin()` est conservé comme filet (fallback) dans
-- `has_permission()` pour ne casser aucune policy existante.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_expires_at ON public.user_roles(expires_at)
  WHERE expires_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Seed rôles
-- ----------------------------------------------------------------------------
INSERT INTO public.roles (name, description) VALUES
  ('super_admin', 'Accès total, gestion des rôles'),
  ('admin', 'Administration contenus + modération + récompenses'),
  ('moderateur', 'Modération contenus + lecture')
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Seed permissions
-- ----------------------------------------------------------------------------
INSERT INTO public.permissions (code, resource, action) VALUES
  ('users.read', 'users', 'read'),
  ('users.write', 'users', 'write'),
  ('roles.grant', 'roles', 'grant'),
  ('products.read', 'products', 'read'),
  ('products.write', 'products', 'write'),
  ('orders.read', 'orders', 'read'),
  ('orders.write', 'orders', 'write'),
  ('moderation.read', 'moderation', 'read'),
  ('moderation.write', 'moderation', 'write'),
  ('rewards.read', 'rewards', 'read'),
  ('rewards.write', 'rewards', 'write'),
  ('audit.read', 'audit', 'read'),
  ('config.write', 'config', 'write')
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Rôle -> permissions
-- ----------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE (r.name = 'super_admin')
   OR (r.name = 'admin' AND p.code <> 'roles.grant')
   OR (r.name = 'moderateur'
       AND p.code IN ('moderation.read', 'moderation.write', 'users.read',
                      'products.read', 'orders.read'))
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- Backfill idempotent, source 1 : user_profiles.role = 'admin'
-- ----------------------------------------------------------------------------
INSERT INTO public.user_roles (user_id, role_id)
SELECT up.id, r.id
FROM public.user_profiles up
JOIN public.roles r ON r.name = 'admin'
WHERE up.role = 'admin'
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- Backfill idempotent, source 2 : table historique admin_roles
-- ----------------------------------------------------------------------------
INSERT INTO public.user_roles (user_id, role_id, granted_at)
SELECT ar.user_id, r.id, ar.created_at
FROM public.admin_roles ar
JOIN public.roles r ON r.name = CASE
  WHEN ar.role = 'super_admin' THEN 'super_admin'
  WHEN ar.role = 'moderateur' THEN 'moderateur'
  ELSE 'admin'
END
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- has_permission(p_code) : rôle non expiré OU filet is_admin()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND p.code = p_code
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) OR public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- RLS deny-by-default
-- ----------------------------------------------------------------------------
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.permissions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.roles FROM anon, authenticated;
REVOKE ALL ON public.role_permissions FROM anon, authenticated;
REVOKE ALL ON public.user_roles FROM anon, authenticated;
REVOKE ALL ON public.permissions FROM anon, authenticated;
GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.role_permissions TO authenticated;

DROP POLICY IF EXISTS roles_read ON public.roles;
CREATE POLICY roles_read ON public.roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS permissions_read ON public.permissions;
CREATE POLICY permissions_read ON public.permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS user_roles_read_own ON public.user_roles;
CREATE POLICY user_roles_read_own ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.has_permission('users.read'));

DROP POLICY IF EXISTS user_roles_grant ON public.user_roles;
CREATE POLICY user_roles_grant ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('roles.grant'));

DROP POLICY IF EXISTS user_roles_revoke ON public.user_roles;
CREATE POLICY user_roles_revoke ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_permission('roles.grant'));

DROP POLICY IF EXISTS role_permissions_read ON public.role_permissions;
CREATE POLICY role_permissions_read ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS role_permissions_write ON public.role_permissions;
CREATE POLICY role_permissions_write ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('roles.grant'));

DROP POLICY IF EXISTS role_permissions_delete ON public.role_permissions;
CREATE POLICY role_permissions_delete ON public.role_permissions
  FOR DELETE TO authenticated
  USING (public.has_permission('roles.grant'));
