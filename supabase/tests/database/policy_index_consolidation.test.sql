BEGIN;
SELECT plan(8);

-- F-029 — plus de doublons stricts sur le périmètre communauté.

SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='public' AND tablename='community_posts' AND policyname='Public read community_posts'),
  0, '1. Doublon SELECT community_posts supprimé');
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='public' AND tablename='community_posts' AND policyname='public_read_community_posts'),
  1, '2. La policy SELECT conservée existe toujours');
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='public' AND tablename='post_comments' AND policyname IN ('Public read post_comments','public_read_post_comments') AND permissive='PERMISSIVE'),
  1, '3. post_comments : une seule policy SELECT permissive');
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='public' AND tablename='post_likes' AND policyname IN ('Public read post_likes','public_read_post_likes') AND permissive='PERMISSIVE'),
  1, '4. post_likes : une seule policy SELECT permissive');
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='public' AND tablename='community_posts' AND cmd='INSERT' AND permissive='PERMISSIVE'),
  1, '5. community_posts : une seule policy INSERT permissive (restrictive essai conservée)');
SELECT is(
  (SELECT count(*)::int FROM pg_indexes
    WHERE schemaname='public' AND indexname IN ('idx_community_posts_author','idx_community_posts_created_at','idx_post_comments_post_id')),
  0, '6. Indexes dupliqués supprimés');
SELECT is(
  (SELECT count(*)::int FROM pg_indexes
    WHERE schemaname='public' AND indexname IN ('idx_community_posts_author_id','idx_community_posts_created','idx_post_comments_post')),
  3, '7. Indexes conservés présents');
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
