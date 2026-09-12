-- ============================================================================
-- Phase 2 — Attachement d'un plan Adventure au voyage (anti plans orphelins)
--   • TEST-PHASE2-ATTACH-01 : RPC présente, SECURITY DEFINER, authenticated
--   • TEST-PHASE2-ATTACH-02 : attachement propriétaire ⇒ plan + corrélation
--   • TEST-PHASE2-ATTACH-03 : idempotence sur le même voyage, corrélation gardée
--   • TEST-PHASE2-ATTACH-04 : refus non-propriétaire (plan et voyage)
--   • TEST-PHASE2-ATTACH-05 : refus d'un plan déjà attaché à un autre voyage
--   • TEST-PHASE2-ATTACH-06 : entrées absentes / nulle refusées, génération uuid
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
-- Replay local : grants explicites (défauts prod non garantis).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adventure_plans, public.trips TO service_role, authenticated;
GRANT USAGE ON SCHEMA public TO service_role, authenticated;
SELECT plan(21);

-- ----------------------------------------------------------------------------
-- TEST-PHASE2-ATTACH-01 — signature, sûreté, privilèges
-- ----------------------------------------------------------------------------
SELECT has_function(
  'public', 'attach_adventure_plan_to_trip', ARRAY['uuid', 'uuid', 'uuid'],
  '1. ATTACH-01. La RPC attach_adventure_plan_to_trip existe'
);
SELECT ok(
  (SELECT p.prosecdef
   FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'attach_adventure_plan_to_trip'),
  '2. ATTACH-01. La RPC est SECURITY DEFINER'
);
SELECT ok(
  (SELECT EXISTS (
     SELECT 1 FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS c
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'attach_adventure_plan_to_trip'
       AND c LIKE 'search_path=%'
   ))
  AND has_function_privilege(
    'authenticated'::name,
    'public.attach_adventure_plan_to_trip(uuid,uuid,uuid)'::text,
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon'::name,
    'public.attach_adventure_plan_to_trip(uuid,uuid,uuid)'::text,
    'EXECUTE'
  ),
  '3. ATTACH-01. search_path verrouillé, EXECUTE authenticated (anon révoqué)'
);

