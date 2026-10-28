BEGIN;
SELECT plan(8);

-- F-029 — plus de doublons stricts sur le périmètre communauté.

SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='public' AND tablename='community_posts' AND policyname='Public read community_posts'),
  0, '1. Doublon SELECT community_posts supprimé');
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='public' AND tablename='community_posts' AND policyname='community_posts_select_audience'),
  1, '2. La policy SELECT par audience remplace la lecture publique globale');
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='public' AND tablename='post_comments' AND policyname='post_comments_select_audience' AND permissive='PERMISSIVE'),
  1, '3. post_comments : lecture autorisée uniquement via le post parent');
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='public' AND tablename='post_likes' AND policyname='post_likes_select_audience' AND permissive='PERMISSIVE'),
  1, '4. post_likes : lecture autorisée uniquement via le post parent');
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='public' AND tablename='community_posts' AND cmd='INSERT' AND permissive='PERMISSIVE'),
  1, '5. community_posts : une seule policy INSERT permissive (restrictive essai conservée)');
SELECT is(
  (SELECT count(*)::int FROM pg_indexes
    WHERE schemaname='public' AND indexname IN ('idx_community_posts_author','idx_community_posts_created_at','idx_post_comments_post_id')),
  0, '6. Indexes dupliqués supprimés');
-- The author-only index was superseded by (author_id, created_at DESC) in
-- 20261022101000. Check usable leading-column coverage rather than old names.
SELECT is(
  (SELECT count(*)::int
     FROM (VALUES ('community_posts', 'author_id'),
                  ('community_posts', 'created_at'),
                  ('post_comments', 'post_id')) AS required(table_name, column_name)
    WHERE EXISTS (
      SELECT 1
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_class idx ON idx.oid = i.indexrelid
        JOIN pg_am am ON am.oid = idx.relam
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
       WHERE n.nspname = 'public' AND t.relname = required.table_name
         AND a.attname = required.column_name AND am.amname = 'btree'
         AND i.indisvalid AND i.indisready AND i.indislive
         AND i.indpred IS NULL
    )),
  3, '7. Indexes utilisables couvrent auteur, date et commentaires du post');
-- Aucun groupe de policies permissives strictement identique ne subsiste
-- sur les tables du périmètre communauté.
SELECT is(
  (SELECT count(*)::int FROM (
     SELECT tablename, cmd, coalesce(qual,''), count(*) AS n
       FROM pg_policies
      WHERE schemaname='public'
        AND tablename IN ('community_posts','post_comments','post_likes','club_topics','club_events','events','event_participants')
        AND permissive='PERMISSIVE'
      GROUP BY tablename, cmd, coalesce(qual,'')
     HAVING count(*) > 1
   ) dup),
  0, '8. Plus aucun doublon strict (mêmes prédicats) sur le périmètre');
SELECT * FROM finish();
ROLLBACK;
