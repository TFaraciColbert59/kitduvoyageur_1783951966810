-- Run after 20260925020000_core_rls_auth_initplan.sql.
BEGIN;
SELECT plan(5);

CREATE TEMP TABLE core_policies_expected (
  table_name text NOT NULL,
  policy_name text NOT NULL,
  command char NOT NULL,
  role_oid oid NOT NULL
) ON COMMIT DROP;

INSERT INTO core_policies_expected VALUES
  ('trips', 'trips_select_policy', 'r', 0::oid),
  ('trips', 'trips_insert_policy', 'a', 0::oid),
  ('trips', 'trips_update_policy', 'w', 0::oid),
  ('trips', 'trips_delete_policy', 'd', 0::oid),
  ('trip_member_profiles', 'tmprof_select', 'r', 0::oid),
  ('trip_member_profiles', 'tmprof_insert', 'a', 0::oid),
  ('trip_member_profiles', 'tmprof_update', 'w', 0::oid),
  ('carnets', 'Public read carnets', 'r', 0::oid),
  ('carnets', 'Auth insert carnets', 'a', 0::oid),
  ('carnets', 'Auth update carnets', 'w', 0::oid),
  ('carnets', 'Auth delete carnets', 'd', 0::oid),
  ('user_profiles', 'Users insert own profile', 'a', 0::oid),
  ('user_profiles', 'Users update own profile', 'w', 0::oid),
  ('user_profiles', 'profile_read_own_visibility', 'r', 'authenticated'::regrole::oid),
  ('user_profiles', 'profile_update_own_visibility', 'w', 'authenticated'::regrole::oid),
  ('user_profiles', 'users_manage_own_profiles', '*', 'authenticated'::regrole::oid),
  ('user_profiles', 'users_read_own_profile', 'r', 'authenticated'::regrole::oid),
  ('user_profiles', 'users_update_own_profile', 'w', 'authenticated'::regrole::oid);

SELECT is((SELECT count(*)::integer FROM core_policies_expected), 18,
  'exactly 18 core policies are tracked');

SELECT is((SELECT count(*)::integer
  FROM core_policies_expected e
  JOIN pg_policy p ON p.polname = e.policy_name
    AND p.polcmd::text = e.command::text
    AND p.polroles = ARRAY[e.role_oid]
  JOIN pg_class c ON c.oid = p.polrelid AND c.relname = e.table_name
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'),
  18, 'all core policies retain their commands and roles');

WITH expressions AS (
  SELECT concat_ws(' ', pg_get_expr(p.polqual, p.polrelid),
    pg_get_expr(p.polwithcheck, p.polrelid)) AS definition
  FROM core_policies_expected e
  JOIN pg_policy p ON p.polname = e.policy_name
  JOIN pg_class c ON c.oid = p.polrelid AND c.relname = e.table_name
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
)
SELECT is((SELECT count(*)::integer FROM expressions
  WHERE regexp_count(definition, 'auth[.]uid[(][)]', 1, 'i') > 0
    AND regexp_count(definition, 'select[[:space:]]+auth[.]uid[(][)]', 1, 'i')
      = regexp_count(definition, 'auth[.]uid[(][)]', 1, 'i')),
  18, 'every auth.uid call in target policies is cached');

SELECT is((SELECT count(*)::integer FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'trips'
    AND ((policyname = 'trips_select_policy' AND qual LIKE '%can_read_trip%')
      OR (policyname = 'trips_update_policy'
        AND qual LIKE '%can_edit_trip%'
        AND with_check LIKE '%can_edit_trip%'))),
  2, 'trip read and edit membership checks remain');

SELECT is((SELECT count(*)::integer FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'carnets'
    AND policyname = 'Public read carnets'
    AND qual LIKE '%visibility%'
    AND qual LIKE '%author_id%'),
  1, 'public carnet visibility and owner access remain');

SELECT * FROM finish();
ROLLBACK;
