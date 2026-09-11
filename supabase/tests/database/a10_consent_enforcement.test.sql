-- ============================================================================
-- A10 (10.7) — Consentement courant : dernière policy_version uniquement
--   • TEST-A10-CONS-DB-01 : dernière version accordée sans révocation ⇒ true
--   • TEST-A10-CONS-DB-02 : dernière version révoquée ⇒ false
--   • TEST-A10-CONS-DB-03 : ancienne version accordée, dernière révoquée ⇒ false
--   • TEST-A10-CONS-DB-04 : ancienne version révoquée, dernière accordée ⇒ true
--   • TEST-A10-CONS-DB-05 : aucune ligne / finalité inconnue ⇒ false
--   • TEST-A10-CONS-DB-06 : ancienne version accordée et non révoquée ne
--                           suffit jamais si une version plus récente existe
--   • TEST-A10-CONS-DB-07 : anon/authenticated interdits, service_role autorisé
--   • TEST-A10-CONS-DB-08 : claim = pending + failed (< 5), jamais processing/
--                           failed épuisé ; attempts incrémenté au claim
--   • TEST-A10-CONS-DB-09 : pas de double-claim d'une ligne déjà processing
--   • TEST-A10-CONS-DB-10 : un échec transitoire (failed + error) est rejoué
--   • TEST-A10-CONS-DB-11 : retry jusqu'au cap de 5 tentatives
--   • TEST-A10-CONS-DB-12 : à 5 tentatives, la ligne reste failed (terminal,
--                           erreur conservée — la purge ne redevient pas
--                           silencieusement impossible)
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(21);

