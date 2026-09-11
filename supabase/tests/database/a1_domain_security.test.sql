-- ============================================================================
-- A1 — Domaine central, BDD et sécurité — RLS et seuils publics (Task 6)
--   • TEST-A1-RLS-01 : consentements d'autrui invisibles
--   • TEST-A1-RLS-02 : external_readiness octroyé refusé (policy puis contrainte)
--   • TEST-A1-RLS-03 : passages privés (propriétaire via sa session uniquement)
--   • TEST-A1-RLS-04 : profils de performance privés
--   • TEST-A1-RLS-05 : agrégats collectifs — seuil public >= 5 utilisateurs
--   • TEST-A1-RLS-06 : vue terrain_reports_public sans identité + filtre statuts
--   • TEST-A1-RLS-07 : adventure_plans privé, lisible via can_read_trip
--   • TEST-A1-RLS-08 : adventure_domain_events — l'acteur ne voit que les siens
--   • TEST-A1-RLS-09 : claim_pending_adventure_events réservé à service_role
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(22);

-- ----------------------------------------------------------------------------
-- Fixtures (rôle session : contourne RLS / FORCE RLS comme les autres suites)
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'a1_rls_a@test.local', 'x', '{}', '{}', now(), now()),
  ('b1111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'a1_rls_b@test.local', 'x', '{}', '{}', now(), now()),
  ('c1111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'a1_rls_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Consentement du propriétaire A (personal_performance)
INSERT INTO public.adventure_data_consents (id, user_id, purpose, granted, policy_version)
VALUES ('0a000000-0000-4000-8000-000000000001', 'a1111111-1111-1111-1111-111111111111', 'personal_performance', true, 'a1-v1');

-- Réseau : un segment privé (agrégat sous seuil) et un segment public (seuil atteint)
INSERT INTO public.trail_segments (id, osm_id, name, highway, geom)
VALUES
  (8800001, 990000000001, 'A1 segment privé', 'path', ST_GeomFromText('LINESTRING(6.0 44.0, 6.001 44.001)', 4326)),
  (8800002, 990000000002, 'A1 segment public', 'path', ST_GeomFromText('LINESTRING(6.1 44.1, 6.101 44.101)', 4326));

-- Session de A + un passage par segment (Niveau 2, privé dérivé)
INSERT INTO public.hike_sessions (id, user_id, started_at, ended_at, distance_km, duration_seconds)
VALUES ('72000000-0000-4000-8000-000000000001', 'a1111111-1111-1111-1111-111111111111', now() - interval '3 hours', now() - interval '1 hour', 8.4, 7200);

INSERT INTO public.session_segment_passages (id, session_id, user_id, segment_id, direction, entered_at, exited_at, duration_s, distance_m, processor_version)
VALUES ('73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'a1111111-1111-1111-1111-111111111111', 8800001, 'forward', now() - interval '3 hours', now() - interval '3 hours' + interval '20 minutes', 1200, 2400, 'a1-test-v1');

-- Profil de performance de A (Niveau 2, privé)
INSERT INTO public.user_performance_profiles (id, user_id, activity_type, model_version, flat_speed_kmh, calibration_level)
VALUES ('74000000-0000-4000-8000-000000000001', 'a1111111-1111-1111-1111-111111111111', 'hiking', 'a1-test-v1', 4.2, 'cold');

-- Agrégats collectifs : 4 utilisateurs distincts (sous seuil) / 5 (seuil public)
INSERT INTO public.segment_collective_aggregates (id, segment_id, condition_bucket, direction, passage_count, distinct_user_count, processor_version)
VALUES
  ('75000000-0000-4000-8000-000000000001', 8800001, 'dry', 'forward', 9, 4, 'a1-test-v1'),
  ('75000000-0000-4000-8000-000000000002', 8800002, 'dry', 'forward', 11, 5, 'a1-test-v1');

-- Signalements Terrain Live : pending / confirmed / active non expiré / active expiré
INSERT INTO public.terrain_reports (id, segment_id, reporter_id, category, severity, passability, lat, lng, status, expires_at)
VALUES
  ('76000000-0000-4000-8000-000000000001', 8800001, 'a1111111-1111-1111-1111-111111111111', 'mud', 'warning', 'difficult', 44.0, 6.0, 'pending', NULL),
  ('76000000-0000-4000-8000-000000000002', 8800001, 'a1111111-1111-1111-1111-111111111111', 'mud', 'warning', 'difficult', 44.0, 6.0, 'confirmed', NULL),
  ('76000000-0000-4000-8000-000000000003', 8800001, 'a1111111-1111-1111-1111-111111111111', 'mud', 'warning', 'difficult', 44.0, 6.0, 'active', now() + interval '2 days'),
  ('76000000-0000-4000-8000-000000000004', 8800001, 'a1111111-1111-1111-1111-111111111111', 'mud', 'warning', 'difficult', 44.0, 6.0, 'active', now() - interval '1 hour');

-- Trip privé de A, collaborateur C (viewer), plan lié au trip
INSERT INTO public.trips (id, slug, title, user_id, visibility)
VALUES ('70000000-0000-4000-8000-000000000001', 'a1-pgtap-rls-fixture-trip', 'A1 RLS — trip privé', 'a1111111-1111-1111-1111-111111111111', 'private');

INSERT INTO public.trip_collaborators (trip_id, user_id, role)
VALUES ('70000000-0000-4000-8000-000000000001', 'c1111111-1111-1111-1111-111111111111', 'viewer');

INSERT INTO public.adventure_plans (id, owner_id, trip_id, title, status)
VALUES ('71000000-0000-4000-8000-000000000001', 'a1111111-1111-1111-1111-111111111111', '70000000-0000-4000-8000-000000000001', 'A1 RLS — plan lié', 'draft');

-- Événements domaine : A, B et un événement système (acteur NULL)
INSERT INTO public.adventure_domain_events (id, event_type, entity_type, entity_id, actor_id, processor_version, idempotency_key)
VALUES
  ('77000000-0000-4000-8000-000000000001', 'plan.created', 'adventure_plan', '71000000-0000-4000-8000-000000000001', 'a1111111-1111-1111-1111-111111111111', 'a1-test-v1', 'plan.created:71000000-0000-4000-8000-000000000001:a1-test-v1'),
  ('77000000-0000-4000-8000-000000000002', 'plan.created', 'adventure_plan', '71000000-0000-4000-8000-000000000099', 'b1111111-1111-1111-1111-111111111111', 'a1-test-v1', 'plan.created:71000000-0000-4000-8000-000000000099:a1-test-v1'),
  ('77000000-0000-4000-8000-000000000003', 'system.tick', 'system', 'cron', NULL, 'a1-test-v1', 'system.tick:cron:a1-test-v1');

-- ----------------------------------------------------------------------------
-- TEST-A1-RLS-01 — consentements : chacun ne voit que les siens
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'b1111111-1111-1111-1111-111111111111';
SELECT is_empty(
  'SELECT * FROM public.adventure_data_consents',
  '1. RLS-01. B ne voit aucun consentement (celui de A est invisible)'
);

SET LOCAL "request.jwt.claim.sub" = 'a1111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT count(*) FROM public.adventure_data_consents),
  1,
  '2. RLS-01. A voit son propre consentement (fixture valide)'
);

-- ----------------------------------------------------------------------------
-- TEST-A1-RLS-02 — external_readiness octroyé : policy puis contrainte
-- ----------------------------------------------------------------------------
SELECT throws_ok(
  $$ INSERT INTO public.adventure_data_consents (user_id, purpose, granted)
     VALUES ('a1111111-1111-1111-1111-111111111111', 'external_readiness', true) $$,
  'new row violates row-level security policy for table "adventure_data_consents"',
  '3. RLS-02. Même pour soi, external_readiness=true est refusé par la policy'
);

RESET ROLE;
SELECT throws_ok(
  $$ INSERT INTO public.adventure_data_consents (user_id, purpose, granted)
     VALUES ('a1111111-1111-1111-1111-111111111111', 'external_readiness', true) $$,
  'new row for relation "adventure_data_consents" violates check constraint "adventure_data_consents_external_readiness_disabled"',
  '4. RLS-02. La contrainte interdit external_readiness=true même hors RLS'
);

-- ----------------------------------------------------------------------------
-- TEST-A1-RLS-03 — passages de session : propriétaire uniquement
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a1111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT count(*) FROM public.session_segment_passages),
  1,
  '5. RLS-03. A (propriétaire de la session) lit son passage'
);

