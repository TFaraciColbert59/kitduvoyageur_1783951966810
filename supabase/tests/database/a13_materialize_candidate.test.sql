-- ============================================================================
-- A13 (S2) — Matérialisation transactionnelle d'un candidat sélectionné
--   • TEST-A13-MAT-DB-01 : matérialisation propriétaire ⇒ version suivante
--   • TEST-A13-MAT-DB-02 : version + current_version + décision atomiques
--   • TEST-A13-MAT-DB-03 : idempotence (même candidateId ⇒ même version, 1 ligne)
--   • TEST-A13-MAT-DB-04 : candidat suivant ⇒ version suivante réelle
--   • TEST-A13-MAT-DB-05 : refus non-propriétaire, aucune écriture
--   • TEST-A13-MAT-DB-06 : plan inconnu / candidateId manquant refusés
--   • TEST-A13-MAT-DB-07 : SECURITY DEFINER, search_path verrouillé, service_role
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
-- Replay local : grants explicites (défauts prod non garantis).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adventure_plans, public.adventure_plan_versions, public.adventure_plan_decisions TO service_role, authenticated;
GRANT USAGE ON SCHEMA public TO service_role, authenticated;
SELECT plan(19);

-- ----------------------------------------------------------------------------
-- Fixtures — propriétaire, tiers, plan + version initiale (aucune donnée perso)
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a13d0000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'a13_mat_owner@test.local', 'x', '{}', '{}', now(), now()),
  ('a13d0000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'a13_mat_other@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.adventure_plans (id, owner_id, title, status, current_version)
VALUES (
  'a13d0000-0000-4000-8000-0000000000a1',
  'a13d0000-0000-4000-8000-0000000000a2',
  'A13 — plan de test matérialisation',
  'draft',
  1
);

INSERT INTO public.adventure_plan_versions (plan_id, version, snapshot, reason, generated_by)
VALUES (
  'a13d0000-0000-4000-8000-0000000000a1',
  1,
  '{"id":"a13d0000-0000-4000-8000-0000000000a1","currentVersion":1}'::jsonb,
  'Génération initiale',
  'a6-orchestrator'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-MAT-DB-01/02 — matérialisation propriétaire : version suivante
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT public.a13_materialize_candidate(
    'a13d0000-0000-4000-8000-0000000000a2'::uuid,
    'a13d0000-0000-4000-8000-0000000000a1'::uuid,
    $jv1${"version":2,"snapshot":{"id":"a13d0000-0000-4000-8000-0000000000a1","candidateId":"comfort","currentVersion":2},"reason":"Sélection variante Confort (A13)","generated_by":"a13-select","confidence":{"score":0.6},"created_at":"2026-09-11T12:00:00.000Z"}$jv1$::jsonb,
    $jd1${"proposal":"Variante Confort sélectionnée (A13).","impact":[],"requires_confirmation":false,"created_at":"2026-09-11T12:00:00.000Z"}$jd1$::jsonb
  )),
  2,
  '1. DB-01. Le propriétaire matérialise le candidat comfort en version 2'
);

SELECT is(
  (SELECT current_version FROM public.adventure_plans
   WHERE id = 'a13d0000-0000-4000-8000-0000000000a1'),
  2,
  '2. DB-02. adventure_plans.current_version passe à 2'
);

SELECT is(
  (SELECT count(*)::int FROM public.adventure_plan_versions
   WHERE plan_id = 'a13d0000-0000-4000-8000-0000000000a1'
     AND version = 2
     AND snapshot->>'candidateId' = 'comfort'),
  1,
  '3. DB-02. La version 2 est insérée avec le snapshot du candidat comfort'
);

SELECT is(
  (SELECT count(*)::int FROM public.adventure_plan_decisions
   WHERE plan_id = 'a13d0000-0000-4000-8000-0000000000a1'
     AND decision_type = 'other'
     AND status = 'confirmed'
     AND decided_by = 'a13d0000-0000-4000-8000-0000000000a2'),
  1,
  '4. DB-02. La décision confirmée est insérée dans la même transaction'
);

SELECT ok(
  (SELECT updated_at >= created_at FROM public.adventure_plans
   WHERE id = 'a13d0000-0000-4000-8000-0000000000a1'),
  '5. DB-02. updated_at est rafraîchi par la matérialisation'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-MAT-DB-03 — idempotence : rejouer comfort ne duplique rien
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT public.a13_materialize_candidate(
    'a13d0000-0000-4000-8000-0000000000a2'::uuid,
    'a13d0000-0000-4000-8000-0000000000a1'::uuid,
    $jv2${"version":3,"snapshot":{"id":"a13d0000-0000-4000-8000-0000000000a1","candidateId":"comfort","currentVersion":3},"reason":"Rejeu sélection Confort (A13)","generated_by":"a13-select","confidence":{"score":0.6},"created_at":"2026-09-11T13:00:00.000Z"}$jv2$::jsonb,
    $jd2${"proposal":"Rejeu Confort (A13).","impact":[],"requires_confirmation":false}$jd2$::jsonb
  )),
  2,
  '6. DB-03. Rejouer le même candidateId renvoie la version existante (2)'
);

SELECT is(
  (SELECT count(*)::int FROM public.adventure_plan_versions
   WHERE plan_id = 'a13d0000-0000-4000-8000-0000000000a1'
     AND snapshot->>'candidateId' = 'comfort'),
  1,
  '7. DB-03. Aucune version dupliquée pour comfort'
);

