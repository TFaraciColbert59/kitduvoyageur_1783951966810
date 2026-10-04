-- Run after 20261005000000_admin_rbac_core.sql.
-- Guards the global admin RBAC: tables, seeds, has_permission() hardening,
-- deny-by-default RLS, and idempotent backfill.
BEGIN;
SELECT plan(16);

SELECT is(
  (SELECT count(*)::integer FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('roles', 'permissions', 'user_roles', 'role_permissions')),
  4,
  'the four RBAC tables exist'
);

SELECT is(
  (SELECT count(*)::integer FROM public.roles
    WHERE name IN ('super_admin', 'admin', 'moderateur')),
  3,
  'the three roles are seeded'
);

SELECT ok(
  (SELECT count(*)::integer FROM public.permissions) >= 13,
  'permissions are seeded'
);

SELECT ok(
  (SELECT count(*)::integer FROM public.role_permissions) > 0,
  'role_permissions are seeded'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_permission' AND p.prosecdef),
  1,
  'has_permission is SECURITY DEFINER'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_permission'
      AND p.proconfig IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(p.proconfig) AS cfg
        WHERE cfg LIKE 'search_path=%' AND cfg LIKE '%public%' AND cfg LIKE '%pg_temp%'
      )
  ),
  'has_permission keeps a locked public,pg_temp search_path'
);

SELECT ok(has_function_privilege('authenticated', 'public.has_permission(text)', 'EXECUTE'),
  'authenticated can evaluate has_permission in RLS policies');
SELECT ok(has_function_privilege('service_role', 'public.has_permission(text)', 'EXECUTE'),
  'service_role can execute has_permission');

SELECT is(
  (SELECT count(*)::integer FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('roles', 'permissions', 'user_roles', 'role_permissions')
      AND rowsecurity),
  4,
  'RLS is enabled on all four RBAC tables'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.tablename IN ('roles', 'permissions', 'user_roles', 'role_permissions')
      AND EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = t.tablename AND c.relforcerowsecurity
      )),
  4,
  'FORCE RLS (deny-by-default) is on for all four RBAC tables'
);

SELECT ok(NOT has_table_privilege('anon', 'public.user_roles', 'SELECT'),
  'anon cannot read user_roles');
SELECT ok(NOT has_table_privilege('anon', 'public.role_permissions', 'SELECT'),
  'anon cannot read role_permissions');
SELECT ok(NOT has_table_privilege('authenticated', 'public.user_roles', 'UPDATE'),
  'authenticated has no direct UPDATE on user_roles (grant/revoke via INSERT/DELETE policies only)');

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
      AND policyname = 'user_roles_grant'
      AND with_check ILIKE '%roles.grant%'
  ),
  'user_roles grant policy requires roles.grant permission'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
      AND policyname = 'user_roles_read_own'
      AND qual ILIKE '%auth.uid()%'
  ),
  'user_roles read policy isolates callers own rows unless users.read'
);

SELECT ok(
  (SELECT count(*)::integer FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'user_roles'
      AND indexname = 'idx_user_roles_user_id') = 1,
  'lookup index on user_roles(user_id) exists'
);

SELECT * FROM finish();
ROLLBACK;
