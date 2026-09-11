-- ============================================================================
-- A10 (10.5) — Lease, retry et dead-letter des sessions GPS
--   • TEST-A10-LEASE-DB-01 : claim réserve les pending dues (next_retry_at passé/null)
--   • TEST-A10-LEASE-DB-02 : attempts + processing_started_at posés au claim
--   • TEST-A10-LEASE-DB-03 : une reprise future (next_retry_at) n'est pas réclamée
--   • TEST-A10-LEASE-DB-04 : un lease expiré est repris, attempts incrémenté
--   • TEST-A10-LEASE-DB-05 : un lease expiré à attempts >= 5 passe en dead_letter
--   • TEST-A10-LEASE-DB-06 : pas de double-claim d'un lease frais
--   • TEST-A10-LEASE-DB-07 : claim réservé à service_role
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
-- Replay local : les grants par défaut service_role de la prod ne sont pas
-- garantis ; on les pose explicitement pour un test déterministe.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hike_sessions TO service_role;
SELECT plan(12);

-- ----------------------------------------------------------------------------
-- Fixtures
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a1011111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'a10_lease@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.hike_sessions (
  id, user_id, started_at, ended_at, distance_km, duration_seconds,
  processing_status, processor_version, processing_attempts,
  processing_started_at, next_retry_at
)
VALUES
  -- 01 : pending due, jamais tentée
  ('7a100000-0000-4000-8000-00000000000a', 'a1011111-1111-1111-1111-111111111111', now() - interval '5 hours', now() - interval '4 hours', 8.0, 3600, 'pending', NULL, 0, NULL, NULL),
  -- 02 : pending avec reprise programmée dans le futur
  ('7a100000-0000-4000-8000-00000000000b', 'a1011111-1111-1111-1111-111111111111', now() - interval '4 hours', now() - interval '3 hours', 6.0, 3000, 'pending', 'a2-v1', 1, NULL, now() + interval '10 minutes'),
  -- 03 : processing dont le lease a expiré, tentative 2
  ('7a100000-0000-4000-8000-00000000000c', 'a1011111-1111-1111-1111-111111111111', now() - interval '3 hours', now() - interval '2 hours', 5.0, 2400, 'processing', 'a2-v1', 2, now() - interval '20 minutes', NULL),
  -- 04 : processing expiré, tentatives épuisées
  ('7a100000-0000-4000-8000-00000000000d', 'a1011111-1111-1111-1111-111111111111', now() - interval '2 hours', now() - interval '1 hour', 4.0, 1800, 'processing', 'a2-v1', 5, now() - interval '20 minutes', NULL),
  -- 05 : déjà terminal
  ('7a100000-0000-4000-8000-00000000000e', 'a1011111-1111-1111-1111-111111111111', now() - interval '1 hour', now(), 3.0, 1200, 'dead_letter', 'a2-v1', 5, now() - interval '1 hour', NULL);

-- ----------------------------------------------------------------------------
-- TEST-A10-LEASE-DB-01..02 — claim des pending dues
-- ----------------------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT is(
  (SELECT count(*)::int FROM public.a2_claim_pending_sessions(10)),
  3,
  '1. DB-01. claim(10) réserve la pending due, le lease expiré et le lease épuisé (dead-letter)'
);
SELECT is(
  (SELECT processing_status FROM public.hike_sessions WHERE id = '7a100000-0000-4000-8000-00000000000a'),
  'processing',
  '2. DB-01. La session pending due passe en processing'
);
SELECT is(
  (SELECT processing_attempts FROM public.hike_sessions WHERE id = '7a100000-0000-4000-8000-00000000000a'),
  1,
  '3. DB-02. processing_attempts est incrémenté à 1'
);
SELECT ok(
  (SELECT processing_started_at IS NOT NULL FROM public.hike_sessions WHERE id = '7a100000-0000-4000-8000-00000000000a'),
  '4. DB-02. processing_started_at (lease) est posé'
);

-- ----------------------------------------------------------------------------
-- TEST-A10-LEASE-DB-03 — la reprise future n'est pas réclamée
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT processing_status FROM public.hike_sessions WHERE id = '7a100000-0000-4000-8000-00000000000b'),
  'pending',
  '5. DB-03. next_retry_at futur : la session reste pending'
);

-- ----------------------------------------------------------------------------
-- TEST-A10-LEASE-DB-04 — reprise d'un lease expiré
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT processing_attempts FROM public.hike_sessions WHERE id = '7a100000-0000-4000-8000-00000000000c'),
  3,
  '6. DB-04. Le lease expiré est repris et attempts passe à 3'
);
SELECT ok(
  (SELECT processing_started_at > now() - interval '1 minute' FROM public.hike_sessions WHERE id = '7a100000-0000-4000-8000-00000000000c'),
  '7. DB-04. Le lease est rafraîchi à now()'
);

-- ----------------------------------------------------------------------------
-- TEST-A10-LEASE-DB-05 — dead-letter des leases épuisés
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT processing_status FROM public.hike_sessions WHERE id = '7a100000-0000-4000-8000-00000000000d'),
  'dead_letter',
  '8. DB-05. Le lease expiré à attempts >= 5 passe en dead_letter'
);
SELECT ok(
  (SELECT last_processing_error IS NOT NULL FROM public.hike_sessions WHERE id = '7a100000-0000-4000-8000-00000000000d'),
  '9. DB-05. last_processing_error est renseigné'
);

-- ----------------------------------------------------------------------------
-- TEST-A10-LEASE-DB-06 — pas de double-claim d'un lease frais
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM public.a2_claim_pending_sessions(10)),
  0,
  '10. DB-06. Aucun double-claim immédiat des leases frais'
);

-- ----------------------------------------------------------------------------
-- TEST-A10-LEASE-DB-07 — service_role uniquement
-- ----------------------------------------------------------------------------
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.a2_claim_pending_sessions(5) $$,
  'permission denied for function a2_claim_pending_sessions',
  '11. DB-07. authenticated ne peut pas réclamer des sessions'
);

-- Le statut terminal est accepté par la contrainte étendue.
RESET ROLE;
SET LOCAL ROLE service_role;
WITH moved AS (
  UPDATE public.hike_sessions
  SET processing_status = 'dead_letter'
  WHERE id = '7a100000-0000-4000-8000-00000000000b'
  RETURNING processing_status
)
SELECT is(
  (SELECT processing_status FROM moved),
  'dead_letter',
  '12. DB-07. Le CHECK accepte le statut dead_letter'
);

SELECT * FROM finish();
ROLLBACK;