-- ----------------------------------------------------------------------------
-- Fixtures — propriétaire, tiers, voyages, plans (aucune donnée perso)
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('f2a60000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'phase2_attach_owner@test.local', 'x', '{}', '{}', now(), now()),
  ('f2a60000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'phase2_attach_other@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.trips (id, slug, title, user_id, visibility)
VALUES
  ('f2a60000-0000-4000-8000-0000000000b1', 'phase2-attach-trip-owner',   'Phase 2 — voyage propriétaire', 'f2a60000-0000-4000-8000-0000000000a2', 'private'),
  ('f2a60000-0000-4000-8000-0000000000b2', 'phase2-attach-trip-other',   'Phase 2 — voyage tiers',        'f2a60000-0000-4000-8000-0000000000a3', 'private'),
  ('f2a60000-0000-4000-8000-0000000000b3', 'phase2-attach-trip-second',  'Phase 2 — second voyage',       'f2a60000-0000-4000-8000-0000000000a2', 'private');

INSERT INTO public.adventure_plans (id, owner_id, trip_id, title, status, current_version)
VALUES
  ('f2a60000-0000-4000-8000-0000000000c1', 'f2a60000-0000-4000-8000-0000000000a2', NULL, 'Phase 2 — plan orphelin', 'draft', 1),
  ('f2a60000-0000-4000-8000-0000000000c2', 'f2a60000-0000-4000-8000-0000000000a2', 'f2a60000-0000-4000-8000-0000000000b3', 'Phase 2 — plan déjà attaché', 'draft', 1),
  ('f2a60000-0000-4000-8000-0000000000c3', 'f2a60000-0000-4000-8000-0000000000a2', NULL, 'Phase 2 — plan corrélation générée', 'draft', 1),
  ('f2a60000-0000-4000-8000-0000000000c4', 'f2a60000-0000-4000-8000-0000000000a3', NULL, 'Phase 2 — plan du tiers', 'draft', 1);

-- ----------------------------------------------------------------------------
-- TEST-PHASE2-ATTACH-02 — attachement propriétaire
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '';
SELECT throws_like(
  $$ SELECT public.attach_adventure_plan_to_trip(
       'f2a60000-0000-4000-8000-0000000000c1'::uuid,
       'f2a60000-0000-4000-8000-0000000000b1'::uuid,
       NULL::uuid
     ) $$,
  '%authentification requise%',
  '4. ATTACH-02. Sans auth.uid(), la commande est refusée'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f2a60000-0000-4000-8000-0000000000a2';
SELECT is(
  (SELECT public.attach_adventure_plan_to_trip(
    'f2a60000-0000-4000-8000-0000000000c1'::uuid,
    'f2a60000-0000-4000-8000-0000000000b1'::uuid,
    'f2a60000-0000-4000-8000-0000000000d1'::uuid
  )->>'plan_id'),
  'f2a60000-0000-4000-8000-0000000000c1',
  '5. ATTACH-02. Retour : plan_id conforme'
);
SELECT is(
  (SELECT public.attach_adventure_plan_to_trip(
    'f2a60000-0000-4000-8000-0000000000c1'::uuid,
    'f2a60000-0000-4000-8000-0000000000b1'::uuid,
    NULL::uuid
  )->>'trip_id'),
  'f2a60000-0000-4000-8000-0000000000b1',
  '6. ATTACH-02. Retour : trip_id conforme'
);
SELECT is(
  (SELECT public.attach_adventure_plan_to_trip(
    'f2a60000-0000-4000-8000-0000000000c1'::uuid,
    'f2a60000-0000-4000-8000-0000000000b1'::uuid,
    NULL::uuid
  )->>'correlation_id'),
  'f2a60000-0000-4000-8000-0000000000d1',
  '7. ATTACH-02. La corrélation fournie est retenue'
);

RESET ROLE;
SELECT is(
  (SELECT trip_id FROM public.adventure_plans
   WHERE id = 'f2a60000-0000-4000-8000-0000000000c1'),
  'f2a60000-0000-4000-8000-0000000000b1'::uuid,
  '8. ATTACH-02. adventure_plans.trip_id est écrit'
);
SELECT is(
  (SELECT correlation_id::text FROM public.adventure_plans
   WHERE id = 'f2a60000-0000-4000-8000-0000000000c1'),
  'f2a60000-0000-4000-8000-0000000000d1',
  '9. ATTACH-02. adventure_plans.correlation_id est écrit'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE2-ATTACH-03 — idempotence sur le même voyage
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f2a60000-0000-4000-8000-0000000000a2';
SELECT is(
  (SELECT public.attach_adventure_plan_to_trip(
    'f2a60000-0000-4000-8000-0000000000c1'::uuid,
    'f2a60000-0000-4000-8000-0000000000b1'::uuid
  )->>'correlation_id'),
  'f2a60000-0000-4000-8000-0000000000d1',
  '10. ATTACH-03. Ré-attachement au même voyage : corrélation conservée'
);
SELECT lives_ok(
  $$ SELECT public.attach_adventure_plan_to_trip(
       'f2a60000-0000-4000-8000-0000000000c1'::uuid,
       'f2a60000-0000-4000-8000-0000000000b1'::uuid,
       'f2a60000-0000-4000-8000-0000000000d9'::uuid
     ) $$,
  '11. ATTACH-03. Un second appel identique ne lève jamais'
);
RESET ROLE;
SELECT is(
  (SELECT trip_id FROM public.adventure_plans
   WHERE id = 'f2a60000-0000-4000-8000-0000000000c1'),
  'f2a60000-0000-4000-8000-0000000000b1'::uuid,
  '12. ATTACH-03. Le voyage reste unique après ré-attachement'
);
SELECT is(
  (SELECT count(*)::int FROM public.adventure_plans
   WHERE owner_id = 'f2a60000-0000-4000-8000-0000000000a2'),
  3,
  '13. ATTACH-03. Aucun plan dupliqué (3 plans propriétaire attendus)'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE2-ATTACH-04 — refus non-propriétaire (plan puis voyage)
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f2a60000-0000-4000-8000-0000000000a2';
SELECT throws_like(
  $$ SELECT public.attach_adventure_plan_to_trip(
       'f2a60000-0000-4000-8000-0000000000c4'::uuid,
       'f2a60000-0000-4000-8000-0000000000b1'::uuid,
       NULL::uuid
     ) $$,
  '%non détenu par l''utilisateur%',
  '14. ATTACH-04. Un plan d''un tiers est refusé explicitement'
);
SELECT throws_like(
  $$ SELECT public.attach_adventure_plan_to_trip(
       'f2a60000-0000-4000-8000-0000000000c3'::uuid,
       'f2a60000-0000-4000-8000-0000000000b2'::uuid,
       NULL::uuid
     ) $$,
  '%voyage% non détenu par l''utilisateur%',
  '15. ATTACH-04. Un voyage d''un tiers est refusé explicitement'
);
RESET ROLE;
SELECT is(
  (SELECT trip_id FROM public.adventure_plans
   WHERE id = 'f2a60000-0000-4000-8000-0000000000c3'),
  NULL::uuid,
  '16. ATTACH-04. Le refus n''a attaché aucun plan'
);
SELECT is(
  (SELECT correlation_id FROM public.adventure_plans
   WHERE id = 'f2a60000-0000-4000-8000-0000000000c4'),
  NULL::uuid,
  '17. ATTACH-04. Le plan du tiers est resté intact'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE2-ATTACH-05 — plan déjà attaché à un autre voyage
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f2a60000-0000-4000-8000-0000000000a2';
SELECT throws_like(
  $$ SELECT public.attach_adventure_plan_to_trip(
       'f2a60000-0000-4000-8000-0000000000c2'::uuid,
       'f2a60000-0000-4000-8000-0000000000b1'::uuid,
       NULL::uuid
     ) $$,
  '%déjà attaché au voyage%',
  '18. ATTACH-05. La réaffectation vers un autre voyage est refusée'
);
RESET ROLE;
SELECT is(
  (SELECT trip_id FROM public.adventure_plans
   WHERE id = 'f2a60000-0000-4000-8000-0000000000c2'),
  'f2a60000-0000-4000-8000-0000000000b3'::uuid,
  '19. ATTACH-05. Le voyage d''origine est inchangé'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE2-ATTACH-06 — entrées absentes et corrélation générée
-- ----------------------------------------------------------------------------
SELECT throws_like(
  $$ SELECT public.attach_adventure_plan_to_trip(
       NULL::uuid,
       'f2a60000-0000-4000-8000-0000000000b1'::uuid,
       NULL::uuid
     ) $$,
  '%p_plan_id obligatoire%',
  '20. ATTACH-06. p_plan_id nulle refusée'
);
SELECT is(
  (SELECT public.attach_adventure_plan_to_trip(
    'f2a60000-0000-4000-8000-0000000000c3'::uuid,
    'f2a60000-0000-4000-8000-0000000000b1'::uuid
  )->>'correlation_id') IS NOT NULL,
  true,
  '21. ATTACH-06. Sans corrélation, la commande en génère une'
);

SELECT * FROM finish();
ROLLBACK;
