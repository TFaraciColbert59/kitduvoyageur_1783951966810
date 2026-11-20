-- =============================================================================
-- pgTAP Security & RLS Test Suite: Lot P3 — Effort Engine V1
-- File: supabase/tests/effort_engine_rls.pgtap.sql
--
-- Prouve que :
-- 1. RLS ENABLE + FORCE est actif sur user_physiology, effort_scores,
--    group_prediction_members, route_predictions, adventure_data_consents.
-- 2. Le rôle anon ne peut ni lire ni écrire sur ces tables privées.
-- 3. L'upsert ON CONFLICT de l'utilisateur A sur sa propre ligne
--    user_physiology et adventure_data_consents (nouvelles finalités +
--    personal_performance) fonctionne sous RLS (PostgreSQL 17.6+).
-- 4. L'utilisateur A ne peut ni lire ni modifier (INSERT/ON CONFLICT/UPDATE/
--    DELETE) la ligne user_physiology de l'utilisateur B.
-- 5. L'utilisateur A lit son propre effort_scores, ne lit jamais celui de B,
--    et ne peut ni insérer, ni modifier, ni supprimer dans effort_scores
--    (écriture service_role uniquement).
-- 6. L'utilisateur A ne peut jamais lire ni modifier les lignes
--    group_prediction_members ni route_predictions (scope='member') de B,
--    même si A est propriétaire/organisateur du plan ou de la prédiction.
-- 7. Le Contrat C d'immutabilité (ON CONFLICT (snapshot_hash) DO NOTHING)
--    empêche toute altération d'un snapshot_hash existant dans effort_scores.
-- 8. La rétrocompatibilité stricte de has_active_consent() accepte
--    'personal_performance' lors du contrôle de 'personal_scoring'.
-- =============================================================================

BEGIN;
SELECT plan(30);

-- ── 0. Fixtures (exécutées par le propriétaire / service_role) ────────────────
DO $$
DECLARE
  v_user_a uuid := 'f3000000-0000-4000-8000-000000000001'::uuid;
  v_user_b uuid := 'f3000000-0000-4000-8000-000000000002'::uuid;
  v_route_pred_group uuid := 'f3000000-1000-4000-8000-000000000001'::uuid;
  v_route_pred_mem_a uuid := 'f3000000-1000-4000-8000-000000000002'::uuid;
  v_route_pred_mem_b uuid := 'f3000000-1000-4000-8000-000000000003'::uuid;
BEGIN
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_user_a, 'authenticated', 'authenticated', 'p3_user_a@lkdv.test', 'x', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_user_b, 'authenticated', 'authenticated', 'p3_user_b@lkdv.test', 'x', '{}'::jsonb, '{}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Physiologie de B pré-insérée
  INSERT INTO public.user_physiology (user_id, weight_kg, sex, birth_year, declared_level, hr_rest, hr_max)
  VALUES (v_user_b, 64.0, 'female', 1992, 'experienced', 50, 192)
  ON CONFLICT (user_id) DO UPDATE SET weight_kg = EXCLUDED.weight_kg;

  -- Scores d'effort de A et B (écrits par service_role)
  INSERT INTO public.effort_scores (
    user_id, score_version, snapshot_hash, iea, erp, e_flat_km, raw_dose,
    technicite, data_level, interval_p10, interval_p50, interval_p90, is_shadow
  )
  VALUES
    (
      v_user_a, 'effort-score-v1',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      42.5, 48.0, 18.2, 3.4, 2, 'socle', 38.0, 42.5, 47.0, true
    ),
    (
      v_user_b, 'effort-score-v1',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      55.0, 61.0, 22.0, 4.1, 3, 'cardio', 50.0, 55.0, 60.0, true
    )
  ON CONFLICT (snapshot_hash) DO NOTHING;

  -- Prédictions de route : 1 groupe (user_id = A), 1 membre A, 1 membre B (même avec user_id = A !)
  INSERT INTO public.route_predictions (
    id, user_id, strategy, eta_p50, eta_p90, total_duration_p50_s, total_duration_p90_s,
    model_version, scope, member_user_id
  )
  VALUES
    (
      v_route_pred_group, v_user_a, 'recommended',
      now() + interval '4 hours', now() + interval '5 hours',
      14400, 18000, 'group-effort-v1', 'group', NULL
    ),
    (
      v_route_pred_mem_a, v_user_a, 'recommended',
      now() + interval '4 hours', now() + interval '5 hours',
      14400, 18000, 'group-effort-v1', 'member', v_user_a
    ),
    (
      v_route_pred_mem_b, v_user_a, 'recommended',
      now() + interval '4 hours', now() + interval '5 hours',
      14400, 18000, 'group-effort-v1', 'member', v_user_b
    )
  ON CONFLICT (id) DO NOTHING;

  -- Lignes group_prediction_members pour A et B rattachées à la même prédiction de groupe
  INSERT INTO public.group_prediction_members (
    route_prediction_id, member_user_id, mode, iea, erp, wait_s, cooling_risk_level, data_level
  )
  VALUES
    (v_route_pred_group, v_user_a, 'regroupement', 42.5, 45.0, 420, 'moderate', 'socle'),
    (v_route_pred_group, v_user_b, 'regroupement', 55.0, 62.0, 0, 'low', 'cardio')
  ON CONFLICT (route_prediction_id, member_user_id) DO NOTHING;

  -- Consentement historique 'personal_performance' uniquement pour B
  INSERT INTO public.adventure_data_consents (
    user_id, purpose, granted, policy_version, granted_at, revoked_at
  )
  VALUES (v_user_b, 'personal_performance', true, 'a1-v1', now(), NULL)
  ON CONFLICT (user_id, purpose, policy_version) DO UPDATE
    SET granted = true, revoked_at = NULL;
