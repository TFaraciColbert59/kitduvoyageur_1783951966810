BEGIN;
SELECT plan(16);

-- Stories V2 (phase 01) — matrice d'accès can_view_story + RLS + storage.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('f0280000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'v2_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f0280000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'v2_b@test.local', 'x', '{}', '{}', now(), now()),
  ('f0280000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'v2_c@test.local', 'x', '{}', '{}', now(), now()),
  ('f0280000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'v2_d@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('f0280000-0000-4000-8000-000000000001', 'V2 Alice', 'v2_a@test.local'),
  ('f0280000-0000-4000-8000-000000000002', 'V2 Bruno', 'v2_b@test.local'),
  ('f0280000-0000-4000-8000-000000000003', 'V2 Chloé', 'v2_c@test.local'),
  ('f0280000-0000-4000-8000-000000000004', 'V2 David', 'v2_d@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_follows (follower_id, following_id) VALUES
  ('f0280000-0000-4000-8000-000000000002', 'f0280000-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;
INSERT INTO public.story_close_friends (owner_id, friend_id) VALUES
  ('f0280000-0000-4000-8000-000000000001', 'f0280000-0000-4000-8000-000000000004')
ON CONFLICT DO NOTHING;

INSERT INTO public.post_stories (id, author_id, image_url, visibility, expires_at, status, moderation_state) VALUES
  ('f0280000-2000-4000-8000-000000000001', 'f0280000-0000-4000-8000-000000000001', 'https://cdn.test/pub.jpg', 'public', now() + interval '1 hour', 'ready', 'visible'),
  ('f0280000-2000-4000-8000-000000000002', 'f0280000-0000-4000-8000-000000000001', 'https://cdn.test/fol.jpg', 'followers', now() + interval '1 hour', 'ready', 'visible'),
  ('f0280000-2000-4000-8000-000000000003', 'f0280000-0000-4000-8000-000000000001', 'https://cdn.test/cf.jpg', 'close_friends', now() + interval '1 hour', 'ready', 'visible'),
  ('f0280000-2000-4000-8000-000000000004', 'f0280000-0000-4000-8000-000000000001', 'https://cdn.test/me.jpg', 'only_me', now() + interval '1 hour', 'ready', 'visible'),
  ('f0280000-2000-4000-8000-000000000005', 'f0280000-0000-4000-8000-000000000001', 'https://cdn.test/old.jpg', 'public', now() - interval '1 hour', 'ready', 'visible'),
  ('f0280000-2000-4000-8000-000000000006', 'f0280000-0000-4000-8000-000000000001', 'https://cdn.test/rm.jpg', 'public', now() + interval '1 hour', 'removed', 'removed')
ON CONFLICT (id) DO NOTHING;

SELECT is(public.can_view_story('f0280000-2000-4000-8000-000000000001', 'f0280000-0000-4000-8000-000000000003'), true, '1. Publique visible par un tiers');
SELECT is(public.can_view_story('f0280000-2000-4000-8000-000000000002', 'f0280000-0000-4000-8000-000000000002'), true, '2. Followers visible par un abonné');
SELECT is(public.can_view_story('f0280000-2000-4000-8000-000000000002', 'f0280000-0000-4000-8000-000000000003'), false, '3. Followers invisible au non-abonné');
SELECT is(public.can_view_story('f0280000-2000-4000-8000-000000000003', 'f0280000-0000-4000-8000-000000000004'), true, '4. Close friends visible à la liste');
SELECT is(public.can_view_story('f0280000-2000-4000-8000-000000000003', 'f0280000-0000-4000-8000-000000000002'), false, '5. Close friends invisible hors liste');
SELECT is(public.can_view_story('f0280000-2000-4000-8000-000000000004', 'f0280000-0000-4000-8000-000000000003'), false, '6. Only me invisible aux tiers');
SELECT is(public.can_view_story('f0280000-2000-4000-8000-000000000004', 'f0280000-0000-4000-8000-000000000001'), true, '7. L''auteur voit sa story privée');
SELECT is(public.can_view_story('f0280000-2000-4000-8000-000000000005', 'f0280000-0000-4000-8000-000000000003'), false, '8. Expirée invisible aux tiers');
SELECT is(public.can_view_story('f0280000-2000-4000-8000-000000000005', 'f0280000-0000-4000-8000-000000000001'), true, '9. Expirée visible à l''auteur (archive)');
SELECT is(public.can_view_story('f0280000-2000-4000-8000-000000000006', 'f0280000-0000-4000-8000-000000000001'), false, '10. Story retirée invisible, même à l''auteur');
SELECT is(public.can_view_story('f0280000-2000-4000-8000-000000000001', NULL), false, '11. Aucun viewer = refus');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0280000-0000-4000-8000-000000000003';
SELECT lives_ok($$ INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ('f0280000-0000-4000-8000-000000000003', 'f0280000-0000-4000-8000-000000000001') $$, '12. Blocage enregistré');
RESET ROLE;
SELECT is(public.can_view_story('f0280000-2000-4000-8000-000000000001', 'f0280000-0000-4000-8000-000000000003'), false, '13. Blocage : publique invisible au bloqueur');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0280000-0000-4000-8000-000000000003';
SELECT is((SELECT count(*)::int FROM public.post_stories WHERE author_id = 'f0280000-0000-4000-8000-000000000001'), 0, '14. RLS : le bloqueur ne lit plus aucune story');
RESET ROLE;

INSERT INTO public.story_hidden_users (owner_id, hidden_user_id) VALUES ('f0280000-0000-4000-8000-000000000001', 'f0280000-0000-4000-8000-000000000004')
ON CONFLICT DO NOTHING;
SELECT is(public.can_view_story('f0280000-2000-4000-8000-000000000003', 'f0280000-0000-4000-8000-000000000004'), false, '15. Masquage effectif (close friends)');

SELECT is((SELECT b."public" FROM storage.buckets b WHERE b.id = 'stories-private'), false, '16. Bucket stories-private privé');

SELECT * FROM finish();
ROLLBACK;
