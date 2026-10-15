BEGIN;
SELECT plan(29);

-- These fixtures run only on CI's EPHEMERAL PostgreSQL; they are rolled back.
-- The audience migration must be applied BEFORE invoking this suite.
INSERT INTO auth.users (id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
 ('fac10000-0000-4000-8000-000000000001','authenticated','authenticated','social-author@test.local','x','{}','{}',now(),now()),
 ('fac10000-0000-4000-8000-000000000002','authenticated','authenticated','social-follower@test.local','x','{}','{}',now(),now()),
 ('fac10000-0000-4000-8000-000000000003','authenticated','authenticated','social-outsider@test.local','x','{}','{}',now(),now()),
 ('fac10000-0000-4000-8000-000000000004','authenticated','authenticated','social-member@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
 ('fac10000-0000-4000-8000-000000000001','Social Author','social-author@test.local'),
 ('fac10000-0000-4000-8000-000000000002','Social Follower','social-follower@test.local'),
 ('fac10000-0000-4000-8000-000000000003','Social Outsider','social-outsider@test.local'),
 ('fac10000-0000-4000-8000-000000000004','Social Member','social-member@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id,slug,name,created_by)
VALUES ('fac10000-0000-4000-8000-000000000099','social-privacy-test-club','Social Privacy Test Club','fac10000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_members (club_id,user_id,role,status)
VALUES ('fac10000-0000-4000-8000-000000000099','fac10000-0000-4000-8000-000000000001','admin','active'),
       ('fac10000-0000-4000-8000-000000000099','fac10000-0000-4000-8000-000000000004','member','active');

INSERT INTO public.user_follows(follower_id,following_id)
VALUES ('fac10000-0000-4000-8000-000000000002','fac10000-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO public.community_posts (id,author_id,content,audience)
VALUES
 ('fac10000-0000-4000-8000-000000000101','fac10000-0000-4000-8000-000000000001','Public voyage','public'),
 ('fac10000-0000-4000-8000-000000000102','fac10000-0000-4000-8000-000000000001','Follower-only voyage','abonnies');

-- A club post must be inserted as its actual authenticated author.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'fac10000-0000-4000-8000-000000000001';
INSERT INTO public.community_posts (id,author_id,content,audience,club_id)
VALUES ('fac10000-0000-4000-8000-000000000103',
        'fac10000-0000-4000-8000-000000000001',
        'Members-only trip','club','fac10000-0000-4000-8000-000000000099');
RESET ROLE;

INSERT INTO public.post_comments(id,post_id,author_id,content)
VALUES ('fac10000-0000-4000-8000-000000000104',
        'fac10000-0000-4000-8000-000000000103',
        'fac10000-0000-4000-8000-000000000001','Hidden club comment');
INSERT INTO public.post_likes(user_id,post_id)
VALUES ('fac10000-0000-4000-8000-000000000001',
        'fac10000-0000-4000-8000-000000000103');

SELECT is(
 (SELECT count(*)::int FROM pg_policies WHERE schemaname='public'
  AND tablename='community_posts' AND policyname='public_read_community_posts'),
 0, '1. Insecure USING(true) SELECT policy was removed'
);
SELECT is(
 (SELECT count(*)::int FROM pg_policies WHERE schemaname='public'
  AND tablename='community_posts' AND policyname='community_posts_select_audience'),
 1, '2. Explicit audience-aware SELECT policy exists'
);

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SELECT is((SELECT count(*)::int FROM public.community_posts
 WHERE id IN ('fac10000-0000-4000-8000-000000000101','fac10000-0000-4000-8000-000000000102','fac10000-0000-4000-8000-000000000103')),
 1, '3. Anonymous users read public posts only');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'fac10000-0000-4000-8000-000000000003';
SELECT is((SELECT count(*)::int FROM public.community_posts
 WHERE id IN ('fac10000-0000-4000-8000-000000000101','fac10000-0000-4000-8000-000000000102','fac10000-0000-4000-8000-000000000103')),
 1, '4. Outsiders cannot see follower- or club-only posts');
SELECT is((SELECT count(*)::int FROM public.post_comments
 WHERE id='fac10000-0000-4000-8000-000000000104'),
 0, '5. Club comments are not leaked through the public comment policy');
SELECT is((SELECT count(*)::int FROM public.post_likes
 WHERE post_id='fac10000-0000-4000-8000-000000000103'),
 0, '6. Club reactions are not leaked through the public like policy');

SELECT throws_ok(
 $$ INSERT INTO public.community_posts(author_id,content,audience,club_id)
    VALUES ('fac10000-0000-4000-8000-000000000003','Unauthorised club post','club','fac10000-0000-4000-8000-000000000099') $$,
 'P0001', NULL, '7. Non-members cannot publish into a club');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'fac10000-0000-4000-8000-000000000002';
SELECT is((SELECT count(*)::int FROM public.community_posts
 WHERE id IN ('fac10000-0000-4000-8000-000000000101','fac10000-0000-4000-8000-000000000102','fac10000-0000-4000-8000-000000000103')),
 2, '8. Followers see public and subscriber-only posts, not club-only posts');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'fac10000-0000-4000-8000-000000000004';
SELECT is((SELECT count(*)::int FROM public.community_posts
 WHERE id IN ('fac10000-0000-4000-8000-000000000101','fac10000-0000-4000-8000-000000000102','fac10000-0000-4000-8000-000000000103')),
 2, '9. Club members see public and club posts, not follower-only posts');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'fac10000-0000-4000-8000-000000000001';
SELECT is((SELECT count(*)::int FROM public.community_posts
 WHERE id IN ('fac10000-0000-4000-8000-000000000101','fac10000-0000-4000-8000-000000000102','fac10000-0000-4000-8000-000000000103')),
 3, '10. Author sees all of their posts');

SELECT throws_ok(
 $$ INSERT INTO public.community_posts(author_id,content,audience)
    VALUES ('fac10000-0000-4000-8000-000000000001','Bad visibility','private') $$,
 '23514', NULL, '11. Invalid audience value is rejected by the check constraint');
RESET ROLE;

SELECT is(
 (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='community_posts' AND c.relrowsecurity),
 1, '12. Audience checks operate under row-level security'
);

-- A blocked member must not keep reading the author's posts even when
-- they formerly had a valid club/follow relationship.
INSERT INTO public.user_blocks(blocker_id,blocked_id)
VALUES ('fac10000-0000-4000-8000-000000000001',
        'fac10000-0000-4000-8000-000000000003');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'fac10000-0000-4000-8000-000000000003';
SELECT is((SELECT count(*)::int FROM public.community_posts
 WHERE author_id='fac10000-0000-4000-8000-000000000001'
   AND id IN ('fac10000-0000-4000-8000-000000000101',
              'fac10000-0000-4000-8000-000000000102',
              'fac10000-0000-4000-8000-000000000103')),
 0, '13. Author block hides even otherwise public posts from authenticated user');
RESET ROLE;


-- Database-enforced post and topic privacy: regression cases 14-20.
SELECT is((SELECT count(*)::int FROM pg_trigger
  WHERE tgname='trg_community_post_restricted_media' AND NOT tgisinternal),
  1, '14. The restricted media guard exists');

SELECT throws_ok(
  $check$ INSERT INTO public.community_posts(author_id,content,audience,image_url)
     VALUES ('fac10000-0000-4000-8000-000000000001','Private image','abonnies','https://public.example/photo.jpg') $check$,
  '23514', NULL, '15. Restricted follower posts reject public image URLs');

SELECT throws_ok(
  $check$ INSERT INTO public.community_posts(author_id,content,audience,media_urls)
     VALUES ('fac10000-0000-4000-8000-000000000001','Private media','abonnies','["https://public.example/photo.jpg"]'::jsonb) $check$,
  '23514', NULL, '16. Restricted follower posts reject public gallery URLs');

SELECT throws_ok(
  $check$ INSERT INTO public.community_posts(author_id,content,audience,snapshot_payload)
     VALUES ('fac10000-0000-4000-8000-000000000001','Private snapshot','abonnies','{}'::jsonb) $check$,
  '23514', NULL, '17. Restricted posts reject publicly linked carnet snapshots');

INSERT INTO public.community_posts(id,author_id,content,audience,image_url)
VALUES ('fac10000-0000-4000-8000-000000000110',
        'fac10000-0000-4000-8000-000000000001',
        'Public media before privacy change','public','https://public.example/photo.jpg');
SELECT throws_ok(
  $check$ UPDATE public.community_posts SET audience='abonnies'
     WHERE id='fac10000-0000-4000-8000-000000000110' $check$,
  '23514', NULL, '18. Public-image posts cannot become private via update');

UPDATE public.clubs SET privacy='closed'
WHERE id='fac10000-0000-4000-8000-000000000099';
INSERT INTO public.club_topics(id,club_id,author_id,title,content,is_approved)
VALUES ('fac10000-0000-4000-8000-000000000111',
        'fac10000-0000-4000-8000-000000000099',
        'fac10000-0000-4000-8000-000000000001',
        'Members-only topic','Private club topic',true);
INSERT INTO public.club_topic_replies(id,topic_id,author_id,content,is_approved)
VALUES ('fac10000-0000-4000-8000-000000000112',
        'fac10000-0000-4000-8000-000000000111',
        'fac10000-0000-4000-8000-000000000001','Private reply',true);
INSERT INTO public.club_topic_likes(topic_id,user_id)
VALUES ('fac10000-0000-4000-8000-000000000111',
        'fac10000-0000-4000-8000-000000000001');

-- 25-29: RLS INSERT must reject attempts to interact with hidden content
-- even when a caller knows or guesses its UUID.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'fac10000-0000-4000-8000-000000000003';
SELECT throws_ok(
  $check$ INSERT INTO public.post_comments(post_id,author_id,content)
     VALUES ('fac10000-0000-4000-8000-000000000102',
             'fac10000-0000-4000-8000-000000000003','Private comment probe') $check$,
  '42501', NULL, '25. Outsider cannot comment on follower-only post');
SELECT throws_ok(
  $check$ INSERT INTO public.post_likes(post_id,user_id)
     VALUES ('fac10000-0000-4000-8000-000000000102',
             'fac10000-0000-4000-8000-000000000003') $check$,
  '42501', NULL, '26. Outsider cannot like follower-only post');
SELECT throws_ok(
  $check$ INSERT INTO public.post_comment_likes(comment_id,user_id)
     VALUES ('fac10000-0000-4000-8000-000000000104',
             'fac10000-0000-4000-8000-000000000003') $check$,
  '42501', NULL, '27. Outsider cannot like hidden club comment');
SELECT throws_ok(
  $check$ INSERT INTO public.club_topic_replies(topic_id,author_id,content)
     VALUES ('fac10000-0000-4000-8000-000000000111',
             'fac10000-0000-4000-8000-000000000003','Guessable topic probe') $check$,
  '42501', NULL, '28. Outsider cannot reply to closed club topic');
SELECT throws_ok(
  $check$ INSERT INTO public.club_topic_likes(topic_id,user_id)
     VALUES ('fac10000-0000-4000-8000-000000000111',
             'fac10000-0000-4000-8000-000000000003') $check$,
  '42501', NULL, '29. Outsider cannot like closed club topic');
RESET ROLE;

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SELECT is(
  (SELECT count(*)::int FROM public.club_topics
   WHERE id='fac10000-0000-4000-8000-000000000111'),
  0, '19. Anon cannot read approved legacy topics of a closed club');
SELECT is((SELECT count(*)::int FROM public.club_topic_replies
  WHERE id='fac10000-0000-4000-8000-000000000112'), 0,
  '21. Anonymous readers cannot read replies of closed club topics');
SELECT is((SELECT count(*)::int FROM public.club_topic_likes
  WHERE topic_id='fac10000-0000-4000-8000-000000000111'), 0,
  '22. Anonymous readers cannot infer likes of closed club topics');
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'fac10000-0000-4000-8000-000000000004';
SELECT is(
  (SELECT count(*)::int FROM public.club_topics
   WHERE id='fac10000-0000-4000-8000-000000000111'),
  1, '20. Active members can still read closed club topics');
SELECT is((SELECT count(*)::int FROM public.club_topic_replies
  WHERE id='fac10000-0000-4000-8000-000000000112'), 1,
  '23. Active members can still see closed club replies');
SELECT is((SELECT count(*)::int FROM public.club_topic_likes
  WHERE topic_id='fac10000-0000-4000-8000-000000000111'), 1,
  '24. Active members can still see closed club likes');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