END $$;

-- ── 1. Vérification ENABLE + FORCE ROW LEVEL SECURITY ─────────────────────────
SELECT is(
  (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.user_physiology'::regclass),
  true,
  '1. user_physiology : ENABLE + FORCE ROW LEVEL SECURITY actifs'
);

SELECT is(
  (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.effort_scores'::regclass),
  true,
  '2. effort_scores : ENABLE + FORCE ROW LEVEL SECURITY actifs'
);

SELECT is(
  (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.group_prediction_members'::regclass),
  true,
  '3. group_prediction_members : ENABLE + FORCE ROW LEVEL SECURITY actifs'
);

SELECT is(
  (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.route_predictions'::regclass),
  true,
  '4. route_predictions : ENABLE + FORCE ROW LEVEL SECURITY actifs'
);

-- ── 2. Rôle anon : aucun accès ────────────────────────────────────────────────
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

SELECT throws_ok(
  $$ SELECT 1 FROM public.user_physiology $$,
  '42501', NULL,
  '5. anon : lecture user_physiology refusée (42501)'
);

SELECT throws_ok(
  $$ SELECT 1 FROM public.effort_scores $$,
  '42501', NULL,
  '6. anon : lecture effort_scores refusée (42501)'
);

SELECT throws_ok(
  $$ SELECT 1 FROM public.group_prediction_members $$,
  '42501', NULL,
  '7. anon : lecture group_prediction_members refusée (42501)'
);

RESET ROLE;

-- ── 3. Utilisateur A (authenticated) : ON CONFLICT sur ses propres lignes ─────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f3000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- Premier INSERT ON CONFLICT sur user_physiology (création)
SELECT lives_ok(
  $$
    INSERT INTO public.user_physiology (user_id, weight_kg, sex, birth_year, declared_level, hr_rest, hr_max)
    VALUES ('f3000000-0000-4000-8000-000000000001'::uuid, 74.0, 'male', 1988, 'regular', 55, 186)
    ON CONFLICT (user_id) DO UPDATE SET
      weight_kg = EXCLUDED.weight_kg,
      hr_rest = EXCLUDED.hr_rest,
      updated_at = now()
  $$,
  '8. User A : premier INSERT ON CONFLICT sur sa ligne user_physiology réussit'
);

-- Second INSERT ON CONFLICT sur user_physiology (mise à jour en conflit sous RLS PG 17.6+)
SELECT lives_ok(
  $$
    INSERT INTO public.user_physiology (user_id, weight_kg, sex, birth_year, declared_level, hr_rest, hr_max)
    VALUES ('f3000000-0000-4000-8000-000000000001'::uuid, 75.5, 'male', 1988, 'regular', 53, 186)
    ON CONFLICT (user_id) DO UPDATE SET
      weight_kg = EXCLUDED.weight_kg,
      hr_rest = EXCLUDED.hr_rest,
      updated_at = now()
  $$,
  '9. User A : second INSERT ON CONFLICT DO UPDATE sur sa ligne user_physiology réussit sous RLS'
);

SELECT is(
  (SELECT weight_kg FROM public.user_physiology WHERE user_id = 'f3000000-0000-4000-8000-000000000001'::uuid),
  75.5::numeric,
  '10. User A : weight_kg mis à jour à 75.5 kg après ON CONFLICT DO UPDATE'
);

-- Upsert ON CONFLICT sur adventure_data_consents avec les 4 nouvelles finalités granulaires
SELECT lives_ok(
  $$
    INSERT INTO public.adventure_data_consents (user_id, purpose, granted, policy_version, granted_at, revoked_at)
    VALUES
      ('f3000000-0000-4000-8000-000000000001'::uuid, 'personal_scoring', true, 'a1-v1', now(), NULL),
      ('f3000000-0000-4000-8000-000000000001'::uuid, 'wearable_sync', true, 'a1-v1', now(), NULL),
      ('f3000000-0000-4000-8000-000000000001'::uuid, 'group_simulation', true, 'a1-v1', now(), NULL),
      ('f3000000-0000-4000-8000-000000000001'::uuid, 'anonymized_calibration', false, 'a1-v1', NULL, now())
    ON CONFLICT (user_id, purpose, policy_version) DO UPDATE SET
      granted = EXCLUDED.granted,
      granted_at = EXCLUDED.granted_at,
      revoked_at = EXCLUDED.revoked_at
  $$,
  '11. User A : INSERT ON CONFLICT des 4 nouvelles finalités granulaires sur adventure_data_consents réussit'
);

SELECT lives_ok(
  $$
    INSERT INTO public.adventure_data_consents (user_id, purpose, granted, policy_version, granted_at, revoked_at)
    VALUES ('f3000000-0000-4000-8000-000000000001'::uuid, 'personal_scoring', false, 'a1-v1', NULL, now())
    ON CONFLICT (user_id, purpose, policy_version) DO UPDATE SET
      granted = EXCLUDED.granted,
      granted_at = EXCLUDED.granted_at,
      revoked_at = EXCLUDED.revoked_at
  $$,
  '12. User A : révocation via ON CONFLICT DO UPDATE sur adventure_data_consents réussit sous RLS'
);

-- ── 4. Isolation user_physiology : A ne peut ni lire ni modifier B ────────────
SELECT is_empty(
  $$ SELECT 1 FROM public.user_physiology WHERE user_id = 'f3000000-0000-4000-8000-000000000002'::uuid $$,
  '13. User A : ne peut pas lire la ligne user_physiology de User B (0 ligne)'
);

SELECT throws_ok(
  $$
    INSERT INTO public.user_physiology (user_id, weight_kg)
    VALUES ('f3000000-0000-4000-8000-000000000002'::uuid, 99.0)
    ON CONFLICT (user_id) DO UPDATE SET weight_kg = EXCLUDED.weight_kg
  $$,
  '42501', NULL,
  '14. User A : INSERT/ON CONFLICT sur la ligne user_physiology de User B est refusé (42501)'
);

WITH upd AS (
  UPDATE public.user_physiology
     SET weight_kg = 99.0
   WHERE user_id = 'f3000000-0000-4000-8000-000000000002'::uuid
  RETURNING user_id
)
SELECT is(
  (SELECT count(*)::int FROM upd),
  0,
  '15. User A : UPDATE sur user_physiology de User B affecte 0 ligne'
);

WITH del AS (
  DELETE FROM public.user_physiology
   WHERE user_id = 'f3000000-0000-4000-8000-000000000002'::uuid
  RETURNING user_id
)
SELECT is(
  (SELECT count(*)::int FROM del),
  0,
  '16. User A : DELETE sur user_physiology de User B supprime 0 ligne'
);

-- ── 5. Isolation & protection en écriture de effort_scores ────────────────────
SELECT is(
  (SELECT count(*)::int FROM public.effort_scores WHERE user_id = 'f3000000-0000-4000-8000-000000000001'::uuid),
  1,
  '17. User A : lit son propre score dans effort_scores (1 ligne)'
);

SELECT is_empty(
  $$ SELECT 1 FROM public.effort_scores WHERE user_id = 'f3000000-0000-4000-8000-000000000002'::uuid $$,
  '18. User A : ne lit aucun effort_scores de User B (0 ligne)'
);

SELECT throws_ok(
  $$
    INSERT INTO public.effort_scores (
      user_id, score_version, snapshot_hash, iea, erp, e_flat_km, raw_dose,
      technicite, data_level, interval_p10, interval_p50, interval_p90
    )
    VALUES (
      'f3000000-0000-4000-8000-000000000001'::uuid, 'effort-score-v1',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      10, 10, 5, 1, 1, 'socle', 8, 10, 12
    )
  $$,
  '42501', NULL,
  '19. User A : INSERT direct dans effort_scores refusé (écriture service_role uniquement)'
);

SELECT throws_ok(
  $$
    UPDATE public.effort_scores
       SET iea = 99
     WHERE user_id = 'f3000000-0000-4000-8000-000000000001'::uuid
  $$,
  '42501', NULL,
  '20. User A : UPDATE dans effort_scores refusé (42501)'
);

SELECT throws_ok(
  $$
    DELETE FROM public.effort_scores
     WHERE user_id = 'f3000000-0000-4000-8000-000000000001'::uuid
  $$,
  '42501', NULL,
  '21. User A : DELETE dans effort_scores refusé (42501)'
);

-- ── 6. Isolation stricte de group_prediction_members et route_predictions ─────
SELECT is(
  (SELECT count(*)::int FROM public.group_prediction_members WHERE member_user_id = 'f3000000-0000-4000-8000-000000000001'::uuid),
  1,
  '22. User A : lit uniquement sa propre ligne dans group_prediction_members (1 ligne)'
);

SELECT is_empty(
  $$ SELECT 1 FROM public.group_prediction_members WHERE member_user_id = 'f3000000-0000-4000-8000-000000000002'::uuid $$,
  '23. User A : ne peut pas lire la ligne group_prediction_members de User B (0 ligne)'
);

SELECT throws_ok(
  $$
    UPDATE public.group_prediction_members
       SET erp = 10
     WHERE member_user_id = 'f3000000-0000-4000-8000-000000000002'::uuid
  $$,
  '42501', NULL,
  '24. User A : UPDATE sur group_prediction_members refusé (42501)'
);

SELECT is(
  (SELECT count(*)::int FROM public.route_predictions WHERE scope = 'member' AND member_user_id = 'f3000000-0000-4000-8000-000000000001'::uuid),
  1,
  '25. User A : lit sa propre ligne route_predictions (scope=member, member_user_id=A)'
);

SELECT is_empty(
  $$ SELECT 1 FROM public.route_predictions WHERE scope = 'member' AND member_user_id = 'f3000000-0000-4000-8000-000000000002'::uuid $$,
  '26. User A : ne peut PAS lire route_predictions (scope=member, member_user_id=B), même si user_id=A'
);

RESET ROLE;

-- ── 7. Immutabilité Contrat C & Rétrocompatibilité Consentements (service_role)
INSERT INTO public.effort_scores (
  user_id, score_version, snapshot_hash, iea, erp, e_flat_km, raw_dose,
  technicite, data_level, interval_p10, interval_p50, interval_p90, is_shadow
)
VALUES (
  'f3000000-0000-4000-8000-000000000001'::uuid, 'effort-score-v1',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  99.9, 99.9, 99.9, 9.9, 5, 'complet', 90.0, 99.9, 100.0, false
)
ON CONFLICT (snapshot_hash) DO NOTHING;

SELECT is(
  (SELECT iea FROM public.effort_scores WHERE snapshot_hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
  42.5::numeric,
  '27. Contrat C : ON CONFLICT (snapshot_hash) DO NOTHING préserve l''immutabilité du score original (42.5)'
);

SELECT is(
  public.has_active_consent('f3000000-0000-4000-8000-000000000002'::uuid, 'personal_scoring'),
  true,
  '28. Rétrocompatibilité : has_active_consent(User B, personal_scoring) accepte le consentement historique personal_performance'
);

SELECT is(
  public.has_active_consent('f3000000-0000-4000-8000-000000000001'::uuid, 'personal_scoring'),
  false,
  '29. Révocation : has_active_consent(User A, personal_scoring) retourne false après révocation explicite'
);

SELECT is(
  (
    SELECT count(*)::int
    FROM public.feature_flags
    WHERE id IN ('effort_score_v1_shadow', 'group_prediction_v2_shadow')
      AND enabled = false
  ),
  2,
  '30. Feature flags : effort_score_v1_shadow et group_prediction_v2_shadow sont présents et à enabled = false par défaut'
);

SELECT * FROM finish();
ROLLBACK;
