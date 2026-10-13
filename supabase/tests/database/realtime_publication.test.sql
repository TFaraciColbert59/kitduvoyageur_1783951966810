BEGIN;
SELECT plan(6);

-- ----------------------------------------------------------------------------
-- F-003 — Publication Realtime : les quatre tables de messagerie sont publiées
-- et les tables filtrées par colonne ont une identité réplica complète.
-- ----------------------------------------------------------------------------

SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'),
  '1. La publication supabase_realtime existe'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'),
  '2. messages est publiée'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_reactions'),
  '3. message_reactions est publiée'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversation_members'),
  '4. conversation_members est publiée'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'),
  '5. conversations est publiée'
);

SELECT is(
  (SELECT count(*)::int
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('messages', 'conversation_members')
      AND c.relreplident = 'f'),
  2,
  '6. REPLICA IDENTITY FULL sur messages et conversation_members'
);

SELECT * FROM finish();
ROLLBACK;
