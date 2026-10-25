-- ============================================================================
-- PHASE 8 — Revue RLS exhaustive : accès horizontal et vertical
-- ============================================================================
--   • TEST-PHASE8-RLS-01..10  : inventaire des durcissements (schéma)
--   • TEST-PHASE8-RLS-11..26  : accès HORIZONTAL (A/B isolés)
--   • TEST-PHASE8-RLS-27..34  : accès VERTICAL (rôle normal ≠ admin,
--                               entitlements infalsifiables, stripe_events)
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
-- Replay local : grants explicites (défauts prod non garantis).
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.trips, public.carnets, public.hike_sessions, public.carnet_moments,
  public.carnet_kit_items, public.community_posts, public.comment_reports,
  public.user_entitlements, public.user_documents, public.orders,
  public.trip_pois, public.adventure_plans, public.conversations,
  public.conversation_members, public.messages, public.user_profiles,
  public.moderation_queue
TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
SELECT plan(40);

-- ----------------------------------------------------------------------------
-- 1..10 — Inventaire des durcissements
-- ----------------------------------------------------------------------------
SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'stripe_events'),
  '1. RLS-01. stripe_events : RLS activée ET forcée'
);
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'stripe_events'),
  0,
  '2. RLS-01. stripe_events : aucune policy (service_role uniquement)'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hike_sessions'
      AND policyname IN ('hike_sessions_select', 'hike_sessions_insert',
                         'hike_sessions_update', 'hike_sessions_delete', 'own_sessions')
  ),
  '3. RLS-02. hike_sessions : politiques permissives `true` supprimées'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hike_sessions'
      AND policyname IN ('hike_sessions_select_owner_or_public_carnet',
                         'hike_sessions_insert_owner', 'hike_sessions_update_owner',
                         'hike_sessions_delete_owner')
    HAVING count(*) = 4
  ),
  '4. RLS-02. hike_sessions : 4 politiques propriétaire/public-carnet en place'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('carnet_moments', 'carnet_kit_items')
      AND policyname IN ('seed_public_read_carnet_moments', 'seed_public_read_carnet_kit_items')
  ),
  '5. RLS-03. carnets privés : lectures seed `true` supprimées'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'groupe_messages'
      AND policyname = 'public_read_groupe_messages'
  ) AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'groupe_messages'
      AND policyname = 'groupe_messages_select_member'
  ),
  '6. RLS-04. groupe_messages : lecture réservée aux membres'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comment_reports'
      AND policyname = 'comment_reports_select'
  ) AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comment_reports'
      AND policyname = 'comment_reports_select_own_or_moderator'
  ),
  '7. RLS-05. comment_reports : signalant/modérateur uniquement'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_posts'
      AND policyname = 'auth_like_community_posts'
  ),
  '8. RLS-06. community_posts : UPDATE générique `true` supprimée'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN ('affiliate_clicks_public_read', 'affiliate_conversions_public_read',
                         'affiliate_offers_public_read', 'affiliate_partners_public_read',
                         'affiliate_programs_public_read')
  ),
  '9. RLS-07. affiliations : politiques `FOR ALL` publiques supprimées'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.hub_dashboard_kpis', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.hub_dashboard_kpis', 'SELECT'),
  '10. RLS-08. hub_dashboard_kpis : plus aucun accès anon/authenticated'
);

-- ----------------------------------------------------------------------------
-- Fixtures — A propriétaire, B tiers, ADMIN administrateur
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('f8a80000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'phase8_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f8a80000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'phase8_b@test.local', 'x', '{}', '{}', now(), now()),
  ('f8a80000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'phase8_admin@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email, role, trust_score)
VALUES
  ('f8a80000-0000-4000-8000-0000000000a1', 'Propriétaire A', 'phase8_a@test.local', 'user', 50),
  ('f8a80000-0000-4000-8000-0000000000a2', 'Tiers B', 'phase8_b@test.local', 'user', 50),
  ('f8a80000-0000-4000-8000-0000000000a3', 'Admin', 'phase8_admin@test.local', 'admin', 90)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, trust_score = EXCLUDED.trust_score;

-- Voyage privé de A + POI
INSERT INTO public.trips (id, slug, title, user_id, visibility)
VALUES ('f8a80000-0000-4000-8000-0000000000f1', 'phase8-rls-trip-prive', 'Phase 8 — trip privé', 'f8a80000-0000-4000-8000-0000000000a1', 'private');

INSERT INTO public.trip_pois (id, trip_id, name, category, latitude, longitude)
VALUES ('f8a80000-0000-4000-8000-0000000000f2', 'f8a80000-0000-4000-8000-0000000000f1', 'Refuge A', 'refuge', 45.1, 6.1);

