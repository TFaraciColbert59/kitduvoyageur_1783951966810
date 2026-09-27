-- Run after 20260926010000_rls_role_helper_execute.sql.
-- Guards the RLS role helpers: policies call them, so authenticated needs
-- EXECUTE even though the functions return only the caller's own role state.
BEGIN;
SELECT plan(14);

SELECT is(
  (SELECT count(*)::integer
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('is_admin', 'is_moderateur', 'get_admin_role')),
  3,
  'the three RLS role helper functions exist'
);

SELECT is(
  (SELECT count(*)::integer
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('is_admin', 'is_moderateur', 'get_admin_role')
     AND p.prosecdef),
  3,
  'all role helpers remain SECURITY DEFINER'
);

SELECT is(
  (SELECT count(*)::integer
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('is_admin', 'is_moderateur', 'get_admin_role')
     AND p.proconfig IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM unnest(p.proconfig) AS cfg
       WHERE cfg LIKE 'search_path=%'
         AND cfg LIKE '%public%'
     )),
  3,
  'all role helpers keep a locked public search_path'
);

SELECT ok(NOT has_function_privilege('anon', 'public.is_admin()', 'EXECUTE'),
  'anon cannot execute is_admin');
SELECT ok(NOT has_function_privilege('anon', 'public.is_moderateur()', 'EXECUTE'),
  'anon cannot execute is_moderateur');
SELECT ok(NOT has_function_privilege('anon', 'public.get_admin_role()', 'EXECUTE'),
  'anon cannot execute get_admin_role');

SELECT ok(has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE'),
  'authenticated can evaluate is_admin in RLS policies');
SELECT ok(has_function_privilege('authenticated', 'public.is_moderateur()', 'EXECUTE'),
  'authenticated can evaluate is_moderateur in RLS policies');
SELECT ok(has_function_privilege('authenticated', 'public.get_admin_role()', 'EXECUTE'),
  'authenticated can read its own admin role');

SELECT ok(has_function_privilege('service_role', 'public.is_admin()', 'EXECUTE'),
  'service_role can execute is_admin');
SELECT ok(has_function_privilege('service_role', 'public.is_moderateur()', 'EXECUTE'),
  'service_role can execute is_moderateur');
SELECT ok(has_function_privilege('service_role', 'public.get_admin_role()', 'EXECUTE'),
  'service_role can execute get_admin_role');

SELECT ok(
  (SELECT count(*) > 0 FROM pg_policies
   WHERE schemaname = 'public'
     AND (qual ILIKE '%is_admin()%' OR with_check ILIKE '%is_admin()%')),
  'live RLS policies still depend on is_admin'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'user_profiles_select_admin'
      AND qual ILIKE '%is_admin()%'
  ),
  'user_profiles admin policy still depends on is_admin'
);

SELECT * FROM finish();
ROLLBACK;
