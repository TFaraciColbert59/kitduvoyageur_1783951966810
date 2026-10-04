-- Run after 20261005010000_admin_action_logs.sql.
-- Guards the append-only audit log: table, trigger, RLS deny policy set.
BEGIN;
SELECT plan(10);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'action_logs'),
  'action_logs table exists'
);

SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'action_logs'),
  'RLS is enabled on action_logs'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'action_logs' AND c.relforcerowsecurity
  ),
  'FORCE RLS (deny-by-default) is on for action_logs'
);

SELECT ok(NOT has_table_privilege('authenticated', 'public.action_logs', 'UPDATE'),
  'authenticated has no UPDATE on action_logs (append-only)');
SELECT ok(NOT has_table_privilege('authenticated', 'public.action_logs', 'DELETE'),
  'authenticated has no DELETE on action_logs (append-only)');
SELECT ok(NOT has_table_privilege('anon', 'public.action_logs', 'SELECT'),
  'anon cannot read action_logs');

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'action_logs'
      AND policyname = 'action_logs_insert_own'
      AND with_check ILIKE '%auth.uid()%'
  ),
  'insert policy binds actor_id to the caller'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'action_logs'
      AND policyname = 'action_logs_select_audit'
      AND qual ILIKE '%audit.read%'
  ),
  'select policy requires audit.read permission'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_roles'
      AND t.tgname = 'trg_log_user_role_change'
  ),
  'user_roles grant/revoke auto-log trigger is installed'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'log_user_role_change' AND p.prosecdef),
  1,
  'log_user_role_change is SECURITY DEFINER'
);

SELECT * FROM finish();
ROLLBACK;