-- Plan de A lié au voyage privé
INSERT INTO public.adventure_plans (id, owner_id, trip_id, title, status)
VALUES ('f8a80000-0000-4000-8000-0000000000f3', 'f8a80000-0000-4000-8000-0000000000a1', 'f8a80000-0000-4000-8000-0000000000f1', 'Plan privé A', 'draft');

-- Carnets : un privé, un public (publication explicite)
INSERT INTO public.carnets (id, author_id, title, destination, visibility)
VALUES
  ('f8a80000-0000-4000-8000-0000000000c1', 'f8a80000-0000-4000-8000-0000000000a1', 'Carnet privé A', 'Belledonne', 'private'),
  ('f8a80000-0000-4000-8000-0000000000c2', 'f8a80000-0000-4000-8000-0000000000a1', 'Carnet public A', 'Vercors', 'public');

INSERT INTO public.carnet_moments (id, carnet_id, jour_numero, citation, auteur_id)
VALUES
  ('f8a80000-0000-4000-8000-0000000000c3', 'f8a80000-0000-4000-8000-0000000000c1', 1, 'Moment privé', 'f8a80000-0000-4000-8000-0000000000a1'),
  ('f8a80000-0000-4000-8000-0000000000c4', 'f8a80000-0000-4000-8000-0000000000c2', 1, 'Moment public', 'f8a80000-0000-4000-8000-0000000000a1');

INSERT INTO public.carnet_kit_items (id, carnet_id, nom, poids_g)
VALUES
  ('f8a80000-0000-4000-8000-0000000000c5', 'f8a80000-0000-4000-8000-0000000000c1', 'Tente privée', 1200),
  ('f8a80000-0000-4000-8000-0000000000c6', 'f8a80000-0000-4000-8000-0000000000c2', 'Tente publique', 1200);

-- Sessions GPS : une privée, une liée au carnet public
INSERT INTO public.hike_sessions (id, user_id, carnet_id, started_at, ended_at, distance_km, duration_seconds, positions_geojson)
VALUES
  ('f8a80000-0000-4000-8000-0000000000d1', 'f8a80000-0000-4000-8000-0000000000a1', 'f8a80000-0000-4000-8000-0000000000c1', now() - interval '4 hours', now() - interval '2 hours', 8.4, 7200, NULL),
  ('f8a80000-0000-4000-8000-0000000000d2', 'f8a80000-0000-4000-8000-0000000000a1', 'f8a80000-0000-4000-8000-0000000000c2', now() - interval '30 hours', now() - interval '26 hours', 12.1, 14400, NULL);

-- Post communautaire de A + signalement de A
INSERT INTO public.community_posts (id, author_id, content)
VALUES ('f8a80000-0000-4000-8000-0000000000e1', 'f8a80000-0000-4000-8000-0000000000a1', 'Post de A');

INSERT INTO public.comment_reports (id, comment_id, reporter_id, reason, table_name, status)
VALUES ('f8a80000-0000-4000-8000-0000000000e2', 'f8a80000-0000-4000-8000-0000000000ee', 'f8a80000-0000-4000-8000-0000000000a1', 'spam', 'post_comments', 'pending');

-- Entitlements : A payant, B gratuit
INSERT INTO public.user_entitlements (user_id, plan, active_passes, source)
VALUES
  ('f8a80000-0000-4000-8000-0000000000a1', 'explorer', '[]'::jsonb, 'manual'),
  ('f8a80000-0000-4000-8000-0000000000a2', 'free', '[]'::jsonb, 'manual');

-- Document et commande de A
INSERT INTO public.user_documents (id, user_id, name, type)
VALUES ('f8a80000-0000-4000-8000-0000000000b1', 'f8a80000-0000-4000-8000-0000000000a1', 'Passeport A', 'passeport');

INSERT INTO public.orders (id, user_id, order_number, status)
VALUES ('f8a80000-0000-4000-8000-0000000000b2', 'f8a80000-0000-4000-8000-0000000000a1', 'KDV-PHASE8-A', 'confirmed');

-- Messagerie : conversation dont A est l'unique membre
INSERT INTO public.conversations (id, type, name, created_by)
VALUES ('f8a80000-0000-4000-8000-0000000000d3', 'group', 'Conversation A', 'f8a80000-0000-4000-8000-0000000000a1');

INSERT INTO public.conversation_members (conversation_id, user_id, role)
VALUES ('f8a80000-0000-4000-8000-0000000000d3', 'f8a80000-0000-4000-8000-0000000000a1', 'owner');

