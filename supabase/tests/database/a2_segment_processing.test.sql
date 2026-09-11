-- ============================================================================
-- A2 — Traitement GPS, segmentation et map-matching — RPC candidats et claim
--   • TEST-A2-DB-01 : a2_claim_pending_sessions réservé à service_role
--   • TEST-A2-DB-02 : le claim réserve des sessions pending (SKIP LOCKED)
--   • TEST-A2-DB-03 : pas de double-claim (processing exclu)
--   • TEST-A2-DB-04 : a2_segment_candidates trouve les segments proches
--   • TEST-A2-DB-05 : pas de fuite hors rayon ni de segment lointain
--   • TEST-A2-DB-06 : a2_segment_candidates refusé à anon
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
-- Replay local : grants service_role/authenticated explicites (défauts prod non garantis).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hike_sessions, public.session_segment_passages, public.performance_observations, public.user_performance_profiles, public.user_performance_profile_versions, public.adventure_plans, public.adventure_plan_versions, public.adventure_plan_decisions, public.adventure_engine_runs, public.trail_segments, public.trail_segment_features, public.segment_collective_aggregates, public.segment_condition_buckets, public.terrain_reports, public.terrain_report_confirmations, public.terrain_events, public.adventure_domain_events, public.adventure_data_consents, public.trips, public.trip_collaborators TO service_role, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;
SELECT plan(14);

-- ----------------------------------------------------------------------------
-- Fixtures (rôle session : contourne RLS / FORCE RLS comme les autres suites)
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a2111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'a2_proc_a@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Session à traiter : 3 pending (la plus ancienne d'abord) + 1 déjà traitée
INSERT INTO public.hike_sessions (id, user_id, started_at, ended_at, distance_km, duration_seconds, processing_status, processor_version)
VALUES
  ('72100000-0000-4000-8000-000000000001', 'a2111111-1111-1111-1111-111111111111', now() - interval '3 hours', now() - interval '2 hours', 8.4, 3600, 'pending', NULL),
  ('72100000-0000-4000-8000-000000000002', 'a2111111-1111-1111-1111-111111111111', now() - interval '2 hours', now() - interval '1 hour', 5.1, 3000, 'pending', NULL),
  ('72100000-0000-4000-8000-000000000003', 'a2111111-1111-1111-1111-111111111111', now() - interval '1 hour', now(), 3.2, 1800, 'pending', NULL),
  ('72100000-0000-4000-8000-000000000004', 'a2111111-1111-1111-1111-111111111111', now() - interval '5 hours', now() - interval '4 hours', 12.0, 5400, 'processed', 'a2-test-v1');

-- Réseau : segment proche (point sur la ligne), segment à ~32 m, segment lointain
INSERT INTO public.trail_segments (id, osm_id, name, highway, surface, sac_scale, geom)
VALUES
  (8810001, 991000000001, 'A2 segment proche', 'path', 'ground', 'hiking', ST_GeomFromText('LINESTRING(6.0 44.0, 6.001 44.0)', 4326)),
  (8810002, 991000000002, 'A2 segment à 32 m', 'track', 'gravel', NULL, ST_GeomFromText('LINESTRING(6.0004 44.0, 6.0014 44.0)', 4326)),
  (8810003, 991000000003, 'A2 segment lointain', 'path', 'rock', NULL, ST_GeomFromText('LINESTRING(7.0 45.0, 7.001 45.0)', 4326));

-- ----------------------------------------------------------------------------
-- TEST-A2-DB-01 — claim refusé à authenticated
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a2111111-1111-1111-1111-111111111111';
SELECT throws_ok(
  $$ SELECT public.a2_claim_pending_sessions(2) $$,
  'permission denied for function a2_claim_pending_sessions',
  '1. DB-01. authenticated ne peut pas réclamer des sessions'
);

-- ----------------------------------------------------------------------------
-- TEST-A2-DB-02 — claim service_role : réserve les plus anciennes pending
-- ----------------------------------------------------------------------------
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT is(
  (SELECT count(*)::int FROM public.a2_claim_pending_sessions(2)),
  2,
  '2. DB-02. claim(2) réserve exactement 2 sessions'
);
SELECT is(
  (SELECT processing_status FROM public.hike_sessions WHERE id = '72100000-0000-4000-8000-000000000001'),
  'processing',
  '3. DB-02. La session la plus ancienne passe en processing'
);
SELECT is(
  (SELECT processing_status FROM public.hike_sessions WHERE id = '72100000-0000-4000-8000-000000000003'),
  'pending',
  '4. DB-02. La session non réservée reste pending'
);
SELECT is(
  (SELECT processing_status FROM public.hike_sessions WHERE id = '72100000-0000-4000-8000-000000000004'),
  'processed',
  '5. DB-02. La session déjà traitée n''est jamais réclamée'
);

-- ----------------------------------------------------------------------------
-- TEST-A2-DB-03 — pas de double-claim
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM public.a2_claim_pending_sessions(5)),
  1,
  '6. DB-03. Le second claim ne prend que la dernière pending'
);
SELECT is(
  (SELECT count(*)::int FROM public.a2_claim_pending_sessions(5)),
  0,
  '7. DB-03. Le troisième claim ne reprend aucune session processing'
);

-- ----------------------------------------------------------------------------
-- TEST-A2-DB-04 — candidats proches (authenticated)
-- ----------------------------------------------------------------------------
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT segment_id FROM public.a2_segment_candidates(44.0, 6.0, 50) LIMIT 1),
  8810001::bigint,
  '8. DB-04. Le segment le plus proche arrive en tête (tri par distance)'
);
SELECT is(
  (SELECT count(*)::int FROM public.a2_segment_candidates(44.0, 6.0, 50)),
  2,
  '9. DB-04. Deux segments dans un rayon de 50 m'
);
SELECT ok(
  (SELECT distance_m < 1 FROM public.a2_segment_candidates(44.0, 6.0, 50) WHERE segment_id = 8810001),
  '10. DB-04. Le point posé sur la ligne donne une distance quasi nulle'
);
SELECT ok(
  (SELECT abs(bearing_deg - 90) < 0.5 FROM public.a2_segment_candidates(44.0, 6.0, 50) WHERE segment_id = 8810001),
  '11. DB-04. L''azimut du segment est calculé (Est ≈ 90°)'
);

-- ----------------------------------------------------------------------------
-- TEST-A2-DB-05 — pas de fuite hors rayon
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM public.a2_segment_candidates(44.0, 6.0, 20)),
  1,
  '12. DB-05. Un rayon de 20 m exclut le segment à ~32 m'
);
SELECT is(
  (SELECT count(*)::int FROM public.a2_segment_candidates(44.0, 6.0, 50) WHERE segment_id = 8810003),
  0,
  '13. DB-05. Le segment lointain n''est jamais retourné'
);

-- ----------------------------------------------------------------------------
-- TEST-A2-DB-06 — candidats refusés à anon
-- ----------------------------------------------------------------------------
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.a2_segment_candidates(44.0, 6.0, 50) $$,
  'permission denied for function a2_segment_candidates',
  '14. DB-06. anon ne peut pas exécuter les candidats'
);

SELECT * FROM finish();
ROLLBACK;