-- ----------------------------------------------------------------------------
-- Fixtures
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a1010000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'a10_consent_1@test.local', 'x', '{}', '{}', now(), now()),
  ('a1010000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'a10_consent_2@test.local', 'x', '{}', '{}', now(), now()),
  ('a1010000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'a10_consent_3@test.local', 'x', '{}', '{}', now(), now()),
  ('a1010000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'a10_consent_4@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.adventure_data_consents
  (user_id, purpose, granted, policy_version, granted_at, revoked_at)
VALUES
  -- 01 : accord courant
  ('a1010000-0000-4000-8000-000000000001', 'personal_performance', true, 'a1-v1', now(), NULL),
  -- 02 : révocation courante
  ('a1010000-0000-4000-8000-000000000002', 'personal_performance', false, 'a1-v1', NULL, now()),
  -- 03 : ancienne version accordée, dernière version révoquée
  ('a1010000-0000-4000-8000-000000000003', 'personal_performance', true, 'a1-v1', now() - interval '10 days', NULL),
  ('a1010000-0000-4000-8000-000000000003', 'personal_performance', false, 'a1-v2', NULL, now()),
  -- 04 : ancienne version révoquée, dernière version accordée
  ('a1010000-0000-4000-8000-000000000004', 'personal_performance', false, 'a1-v1', NULL, now() - interval '10 days'),
  ('a1010000-0000-4000-8000-000000000004', 'personal_performance', true, 'a1-v2', now(), NULL);

-- File d'événements : pending neuf, failed réessayable, failed épuisé (terminal)
-- et processing en vol (worker actif, non réclamable).
INSERT INTO public.adventure_domain_events
  (id, event_type, entity_type, entity_id, actor_id, payload, status,
   processor_version, idempotency_key, attempts, error)
VALUES
  ('a1070000-0000-4000-8000-000000000001', 'consent.revoked', 'adventure_data_consent',
   'a1010000-0000-4000-8000-000000000001:personal_performance',
   'a1010000-0000-4000-8000-000000000001', '{}', 'pending',
   'a10-consent-v1', 'a10-cons-db:pending', 0, NULL),
  ('a1070000-0000-4000-8000-000000000002', 'consent.revoked', 'adventure_data_consent',
   'a1010000-0000-4000-8000-000000000002:personal_performance',
   'a1010000-0000-4000-8000-000000000002', '{}', 'failed',
   'a10-consent-v1', 'a10-cons-db:retryable', 1, 'rpc indisponible'),
  ('a1070000-0000-4000-8000-000000000003', 'consent.revoked', 'adventure_data_consent',
   'a1010000-0000-4000-8000-000000000003:personal_performance',
   'a1010000-0000-4000-8000-000000000003', '{}', 'failed',
   'a10-consent-v1', 'a10-cons-db:exhausted', 5, 'purge indisponible'),
  ('a1070000-0000-4000-8000-000000000004', 'consent.revoked', 'adventure_data_consent',
   'a1010000-0000-4000-8000-000000000004:personal_performance',
   'a1010000-0000-4000-8000-000000000004', '{}', 'processing',
   'a10-consent-v1', 'a10-cons-db:inflight', 2, NULL);

-- ----------------------------------------------------------------------------
-- TEST-A10-CONS-DB-01..05
-- ----------------------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT ok(
  public.has_active_consent('a1010000-0000-4000-8000-000000000001', 'personal_performance'),
  '1. DB-01. Dernière version accordée sans révocation ⇒ true'
);
SELECT ok(
  NOT public.has_active_consent('a1010000-0000-4000-8000-000000000002', 'personal_performance'),
  '2. DB-02. Dernière version révoquée ⇒ false'
);
SELECT ok(
  NOT public.has_active_consent('a1010000-0000-4000-8000-000000000003', 'personal_performance'),
  '3. DB-03. Ancienne version accordée mais dernière révoquée ⇒ false'
);
SELECT ok(
  public.has_active_consent('a1010000-0000-4000-8000-000000000004', 'personal_performance'),
  '4. DB-04. Dernière version accordée ⇒ true malgré une ancienne révocation'
);
SELECT ok(
  NOT public.has_active_consent('a1010000-0000-4000-8000-000000000001', 'collective_terrain'),
  '5. DB-05. Finalité sans ligne ⇒ false'
);
SELECT ok(
  NOT public.has_active_consent(gen_random_uuid(), 'personal_performance'),
  '6. DB-05. Utilisateur sans aucun consentement ⇒ false'
);
SELECT ok(
  NOT public.has_active_consent('a1010000-0000-4000-8000-000000000003', 'external_readiness'),
  '7. DB-06. Une finalité inconnue ne bénéficie jamais d''un accord implicite'
);

-- ----------------------------------------------------------------------------
-- TEST-A10-CONS-DB-07 — service_role uniquement
-- ----------------------------------------------------------------------------
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.has_active_consent('a1010000-0000-4000-8000-000000000001', 'personal_performance') $$,
  'permission denied for function has_active_consent',
  '8. DB-07. authenticated ne peut pas lire le consentement courant'
);

RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.has_active_consent('a1010000-0000-4000-8000-000000000001', 'personal_performance') $$,
  'permission denied for function has_active_consent',
  '9. DB-07. anon ne peut pas lire le consentement courant'
);

-- ----------------------------------------------------------------------------
-- TEST-A10-CONS-DB-08..12 — reprise fiable de la file (purge RGPD)
-- ----------------------------------------------------------------------------
RESET ROLE;
SET LOCAL ROLE service_role;

SELECT is(
  (SELECT count(*)::int FROM public.claim_pending_adventure_events(10)),
  2,
  '10. DB-08. claim réclame pending + failed (< 5), jamais processing ni failed épuisé'
);
SELECT is(
  (SELECT attempts FROM public.adventure_domain_events WHERE id = 'a1070000-0000-4000-8000-000000000001'),
  1,
  '11. DB-08. Une ligne pending voit attempts incrémenté au claim (0 → 1)'
);
SELECT is(
  (SELECT attempts FROM public.adventure_domain_events WHERE id = 'a1070000-0000-4000-8000-000000000002'),
  2,
  '12. DB-08. Une ligne failed réessayable voit attempts incrémenté (1 → 2)'
);
SELECT is(
  (SELECT status FROM public.adventure_domain_events WHERE id = 'a1070000-0000-4000-8000-000000000001'),
  'processing',
  '13. DB-08. Les lignes réclamées passent en processing'
);
SELECT ok(
  (SELECT attempts = 2 AND status = 'processing'
   FROM public.adventure_domain_events WHERE id = 'a1070000-0000-4000-8000-000000000004'),
  '14. DB-08. Un événement processing en vol n''est ni réclamé ni modifié'
);
SELECT ok(
  (SELECT attempts = 5 AND status = 'failed'
   FROM public.adventure_domain_events WHERE id = 'a1070000-0000-4000-8000-000000000003'),
  '15. DB-08. Un failed à 5 tentatives reste failed (terminal), jamais réclamé'
);
SELECT is(
  (SELECT count(*)::int FROM public.claim_pending_adventure_events(10)),
  0,
  '16. DB-09. Pas de double-claim : les lignes déjà processing ne repartent pas'
);

-- Chemin d'échec applicatif : status = 'failed' + error, donc réessayable.
UPDATE public.adventure_domain_events
SET status = 'failed', error = 'rpc indisponible'
WHERE id IN ('a1070000-0000-4000-8000-000000000001', 'a1070000-0000-4000-8000-000000000002');

SELECT is(
  (SELECT count(*)::int FROM public.claim_pending_adventure_events(10)),
  2,
  '17. DB-10. Un échec transitoire (failed + error) est rejoué au claim suivant'
);

-- Montée jusqu'au cap : attempts 4 → claim → 5.
UPDATE public.adventure_domain_events
SET attempts = 4, status = 'failed', error = 'rpc indisponible'
WHERE id = 'a1070000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT count(*)::int FROM public.claim_pending_adventure_events(10)),
  1,
  '18. DB-11. La dernière tentative disponible (attempts 4) est bien réclamée'
);
SELECT is(
  (SELECT attempts FROM public.adventure_domain_events WHERE id = 'a1070000-0000-4000-8000-000000000001'),
  5,
  '19. DB-11. attempts atteint le cap de 5'
);

-- Échec à la 5e tentative : la ligne reste failed, plus jamais réclamée.
UPDATE public.adventure_domain_events
SET status = 'failed', error = 'rpc indisponible (cap)'
WHERE id = 'a1070000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT count(*)::int FROM public.claim_pending_adventure_events(10)),
  0,
  '20. DB-12. À 5 tentatives, la ligne n''est plus jamais réclamée'
);
SELECT ok(
  (SELECT status = 'failed' AND attempts = 5 AND error = 'rpc indisponible (cap)'
   FROM public.adventure_domain_events WHERE id = 'a1070000-0000-4000-8000-000000000001'),
  '21. DB-12. L''état terminal reste failed avec son erreur (traçable, pas de purge silencieuse)'
);

SELECT * FROM finish();
ROLLBACK;
