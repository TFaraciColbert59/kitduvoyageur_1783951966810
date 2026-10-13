BEGIN;
SELECT plan(6);

-- F-022 — mentions structurées : notification à chaque mention, hors blocages.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('f0220000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'men_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f0220000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'men_b@test.local', 'x', '{}', '{}', now(), now()),
  ('f0220000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'men_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('f0220000-0000-4000-8000-000000000001', 'Mona', 'men_a@test.local'),
  ('f0220000-0000-4000-8000-000000000002', 'Milo', 'men_b@test.local'),
  ('f0220000-0000-4000-8000-000000000003', 'Maé', 'men_c@test.local')
ON CONFLICT (id) DO NOTHING;

-- A publie en mentionnant B et C, ainsi que lui-même (doit être ignoré).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0220000-0000-4000-8000-000000000001';
INSERT INTO public.community_posts (id, author_id, content, mentions, likes_count, comments_count)
VALUES (
  'f0220000-1000-4000-8000-000000000001',
  'f0220000-0000-4000-8000-000000000001',
  'Salut @Milo et @Maé, on part samedi ?',
  ARRAY['f0220000-0000-4000-8000-000000000002','f0220000-0000-4000-8000-000000000003','f0220000-0000-4000-8000-000000000001']::uuid[],
  0, 0
);

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE user_id = 'f0220000-0000-4000-8000-000000000002' AND type = 'mention'
      AND related_id = 'f0220000-1000-4000-8000-000000000001'),
  1,
  '1. La personne mentionnée reçoit une notification'
);

SELECT is(
  (SELECT link FROM public.notifications
    WHERE user_id = 'f0220000-0000-4000-8000-000000000002' AND type = 'mention'
    LIMIT 1),
  '/communaute?post=f0220000-1000-4000-8000-000000000001',
  '2. La notification pointe vers le permalien exact'
);

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE user_id = 'f0220000-0000-4000-8000-000000000001' AND type = 'mention'),
  0,
  '3. Se mentionner soi-même ne notifie pas'
);

-- B bloque A → la mention A→B ne produit plus de notification.
INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('f0220000-0000-4000-8000-000000000002', 'f0220000-0000-4000-8000-000000000001');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0220000-0000-4000-8000-000000000001';
INSERT INTO public.community_posts (id, author_id, content, mentions, likes_count, comments_count)
VALUES (
  'f0220000-1000-4000-8000-000000000002',
  'f0220000-0000-4000-8000-000000000001',
  'Encore @Milo ?',
  ARRAY['f0220000-0000-4000-8000-000000000002']::uuid[],
  0, 0
);
RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE user_id = 'f0220000-0000-4000-8000-000000000002' AND type = 'mention'
      AND related_id = 'f0220000-1000-4000-8000-000000000002'),
  0,
  '4. Un blocage (dans un sens) annule la mention'
);

-- Ids sans profil : ignorés proprement.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0220000-0000-4000-8000-000000000001';
INSERT INTO public.community_posts (id, author_id, content, mentions, likes_count, comments_count)
VALUES (
  'f0220000-1000-4000-8000-000000000003',
  'f0220000-0000-4000-8000-000000000001',
  'Mention fantôme',
  ARRAY['00000000-0000-4000-8000-000000000099']::uuid[],
  0, 0
);
RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM public.notifications WHERE related_id = 'f0220000-1000-4000-8000-000000000003'),
  0,
  '5. Un identifiant sans profil ne produit rien'
);

SELECT is(
  (SELECT mentions FROM public.community_posts WHERE id = 'f0220000-1000-4000-8000-000000000001'),
  ARRAY['f0220000-0000-4000-8000-000000000002','f0220000-0000-4000-8000-000000000003','f0220000-0000-4000-8000-000000000001']::uuid[],
  '6. Les mentions sont stockées structurées (IDs)'
);

SELECT * FROM finish();
ROLLBACK;
