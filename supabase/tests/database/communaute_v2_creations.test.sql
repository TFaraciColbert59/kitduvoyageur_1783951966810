BEGIN;
SELECT plan(45);

-- ═══════════════════════════════════════════════════════════════════════════
-- Communauté v2 — lot E : créations atomiques (20261108130005)
-- Club + admin, sortie + organisateur + post d'annonce, kit + items + poids SQL,
-- carnet + moments/médias/collaborateurs/nuits + post si public, publication
-- avec lieu/tags/creation_meta. Vérifie l'atomicité (échec → aucune ligne),
-- l'idempotence client_request_id et les erreurs JSON validation_failed.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('c7e10000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'create_a@test.local', 'x', '{}', '{}', now(), now()),
  ('c7e10000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'create_b@test.local', 'x', '{}', '{}', now(), now()),
  ('c7e10000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'create_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('c7e10000-0000-4000-8000-000000000001', 'Paul Créateur', 'create_a@test.local'),
  ('c7e10000-0000-4000-8000-000000000002', 'Rose Autre', 'create_b@test.local'),
  ('c7e10000-0000-4000-8000-000000000003', 'Sacha Collaborateur', 'create_c@test.local')
ON CONFLICT (id) DO NOTHING;

-- Club d'autrui : sert aux refus d'audience/rattachement.
INSERT INTO public.clubs (id, slug, name, privacy, created_by)
VALUES ('c7e20000-0000-4000-8000-000000000001', 'club-v2-autre', 'Club d''autrui', 'open', 'c7e10000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c7e10000-0000-4000-8000-000000000001';

-- ── 1-11 : create_club_with_admin ─────────────────────────────────────────
SELECT is(
  (SELECT public.check_club_slug('club-v2-creation')),
  true,
  '1. check_club_slug : slug libre'
);
SELECT is(
  (SELECT public.create_club_with_admin($j${
    "name": "Club v2 Création", "slug": "club-v2-creation", "privacy": "open",
    "description": "Un club de test", "rules": "Respect", "activities": ["rando"],
    "join_questions": ["Pourquoi ?"], "welcome_post": true,
    "welcome_post_content": "Bienvenue !", "client_request_id": "creation-club-1"
  }$j$::jsonb) ->> 'slug'),
  'club-v2-creation',
  '2. create_club_with_admin : club créé avec le slug demandé'
);
RESET ROLE;
SELECT is(
  (SELECT created_by FROM public.clubs WHERE slug = 'club-v2-creation'),
  'c7e10000-0000-4000-8000-000000000001'::uuid,
  '3. create_club_with_admin : créateur = appelant'
);
SELECT is(
  (SELECT count(*)::int FROM public.club_members cm
     JOIN public.clubs c ON c.id = cm.club_id
    WHERE c.slug = 'club-v2-creation'
      AND cm.user_id = 'c7e10000-0000-4000-8000-000000000001'
      AND cm.role = 'admin' AND cm.status = 'active'),
  1,
  '4. create_club_with_admin : admin actif créé dans la même transaction'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_posts p
     JOIN public.clubs c ON c.id = p.club_id
    WHERE c.slug = 'club-v2-creation' AND p.audience = 'club'),
  1,
  '5. create_club_with_admin : post de bienvenue (club ouvert)'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c7e10000-0000-4000-8000-000000000001';
SELECT is(
  (SELECT public.check_club_slug('club-v2-creation')),
  false,
  '6. check_club_slug : slug désormais pris'
);
SELECT is(
  (SELECT public.create_club_with_admin($j${
    "name": "Club v2 Création", "slug": "club-v2-creation", "privacy": "open",
    "client_request_id": "creation-club-1"
  }$j$::jsonb) ->> 'idempotent'),
  'true',
  '7. create_club_with_admin : même client_request_id → idempotent'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.clubs WHERE slug = 'club-v2-creation'),
  1,
  '8. create_club_with_admin : aucun doublon de club'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c7e10000-0000-4000-8000-000000000001';
SELECT throws_ok(
  $$ SELECT public.create_club_with_admin('{"name":"Autre club","slug":"club-v2-creation"}'::jsonb) $$,
  'P0001',
  NULL,
  '9. create_club_with_admin : slug pris → slug_taken'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.clubs),
  2,
10. create_club_with_admin : l''échec slug_taken n''a rien créé'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c7e10000-0000-4000-8000-000000000001';
SELECT throws_ok(
  $$ SELECT public.create_club_with_admin('{"name":"   "}'::jsonb) $$,
  'P0001',
  NULL,
11. create_club_with_admin : nom vide → validation_failed'
);
SELECT is(
  (SELECT public.create_club_with_admin($j${
    "name": "Club fermé v2", "slug": "club-v2-ferme", "privacy": "closed",
    "welcome_post": true, "client_request_id": "creation-club-2"
  }$j$::jsonb) ->> 'post_id') IS NULL,
  true,
12. create_club_with_admin : aucun post de bienvenue pour un club sur validation'
);

-- ── 13-19 : create_event_with_post ────────────────────────────────────────
SELECT is(
  (SELECT public.create_event_with_post($j${
    "title": "Sortie v2 création",
    "starts_at": "2027-06-12T09:00:00+02:00",
    "activity": "rando", "level": "facile", "distance_km": 12,
    "elevation_gain_m": 700, "max_participants": 2, "waitlist_enabled": true,
    "location": "Chamonix", "meeting_point": "Parking",
    "announce": true, "announce_content": "Annonce de la sortie",
    "client_request_id": "creation-event-1"
  }$j$::jsonb) ->> 'post_id') IS NOT NULL,
  true,
13. create_event_with_post : sortie + post d''annonce'
);
RESET ROLE;
SELECT is(
  (SELECT organizer_id FROM public.events WHERE title = 'Sortie v2 création'),
  'c7e10000-0000-4000-8000-000000000001'::uuid,
14. create_event_with_post : organisateur = appelant'
);
SELECT is(
  (SELECT event_date FROM public.events WHERE title = 'Sortie v2 création'),
  '2027-06-12'::date,
15. create_event_with_post : event_date dérivée de starts_at'
);
SELECT is(
  (SELECT count(*)::int FROM public.event_participants ep
     JOIN public.events e ON e.id = ep.event_id
    WHERE e.title = 'Sortie v2 création' AND ep.status = 'confirmed'),
  1,
16. create_event_with_post : organisateur inscrit confirmé'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_posts
    WHERE creation_meta ->> 'event_id' = (SELECT id::text FROM public.events WHERE title = 'Sortie v2 création')),
  1,
17. create_event_with_post : le post d''annonce pointe la sortie'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c7e10000-0000-4000-8000-000000000001';
SELECT is(
  (SELECT public.create_event_with_post($j${
    "title": "Sortie v2 création", "starts_at": "2027-06-12T09:00:00+02:00",
    "client_request_id": "creation-event-1"
  }$j$::jsonb) ->> 'idempotent'),
  'true',
18. create_event_with_post : idempotent (même client_request_id)'
);
SELECT is(
  (SELECT public.create_event_with_post($j${
    "title": "Sortie sans annonce", "starts_at": "2027-07-01T08:00:00+02:00",
    "announce": false, "client_request_id": "creation-event-2"
  }$j$::jsonb) ->> 'post_id') IS NULL,
  true,
19. create_event_with_post : announce=false → aucun post'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.events WHERE title = 'Sortie v2 création'),
  1,
20. create_event_with_post : aucun doublon de sortie'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c7e10000-0000-4000-8000-000000000001';
SELECT throws_ok(
  $$ SELECT public.create_event_with_post($j${
       "title": "Sortie club interdit",
       "starts_at": "2027-08-01T08:00:00+02:00",
       "club_id": "c7e20000-0000-4000-8000-000000000001"
     }$j$::jsonb) $$,
  'P0001',
  NULL,
21. create_event_with_post : club sans adhésion → club_not_member'
);
SELECT throws_ok(
  $$ SELECT public.create_event_with_post($j${
       "title": "Sortie niveau invalide", "starts_at": "2027-08-01T08:00:00+02:00",
       "level": "expert"
     }$j$::jsonb) $$,
  'P0001',
  NULL,
22. create_event_with_post : niveau hors énumération → validation_failed'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.events
    WHERE title IN ('Sortie club interdit', 'Sortie niveau invalide')),
  0,
23. create_event_with_post : échec de validation → aucune sortie'
);

-- ── 24-27 : create_kit_with_items ─────────────────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c7e10000-0000-4000-8000-000000000001';
SELECT is(
  (SELECT public.create_kit_with_items($j${
    "name": "Kit v2", "description": "Kit de test", "season": "ete", "is_public": true,
    "tags": ["rando"],
    "items": [
      {"name": "Sac", "weight_g": 500, "quantity": 1},
      {"name": "Piolet", "weight_g": 100, "quantity": 2}
    ],
    "share_content": "Mon kit de test",
    "client_request_id": "creation-kit-1"
  }$j$::jsonb) ->> 'total_weight_g'),
  '700',
24. create_kit_with_items : poids total calculé en SQL (500 + 2×100)'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.materiel_kit_items i
     JOIN public.materiel_kits k ON k.id = i.kit_id
    WHERE k.name = 'Kit v2'),
  2,
25. create_kit_with_items : deux articles créés'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_posts
    WHERE linked_kit_id = (SELECT id FROM public.materiel_kits WHERE name = 'Kit v2')),
  1,
26. create_kit_with_items : kit public → un post pont'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c7e10000-0000-4000-8000-000000000001';
SELECT throws_ok(
  $$ SELECT public.create_kit_with_items($j${
       "name": "Kit invalide",
       "items": [{"weight_g": 10}]
     }$j$::jsonb) $$,
  'P0001',
  NULL,
27. create_kit_with_items : article sans nom → validation_failed'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.materiel_kits WHERE name = 'Kit invalide'),
  0,
28. create_kit_with_items : échec → aucun kit partiel'
);

-- ── 29-35 : create_carnet_v2 ──────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c7e10000-0000-4000-8000-000000000001';
SELECT is(
  (SELECT (public.create_carnet_v2($j${
    "title": "Carnet v2 privé", "destination": "Chamonix", "visibility": "private",
    "start_lat": 45.9237, "start_lng": 6.8694,
    "moments": [
      {"jour_numero": 1, "citation": "Départ", "lieu": "Chamonix"},
      {"jour_numero": 2, "citation": "Sommet", "lieu": "Aiguille"}
    ],
    "media": [
      {"url": "https://cdn.test/1.jpg", "type": "image", "position": 1},
      {"url": "https://cdn.test/2.jpg", "type": "image", "position": 2}
    ],
    "collaborators": ["c7e10000-0000-4000-8000-000000000003"],
    "nights": [
      {"jour_numero": 1, "nom": "Refuge du Goûter", "type": "refuge", "lat": 45.85, "lng": 6.83},
      {"jour_numero": 2, "nom": "Bivouac", "type": "bivouac"}
    ],
    "client_request_id": "creation-carnet-1"
  }$j$::jsonb) ->> 'moments_count')::int,
  2,
29. create_carnet_v2 : moments écrits'
);
SELECT is(
  (SELECT (public.create_carnet_v2($j${
    "title": "Carnet v2 privé", "destination": "Chamonix", "visibility": "private",
    "media": [{"url": "https://cdn.test/3.jpg"}],
    "collaborators": ["c7e10000-0000-4000-8000-000000000003"],
    "client_request_id": "creation-carnet-2"
  }$j$::jsonb) ->> 'media_count')::int,
  1,
30. create_carnet_v2 : médias écrits'
);
SELECT is(
  (SELECT count(*)::int FROM public.carnet_collaborators
    WHERE user_id = 'c7e10000-0000-4000-8000-000000000003'
      AND carnet_id IN (SELECT id FROM public.carnets WHERE title = 'Carnet v2 privé')),
  2,
31. create_carnet_v2 : collaborateur invité (un par carnet)'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.community_posts
    WHERE (creation_meta ->> 'carnet_id') IN (SELECT id::text FROM public.carnets WHERE title = 'Carnet v2 privé')),
  0,
32. create_carnet_v2 : un carnet privé ne crée aucun post'
);
SELECT is(
  (SELECT count(*)::int FROM public.carnets
    WHERE title = 'Carnet v2 privé' AND start_geom IS NOT NULL),
  1,
33. create_carnet_v2 : start_geom renseignée'
);
SELECT ok(
  (SELECT count(*)::int FROM public.carnet_moments
    WHERE carnet_id IN (SELECT id FROM public.carnets WHERE title = 'Carnet v2 privé')) = 2,
34. create_carnet_v2 : deux moments en base'
);
SELECT is(
  (SELECT count(*)::int FROM public.carnets WHERE client_request_id = 'creation-carnet-1'),
  1,
35. create_carnet_v2 : idempotence (un seul carnet pour le même client_request_id)'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c7e10000-0000-4000-8000-000000000001';
SELECT is(
  (SELECT (public.create_carnet_v2($j${
    "title": "Carnet v2 public", "destination": "Annecy", "visibility": "public",
    "media": [{"url": "https://cdn.test/4.jpg"}],
    "post": {"enabled": true, "content": "Mon carnet public"},
    "client_request_id": "creation-carnet-3"
  }$j$::jsonb) ->> 'post_id') IS NOT NULL,
  true,
36. create_carnet_v2 : carnet public → post pont'
);
-- ── 37-45 : create_community_post ─────────────────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c7e10000-0000-4000-8000-000000000001';
SELECT is(
  (SELECT public.create_community_post($j${
    "content": "Publication v2 avec lieu",
    "post_type": "post", "audience": "public",
    "place_label": "Chamonix", "place_lat": 45.9237, "place_lng": 6.8694,
    "tags": ["rando", "chamonix"],
    "creation_meta": {"media_alts": ["Vue du sommet"]},
    "media_urls": ["https://cdn.test/post.jpg"],
    "client_request_id": "11111111-2222-3333-4444-555555555555"
  }$j$::jsonb) ->> 'audience'),
  'public',
37. create_community_post : publication créée'
);
RESET ROLE;
SELECT is(
  (SELECT place_label FROM public.community_posts
    WHERE client_request_id = '11111111-2222-3333-4444-555555555555'),
  'Chamonix',
38. create_community_post : lieu stocké en colonne'
);
SELECT is(
  (SELECT tags FROM public.community_posts
    WHERE client_request_id = '11111111-2222-3333-4444-555555555555'),
  '{rando,chamonix}'::text[],
39. create_community_post : tags stockés'
);
SELECT is(
  (SELECT creation_meta FROM public.community_posts
    WHERE client_request_id = '11111111-2222-3333-4444-555555555555'),
  '{"media_alts": ["Vue du sommet"]}'::jsonb,
40. create_community_post : creation_meta conservé'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c7e10000-0000-4000-8000-000000000001';
SELECT is(
  (SELECT public.create_community_post($j${
    "content": "Publication v2 avec lieu",
    "audience": "public",
    "client_request_id": "11111111-2222-3333-4444-555555555555"
  }$j$::jsonb) ->> 'idempotent'),
  'true',
41. create_community_post : idempotent (même uuid)'
);
SELECT throws_ok(
  $$ SELECT public.create_community_post($j${
       "content": "Audience restreinte avec média", "audience": "abonnies",
       "media_urls": ["https://cdn.test/x.jpg"]
     }$j$::jsonb) $$,
  'P0001',
  NULL,
42. create_community_post : audience restreinte + média → validation_failed'
);
SELECT throws_ok(
  $$ SELECT public.create_community_post($j${
       "content": "Club sans adhésion", "audience": "club",
       "club_id": "c7e20000-0000-4000-8000-000000000001"
     }$j$::jsonb) $$,
  'P0001',
  NULL,
43. create_community_post : audience club sans adhésion → club_not_member'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.community_posts
    WHERE client_request_id = '11111111-2222-3333-4444-555555555555'),
  1,
44. create_community_post : aucun doublon de publication'
);

-- ── 46 : invité refusé sur une écriture atomique ─────────────────────────
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SELECT throws_ok(
  $$ SELECT public.create_community_post('{"content":"écriture invitée"}'::jsonb) $$,
  '42501',
  NULL,
45. create_community_post : invité refusé'
);

SELECT * FROM finish();
ROLLBACK;
