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
SELECT plan(16);

-- ----------------------------------------------------------------------------
-- Fixtures (rôle session : contourne RLS / FORCE RLS comme les autres suites)
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a2111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'a2_proc_a@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Sessions du contrat de claim (IDs stables) :
--   01,02,03 : pending dues (01 la plus ancienne) — 08 : pending future
--   05 : processing lease FRAIS (ne doit jamais être repris)
--   06 : processing lease EXPIRÉ (peut être repris)
--   04 : processed — 07 : dead_letter (jamais repris)
INSERT INTO public.hike_sessions (
  id, user_id, started_at, ended_at, distance_km, duration_seconds,
  processing_status, processor_version, processing_attempts, processing_started_at, next_retry_at
)
VALUES
  ('72100000-0000-4000-8000-000000000001', 'a2111111-1111-1111-1111-111111111111', now() - interval '3 hours', now() - interval '2 hours', 8.4, 3600, 'pending', NULL, 0, NULL, NULL),
  ('72100000-0000-4000-8000-000000000002', 'a2111111-1111-1111-1111-111111111111', now() - interval '2 hours', now() - interval '1 hour', 5.1, 3000, 'pending', NULL, 0, NULL, NULL),
  ('72100000-0000-4000-8000-000000000003', 'a2111111-1111-1111-1111-111111111111', now() - interval '1 hour', now(), 3.2, 1800, 'pending', NULL, 0, NULL, NULL),
  ('72100000-0000-4000-8000-000000000004', 'a2111111-1111-1111-1111-111111111111', now() - interval '5 hours', now() - interval '4 hours', 12.0, 5400, 'processed', 'a2-test-v1', 1, NULL, NULL),
  ('72100000-0000-4000-8000-000000000005', 'a2111111-1111-1111-1111-111111111111', now() - interval '4 hours', now() - interval '3 hours', 9.9, 4200, 'processing', 'a2-v1', 1, now() - interval '5 minutes', NULL),
  ('72100000-0000-4000-8000-000000000006', 'a2111111-1111-1111-1111-111111111111', now() - interval '45 minutes', now() - interval '10 minutes', 7.7, 3300, 'processing', 'a2-v1', 1, now() - interval '20 minutes', NULL),
  ('72100000-0000-4000-8000-000000000007', 'a2111111-1111-1111-1111-111111111111', now() - interval '6 hours', now() - interval '5 hours', 9.0, 4800, 'dead_letter', 'a2-v1', 5, now() - interval '30 minutes', NULL),
  ('72100000-0000-4000-8000-000000000008', 'a2111111-1111-1111-1111-111111111111', now() - interval '90 minutes', now() - interval '30 minutes', 2.5, 1500, 'pending', NULL, 1, NULL, now() + interval '10 minutes');

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
-- TEST-A2-DB-02 — claim service_role : contrat par IDs (au plus p_limit)
-- ----------------------------------------------------------------------------
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_eq(
  $$ SELECT id::text FROM public.a2_claim_pending_sessions(2) ORDER BY id $$,
  ARRAY['72100000-0000-4000-8000-000000000001', '72100000-0000-4000-8000-000000000002'],
  '2. DB-02. claim(2) réclame exactement les 2 pending les plus anciennes'
);
SELECT is(
  (SELECT count(*)::int FROM public.hike_sessions
   WHERE id IN ('72100000-0000-4000-8000-000000000001', '72100000-0000-4000-8000-000000000002')
     AND processing_status = 'processing' AND processing_attempts = 1),
  2,
  '3. DB-02. Les sessions réclamées passent en processing, attempts = 1'
);
SELECT is(
  (SELECT processing_status FROM public.hike_sessions WHERE id = '72100000-0000-4000-8000-000000000003'),
  'pending',
  '4. DB-02. La limite du lot est respectée (03 reste pending)'
);
SELECT is(
  (SELECT processing_status FROM public.hike_sessions WHERE id = '72100000-0000-4000-8000-000000000004'),
  'processed',
  '5. DB-02. Une session processed n''est jamais réclamée'
);

-- ----------------------------------------------------------------------------
-- TEST-A2-DB-03 — reprise : lease expiré seul, jamais un lease frais
-- ----------------------------------------------------------------------------
SELECT set_eq(
  $$ SELECT id::text FROM public.a2_claim_pending_sessions(5) ORDER BY id $$,
  ARRAY['72100000-0000-4000-8000-000000000003', '72100000-0000-4000-8000-000000000006'],
  '6. DB-03. Le 2e claim prend la pending restante et le lease expiré uniquement'
);
SELECT is(
  (SELECT processing_attempts FROM public.hike_sessions WHERE id = '72100000-0000-4000-8000-000000000005'),
  1,
  '7. DB-03. Un lease frais (05) n''est jamais repris ni incrémenté'
);
SELECT set_eq(
  $$ SELECT id::text FROM public.a2_claim_pending_sessions(5) $$,
  ARRAY[]::text[],
  '7bis. DB-03. Plus rien de dû : le 3e claim est vide'
);
SELECT is(
  (SELECT count(*)::int FROM public.hike_sessions
   WHERE id = '72100000-0000-4000-8000-000000000007' AND processing_status = 'dead_letter'),
  1,
  '7ter. DB-03. Une session dead_letter n''est jamais réclamée'
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
