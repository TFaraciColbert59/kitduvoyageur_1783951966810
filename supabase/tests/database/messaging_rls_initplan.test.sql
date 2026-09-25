-- RLS performance regression for the canonical messaging policies.
-- Run with messaging_security.test.sql to cover both policy shape and access.
BEGIN;
SELECT plan(6);

CREATE TEMP TABLE messaging_policies_expected (
  schema_name text NOT NULL,
  table_name text NOT NULL,
  policy_name text NOT NULL,
  command char NOT NULL
) ON COMMIT DROP;

INSERT INTO messaging_policies_expected (schema_name, table_name, policy_name, command) VALUES
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
  ('storage', 'objects', 'storage_delete_message_attachments', 'd');

SELECT is(
  (SELECT count(*)::integer
   FROM messaging_policies_expected e
   JOIN pg_policy p ON p.polname = e.policy_name AND p.polcmd::text = e.command::text
   JOIN pg_class c ON c.oid = p.polrelid AND c.relname = e.table_name
   JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = e.schema_name),
  19,
  'all canonical messaging policies retain their commands'
);

SELECT is(
  (SELECT count(*)::integer
   FROM messaging_policies_expected e
   JOIN pg_policy p ON p.polname = e.policy_name AND p.polcmd::text = e.command::text
   JOIN pg_class c ON c.oid = p.polrelid AND c.relname = e.table_name
   JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = e.schema_name
   WHERE p.polroles = ARRAY['authenticated'::regrole::oid]),
  19,
  'messaging policies remain restricted to authenticated users'
);

WITH expressions AS (
  SELECT concat_ws(' ', pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid)) AS definition
  FROM messaging_policies_expected e
  JOIN pg_policy p ON p.polname = e.policy_name AND p.polcmd::text = e.command::text
  JOIN pg_class c ON c.oid = p.polrelid AND c.relname = e.table_name
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = e.schema_name
)
SELECT is(
  (SELECT count(*)::integer FROM expressions
   WHERE regexp_count(definition, 'auth[.]uid[(][)]', 1, 'i') > 0
     AND regexp_count(definition, 'select[[:space:]]+auth[.]uid[(][)]', 1, 'i')
       = regexp_count(definition, 'auth[.]uid[(][)]', 1, 'i')),
  19,
  'every auth.uid call in the messaging policies is an initPlan candidate'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'message_attachments'
     AND policyname IN ('members_select_attachments', 'senders_insert_attachments')
     AND concat_ws(' ', qual, with_check) LIKE '%message_id%'
     AND concat_ws(' ', qual, with_check) LIKE '%is_conversation_member%'),
  2,
  'attachment policies retain message and conversation membership checks'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN ('storage_select_message_attachments',
                        'storage_insert_message_attachments',
                        'storage_delete_message_attachments')
     AND concat_ws(' ', qual, with_check) LIKE '%bucket_id%'
     AND concat_ws(' ', qual, with_check) LIKE '%foldername%'),
  3,
  'storage policies retain bucket and path restrictions'
);

SELECT has_index('public', 'messages', 'idx_messages_conv_created',
  'conversation message chronology index remains available');

SELECT * FROM finish();
ROLLBACK;
