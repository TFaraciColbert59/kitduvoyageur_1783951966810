-- ============================================================================
-- Phase 2 — Unifier la chaîne d'identifiants (schéma + RPC de sélection)
--   • TEST-PHASE2-DB-01 : colonnes/FK/index de la chaîne existent
--   • TEST-PHASE2-DB-02 : sélection propriétaire ⇒ plan + corrélation + voyage
--   • TEST-PHASE2-DB-03 : non-propriétaire refusé, aucune écriture
--   • TEST-PHASE2-DB-04 : route sans géométrie navigable refusée
--   • TEST-PHASE2-DB-05 : une seule sélection active par plan (index partiel)
--   • TEST-PHASE2-DB-06 : SECURITY DEFINER, search_path verrouillé, authenticated
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
-- Replay local : grants explicites (défauts prod non garantis).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adventure_plans, public.adventure_plan_versions, public.adventure_plan_route_selections, public.hiking_routes, public.trips, public.community_posts, public.hike_sessions, public.carnets TO service_role, authenticated;
GRANT USAGE ON SCHEMA public TO service_role, authenticated;
SELECT plan(36);

-- ----------------------------------------------------------------------------
-- TEST-PHASE2-DB-01 — schéma : colonnes, FK, index de la chaîne
-- ----------------------------------------------------------------------------
SELECT has_column('public', 'adventure_plans', 'selected_route_id',
  '1. DB-01. adventure_plans.selected_route_id existe');
SELECT col_type_is('public', 'adventure_plans', 'selected_route_id', 'bigint',
  '2. DB-01. selected_route_id est du type réel de hiking_routes.id (bigint)');
SELECT col_is_fk('public', 'adventure_plans', 'selected_route_id',
  '3. DB-01. selected_route_id est une FK (hiking_routes)');
SELECT has_index('public', 'adventure_plans', 'idx_adventure_plans_selected_route',
  '4. DB-01. Index partiel sur selected_route_id');

SELECT has_column('public', 'adventure_plans', 'correlation_id',
  '5. DB-01. correlation_id sur adventure_plans');
SELECT has_column('public', 'adventure_plan_versions', 'correlation_id',
  '6. DB-01. correlation_id sur adventure_plan_versions');
SELECT has_column('public', 'hike_sessions', 'correlation_id',
  '7. DB-01. correlation_id sur hike_sessions');
SELECT has_column('public', 'carnets', 'correlation_id',
  '8. DB-01. correlation_id sur carnets');
SELECT has_column('public', 'community_posts', 'correlation_id',
  '9. DB-01. correlation_id sur community_posts');

SELECT has_column('public', 'community_posts', 'linked_carnet_id',
  '10. DB-01. community_posts.linked_carnet_id existe');
SELECT col_is_fk('public', 'community_posts', 'linked_carnet_id',
  '11. DB-01. linked_carnet_id est une FK (carnets)');
SELECT has_index('public', 'community_posts', 'idx_community_posts_linked_carnet',
  '12. DB-01. Index partiel sur linked_carnet_id');

SELECT ok(
  to_regclass('public.adventure_plan_route_selections') IS NOT NULL,
  '13. DB-01. Table historique adventure_plan_route_selections'
);
SELECT has_index('public', 'adventure_plan_route_selections', 'idx_adventure_plan_route_selections_active',
  '14. DB-01. Index unique partiel : une seule sélection active par plan');
SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.adventure_plan_route_selections'::regclass),
  '15. DB-01. RLS activée sur adventure_plan_route_selections'
);

