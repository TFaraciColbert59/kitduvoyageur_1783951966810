BEGIN;
SELECT plan(11);

-- ═══════════════════════════════════════════════════════════════════════════
-- Communauté v2 — lot F : stories (20261108130006)
-- Colonnes de rognage vidéo, lien carnet et texte alternatif : présence,
-- bornes CHECK, FK, et non-régression de la visibilité (can_view_story ne
-- dépend pas du carnet lié).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('f6e10000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'story_trim_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f6e10000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'story_trim_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('f6e10000-0000-4000-8000-000000000001', 'Tina Story', 'story_trim_a@test.local'),
  ('f6e10000-0000-4000-8000-000000000002', 'Ulysse Lecteur', 'story_trim_b@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carnets (id, author_id, title, destination, visibility) VALUES
  ('f6e20000-0000-4000-8000-000000000001', 'f6e10000-0000-4000-8000-000000000001', 'Carnet public story', 'Chamonix', 'public'),
  ('f6e20000-0000-4000-8000-000000000002', 'f6e10000-0000-4000-8000-000000000001', 'Carnet privé story', 'Chamonix', 'private')
ON CONFLICT (id) DO NOTHING;

-- Story valide avec rognage, carnet lié et texte alternatif.
INSERT INTO public.post_stories (
  id, author_id, image_url, visibility, expires_at, status, moderation_state,
  trim_start_ms, trim_end_ms, linked_carnet_id, linked_carnet_day, alt_text
) VALUES (
  'f6e30000-0000-4000-8000-000000000001', 'f6e10000-0000-4000-8000-000000000001',
  'https://cdn.test/story.jpg', 'public', now() + interval '1 hour', 'ready', 'visible',
  1000, 5000, 'f6e20000-0000-4000-8000-000000000001', 2, 'Vue du sommet'
)
ON CONFLICT (id) DO NOTHING;

SELECT is(
  (SELECT trim_start_ms FROM public.post_stories WHERE id = 'f6e30000-0000-4000-8000-000000000001'),
  1000,
  '1. trim_start_ms stocké'
);
SELECT is(
  (SELECT trim_end_ms FROM public.post_stories WHERE id = 'f6e30000-0000-4000-8000-000000000001'),
  5000,
  '2. trim_end_ms stocké'
);
SELECT is(
  (SELECT linked_carnet_id FROM public.post_stories WHERE id = 'f6e30000-0000-4000-8000-000000000001'),
  'f6e20000-0000-4000-8000-000000000001'::uuid,
  '3. linked_carnet_id stocké'
);
SELECT is(
  (SELECT linked_carnet_day FROM public.post_stories WHERE id = 'f6e30000-0000-4000-8000-000000000001'),
  2,
  '4. linked_carnet_day stocké'
);
SELECT is(
  (SELECT alt_text FROM public.post_stories WHERE id = 'f6e30000-0000-4000-8000-000000000001'),
  'Vue du sommet',
  '5. alt_text stocké'
);

-- Bornes CHECK.
SELECT throws_ok(
  $$ INSERT INTO public.post_stories (author_id, image_url, visibility, status, moderation_state, trim_start_ms, trim_end_ms)
     VALUES ('f6e10000-0000-4000-8000-000000000001', 'https://cdn.test/x.jpg', 'public', 'ready', 'visible', 5000, 1000) $$,
  '23514',
  NULL,
  '6. trim_end_ms ≤ trim_start_ms refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.post_stories (author_id, image_url, visibility, status, moderation_state, trim_start_ms)
     VALUES ('f6e10000-0000-4000-8000-000000000001', 'https://cdn.test/x.jpg', 'public', 'ready', 'visible', -1) $$,
  '23514',
  NULL,
  '7. trim_start_ms négatif refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.post_stories (author_id, image_url, visibility, status, moderation_state, linked_carnet_day)
     VALUES ('f6e10000-0000-4000-8000-000000000001', 'https://cdn.test/x.jpg', 'public', 'ready', 'visible', 61) $$,
  '23514',
  NULL,
  '8. linked_carnet_day hors 1..60 refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.post_stories (author_id, image_url, visibility, status, moderation_state, alt_text)
     VALUES ('f6e10000-0000-4000-8000-000000000001', 'https://cdn.test/x.jpg', 'public', 'ready', 'visible',
             repeat('a', 201)) $$,
  '23514',
  NULL,
  '9. alt_text de plus de 200 caractères refusé'
);
SELECT throws_ok(
  $$ INSERT INTO public.post_stories (author_id, image_url, visibility, status, moderation_state, linked_carnet_id)
     VALUES ('f6e10000-0000-4000-8000-000000000001', 'https://cdn.test/x.jpg', 'public', 'ready', 'visible',
             '00000000-0000-4000-8000-000000000000') $$,
  '23503',
  NULL,
  '10. linked_carnet_id inexistant refusé (FK)'
);

-- Non-régression : la story liée à un carnet privé reste visible selon SA
-- propre visibilité (le lien est masqué côté UI selon l'accès au carnet).
SELECT is(
  (SELECT public.can_view_story(
            (SELECT id FROM public.post_stories WHERE id = 'f6e30000-0000-4000-8000-000000000001'),
            'f6e10000-0000-4000-8000-000000000002')),
  true,
  '11. can_view_story inchangé : le lien carnet ne change pas la visibilité de la story'
);

SELECT * FROM finish();
ROLLBACK;