SET LOCAL "request.jwt.claim.sub" = 'b1111111-1111-1111-1111-111111111111';
SELECT is_empty(
  'SELECT * FROM public.session_segment_passages',
  '6. RLS-03. B (tiers) ne voit aucun passage'
);

-- ----------------------------------------------------------------------------
-- TEST-A1-RLS-04 — profils de performance privés
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = 'a1111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT count(*) FROM public.user_performance_profiles),
  1,
  '7. RLS-04. A lit son propre profil de performance'
);

SET LOCAL "request.jwt.claim.sub" = 'b1111111-1111-1111-1111-111111111111';
SELECT is_empty(
  'SELECT * FROM public.user_performance_profiles',
  '8. RLS-04. Le profil de A est privé (B ne voit rien)'
);

-- ----------------------------------------------------------------------------
-- TEST-A1-RLS-05 — agrégats collectifs : seuil public >= 5 utilisateurs
-- ----------------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT is_empty(
  'SELECT * FROM public.segment_collective_aggregates WHERE id = ''75000000-0000-4000-8000-000000000001''',
  '9. RLS-05. Un agrégat à 4 utilisateurs distincts est invisible en lecture publique'
);
SELECT is(
  (SELECT count(*) FROM public.segment_collective_aggregates WHERE id = '75000000-0000-4000-8000-000000000002'),
  1,
  '10. RLS-05. Un agrégat à 5 utilisateurs distincts est visible en lecture publique'
);

