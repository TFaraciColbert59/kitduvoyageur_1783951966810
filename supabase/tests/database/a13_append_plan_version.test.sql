-- ============================================================================
-- A13 (S3) — Append transactionnel d'une version de plan (groupe/trek)
--   • TEST-A13-APPEND-DB-01 : append propriétaire ⇒ version suivante réelle
--   • TEST-A13-APPEND-DB-02 : snapshot.currentVersion forcé par la base
--   • TEST-A13-APPEND-DB-03 : append successif ⇒ version +1 (pas de collision)
--   • TEST-A13-APPEND-DB-04 : refus non-propriétaire, aucune écriture
--   • TEST-A13-APPEND-DB-05 : plan inconnu / payload incomplet refusés
--   • TEST-A13-APPEND-DB-06 : SECURITY DEFINER, search_path verrouillé, service_role
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
-- Replay local : grants explicites (défauts prod non garantis).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adventure_plans, public.adventure_plan_versions TO service_role, authenticated;
GRANT USAGE ON SCHEMA public TO service_role, authenticated;
SELECT plan(17);

-- ----------------------------------------------------------------------------
-- Fixtures — propriétaire, tiers, plan + version initiale (aucune donnée perso)
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a13e0000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'a13_append_owner@test.local', 'x', '{}', '{}', now(), now()),
  ('a13e0000-0000-4000-8000-0000000000b3', 'authenticated', 'authenticated', 'a13_append_other@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.adventure_plans (id, owner_id, title, status, current_version)
VALUES (
  'a13e0000-0000-4000-8000-0000000000b1',
  'a13e0000-0000-4000-8000-0000000000b2',
  'A13 — plan de test append',
  'draft',
  1
);

INSERT INTO public.adventure_plan_versions (plan_id, version, snapshot, reason, generated_by)
VALUES (
  'a13e0000-0000-4000-8000-0000000000b1',
  1,
  '{"id":"a13e0000-0000-4000-8000-0000000000b1","currentVersion":1}'::jsonb,
  'Génération initiale',
  'a6-orchestrator'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-APPEND-DB-01/02 — append propriétaire : version 2 + snapshot forcé
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT public.a13_append_plan_version(
    'a13e0000-0000-4000-8000-0000000000b2'::uuid,
    'a13e0000-0000-4000-8000-0000000000b1'::uuid,
    $jv1${"version":99,"snapshot":{"id":"a13e0000-0000-4000-8000-0000000000b1","currentVersion":99,"groupPlan":{"memberCount":2}},"reason":"group-computed","generated_by":"a13-group","confidence":{"score":0.5},"created_at":"2026-09-11T12:00:00.000Z"}$jv1$::jsonb
  )),
  2,
  '1. DB-01. Le propriétaire ajoute la version 2'
);

SELECT is(
  (SELECT count(*)::int FROM public.adventure_plan_versions
   WHERE plan_id = 'a13e0000-0000-4000-8000-0000000000b1'
     AND version = 2
     AND reason = 'group-computed'
     AND generated_by = 'a13-group'),
  1,
  '2. DB-01. La version 2 est insérée avec raison et auteur'
);

SELECT is(
  (SELECT snapshot->>'currentVersion' FROM public.adventure_plan_versions
   WHERE plan_id = 'a13e0000-0000-4000-8000-0000000000b1' AND version = 2),
  '2',
  '3. DB-02. snapshot.currentVersion est forcé à la version réelle (99 ignoré)'
);

SELECT is(
  (SELECT snapshot->'groupPlan'->>'memberCount' FROM public.adventure_plan_versions
   WHERE plan_id = 'a13e0000-0000-4000-8000-0000000000b1' AND version = 2),
  '2',
  '4. DB-02. Le payload groupe est conservé tel quel'
);

SELECT is(
  (SELECT current_version FROM public.adventure_plans
   WHERE id = 'a13e0000-0000-4000-8000-0000000000b1'),
  2,
  '5. DB-02. adventure_plans.current_version passe à 2'
);