INSERT INTO public.messages (id, conversation_id, sender_id, content)
VALUES ('f8a80000-0000-4000-8000-0000000000d4', 'f8a80000-0000-4000-8000-0000000000d3', 'f8a80000-0000-4000-8000-0000000000a1', 'Message privé A');

-- ============================================================================
-- ACCÈS HORIZONTAL — B ne voit/ne modifie rien de A
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f8a80000-0000-4000-8000-0000000000a2';

SELECT is_empty(
  'SELECT * FROM public.carnets WHERE id = ''f8a80000-0000-4000-8000-0000000000c1''',
  '11. RLS-11. Carnet privé d''autrui invisible'
);
SELECT is(
  (SELECT count(*)::int FROM public.carnets WHERE id = 'f8a80000-0000-4000-8000-0000000000c2'),
  1,
  '12. RLS-12. Carnet explicitement public lisible (contrôle positif)'
);
SELECT is(
  (SELECT count(*)::int FROM public.hike_sessions),
  1,
  '13. RLS-13. B ne voit QUE la session liée au carnet public (pas la privée)'
);
SELECT is(
  (SELECT id FROM public.hike_sessions LIMIT 1),
  'f8a80000-0000-4000-8000-0000000000d2'::uuid,
  '14. RLS-13. La session visible est bien celle du carnet public'
);
SELECT is_empty(
  'SELECT * FROM public.carnet_moments WHERE carnet_id = ''f8a80000-0000-4000-8000-0000000000c1''',
  '15. RLS-14. Moments du carnet privé invisibles'
);
SELECT is(
  (SELECT count(*)::int FROM public.carnet_moments WHERE carnet_id = 'f8a80000-0000-4000-8000-0000000000c2'),
  1,
  '16. RLS-14. Moments du carnet public lisibles'
);
SELECT is_empty(
  'SELECT * FROM public.carnet_kit_items WHERE carnet_id = ''f8a80000-0000-4000-8000-0000000000c1''',
  '17. RLS-15. Matériel du carnet privé invisible'
);
SELECT is_empty(
  'SELECT * FROM public.trips WHERE id = ''f8a80000-0000-4000-8000-0000000000f1''',
  '18. RLS-16. Voyage privé d''autrui invisible'
);
SELECT is_empty(
  'SELECT * FROM public.trip_pois WHERE trip_id = ''f8a80000-0000-4000-8000-0000000000f1''',
  '19. RLS-17. POI du voyage privé invisibles'
);
SELECT is_empty(
  'SELECT * FROM public.adventure_plans WHERE id = ''f8a80000-0000-4000-8000-0000000000f3''',
  '20. RLS-18. Plan d''aventure privé invisible'
);
SELECT is_empty(
  'SELECT * FROM public.user_documents WHERE user_id = ''f8a80000-0000-4000-8000-0000000000a1''',
  '21. RLS-19. Documents d''autrui invisibles'
);
SELECT is_empty(
  'SELECT * FROM public.orders WHERE user_id = ''f8a80000-0000-4000-8000-0000000000a1''',
  '22. RLS-20. Commandes d''autrui invisibles'
);
SELECT is_empty(
  'SELECT * FROM public.messages WHERE conversation_id = ''f8a80000-0000-4000-8000-0000000000d3''',
  '23. RLS-21. Messages d''une conversation dont on n''est pas membre : invisibles'
);
SELECT is_empty(
  'SELECT * FROM public.comment_reports WHERE id = ''f8a80000-0000-4000-8000-0000000000e2''',
  '24. RLS-22. Signalement d''autrui invisible'
);
SELECT is_empty(
  'SELECT * FROM public.user_entitlements WHERE user_id = ''f8a80000-0000-4000-8000-0000000000a1''',
  '25. RLS-23. Entitlements d''autrui invisibles (horizontal)'
);

