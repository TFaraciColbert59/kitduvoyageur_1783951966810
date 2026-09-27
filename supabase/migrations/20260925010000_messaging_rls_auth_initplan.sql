-- Cache the request user id once per statement in the canonical messaging RLS
-- policies. Keep row-dependent membership helpers as row-dependent calls.
-- Read each live predicate before rewriting so any additional authorization
-- conditions are preserved. Abort if a policy differs in command/role or mixes
-- optimized and unoptimized auth.uid calls; review that drift separately.
BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $migration$
DECLARE
  target record;
  policy_row record;
  using_expression text;
  check_expression text;
  expressions text;
  uid_calls integer;
  cached_uid_calls integer;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('public', 'conversations', 'members_select_conversations', 'r'),
      ('public', 'conversations', 'admin_update_conversations', 'w'),
      ('public', 'conversations', 'owners_delete_conversations', 'd'),
      ('public', 'conversation_members', 'members_select_conversation_members', 'r'),
      ('public', 'conversation_members', 'admin_insert_conversation_members', 'a'),
      ('public', 'conversation_members', 'members_update_own_preferences', 'w'),
      ('public', 'conversation_members', 'members_delete_conversation_members', 'd'),
      ('public', 'messages', 'members_select_messages', 'r'),
      ('public', 'messages', 'members_insert_messages', 'a'),
      ('public', 'messages', 'senders_update_messages', 'w'),
      ('public', 'messages', 'senders_delete_messages', 'd'),
      ('public', 'message_reactions', 'members_select_reactions', 'r'),
      ('public', 'message_reactions', 'users_insert_reactions', 'a'),
      ('public', 'message_reactions', 'users_delete_reactions', 'd'),
      ('public', 'message_attachments', 'members_select_attachments', 'r'),
      ('public', 'message_attachments', 'senders_insert_attachments', 'a'),
      ('storage', 'objects', 'storage_select_message_attachments', 'r'),
      ('storage', 'objects', 'storage_insert_message_attachments', 'a'),
      ('storage', 'objects', 'storage_delete_message_attachments', 'd')
    ) AS expected(schema_name, table_name, policy_name, command)
  LOOP
    SELECT p.polcmd, p.polroles,
           pg_get_expr(p.polqual, p.polrelid) AS using_sql,
           pg_get_expr(p.polwithcheck, p.polrelid) AS check_sql
    INTO policy_row
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = target.schema_name
      AND c.relname = target.table_name
      AND p.polname = target.policy_name;

    IF NOT FOUND OR policy_row.polcmd::text <> target.command::text
       OR policy_row.polroles <> ARRAY['authenticated'::regrole::oid] THEN
      RAISE EXCEPTION 'Messaging policy drift: %.%, %',
        target.schema_name, target.table_name, target.policy_name;
    END IF;

    expressions := concat_ws(' ', policy_row.using_sql, policy_row.check_sql);
    uid_calls := regexp_count(expressions, 'auth[.]uid[(][)]', 1, 'i');
    cached_uid_calls := regexp_count(expressions,
      'select[[:space:]]+auth[.]uid[(][)]', 1, 'i');

    IF uid_calls = 0 OR (cached_uid_calls > 0 AND cached_uid_calls <> uid_calls) THEN
      RAISE EXCEPTION 'Unexpected auth.uid expression: %.%, %',
        target.schema_name, target.table_name, target.policy_name;
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

    EXECUTE format('ALTER POLICY %I ON %I.%I%s%s',
      target.policy_name, target.schema_name, target.table_name,
      using_expression, check_expression);
  END LOOP;
END;
$migration$;

COMMIT;