-- ----------------------------------------------------------------------------
-- Fixtures — propriétaire, tiers, voyage, plans, routes (aucune donnée perso)
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('f2a50000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'phase2_chain_owner@test.local', 'x', '{}', '{}', now(), now()),
  ('f2a50000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'phase2_chain_other@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.trips (id, slug, title, user_id, visibility)
VALUES (
  'f2a50000-0000-4000-8000-0000000000b1',
  'phase2-pgtap-chain-trip',
  'Phase 2 — trip de test chaîne',
  'f2a50000-0000-4000-8000-0000000000a2',
  'private'
);

INSERT INTO public.adventure_plans (id, owner_id, trip_id, title, status, current_version)
VALUES
  ('f2a50000-0000-4000-8000-0000000000c1', 'f2a50000-0000-4000-8000-0000000000a2', 'f2a50000-0000-4000-8000-0000000000b1', 'Phase 2 — plan sélection', 'draft', 1),
  ('f2a50000-0000-4000-8000-0000000000c2', 'f2a50000-0000-4000-8000-0000000000a2', 'f2a50000-0000-4000-8000-0000000000b1', 'Phase 2 — plan refus', 'draft', 1),
  ('f2a50000-0000-4000-8000-0000000000c3', 'f2a50000-0000-4000-8000-0000000000a2', 'f2a50000-0000-4000-8000-0000000000b1', 'Phase 2 — plan corrélation générée', 'draft', 1);

INSERT INTO public.adventure_plan_versions (plan_id, version, snapshot, reason, generated_by)
VALUES (
  'f2a50000-0000-4000-8000-0000000000c1',
  1,
  '{"id":"f2a50000-0000-4000-8000-0000000000c1","currentVersion":1}'::jsonb,
  'Génération initiale',
  'a6-orchestrator'
);

INSERT INTO public.hiking_routes (id, osm_relation_id, name, distance_km, geom)
VALUES
  (920000001, 992000000001, 'Phase 2 — route valide', 12.5,
   ST_GeomFromText('MULTILINESTRING((6.0 45.0, 6.1 45.1, 6.2 45.0))', 4326)),
  (920000002, 992000000002, 'Phase 2 — route sans géométrie', 8.0, NULL),
  (920000003, 992000000003, 'Phase 2 — route géométrie vide', 8.0,
   ST_GeomFromText('MULTILINESTRING EMPTY', 4326)),
  (920000004, 992000000004, 'Phase 2 — route géométrie dégénérée', 0.0,
   ST_GeomFromText('MULTILINESTRING((6.0 45.0, 6.0 45.0))', 4326));

-- ----------------------------------------------------------------------------
-- TEST-PHASE2-DB-02 — sélection propriétaire : plan, historique, voyage
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '';
SELECT throws_like(
  $$ SELECT public.select_adventure_plan_route(
       'f2a50000-0000-4000-8000-0000000000c1'::uuid,
       920000001::bigint,
       NULL::uuid
     ) $$,
  '%authentification requise%',
  '16. DB-02. Sans auth.uid(), la commande est refusée'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f2a50000-0000-4000-8000-0000000000a2';
SELECT is(
  (SELECT public.select_adventure_plan_route(
    'f2a50000-0000-4000-8000-0000000000c1'::uuid,
    920000001::bigint,
    'f2a50000-0000-4000-8000-0000000000d1'::uuid
  )->>'selected_route_id'),
  '920000001',
  '17. DB-02. Le propriétaire sélectionne la route et la reçoit en retour'
);
SELECT is(
  (SELECT public.select_adventure_plan_route(
    'f2a50000-0000-4000-8000-0000000000c1'::uuid,
    920000001::bigint,
    'f2a50000-0000-4000-8000-0000000000d1'::uuid
  )->>'correlation_id'),
  'f2a50000-0000-4000-8000-0000000000d1',
  '18. DB-02. correlation_id fourni est inscrit et retourné'
);
SELECT is(
  (SELECT public.select_adventure_plan_route(
    'f2a50000-0000-4000-8000-0000000000c3'::uuid,
    920000001::bigint
  )->>'correlation_id') IS NOT NULL,
  true,
  '19. DB-02. Sans correlation_id fourni, la commande en génère un'
);

RESET ROLE;
SELECT is(
  (SELECT selected_route_id FROM public.adventure_plans
   WHERE id = 'f2a50000-0000-4000-8000-0000000000c1'),
  920000001::bigint,
  '20. DB-02. adventure_plans.selected_route_id est mis à jour'
);
SELECT is(
  (SELECT correlation_id::text FROM public.adventure_plans
   WHERE id = 'f2a50000-0000-4000-8000-0000000000c1'),
  'f2a50000-0000-4000-8000-0000000000d1',
  '21. DB-02. adventure_plans.correlation_id est mis à jour'
);
SELECT is(
  (SELECT count(*)::int FROM public.adventure_plan_route_selections
   WHERE plan_id = 'f2a50000-0000-4000-8000-0000000000c1' AND is_active),
  1,
  '22. DB-02. Une seule sélection active pour le plan'
);
SELECT is(
  (SELECT route_id FROM public.adventure_plan_route_selections
   WHERE plan_id = 'f2a50000-0000-4000-8000-0000000000c1' AND is_active),
  920000001::bigint,
  '23. DB-02. La sélection active porte la route choisie'
);
SELECT cmp_ok(
  (SELECT count(*)::int FROM public.adventure_plan_route_selections
   WHERE plan_id = 'f2a50000-0000-4000-8000-0000000000c1'),
  '>=',
  2,
  '24. DB-02. L''historique conserve les sélections successives'
);
SELECT is(
  (SELECT metadata->>'route_id' FROM public.trips
   WHERE id = 'f2a50000-0000-4000-8000-0000000000b1'),
  '920000001',
  '25. DB-02. La route est propagée dans trips.metadata.route_id'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE2-DB-03 — non-propriétaire refusé, aucune écriture
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f2a50000-0000-4000-8000-0000000000a3';
SELECT throws_like(
  $$ SELECT public.select_adventure_plan_route(
       'f2a50000-0000-4000-8000-0000000000c1'::uuid,
       920000001::bigint,
       NULL::uuid
     ) $$,
  '%non détenu%',
  '26. DB-03. Un tiers non propriétaire est refusé explicitement'
);
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.adventure_plan_route_selections
   WHERE plan_id = 'f2a50000-0000-4000-8000-0000000000c1' AND is_active),
  1,
  '27. DB-03. Le refus n''a laissé aucune sélection supplémentaire'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE2-DB-04 — route sans géométrie navigable refusée
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f2a50000-0000-4000-8000-0000000000a2';
SELECT throws_like(
  $$ SELECT public.select_adventure_plan_route(
       'f2a50000-0000-4000-8000-0000000000c2'::uuid, 920000002::bigint, NULL::uuid
     ) $$,
  '%sans géométrie navigable%',
  '28. DB-04. Une route sans géométrie (NULL) est refusée'
);
SELECT throws_like(
  $$ SELECT public.select_adventure_plan_route(
       'f2a50000-0000-4000-8000-0000000000c2'::uuid, 920000003::bigint, NULL::uuid
     ) $$,
  '%sans géométrie navigable%',
  '29. DB-04. Une route à géométrie vide est refusée'
);
SELECT throws_like(
  $$ SELECT public.select_adventure_plan_route(
       'f2a50000-0000-4000-8000-0000000000c2'::uuid, 920000004::bigint, NULL::uuid
     ) $$,
  '%sans géométrie navigable%',
  '30. DB-04. Une route à géométrie invalide/dégénérée est refusée'
);
SELECT throws_like(
  $$ SELECT public.select_adventure_plan_route(
       'f2a50000-0000-4000-8000-0000000000c1'::uuid,
       999999999::bigint,
       NULL::uuid
     ) $$,
  '%introuvable%',
  '31. DB-04. Une route inexistante est refusée explicitement'
);
RESET ROLE;
SELECT is(
  (SELECT selected_route_id FROM public.adventure_plans
   WHERE id = 'f2a50000-0000-4000-8000-0000000000c2'),
  NULL::bigint,
  '32. DB-04. Le plan cible reste sans sélection après refus'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE2-DB-05 — une seule sélection active par plan (index partiel)
-- ----------------------------------------------------------------------------
INSERT INTO public.adventure_plan_route_selections (
  plan_id, route_id, selected_by, correlation_id
) VALUES (
  'f2a50000-0000-4000-8000-0000000000c2',
  920000001,
  'f2a50000-0000-4000-8000-0000000000a2',
  'f2a50000-0000-4000-8000-0000000000d2'
);

SELECT throws_ok(
  $$ INSERT INTO public.adventure_plan_route_selections (
       plan_id, route_id, selected_by, correlation_id
     ) VALUES (
       'f2a50000-0000-4000-8000-0000000000c2',
       920000001,
       'f2a50000-0000-4000-8000-0000000000a2',
       'f2a50000-0000-4000-8000-0000000000d3'
     ) $$,
  '23505'::char(5),
  NULL::text,
  '33. DB-05. Deux sélections actives du même plan sont impossibles'
);
SELECT is(
  (SELECT count(*)::int FROM public.adventure_plan_route_selections
   WHERE plan_id = 'f2a50000-0000-4000-8000-0000000000c2' AND is_active),
  1,
  '34. DB-05. La contrainte laisse exactement une sélection active'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE2-DB-06 — SECURITY DEFINER, search_path verrouillé, authenticated
-- ----------------------------------------------------------------------------
SELECT ok(
  (SELECT p.prosecdef
   FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'select_adventure_plan_route'),
  '35. DB-06. La RPC est SECURITY DEFINER avec search_path verrouillé'
);
SELECT ok(
  (SELECT EXISTS (
     SELECT 1 FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS c
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'select_adventure_plan_route'
       AND c LIKE 'search_path=%'
   ))
  AND has_function_privilege(
    'authenticated'::name,
    'public.select_adventure_plan_route(uuid,bigint,uuid)'::text,
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon'::name,
    'public.select_adventure_plan_route(uuid,bigint,uuid)'::text,
    'EXECUTE'
  ),
  '36. DB-06. EXECUTE réservé à authenticated (anon révoqué)'
);

SELECT * FROM finish();
ROLLBACK;