-- Tentatives de modification horizontales (0 ligne affectée)
UPDATE public.trips SET title = 'piraté' WHERE id = 'f8a80000-0000-4000-8000-0000000000f1';
UPDATE public.carnets SET title = 'piraté' WHERE id = 'f8a80000-0000-4000-8000-0000000000c1';
UPDATE public.hike_sessions SET distance_km = 0 WHERE id = 'f8a80000-0000-4000-8000-0000000000d1';
DELETE FROM public.hike_sessions WHERE id = 'f8a80000-0000-4000-8000-0000000000d1';
UPDATE public.community_posts SET content = 'piraté' WHERE id = 'f8a80000-0000-4000-8000-0000000000e1';
UPDATE public.adventure_plans SET title = 'piraté' WHERE id = 'f8a80000-0000-4000-8000-0000000000f3';
RESET ROLE;
SELECT is(
  (SELECT title FROM public.trips WHERE id = 'f8a80000-0000-4000-8000-0000000000f1'),
  'Phase 8 — trip privé',
  '26. RLS-24. Le voyage de A est resté intact'
);
SELECT is(
  (SELECT title FROM public.carnets WHERE id = 'f8a80000-0000-4000-8000-0000000000c1'),
  'Carnet privé A',
  '27. RLS-24. Le carnet de A est resté intact'
);
SELECT is(
  (SELECT distance_km FROM public.hike_sessions WHERE id = 'f8a80000-0000-4000-8000-0000000000d1'),
  8.4,
  '28. RLS-24. La session de A est restée intacte (ni UPDATE ni DELETE)'
);
SELECT is(
  (SELECT content FROM public.community_posts WHERE id = 'f8a80000-0000-4000-8000-0000000000e1'),
  'Post de A',
  '29. RLS-24. Le post de A est resté intact'
);
SELECT is(
  (SELECT title FROM public.adventure_plans WHERE id = 'f8a80000-0000-4000-8000-0000000000f3'),
  'Plan privé A',
  '30. RLS-24. Le plan de A est resté intact'
);

-- ============================================================================
-- ACCÈS VERTICAL — B (rôle normal) ne s'octroie aucun privilège admin
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f8a80000-0000-4000-8000-0000000000a2';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

SELECT throws_ok(
  $$ UPDATE public.user_profiles SET role = 'admin'
     WHERE id = 'f8a80000-0000-4000-8000-0000000000a2' $$,
  NULL, NULL,
  '31. RLS-25. Auto-promotion `role = admin` refusée par le garde-fou'
);
SELECT throws_ok(
  $$ UPDATE public.user_profiles SET trust_score = 100
     WHERE id = 'f8a80000-0000-4000-8000-0000000000a2' $$,
  NULL, NULL,
  '32. RLS-25. Auto-élévation `trust_score` refusée'
);
SELECT lives_ok(
  $$ UPDATE public.user_profiles SET full_name = 'B modifié'
     WHERE id = 'f8a80000-0000-4000-8000-0000000000a2' $$,
  '33. RLS-25. Les colonnes personnelles restent modifiables (full_name)'
);
SELECT is_empty(
  'SELECT * FROM public.moderation_queue',
  '34. RLS-26. File de modération invisible pour un rôle normal'
);

-- Entitlements : lecture de SON plan oui, écriture non
SELECT is(
  (SELECT plan FROM public.user_entitlements WHERE user_id = 'f8a80000-0000-4000-8000-0000000000a2'),
  'free',
  '35. RLS-27. B lit son propre entitlement (source serveur)'
);
UPDATE public.user_entitlements SET plan = 'expedition'
  WHERE user_id = 'f8a80000-0000-4000-8000-0000000000a2';
SELECT throws_ok(
  $$ INSERT INTO public.user_entitlements (user_id, plan, active_passes, source)
     VALUES ('f8a80000-0000-4000-8000-0000000000a2', 'expedition', '[]'::jsonb, 'manual') $$,
  NULL, NULL,
  '36. RLS-27. Insertion d''un entitlement forgé refusée (RLS)'
);
SELECT throws_ok(
  'SELECT * FROM public.stripe_events',
  NULL, NULL,
  '37. RLS-28. stripe_events illisible pour authenticated (aucun privilège)'
);
SELECT throws_ok(
  $$ INSERT INTO public.stripe_events (event_id, type, kind)
     VALUES ('evt_forge', 'checkout.session.completed', 'checkout_completed') $$,
  NULL, NULL,
  '38. RLS-28. stripe_events non insérable par authenticated'
);
RESET ROLE;

SELECT is(
  (SELECT plan FROM public.user_entitlements WHERE user_id = 'f8a80000-0000-4000-8000-0000000000a2'),
  'free',
  '39. RLS-27. L''UPDATE client de l''entitlement n''a rien changé'
);

-- service_role : accès légitime aux événements Stripe
SET LOCAL ROLE service_role;
INSERT INTO public.stripe_events (event_id, type, kind)
VALUES ('evt_phase8_service', 'checkout.session.completed', 'checkout_completed');
SELECT is(
  (SELECT count(*)::int FROM public.stripe_events WHERE event_id = 'evt_phase8_service'),
  1,
  '40. RLS-28. service_role peut journaliser un événement Stripe'
);

SELECT * FROM finish();
ROLLBACK;