-- ----------------------------------------------------------------------------
-- TEST-A1-RLS-06 — vue terrain_reports_public : sans identité, statuts filtrés
-- ----------------------------------------------------------------------------
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'terrain_reports_public'
      AND column_name = 'reporter_id'
  ),
  '11. RLS-06. La vue publique n''expose pas la colonne reporter_id'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.terrain_reports_public WHERE id = '76000000-0000-4000-8000-000000000002'),
  '12. RLS-06. Un rapport confirmed non expiré est visible'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.terrain_reports_public WHERE id = '76000000-0000-4000-8000-000000000003'),
  '13. RLS-06. Un rapport active non expiré est visible'
);
SELECT is_empty(
  'SELECT * FROM public.terrain_reports_public WHERE id = ''76000000-0000-4000-8000-000000000001''',
  '14. RLS-06. Un rapport pending est filtré de la vue'
);
SELECT is_empty(
  'SELECT * FROM public.terrain_reports_public WHERE id = ''76000000-0000-4000-8000-000000000004''',
  '15. RLS-06. Un rapport active expiré est filtré de la vue'
);

-- La table de base, elle, reste invisible à un tiers authentifié (aucune policy publique)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'b1111111-1111-1111-1111-111111111111';
SELECT is_empty(
  'SELECT * FROM public.terrain_reports',
  '16. RLS-06. La table de base terrain_reports ne renvoie rien pour un tiers'
);

-- ----------------------------------------------------------------------------
-- TEST-A1-RLS-07 — adventure_plans : privé, lisible par collaborateur du trip
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = 'a1111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT count(*) FROM public.adventure_plans),
  1,
  '17. RLS-07. Le propriétaire A lit son plan'
);

SET LOCAL "request.jwt.claim.sub" = 'b1111111-1111-1111-1111-111111111111';
SELECT is_empty(
  'SELECT * FROM public.adventure_plans',
  '18. RLS-07. B (tiers non collaborateur) ne voit aucun plan'
);

SET LOCAL "request.jwt.claim.sub" = 'c1111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT count(*) FROM public.adventure_plans),
  1,
  '19. RLS-07. C, collaborateur du trip lié, lit le plan via can_read_trip'
);

-- ----------------------------------------------------------------------------
-- TEST-A1-RLS-08 — événements domaine : l'acteur ne voit que les siens
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = 'a1111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT count(*) FROM public.adventure_domain_events),
  1,
  '20. RLS-08. A ne voit que son événement (ni celui de B, ni l''événement système)'
);

SET LOCAL "request.jwt.claim.sub" = 'b1111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT count(*) FROM public.adventure_domain_events),
  1,
  '21. RLS-08. B ne voit que son propre événement'
);

-- ----------------------------------------------------------------------------
-- TEST-A1-RLS-09 — claim réservé au traitement serveur (service_role)
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = 'a1111111-1111-1111-1111-111111111111';
SELECT throws_ok(
  $$ SELECT public.claim_pending_adventure_events(10) $$,
  'permission denied for function claim_pending_adventure_events',
  '22. RLS-09. authenticated ne peut pas exécuter le claim d''événements'
);

SELECT * FROM finish();
ROLLBACK;
