-- ============================================================================
-- ADMIN OS P0-02 — Autorité canonique unique : user_roles + has_permission().
-- DOWN :
--   GRANT EXECUTE ON FUNCTION public.has_permission(text) TO anon;
--   (ne restaure JAMAIS le `OR public.is_admin()` — fallback supprimé P0.)
-- Effets :
-- 1. has_permission() stricte : registre user_roles seul, sans OR is_admin().
-- 2. REVOKE anon sur has_permission/is_moderateur/get_admin_role (oracle anonyme fermé).
-- 3. admin_roles fossilisée en lecture seule (pas de DROP en P0, rollback sûr).
-- 4. Durcit is_moderateur()/get_admin_role() hérités (search_path + REVOKE).
-- Dépend de 20261005000000_admin_rbac_core.sql (tables + seeds + policies).
-- ============================================================================

-- 1. has_permission() stricte (même signature, corps sans fallback).
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
  )
$$;

REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated, service_role;

-- 2. Fossilise admin_roles historique en lecture seule.
REVOKE ALL ON TABLE public.admin_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_roles TO authenticated;

-- 3. Durcit les helpers hérités (lecture legacy inchangée, surface réduite).
CREATE OR REPLACE FUNCTION public.is_moderateur()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.is_moderateur() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_moderateur() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ar.role::text FROM public.admin_roles ar WHERE ar.user_id = auth.uid() LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_admin_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_role() TO authenticated, service_role;
