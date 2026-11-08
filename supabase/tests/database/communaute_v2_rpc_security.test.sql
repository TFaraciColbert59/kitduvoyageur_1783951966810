BEGIN;
SELECT plan(27);

-- ═══════════════════════════════════════════════════════════════════════════
-- Communauté v2 — sécurité des RPC (03 § 8.9)
-- 1) toutes les RPC d'écriture `security definer` refusent l'invité (42501) ;
-- 2) impossible d'écrire au nom d'un autre (l'auteur/organisateur/créateur est
--    toujours auth.uid(), quel que soit le payload) ;
-- 3) impossible d'adhérer ou de modérer à la place d'un autre ;
-- 4) les helpers internes (lkdv_*) ne sont pas exécutables par le client ;
-- 5) les RPC de lecture sont lisibles par anon (RLS) et n'écrivent rien ;
-- 6) anon ne peut pas écrire en direct.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('5ec10000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'sec_a@test.local', 'x', '{}', '{}', now(), now()),
  ('5ec10000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'sec_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('5ec10000-0000-4000-8000-000000000001', 'Victor A', 'sec_a@test.local'),
  ('5ec10000-0000-4000-8000-000000000002', 'Wanda B', 'sec_b@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, slug, name, privacy, created_by) VALUES
  ('5ec20000-0000-4000-8000-000000000001', 'sec-club-ouvert', 'Sec Club ouvert', 'open', '5ec10000-0000-4000-8000-000000000001'),
  ('5ec20000-0000-4000-8000-000000000002', 'sec-club-ferme', 'Sec Club fermé', 'closed', '5ec10000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_members (club_id, user_id, role, status)
VALUES ('5ec20000-0000-4000-8000-000000000001', '5ec10000-0000-4000-8000-000000000001', 'admin', 'active')
ON CONFLICT (club_id, user_id) DO NOTHING;

INSERT INTO public.club_join_requests (club_id, user_id, status)
VALUES ('5ec20000-0000-4000-8000-000000000002', '5ec10000-0000-4000-8000-000000000002', 'pending')
ON CONFLICT (club_id, user_id) DO NOTHING;

INSERT INTO public.carnets (id, author_id, title, destination, visibility)
VALUES ('5ec30000-0000-4000-8000-000000000001', '5ec10000-0000-4000-8000-000000000001', 'Chamonix sécurité', 'Chamonix', 'public')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, title, event_date, starts_at, organizer_id, status)
VALUES ('5ec40000-0000-4000-8000-000000000001', 'Sortie sécurité', CURRENT_DATE + 3, now() + interval '3 days',
        '5ec10000-0000-4000-8000-000000000001', 'upcoming')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Invité (anon) : toutes les RPC d'écriture refusent.
-- ═══════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';

SELECT throws_ok($$ SELECT public.join_club('5ec20000-0000-4000-8000-000000000001') $$, '42501', NULL, '1. join_club : invité refusé');
SELECT throws_ok($$ SELECT public.leave_club('5ec20000-0000-4000-8000-000000000001') $$, '42501', NULL, '2. leave_club : invité refusé');
SELECT throws_ok($$ SELECT public.cancel_join_request('5ec20000-0000-4000-8000-000000000002') $$, '42501', NULL, '3. cancel_join_request : invité refusé');
SELECT throws_ok($$ SELECT public.review_join_request('00000000-0000-4000-8000-000000000000', true) $$, '42501', NULL, '4. review_join_request : invité refusé');
SELECT throws_ok($$ SELECT public.create_club_with_admin('{"name":"Club invité"}'::jsonb) $$, '42501', NULL, '5. create_club_with_admin : invité refusé');
SELECT throws_ok($$ SELECT public.create_event_with_post('{"title":"Sortie invitée","starts_at":"2027-01-01T10:00:00+01:00"}'::jsonb) $$, '42501', NULL, '6. create_event_with_post : invité refusé');
SELECT throws_ok($$ SELECT public.create_kit_with_items('{"name":"Kit invité"}'::jsonb) $$, '42501', NULL, '7. create_kit_with_items : invité refusé');
SELECT throws_ok($$ SELECT public.create_carnet_v2('{"title":"Carnet invité","destination":"Ailleurs"}'::jsonb) $$, '42501', NULL, '8. create_carnet_v2 : invité refusé');
SELECT throws_ok($$ SELECT public.create_community_post('{"content":"Post invité"}'::jsonb) $$, '42501', NULL, '9. create_community_post : invité refusé');
SELECT throws_ok($$ SELECT public.join_event('5ec40000-0000-4000-8000-000000000001') $$, '42501', NULL, '10. join_event : invité refusé');
SELECT throws_ok($$ SELECT public.leave_event('5ec40000-0000-4000-8000-000000000001') $$, '42501', NULL, '11. leave_event : invité refusé');

-- ── 5. RPC de lecture : anon lit (RLS), n'écrit rien ─────────────────────
SELECT ok(
  (SELECT count(*)::int FROM public.community_search('chamonix')) >= 1,
  '12. Invité : community_search lit les objets publics'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_carnets_feed('discover', 'recent', NULL, NULL, NULL, 30)),
  1,
  '13. Invité : community_carnets_feed lit le carnet public'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_events_agenda(CURRENT_DATE, 3)),
  3,
  '14. Invité : community_events_agenda répond'
);
SELECT is(
  (SELECT public.check_club_slug('sec-slug-libre')),
  true,
  '15. Invité : check_club_slug est exécutable'
);

SELECT throws_ok(
  $$ INSERT INTO public.community_posts (author_id, content)
     VALUES ('5ec10000-0000-4000-8000-000000000001', 'Post invité') $$,
  '42501',
  NULL,
  '16. Invité : écriture directe refusée (posts)'
);
SELECT throws_ok(
  $$ INSERT INTO public.clubs (slug, name, created_by)
     VALUES ('sec-club-invite', 'Club invité', '5ec10000-0000-4000-8000-000000000001') $$,
  '42501',
  NULL,
  '17. Invité : écriture directe refusée (clubs)'
);

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.community_posts),
  0,
  '18. Les RPC de lecture et les tentatives refusées n''ont rien écrit'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Impossible d'écrire au nom d'un autre : l'auteur est toujours l'appelant.
