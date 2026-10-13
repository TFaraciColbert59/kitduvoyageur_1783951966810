BEGIN;
SELECT plan(9);

-- F-027 — stories : publication, audience, expiration, retrait, signalement.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('f0270000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'st_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f0270000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'st_b@test.local', 'x', '{}', '{}', now(), now()),
  ('f0270000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'st_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('f0270000-0000-4000-8000-000000000001', 'Sacha', 'st_a@test.local'),
  ('f0270000-0000-4000-8000-000000000002', 'Sonia', 'st_b@test.local'),
  ('f0270000-0000-4000-8000-000000000003', 'Sam', 'st_c@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, slug, name, privacy, created_by) VALUES
  ('f0270000-1000-4000-8000-000000000001', 'club-stories-test', 'Club stories', 'open', 'f0270000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.club_members (club_id, user_id, role, status) VALUES
  ('f0270000-1000-4000-8000-000000000001', 'f0270000-0000-4000-8000-000000000002', 'member', 'active')
ON CONFLICT DO NOTHING;

-- 1. A publie une story publique.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0270000-0000-4000-8000-000000000001';
SELECT lives_ok(
  $$ INSERT INTO public.post_stories (id, author_id, image_url, caption)
     VALUES ('f0270000-2000-4000-8000-000000000001', 'f0270000-0000-4000-8000-000000000001',
             'https://cdn.test/story-a.jpg', 'Col du midi') $$,
  '1. Publication d''une story publique'
);

-- 2. B (membre authentifié) la voit.
SET LOCAL "request.jwt.claim.sub" = 'f0270000-0000-4000-8000-000000000002';
SELECT is(
  (SELECT count(*)::int FROM public.post_stories WHERE id = 'f0270000-2000-4000-8000-000000000001'),
  1,
  '2. La story non expirée est visible par les membres'
);

-- 3. Une story expirée est invisible.
RESET ROLE;
INSERT INTO public.post_stories (id, author_id, image_url, expires_at) VALUES
  ('f0270000-2000-4000-8000-000000000099', 'f0270000-0000-4000-8000-000000000001',
   'https://cdn.test/story-old.jpg', now() - interval '1 hour')
ON CONFLICT (id) DO NOTHING;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0270000-0000-4000-8000-000000000002';
SELECT is(
  (SELECT count(*)::int FROM public.post_stories WHERE id = 'f0270000-2000-4000-8000-000000000099'),
  0,
  '3. Une story expirée n''est plus visible'
);

-- 4. B ne peut pas supprimer la story d'A.
DELETE FROM public.post_stories WHERE id = 'f0270000-2000-4000-8000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.post_stories WHERE id = 'f0270000-2000-4000-8000-000000000001'),
  1,
  '4. La story d''autrui ne peut pas être supprimée'
);

-- 5. Story de club : un non-membre ne peut pas publier.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0270000-0000-4000-8000-000000000003';
SELECT throws_ok(
  $$ INSERT INTO public.post_stories (author_id, image_url, visibility, club_id)
     VALUES ('f0270000-0000-4000-8000-000000000003', 'https://cdn.test/club.jpg', 'club',
             'f0270000-1000-4000-8000-000000000001') $$,
  '42501', NULL,
  '5. Un non-membre ne peut pas publier de story de club'
);

-- 6. Un membre du club le peut.
SET LOCAL "request.jwt.claim.sub" = 'f0270000-0000-4000-8000-000000000002';
SELECT lives_ok(
  $$ INSERT INTO public.post_stories (id, author_id, image_url, visibility, club_id)
     VALUES ('f0270000-2000-4000-8000-000000000002', 'f0270000-0000-4000-8000-000000000002',
             'https://cdn.test/club.jpg', 'club', 'f0270000-1000-4000-8000-000000000001') $$,
  '6. Un membre publie une story de club'
);

-- 7. Signalement : B signale la story d'A.
INSERT INTO public.story_reports (story_id, story_author_id, reporter_id, reason)
VALUES ('f0270000-2000-4000-8000-000000000001', 'f0270000-0000-4000-8000-000000000001',
        'f0270000-0000-4000-8000-000000000002', 'Contenu inapproprié');
SELECT is(
  (SELECT count(*)::int FROM public.story_reports),
  1,
  '7. Le signalement est enregistré'
);

-- 8. Un tiers ne lit pas les signalements d'autrui.
SET LOCAL "request.jwt.claim.sub" = 'f0270000-0000-4000-8000-000000000003';
SELECT is_empty(
  $$ SELECT 1 FROM public.story_reports $$,
  '8. Les signalements restent confidentiels'
);

-- 9. Blocage : B bloque A (réutilisation user_blocks).
SET LOCAL "request.jwt.claim.sub" = 'f0270000-0000-4000-8000-000000000002';
SELECT lives_ok(
  $$ INSERT INTO public.user_blocks (blocker_id, blocked_id)
     VALUES ('f0270000-0000-4000-8000-000000000002', 'f0270000-0000-4000-8000-000000000001') $$,
  '9. Le blocage depuis le visionneur fonctionne (user_blocks)'
);

SELECT * FROM finish();
ROLLBACK;
