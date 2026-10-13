BEGIN;
SELECT plan(6);

-- F-032 — compteurs de clubs maintenus par recount serveur.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('f0320000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'club_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f0320000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'club_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('f0320000-0000-4000-8000-000000000001', 'Léa', 'club_a@test.local'),
  ('f0320000-0000-4000-8000-000000000002', 'Noé', 'club_b@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, slug, name, privacy, created_by) VALUES
  ('f0320000-1000-4000-8000-000000000001', 'club-compteurs-test', 'Club compteurs', 'open', 'f0320000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_topics (id, club_id, author_id, title, content, likes_count, replies_count, is_approved) VALUES
  ('f0320000-2000-4000-8000-000000000001', 'f0320000-1000-4000-8000-000000000001', 'f0320000-0000-4000-8000-000000000001', 'Sujet compteurs', 'Contenu', 0, 0, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_events (id, club_id, title, event_date, participants_count) VALUES
  ('f0320000-3000-4000-8000-000000000001', 'f0320000-1000-4000-8000-000000000001', 'Sortie compteurs', CURRENT_DATE + 14, 0)
ON CONFLICT (id) DO NOTHING;

-- Likes : deux membres → recount 2, quel que soit l'ordre.
INSERT INTO public.club_topic_likes (topic_id, user_id) VALUES
  ('f0320000-2000-4000-8000-000000000001', 'f0320000-0000-4000-8000-000000000001'),
  ('f0320000-2000-4000-8000-000000000001', 'f0320000-0000-4000-8000-000000000002');

SELECT is(
  (SELECT likes_count FROM public.club_topics WHERE id = 'f0320000-2000-4000-8000-000000000001'),
  2,
  '1. Deux likes → likes_count recalculé (2)'
);

DELETE FROM public.club_topic_likes
 WHERE topic_id = 'f0320000-2000-4000-8000-000000000001'
   AND user_id = 'f0320000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT likes_count FROM public.club_topics WHERE id = 'f0320000-2000-4000-8000-000000000001'),
  1,
  '2. Retrait d''un like → likes_count recalculé (1)'
);

-- Réponses : recount aussi.
INSERT INTO public.club_topic_replies (topic_id, author_id, content) VALUES
  ('f0320000-2000-4000-8000-000000000001', 'f0320000-0000-4000-8000-000000000002', 'Réponse 1'),
  ('f0320000-2000-4000-8000-000000000001', 'f0320000-0000-4000-8000-000000000001', 'Réponse 2');

SELECT is(
  (SELECT replies_count FROM public.club_topics WHERE id = 'f0320000-2000-4000-8000-000000000001'),
  2,
  '3. Deux réponses → replies_count recalculé (2)'
);

-- Participants d'événement de club.
INSERT INTO public.club_event_participants (event_id, user_id) VALUES
  ('f0320000-3000-4000-8000-000000000001', 'f0320000-0000-4000-8000-000000000001'),
  ('f0320000-3000-4000-8000-000000000001', 'f0320000-0000-4000-8000-000000000002');

SELECT is(
  (SELECT participants_count FROM public.club_events WHERE id = 'f0320000-3000-4000-8000-000000000001'),
  2,
  '4. Deux participants → participants_count recalculé (2)'
);

DELETE FROM public.club_event_participants
 WHERE event_id = 'f0320000-3000-4000-8000-000000000001'
   AND user_id = 'f0320000-0000-4000-8000-000000000002';

SELECT is(
  (SELECT participants_count FROM public.club_events WHERE id = 'f0320000-3000-4000-8000-000000000001'),
  1,
  '5. Départ → participants_count recalculé (1)'
);

-- Un client ne peut pas écrire un compteur faux durablement : le recount
-- s'applique à la mutation suivante et la valeur initiale reste la vérité.
SELECT is(
  (SELECT count(*)::int FROM pg_trigger
    WHERE tgrelid IN ('public.club_topic_likes'::regclass, 'public.club_topic_replies'::regclass, 'public.club_event_participants'::regclass)
      AND NOT tgisinternal
      AND tgname IN ('sync_club_topic_likes_count', 'sync_club_topic_replies_count', 'sync_club_event_participants_count')),
  3,
  '6. Les trois triggers de recount sont actifs'
);

SELECT * FROM finish();
ROLLBACK;
