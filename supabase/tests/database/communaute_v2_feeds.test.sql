BEGIN;
SELECT plan(34);

-- ═══════════════════════════════════════════════════════════════════════════
-- Communauté v2 — lot B : feeds paginés (20261108130002)
-- Carnets / Clubs / Sorties : pagination par curseur stable sans doublon,
-- compteurs serveur, liked_by_me, my_status, friends/travelers, near,
-- événements du mois, agenda, filtres, RLS de l'invité et refus d'écriture.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('fea10000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'feed_a@test.local', 'x', '{}', '{}', now(), now()),
  ('fea10000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'feed_b@test.local', 'x', '{}', '{}', now(), now()),
  ('fea10000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'feed_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

-- handle/visibilité/is_demo explicites : les avatars travelers/friends passent
-- par la vue public_profiles (filtrée sur profile_visibility='public', is_demo=false).
INSERT INTO public.user_profiles (id, full_name, email, handle, profile_visibility, is_demo) VALUES
  ('fea10000-0000-4000-8000-000000000001', 'Fanny Auteur', 'feed_a@test.local', 'feed_fixture_a', 'public', false),
  ('fea10000-0000-4000-8000-000000000002', 'Gaspard Suiveur', 'feed_b@test.local', 'feed_fixture_b', 'public', false),
  ('fea10000-0000-4000-8000-000000000003', 'Hugo Attente', 'feed_c@test.local', 'feed_fixture_c', 'public', false)
ON CONFLICT (id) DO NOTHING;

-- B suit A : avatars « amis » dans les feeds.
INSERT INTO public.user_follows (follower_id, following_id)
VALUES ('fea10000-0000-4000-8000-000000000002', 'fea10000-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;

-- 5 carnets publics (A) + 1 privé (A).
INSERT INTO public.carnets (id, author_id, title, destination, visibility, created_at, start_geom) VALUES
  ('fea20000-0000-4000-8000-000000000001', 'fea10000-0000-4000-8000-000000000001', 'Carnet un', 'Chamonix', 'public', now() - interval '1 hour', st_setsrid(st_makepoint(6.8694, 45.9237), 4326)::geography),
  ('fea20000-0000-4000-8000-000000000002', 'fea10000-0000-4000-8000-000000000001', 'Carnet deux', 'Chamonix', 'public', now() - interval '2 hours', NULL),
  ('fea20000-0000-4000-8000-000000000003', 'fea10000-0000-4000-8000-000000000001', 'Carnet trois', ' Annecy', 'public', now() - interval '3 hours', NULL),
  ('fea20000-0000-4000-8000-000000000004', 'fea10000-0000-4000-8000-000000000001', 'Carnet quatre', 'Paris', 'public', now() - interval '4 hours', st_setsrid(st_makepoint(2.3522, 48.8566), 4326)::geography),
  ('fea20000-0000-4000-8000-000000000005', 'fea10000-0000-4000-8000-000000000001', 'Carnet cinq', 'Lyon', 'public', now() - interval '5 hours', NULL),
  ('fea20000-0000-4000-8000-000000000006', 'fea10000-0000-4000-8000-000000000001', 'Carnet privé', 'Chamonix', 'private', now() - interval '30 minutes', NULL)
ON CONFLICT (id) DO NOTHING;

-- C3 : B est collaboratrice (voyageurs = A + B = 2).
INSERT INTO public.carnet_collaborators (carnet_id, user_id, role)
VALUES ('fea20000-0000-4000-8000-000000000003', 'fea10000-0000-4000-8000-000000000002', 'contributor')
ON CONFLICT DO NOTHING;

-- J'aime : C2 = 3 (populaire), C1 = 1 par B (liked_by_me).
INSERT INTO public.carnet_likes (carnet_id, user_id) VALUES
  ('fea20000-0000-4000-8000-000000000002', 'fea10000-0000-4000-8000-000000000001'),
  ('fea20000-0000-4000-8000-000000000002', 'fea10000-0000-4000-8000-000000000002'),
  ('fea20000-0000-4000-8000-000000000002', 'fea10000-0000-4000-8000-000000000003'),
  ('fea20000-0000-4000-8000-000000000001', 'fea10000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- Clubs : 1 ouvert (B membre), 1 sur validation (B en attente), 1 secret.
INSERT INTO public.clubs (id, slug, name, privacy, created_by, created_at, updated_at, zone_geom, activities, members_count) VALUES
  ('fea30000-0000-4000-8000-000000000001', 'feed-club-ouvert', 'Club ouvert', 'open', 'fea10000-0000-4000-8000-000000000001', now() - interval '1 day', now() - interval '1 day',
   st_setsrid(st_makepoint(6.8694, 45.9237), 4326)::geography, '{rando,trail}', 2),
  ('fea30000-0000-4000-8000-000000000002', 'feed-club-validation', 'Club sur validation', 'closed', 'fea10000-0000-4000-8000-000000000001', now() - interval '10 days', now() - interval '10 days', NULL, '{rando}', 0),
  ('fea30000-0000-4000-8000-000000000003', 'feed-club-secret', 'Club secret', 'secret', 'fea10000-0000-4000-8000-000000000001', now() - interval '10 days', now() - interval '10 days', NULL, '{}', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_members (club_id, user_id, role, status) VALUES
  ('fea30000-0000-4000-8000-000000000001', 'fea10000-0000-4000-8000-000000000001', 'admin', 'active'),
  ('fea30000-0000-4000-8000-000000000001', 'fea10000-0000-4000-8000-000000000002', 'member', 'active')
ON CONFLICT (club_id, user_id) DO NOTHING;

INSERT INTO public.club_join_requests (club_id, user_id, status)
VALUES ('fea30000-0000-4000-8000-000000000002', 'fea10000-0000-4000-8000-000000000002', 'pending')
ON CONFLICT (club_id, user_id) DO NOTHING;

-- Dernier post du club ouvert (B, membre, le voit : audience club).
-- Le trigger validate_community_post_audience exige author = auth.uid() :
-- on insère donc en tant que f1, pas en superutilisateur.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'fea10000-0000-4000-8000-000000000001';
INSERT INTO public.community_posts (id, author_id, content, audience, post_type, club_id, created_at)
VALUES ('fea50000-0000-4000-8000-000000000001', 'fea10000-0000-4000-8000-000000000001',
        'Dernière sortie du club', 'club', 'post', 'fea30000-0000-4000-8000-000000000001', now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;
RESET ROLE;

-- Sorties : 2 à venir (dont une au club), 1 passée, 1 annulée.
INSERT INTO public.events (id, title, event_date, starts_at, organizer_id, status, max_participants, waitlist_enabled, club_id, location_geom) VALUES
  ('fea40000-0000-4000-8000-000000000001', 'Sortie à venir au club', CURRENT_DATE + 2, now() + interval '2 days',
   'fea10000-0000-4000-8000-000000000001', 'upcoming', 3, true, 'fea30000-0000-4000-8000-000000000001',
   st_setsrid(st_makepoint(6.8694, 45.9237), 4326)::geography),
  ('fea40000-0000-4000-8000-000000000002', 'Sortie à venir sans lieu', CURRENT_DATE + 5, now() + interval '5 days',
   'fea10000-0000-4000-8000-000000000001', 'upcoming', 10, false, NULL, NULL),
  ('fea40000-0000-4000-8000-000000000003', 'Sortie passée', CURRENT_DATE - 7, now() - interval '7 days',
   'fea10000-0000-4000-8000-000000000001', 'past', 10, false, NULL, NULL),
  ('fea40000-0000-4000-8000-000000000004', 'Sortie annulée', CURRENT_DATE + 1, now() + interval '1 day',
   'fea10000-0000-4000-8000-000000000001', 'cancelled', 10, false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_participants (event_id, user_id, status) VALUES
  ('fea40000-0000-4000-8000-000000000001', 'fea10000-0000-4000-8000-000000000001', 'confirmed'),
  ('fea40000-0000-4000-8000-000000000001', 'fea10000-0000-4000-8000-000000000002', 'confirmed'),
  ('fea40000-0000-4000-8000-000000000001', 'fea10000-0000-4000-8000-000000000003', 'waitlist')
ON CONFLICT (event_id, user_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- B (membre du club ouvert, inscrite à la sortie, suit A)
-- ═══════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'fea10000-0000-4000-8000-000000000002';

-- Carnets : discover / pagination / tri / compteurs.
SELECT is(
  (SELECT count(*)::int FROM public.community_carnets_feed('discover', 'recent', NULL, NULL, NULL, 30)),
  5,
  '1. Carnets discover : 5 carnets publics (le privé est exclu)'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_carnets_feed('discover', 'recent', NULL, NULL, NULL, 2)),
  2,
  '2. Carnets : première page limitée à 2'
);
SELECT is(
  (SELECT count(*)::int
     FROM public.community_carnets_feed('discover', 'recent', NULL, NULL,
       (SELECT jsonb_build_object('v', sort_key, 'id', id)
          FROM public.community_carnets_feed('discover', 'recent', NULL, NULL, NULL, 2)
         ORDER BY sort_key ASC, id ASC
         LIMIT 1),
       30)),
  3,
  '3. Carnets : la page suivante reprend exactement le reste'
);
SELECT is(
  (SELECT count(*)::int FROM (
     SELECT id FROM public.community_carnets_feed('discover', 'recent', NULL, NULL, NULL, 2)
     UNION ALL
     SELECT id FROM public.community_carnets_feed('discover', 'recent', NULL, NULL,
       (SELECT jsonb_build_object('v', sort_key, 'id', id)
          FROM public.community_carnets_feed('discover', 'recent', NULL, NULL, NULL, 2)
         ORDER BY sort_key ASC, id ASC
         LIMIT 1),
       30)
   ) pages),
  5,
  '4. Carnets : pages 1+2 sans doublon ni ligne sautée (curseur stable)'
);
SELECT is(
  (SELECT id FROM public.community_carnets_feed('discover', 'popular', NULL, NULL, NULL, 1)),
  'fea20000-0000-4000-8000-000000000002'::uuid,
  '5. Carnets : tri populaire place le carnet le plus aimé en tête'
);
SELECT is(
  (SELECT liked_by_me FROM public.community_carnets_feed('discover', 'recent', NULL, NULL, NULL, 30)
    WHERE id = 'fea20000-0000-4000-8000-000000000001'),
  true,
  '6. Carnets : liked_by_me vrai pour un carnet aimé par l''appelante'
);
SELECT is(
  (SELECT liked_by_me FROM public.community_carnets_feed('discover', 'recent', NULL, NULL, NULL, 30)
    WHERE id = 'fea20000-0000-4000-8000-000000000003'),
  false,
  '7. Carnets : liked_by_me faux pour un carnet non aimé'
);
SELECT is(
  (SELECT (travelers ->> 'total')::int FROM public.community_carnets_feed('discover', 'recent', NULL, NULL, NULL, 30)
    WHERE id = 'fea20000-0000-4000-8000-000000000003'),
  2,
  '8. Carnets : voyageurs = auteur + collaboratrice'
);
SELECT is(
  (SELECT jsonb_array_length(travelers -> 'avatars') FROM public.community_carnets_feed('discover', 'recent', NULL, NULL, NULL, 30)
    WHERE id = 'fea20000-0000-4000-8000-000000000003'),
  2,
  '9. Carnets : deux avatars de voyageurs'
);
SELECT is(
  (SELECT is_live FROM public.community_carnets_feed('discover', 'recent', NULL, NULL, NULL, 30)
    WHERE id = 'fea20000-0000-4000-8000-000000000001'),
  false,
  '10. Carnets : is_live est faux quand live_sharing est absent/DEFAULT false'
);
SELECT is(
  (SELECT count(*)::int
     FROM public.community_carnets_feed('near', 'near', 45.9237, 6.8694, NULL, 30)),
  1,
  '11. Carnets near : seuls les carnets géolocalisés à ≤ 100 km sont renvoyés'
);
SELECT ok(
  (SELECT distance_km < 1
     FROM public.community_carnets_feed('near', 'near', 45.9237, 6.8694, NULL, 30)
    LIMIT 1),
  '12. Carnets near : la distance serveur est calculée'
);

-- Clubs.
SELECT is(
  (SELECT count(*)::int FROM public.community_clubs_feed('discover', 'activity', NULL, NULL, NULL, NULL, 30)),
  2,
  '13. Clubs discover : le club secret est exclu pour un non-membre'
);
SELECT is(
  (SELECT my_status FROM public.community_clubs_feed('discover', 'activity', NULL, NULL, NULL, NULL, 30)
    WHERE id = 'fea30000-0000-4000-8000-000000000001'),
  'member',
  '14. Clubs : my_status = member pour une adhérente'
);
SELECT is(
  (SELECT my_status FROM public.community_clubs_feed('discover', 'activity', NULL, NULL, NULL, NULL, 30)
    WHERE id = 'fea30000-0000-4000-8000-000000000002'),
  'pending',
  '15. Clubs : my_status = pending quand une demande est en attente'
);
SELECT is(
  (SELECT (friends ->> 'total')::int FROM public.community_clubs_feed('discover', 'activity', NULL, NULL, NULL, NULL, 30)
    WHERE id = 'fea30000-0000-4000-8000-000000000001'),
  1,
  '16. Clubs : amis membres = adhérents suivis'
);
SELECT is(
  (SELECT id FROM public.community_clubs_feed('discover', 'activity', NULL, NULL, NULL, NULL, 1)),
  'fea30000-0000-4000-8000-000000000001'::uuid,
  '17. Clubs : tri activité place le club avec le post le plus récent en tête'
);
SELECT is(
  (SELECT events_this_month FROM public.community_clubs_feed('discover', 'activity', NULL, NULL, NULL, NULL, 30)
    WHERE id = 'fea30000-0000-4000-8000-000000000001'),
  CASE
    WHEN now() + interval '2 days' < date_trunc('month', now()) + interval '1 month' THEN 1
    ELSE 0
  END,
  '18. Clubs : events_this_month compte la sortie du mois courant'
);

-- Sorties.
SELECT is(
  (SELECT count(*)::int FROM public.community_events_feed('discover', NULL, NULL, NULL, NULL, 30)),
  2,
  '19. Sorties discover : seules les sorties à venir non annulées'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_events_feed('mine', NULL, NULL, NULL, NULL, 30)),
  1,
  '20. Sorties mine : une inscription confirmée'
);
SELECT is(
  (SELECT my_status FROM public.community_events_feed('mine', NULL, NULL, NULL, NULL, 30)
    WHERE id = 'fea40000-0000-4000-8000-000000000001'),
  'registered',
  '21. Sorties : my_status = registered'
);
SELECT is(
  (SELECT spots_left FROM public.community_events_feed('discover', NULL, NULL, NULL, NULL, 30)
    WHERE id = 'fea40000-0000-4000-8000-000000000001'),
  1,
  '22. Sorties : places restantes = capacité − confirmés'
);
SELECT is(
  (SELECT (friends ->> 'total')::int FROM public.community_events_feed('discover', NULL, NULL, NULL, NULL, 30)
    WHERE id = 'fea40000-0000-4000-8000-000000000001'),
  1,
  '23. Sorties : amis inscrits (confirmés suivis)'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_events_feed('near', NULL, 45.9237, 6.8694, NULL, 30)),
  1,
  '24. Sorties near : seule la sortie géolocalisée à ≤ 100 km'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_events_agenda(CURRENT_DATE, 3)),
  3,
  '25. Agenda : une ligne par jour, jours vides compris'
);
SELECT is(
  (SELECT events_count FROM public.community_events_agenda(CURRENT_DATE, 3)
    WHERE day = (SELECT coalesce(starts_at, event_date::timestamptz)::date
                   FROM public.events WHERE id = 'fea40000-0000-4000-8000-000000000001')),
  1,
  '26. Agenda : la sortie est comptée le bon jour'
);

-- Mine / suivi pour A.
SET LOCAL "request.jwt.claim.sub" = 'fea10000-0000-4000-8000-000000000001';
SELECT is(
  (SELECT count(*)::int FROM public.community_carnets_feed('mine', 'recent', NULL, NULL, NULL, 30)),
  6,
  '27. Carnets mine : l''auteur voit aussi son carnet privé'
);
SET LOCAL "request.jwt.claim.sub" = 'fea10000-0000-4000-8000-000000000002';
SELECT is(
  (SELECT count(*)::int FROM public.community_carnets_feed('followed', 'recent', NULL, NULL, NULL, 30)),
  5,
  '28. Carnets suivis : les carnets publics des auteurs suivis'
);

-- C (liste d'attente).
SET LOCAL "request.jwt.claim.sub" = 'fea10000-0000-4000-8000-000000000003';
SELECT is(
  (SELECT my_status FROM public.community_events_feed('mine', NULL, NULL, NULL, NULL, 30)
    WHERE id = 'fea40000-0000-4000-8000-000000000001'),
  'waitlist',
  '29. Sorties : my_status = waitlist pour un inscrit en attente'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Invité : lecture sous RLS, écriture refusée.
-- ═══════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';

SELECT is(
  (SELECT count(*)::int FROM public.community_carnets_feed('discover', 'recent', NULL, NULL, NULL, 30)),
  5,
  '30. Invité : les carnets publics sont lisibles'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_clubs_feed('discover', 'activity', NULL, NULL, NULL, NULL, 30)),
  2,
  '31. Invité : le club secret reste invisible'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_events_feed('discover', NULL, NULL, NULL, NULL, 30)),
  2,
  '32. Invité : les sorties publiques sont lisibles'
);
SELECT throws_ok(
  $$ INSERT INTO public.carnets (author_id, title, destination)
     VALUES ('fea10000-0000-4000-8000-000000000001', 'Écriture invitée', 'Ailleurs') $$,
  '42501',
  NULL,
  '33. Invité : aucune écriture possible'
);
SELECT is(
  (SELECT count(*)::int
     FROM public.community_carnets_feed('discover', 'recent', NULL, NULL, NULL, 100)),
  5,
  '34. p_limit = 100 reste borné et stable'
);

SELECT * FROM finish();
ROLLBACK;
