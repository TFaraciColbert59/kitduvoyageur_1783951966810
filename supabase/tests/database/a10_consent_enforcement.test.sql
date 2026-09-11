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
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(9);

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

SELECT * FROM finish();
ROLLBACK;