SELECT ok(
  (SELECT updated_at >= created_at FROM public.adventure_plans
   WHERE id = 'a13e0000-0000-4000-8000-0000000000b1'),
  '6. DB-02. updated_at est rafraîchi'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-APPEND-DB-03 — append successif : version 3
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT public.a13_append_plan_version(
    'a13e0000-0000-4000-8000-0000000000b2'::uuid,
    'a13e0000-0000-4000-8000-0000000000b1'::uuid,
    $jv2${"snapshot":{"id":"a13e0000-0000-4000-8000-0000000000b1","trekPlan":{"worstDay":2}},"reason":"trek-computed"}$jv2$::jsonb
  )),
  3,
  '7. DB-03. Un second append obtient la version 3'
);

SELECT is(
  (SELECT count(*)::int FROM public.adventure_plan_versions
   WHERE plan_id = 'a13e0000-0000-4000-8000-0000000000b1'),
  3,
  '8. DB-03. Trois versions au total (initiale + groupe + trek)'
);

SELECT is(
  (SELECT generated_by FROM public.adventure_plan_versions
   WHERE plan_id = 'a13e0000-0000-4000-8000-0000000000b1' AND version = 3),
  'a13-append',
  '9. DB-03. generated_by par défaut = a13-append quand absent'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-APPEND-DB-04 — refus non-propriétaire : aucune écriture
-- ----------------------------------------------------------------------------
SELECT throws_like(
  $$ SELECT public.a13_append_plan_version(
       'a13e0000-0000-4000-8000-0000000000b3'::uuid,
       'a13e0000-0000-4000-8000-0000000000b1'::uuid,
       '{"snapshot":{"id":"a13e0000-0000-4000-8000-0000000000b1"},"reason":"group-computed"}'::jsonb
     ) $$,
  '%non détenu%',
  '10. DB-04. Un tiers non propriétaire est refusé explicitement'
);

SELECT is(
  (SELECT count(*)::int FROM public.adventure_plan_versions
   WHERE plan_id = 'a13e0000-0000-4000-8000-0000000000b1'),
  3,
  '11. DB-04. Le refus n’a laissé aucune version derrière lui'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-APPEND-DB-05 — plan inconnu / payload incomplet
-- ----------------------------------------------------------------------------
SELECT throws_like(
  $$ SELECT public.a13_append_plan_version(
       'a13e0000-0000-4000-8000-0000000000b2'::uuid,
       'a13e0000-0000-4000-8000-0000000000ff'::uuid,
       '{"snapshot":{},"reason":"group-computed"}'::jsonb
     ) $$,
  '%introuvable%',
  '12. DB-05. Un plan inconnu est refusé explicitement'
);

SELECT throws_like(
  $$ SELECT public.a13_append_plan_version(
       'a13e0000-0000-4000-8000-0000000000b2'::uuid,
       'a13e0000-0000-4000-8000-0000000000b1'::uuid,
       '{"reason":"group-computed"}'::jsonb
     ) $$,
  '%snapshot%',
  '13. DB-05. Un payload sans snapshot est refusé'
);

SELECT throws_like(
  $$ SELECT public.a13_append_plan_version(
       'a13e0000-0000-4000-8000-0000000000b2'::uuid,
       'a13e0000-0000-4000-8000-0000000000b1'::uuid,
       '{"snapshot":{}}'::jsonb
     ) $$,
  '%reason%',
  '14. DB-05. Un payload sans raison est refusé'
);

-- ----------------------------------------------------------------------------
-- TEST-A13-APPEND-DB-06 — SECURITY DEFINER, search_path verrouillé, service_role
-- ----------------------------------------------------------------------------
SELECT ok(
  (SELECT p.prosecdef
   FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'a13_append_plan_version'),
  '15. DB-06. La RPC est SECURITY DEFINER'
);

SELECT ok(
  (SELECT EXISTS (
     SELECT 1 FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS c
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'a13_append_plan_version'
       AND c LIKE 'search_path=%'
   )),
  '16. DB-06. search_path est verrouillé'
);

SELECT ok(
  has_function_privilege(
    'service_role'::name,
    'public.a13_append_plan_version(uuid,uuid,jsonb)'::text,
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon'::name,
    'public.a13_append_plan_version(uuid,uuid,jsonb)'::text,
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated'::name,
    'public.a13_append_plan_version(uuid,uuid,jsonb)'::text,
    'EXECUTE'
  ),
  '17. DB-06. EXECUTE réservé à service_role (anon/authenticated révoqués)'
);

SELECT * FROM finish();
ROLLBACK;