-- ═══════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '5ec10000-0000-4000-8000-000000000002';

SELECT public.create_club_with_admin('{"name":"Club par Wanda","slug":"sec-club-wanda"}'::jsonb);
SELECT public.create_community_post('{"content":"Post de Wanda"}'::jsonb);
SELECT public.create_kit_with_items('{"name":"Kit de Wanda"}'::jsonb);
SELECT public.create_event_with_post('{"title":"Sortie de Wanda","starts_at":"2027-02-01T09:00:00+01:00","announce":false}'::jsonb);
SELECT public.create_carnet_v2('{"title":"Carnet de Wanda","destination":"Ailleurs","visibility":"private"}'::jsonb);

RESET ROLE;
SELECT is(
  (SELECT created_by FROM public.clubs WHERE slug = 'sec-club-wanda'),
  '5ec10000-0000-4000-8000-000000000002'::uuid,
  '19. create_club_with_admin : créateur = appelant, jamais un autre'
);
SELECT is(
  (SELECT author_id FROM public.community_posts WHERE content = 'Post de Wanda'),
  '5ec10000-0000-4000-8000-000000000002'::uuid,
  '20. create_community_post : auteur = appelant'
);
SELECT is(
  (SELECT user_id FROM public.materiel_kits WHERE name = 'Kit de Wanda'),
  '5ec10000-0000-4000-8000-000000000002'::uuid,
  '21. create_kit_with_items : propriétaire = appelant'
);
SELECT is(
  (SELECT organizer_id FROM public.events WHERE title = 'Sortie de Wanda'),
  '5ec10000-0000-4000-8000-000000000002'::uuid,
  '22. create_event_with_post : organisateur = appelant'
);
SELECT is(
  (SELECT author_id FROM public.carnets WHERE title = 'Carnet de Wanda'),
  '5ec10000-0000-4000-8000-000000000002'::uuid,
  '23. create_carnet_v2 : auteur = appelant'
);

-- Adhésion : join_club n'ajoute que l'appelant.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '5ec10000-0000-4000-8000-000000000002';
SELECT public.join_club('5ec20000-0000-4000-8000-000000000001');
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.club_members
    WHERE club_id = '5ec20000-0000-4000-8000-000000000001'
      AND user_id = '5ec10000-0000-4000-8000-000000000002'
      AND status = 'active'),
  1,
  '24. join_club : une adhésion, au nom de l''appelant uniquement'
);

-- Modération : impossible de traiter une demande d'un club dont on n'est pas admin.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '5ec10000-0000-4000-8000-000000000002';
SELECT throws_ok(
  $$ SELECT public.review_join_request(
       (SELECT id FROM public.club_join_requests
         WHERE club_id = '5ec20000-0000-4000-8000-000000000002'
           AND user_id = '5ec10000-0000-4000-8000-000000000002'),
       true) $$,
  'P0001',
  NULL,
  '25. review_join_request : refusé sans rôle admin/modérateur'
);

-- ── 4. Helpers internes non exécutables par le client ────────────────────
SELECT throws_ok($$ SELECT public.lkdv_require_actor() $$, '42501', NULL, '26. lkdv_require_actor : non exécutable par un client');
SELECT throws_ok($$ SELECT public.lkdv_recount_club_members('5ec20000-0000-4000-8000-000000000001') $$, '42501', NULL, '27. lkdv_recount_club_members : non exécutable par un client');

SELECT * FROM finish();
ROLLBACK;
