BEGIN;
SELECT plan(25);

-- ═══════════════════════════════════════════════════════════════════════════
-- Communauté v2 — lot A : recherche tolérante (20261108130001)
-- Recherche#9 + Recherche#4. Couvre : normalisation/accents/ponctuation,
-- échappement de la saisie (% _ \ littéraux), RLS (carnet privé, club secret,
-- post d'audience restreinte), portée, filtres near, tendances, refus d'écriture
-- pour anon.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('5ea10000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'search_a@test.local', 'x', '{}', '{}', now(), now()),
  ('5ea10000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'search_b@test.local', 'x', '{}', '{}', now(), now()),
  ('5ea10000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'search_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

-- handle/visibilité/is_demo explicites : la branche « membres » lit la vue
-- public_profiles (filtrée sur profile_visibility='public' et is_demo=false).
INSERT INTO public.user_profiles (id, full_name, email, handle, profile_visibility, is_demo) VALUES
  ('5ea10000-0000-4000-8000-000000000001', 'Alice Chamonix', 'search_a@test.local', 'search_fixture_a', 'public', false),
  ('5ea10000-0000-4000-8000-000000000002', 'Bruno Chamonix', 'search_b@test.local', 'search_fixture_b', 'public', false),
  ('5ea10000-0000-4000-8000-000000000003', 'Chloé Chamonix', 'search_c@test.local', 'search_fixture_c', 'public', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carnets (id, author_id, title, destination, visibility, start_geom) VALUES
  ('5ea20000-0000-4000-8000-000000000001', '5ea10000-0000-4000-8000-000000000001',
   'Chamonix', 'Chamonix, France', 'public',
   st_setsrid(st_makepoint(6.8694, 45.9237), 4326)::geography),
  ('5ea20000-0000-4000-8000-000000000002', '5ea10000-0000-4000-8000-000000000001',
   'Chamonix secret', 'Chamonix, France', 'private', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, slug, name, privacy, created_by, zone_geom) VALUES
  ('5ea30000-0000-4000-8000-000000000001', 'club-chamonix-ouvert', 'Chamonix Rando', 'open',
   '5ea10000-0000-4000-8000-000000000001',
   st_setsrid(st_makepoint(6.8694, 45.9237), 4326)::geography),
  ('5ea30000-0000-4000-8000-000000000002', 'club-chamonix-secret', 'Chamonix Secret', 'secret',
   '5ea10000-0000-4000-8000-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;

-- Le créateur est admin actif de son club secret (RLS : visible par ses membres).
INSERT INTO public.club_members (club_id, user_id, role, status) VALUES
  ('5ea30000-0000-4000-8000-000000000002', '5ea10000-0000-4000-8000-000000000001', 'admin', 'active')
ON CONFLICT (club_id, user_id) DO NOTHING;

INSERT INTO public.events (id, title, event_date, organizer_id, status, location) VALUES
  ('5ea40000-0000-4000-8000-000000000001', 'Traversée Chamonix', CURRENT_DATE + 7,
   '5ea10000-0000-4000-8000-000000000001', 'upcoming', 'Chamonix')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.community_posts (id, author_id, content, audience, post_type) VALUES
  ('5ea50000-0000-4000-8000-000000000001', '5ea10000-0000-4000-8000-000000000001',
   'Randonnée à Chamonix', 'public', 'post'),
  ('5ea50000-0000-4000-8000-000000000002', '5ea10000-0000-4000-8000-000000000001',
   'Chamonix entre abonnés', 'abonnies', 'post')
ON CONFLICT (id) DO NOTHING;

-- C (5ea1…3) suit A (5ea1…1) : seule elle voit le post « abonnies ».
INSERT INTO public.user_follows (follower_id, following_id)
VALUES ('5ea10000-0000-4000-8000-000000000003', '5ea10000-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;

-- Diagnostic d'environnement CI (n'affecte pas le plan pgTAP).
SELECT diag('UP=' || (SELECT count(*)::text FROM public.user_profiles)
  || ' public=' || (SELECT count(*)::text FROM public.user_profiles WHERE profile_visibility = 'public')
  || ' demo_false=' || (SELECT count(*)::text FROM public.user_profiles WHERE is_demo = false)
  || ' view=' || (SELECT count(*)::text FROM public.public_profiles));

-- ── Invité (anon) ──────────────────────────────────────────────────────────
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';

SELECT diag('anon view=' || (SELECT count(*)::text FROM public.public_profiles)
  || ' norms=' || coalesce((SELECT string_agg(public.lkdv_norm(full_name), '|') FROM public.public_profiles), 'EMPTY')
  || ' direct=' || (SELECT count(*)::text FROM public.public_profiles pp
                     WHERE public.lkdv_norm(coalesce(pp.full_name, '')) like '%chamonix%')
  || ' kinds=' || coalesce((SELECT string_agg(kind || ':' || cnt::text, ',')
                              FROM (SELECT kind, count(*) AS cnt FROM public.community_search('chamonix') GROUP BY kind) k), 'EMPTY'));
SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix', 'membres')),
  3,
  '1b. Recherche scope membres : les trois profils publics sont trouvés'
);

SELECT is(
  (SELECT public.lkdv_norm('  Chamonix,  FRANCE ! ')),
  'chamonix france',
  '1. lkdv_norm : minuscules, accents et ponctuation normalisés'
);

SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix') WHERE kind = 'carnet'),
  1,
  '2. Recherche : le carnet public est trouvé'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix') WHERE kind = 'club'),
  1,
  '3. Recherche : le club ouvert est trouvé'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix') WHERE kind = 'sortie'),
  1,
  '4. Recherche : la sortie est trouvée'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix') WHERE kind = 'post'),
  1,
  '5. Recherche : seul le post public est trouvé (audience abonnés masquée)'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix') WHERE kind = 'membre'),
  3,
  '6. Recherche : les trois membres publics sont trouvés'
);

SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix,') WHERE kind = 'carnet'),
  1,
  '7. Recherche : « chamonix, » (ponctuation) trouve le même carnet'
);

SELECT is(
  (SELECT count(*)::int FROM public.community_search('%')),
  0,
  '8. Recherche : « % » seul ne renvoie rien (joker échappé, requête trop courte)'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix%')),
  (SELECT count(*)::int FROM public.community_search('chamonix')),
  '9. Recherche : « chamonix% » n''élargit pas les résultats (le % est littéral)'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix_')),
  (SELECT count(*)::int FROM public.community_search('chamonix')),
  '10. Recherche : « chamonix_ » n''élargit pas les résultats (le _ est littéral)'
);

SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix')
    WHERE kind = 'carnet' AND id = '5ea20000-0000-4000-8000-000000000002'),
  0,
  '11. Recherche : un carnet privé d''autrui n''est jamais renvoyé'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix')
    WHERE kind = 'club' AND id = '5ea30000-0000-4000-8000-000000000002'),
  0,
  '12. Recherche : un club secret n''est jamais renvoyé à un non-membre'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix')
    WHERE kind = 'post' AND id = '5ea50000-0000-4000-8000-000000000002'),
  0,
  '13. Recherche : un post d''audience restreinte n''est pas renvoyé à un invité'
);

SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix', 'clubs') WHERE kind <> 'club'),
  0,
  '14. Recherche : p_scope = clubs ne renvoie que des clubs'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_search('c')),
  0,
  '15. Recherche : moins de deux caractères → résultat vide'
);

SELECT is(
  (SELECT round(distance_km::numeric, 1)
     FROM public.community_search('chamonix', 'carnets', 5, 0, 45.9237, 6.8694, '{"near":true,"max_km":50}')
    LIMIT 1),
  0.0,
  '16. Recherche : distance PostGIS calculée quand lat/lng sont fournis'
);
SELECT is(
  (SELECT count(*)::int
     FROM public.community_search('chamonix', 'sorties', 5, 0, 45.9237, 6.8694, '{"near":true}')),
  0,
  '17. Recherche : le filtre near exclut un objet sans géométrie'
);

SELECT ok(
  (SELECT count(*) FROM public.community_search_trending(10) WHERE label ILIKE '%chamonix%') >= 1,
  '18. Tendances : un lieu des 7 derniers jours est proposé'
);

SELECT throws_ok(
  $$ INSERT INTO public.community_posts (author_id, content)
     VALUES ('5ea10000-0000-4000-8000-000000000001', 'Écriture invitée') $$,
  '42501',
  NULL,
  '19. Un invité ne peut pas écrire (RLS)'
);

-- ── Membre non abonné (B) ─────────────────────────────────────────────────
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '5ea10000-0000-4000-8000-000000000002';

SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix')
    WHERE kind = 'post' AND id = '5ea50000-0000-4000-8000-000000000002'),
  0,
  '20. Recherche : un non-abonné ne voit pas le post « abonnés »'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix secret') WHERE kind = 'carnet'),
  0,
  '21. Recherche : un tiers ne voit pas le carnet privé'
);

-- ── Abonnée (C) ───────────────────────────────────────────────────────────
SET LOCAL "request.jwt.claim.sub" = '5ea10000-0000-4000-8000-000000000003';

SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix')
    WHERE kind = 'post' AND id = '5ea50000-0000-4000-8000-000000000002'),
  1,
  '22. Recherche : une abonnée voit le post « abonnés »'
);

-- ── Auteur (A) ────────────────────────────────────────────────────────────
SET LOCAL "request.jwt.claim.sub" = '5ea10000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix secret') WHERE kind = 'carnet'),
  1,
  '23. Recherche : l''auteur retrouve son propre carnet privé'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_search('chamonix secret') WHERE kind = 'club'),
  1,
  '24. Recherche : le créateur retrouve son club secret (membre actif)'
);

SELECT * FROM finish();
ROLLBACK;
