-- Cache auth.uid() once per statement for the core trip, carnet, and profile
-- policies. Preserve every other part of each live policy expression. Fail
-- atomically if a target policy has changed command, role, or auth shape.
BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $migration$
DECLARE
  target record;
  policy_row record;
  expressions text;
  uid_calls integer;
  cached_uid_calls integer;
  using_expression text;
  check_expression text;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
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
      ('user_profiles', 'users_update_own_profile', 'w', 'authenticated'::regrole::oid)
    ) AS expected(table_name, policy_name, command, role_oid)
  LOOP
    SELECT p.polcmd, p.polroles,
           pg_get_expr(p.polqual, p.polrelid) AS using_sql,
           pg_get_expr(p.polwithcheck, p.polrelid) AS check_sql
    INTO policy_row
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = target.table_name
      AND p.polname = target.policy_name;

    IF NOT FOUND OR policy_row.polcmd::text <> target.command::text
       OR policy_row.polroles <> ARRAY[target.role_oid] THEN
      RAISE EXCEPTION 'Core RLS policy drift: %.%',
        target.table_name, target.policy_name;
    END IF;

    expressions := concat_ws(' ', policy_row.using_sql, policy_row.check_sql);
    uid_calls := regexp_count(expressions, 'auth[.]uid[(][)]', 1, 'i');
    cached_uid_calls := regexp_count(expressions,
      'select[[:space:]]+auth[.]uid[(][)]', 1, 'i');

    IF uid_calls = 0 OR (cached_uid_calls > 0 AND cached_uid_calls <> uid_calls) THEN
      RAISE EXCEPTION 'Unexpected auth.uid expression: %.%',
        target.table_name, target.policy_name;
    END IF;

    IF cached_uid_calls = uid_calls THEN
      CONTINUE; -- Safe on replay.
    END IF;

    using_expression := CASE WHEN policy_row.using_sql IS NULL THEN '' ELSE
      format(' USING (%s)', regexp_replace(policy_row.using_sql,
        'auth[.]uid[(][)]', '(SELECT auth.uid())', 'gi')) END;
    check_expression := CASE WHEN policy_row.check_sql IS NULL THEN '' ELSE
      format(' WITH CHECK (%s)', regexp_replace(policy_row.check_sql,
        'auth[.]uid[(][)]', '(SELECT auth.uid())', 'gi')) END;

    EXECUTE format('ALTER POLICY %I ON public.%I%s%s',
      target.policy_name, target.table_name,
      using_expression, check_expression);
  END LOOP;
END;
$migration$;

COMMIT;