SELECT is(
  (SELECT count(*)::int FROM public.adventure_plan_decisions
   WHERE plan_id = 'a13d0000-0000-4000-8000-0000000000a1'),
  1,
  '8. DB-03. Aucune décision dupliquée sur rejeu'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-MAT-DB-04 — un autre candidat obtient la version suivante
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT public.a13_materialize_candidate(
    'a13d0000-0000-4000-8000-0000000000a2'::uuid,
    'a13d0000-0000-4000-8000-0000000000a1'::uuid,
    $jv3${"version":3,"snapshot":{"id":"a13d0000-0000-4000-8000-0000000000a1","candidateId":"balanced","currentVersion":3},"reason":"Sélection variante Équilibré (A13)","generated_by":"a13-select","confidence":{"score":0.6},"created_at":"2026-09-11T14:00:00.000Z"}$jv3$::jsonb,
    $jd3${"proposal":"Variante Équilibré sélectionnée (A13).","impact":[],"requires_confirmation":false}$jd3$::jsonb
  )),
  3,
  '9. DB-04. Le candidat balanced obtient la version 3'
);

SELECT is(
  (SELECT count(*)::int FROM public.adventure_plan_versions
   WHERE plan_id = 'a13d0000-0000-4000-8000-0000000000a1'),
  3,
  '10. DB-04. Trois versions au total (initiale + comfort + balanced)'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-MAT-DB-05 — refus non-propriétaire : aucune écriture
-- ----------------------------------------------------------------------------
SELECT throws_like(
  $$ SELECT public.a13_materialize_candidate(
       'a13d0000-0000-4000-8000-0000000000a3'::uuid,
       'a13d0000-0000-4000-8000-0000000000a1'::uuid,
       '{"version":4,"snapshot":{"candidateId":"adventure"}}'::jsonb,
       '{}'::jsonb
     ) $$,
  '%non détenu%',
  '11. DB-05. Un tiers non propriétaire est refusé explicitement'
);

SELECT is(
  (SELECT count(*)::int FROM public.adventure_plan_versions
   WHERE plan_id = 'a13d0000-0000-4000-8000-0000000000a1'),
  3,
  '12. DB-05. Le refus n’a laissé aucune version derrière lui'
);

SELECT is(
  (SELECT current_version FROM public.adventure_plans
   WHERE id = 'a13d0000-0000-4000-8000-0000000000a1'),
  3,
  '13. DB-05. current_version reste inchangé après refus'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-MAT-DB-06 — plan inconnu / candidateId manquant
-- ----------------------------------------------------------------------------
SELECT throws_like(
  $$ SELECT public.a13_materialize_candidate(
       'a13d0000-0000-4000-8000-0000000000a2'::uuid,
       'a13d0000-0000-4000-8000-0000000000ff'::uuid,
       '{"snapshot":{"candidateId":"comfort"}}'::jsonb,
       '{}'::jsonb
     ) $$,
  '%introuvable%',
  '14. DB-06. Un plan inconnu est refusé explicitement'
);

SELECT throws_like(
  $$ SELECT public.a13_materialize_candidate(
       'a13d0000-0000-4000-8000-0000000000a2'::uuid,
       'a13d0000-0000-4000-8000-0000000000a1'::uuid,
       '{"snapshot":{"id":"a13d0000-0000-4000-8000-0000000000a1"}}'::jsonb,
       '{}'::jsonb
     ) $$,
  '%candidateId%',
  '15. DB-06. Un snapshot sans candidateId est refusé (pas de sélection implicite)'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-MAT-DB-07 — SECURITY DEFINER, search_path verrouillé, service_role
-- ----------------------------------------------------------------------------
SELECT ok(
  (SELECT p.prosecdef
   FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'a13_materialize_candidate'),
  '16. DB-07. La RPC est SECURITY DEFINER'
);

SELECT ok(
  (SELECT EXISTS (
     SELECT 1 FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS c
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'a13_materialize_candidate'
       AND c LIKE 'search_path=%'
   )),
  '17. DB-07. search_path est verrouillé'
);

SELECT ok(
  has_function_privilege(
    'service_role'::name,
    'public.a13_materialize_candidate(uuid,uuid,jsonb,jsonb)'::text,
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon'::name,
    'public.a13_materialize_candidate(uuid,uuid,jsonb,jsonb)'::text,
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated'::name,
    'public.a13_materialize_candidate(uuid,uuid,jsonb,jsonb)'::text,
    'EXECUTE'
  ),
  '18. DB-07. EXECUTE réservé à service_role (anon/authenticated révoqués)'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a13d0000-0000-4000-8000-0000000000a2';
SELECT throws_ok(
  $$ SELECT public.a13_materialize_candidate(
       'a13d0000-0000-4000-8000-0000000000a2'::uuid,
       'a13d0000-0000-4000-8000-0000000000a1'::uuid,
       '{"snapshot":{"candidateId":"adventure"}}'::jsonb,
       '{}'::jsonb
     ) $$,
  '42501'::char(5),
  NULL::text,
  '19. DB-07. Même le propriétaire ne peut pas matérialiser en direct : service_role uniquement'
);

SELECT * FROM finish();
ROLLBACK;
