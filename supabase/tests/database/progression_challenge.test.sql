-- P1 — Défis de saison : progression dérivée des gains (plafonnée), absence de
-- gain en points, compensation neutre, remplacement réel, cooldown, catalogue
-- réel, privilèges service_role uniquement.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(17);

UPDATE public.progression_rules SET payload = jsonb_set(payload, '{actions}',
  '{"test_explore":{"caps":{"daily":20,"weekly":40,"season":100}},
    "test_share":{"caps":{"daily":20,"weekly":40,"season":100}}}'::jsonb) WHERE active;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('dddddddd-0000-4000-8000-000000000001','authenticated','authenticated','chal1@test.local','x','{}','{}',now(),now()),
  ('dddddddd-0000-4000-8000-000000000002','authenticated','authenticated','chal2@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email)
VALUES
  ('dddddddd-0000-4000-8000-000000000001','Chloé Défi','chal1@test.local'),
  ('dddddddd-0000-4000-8000-000000000002','Cyril SansProgression','chal2@test.local')
ON CONFLICT (id) DO NOTHING;

-- Défi réel en cours : chal_exp_02 est explorer, cible 3.
INSERT INTO public.user_progression (user_id, lifetime_points, current_challenge_id, challenge_progress)
VALUES ('dddddddd-0000-4000-8000-000000000001', 0, 'chal_exp_02', 0);

-- 1-2. Un gain explorer fait progresser le défi.
SELECT (public.award_progression_gain('dddddddd-0000-4000-8000-000000000001','test_explore','hike_session','ch-1', now(), 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}','Exploration 1'))->>'outcome';
SELECT is((public.process_progression_outbox(10))->>'processed', '1', '1. gain explorateur consommé');
SELECT is((SELECT challenge_progress FROM public.user_progression WHERE user_id='dddddddd-0000-4000-8000-000000000001'), 1, '2. défi explorer +1');

-- 3. Deuxième gain explorer → 2.
SELECT public.award_progression_gain('dddddddd-0000-4000-8000-000000000001','test_explore','hike_session','ch-2', now(), 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}','Exploration 2');
SELECT (public.process_progression_outbox(10))->>'processed';
SELECT is((SELECT challenge_progress FROM public.user_progression WHERE user_id='dddddddd-0000-4000-8000-000000000001'), 2, '3. deuxième gain explorer → 2');

-- 4. Gain d'une autre compétence → aucune progression du défi.
SELECT public.award_progression_gain('dddddddd-0000-4000-8000-000000000001','test_share','place_review','ch-3', now(), 40,
  '{"explorer":0,"preparer":0,"partager":1,"entraider":0}','Partage');
SELECT (public.process_progression_outbox(10))->>'processed';
SELECT is((SELECT challenge_progress FROM public.user_progression WHERE user_id='dddddddd-0000-4000-8000-000000000001'), 2, '4. compétence non correspondante → défi inchangé');

-- 5-6. Cible atteinte puis plafonnée.
SELECT public.award_progression_gain('dddddddd-0000-4000-8000-000000000001','test_explore','hike_session','ch-4', now(), 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}','Exploration 4');
SELECT (public.process_progression_outbox(10))->>'processed';
SELECT is((SELECT challenge_progress FROM public.user_progression WHERE user_id='dddddddd-0000-4000-8000-000000000001'), 3, '5. défi à sa cible');
SELECT public.award_progression_gain('dddddddd-0000-4000-8000-000000000001','test_explore','hike_session','ch-5', now(), 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}','Exploration 5');
SELECT (public.process_progression_outbox(10))->>'processed';
SELECT is((SELECT challenge_progress FROM public.user_progression WHERE user_id='dddddddd-0000-4000-8000-000000000001'), 3, '6. progression plafonnée à target_progress');

-- 7. Aucun gain en points pour le défi : 5 × 40 exactement.
SELECT is((SELECT lifetime_points FROM public.user_progression WHERE user_id='dddddddd-0000-4000-8000-000000000001'), 200, '7. aucun point de défi ajouté au cumul');

-- 8. Une compensation ne fait jamais progresser un défi.
UPDATE public.user_progression SET challenge_progress = 0 WHERE user_id='dddddddd-0000-4000-8000-000000000001';
INSERT INTO public.reward_transactions
  (user_id, points, transaction_type, reference_type, metadata, idempotency_key, effective_at, season_id, rules_version, skill_allocations, counts_for_progression, affects_balance)
SELECT 'dddddddd-0000-4000-8000-000000000001', -40, 'FRAUD_REVERSAL', 'hike_session',
  '{"action_type":"fraud_reversal"}'::jsonb, 'fraud:ch-x', now(), season_id, 'v1',
  '[{"skill":"explorer","weight":1,"points":-40},{"skill":"preparer","weight":0,"points":0},{"skill":"partager","weight":0,"points":0},{"skill":"entraider","weight":0,"points":0}]'::jsonb, true, false
FROM public.reward_transactions WHERE idempotency_key='hike_session:ch-1';
SELECT (public.process_progression_outbox(10))->>'processed';
SELECT is((SELECT challenge_progress FROM public.user_progression WHERE user_id='dddddddd-0000-4000-8000-000000000001'), 0, '8. compensation négative → défi non progressé');

-- 9-12. Remplacement réel du défi.
CREATE TEMP TABLE replace_first AS
  SELECT public.replace_progression_challenge('dddddddd-0000-4000-8000-000000000001') AS result;

SELECT is((SELECT result->>'ok' FROM replace_first), 'true', '9. remplacement nominal accepté');
SELECT is((SELECT count(*)::int FROM public.progression_challenges WHERE id = (SELECT result->>'challengeId' FROM replace_first)), 1, '10. défi choisi dans le catalogue réel');
SELECT is((SELECT (result->>'challengeId') <> 'chal_exp_02' FROM replace_first), true, '11. défi différent du défi courant');
SELECT is((SELECT current_challenge_id || ':' || challenge_progress || ':' || (challenge_replaced_at IS NOT NULL)::text
  FROM public.user_progression WHERE user_id='dddddddd-0000-4000-8000-000000000001'),
  (SELECT result->>'challengeId' FROM replace_first) || ':0:true', '12. ligne mise à jour (nouveau défi, progression remise à 0, horodatage)');

-- 13-14. Cooldown 7 jours.
SELECT is((public.replace_progression_challenge('dddddddd-0000-4000-8000-000000000001'))->>'reason', 'cooldown', '13. second remplacement immédiat refusé (cooldown)');
SELECT is((SELECT current_challenge_id FROM public.user_progression WHERE user_id='dddddddd-0000-4000-8000-000000000001'),
  (SELECT result->>'challengeId' FROM replace_first), '14. défi inchangé pendant le cooldown');

-- 15. Sans ligne de progression, refus propre.
SELECT is((public.replace_progression_challenge('dddddddd-0000-4000-8000-000000000002'))->>'reason', 'no_progression', '15. utilisateur sans projection → no_progression');

-- 16-17. Privilèges.
SELECT is((SELECT bool_and(NOT has_function_privilege(role_name, 'public.replace_progression_challenge(uuid)', 'EXECUTE'))
  FROM (VALUES ('anon'), ('authenticated')) AS t(role_name)), true, '16. non exécutable par anon/authenticated');
SELECT is(has_function_privilege('service_role', 'public.replace_progression_challenge(uuid)', 'EXECUTE'), true, '17. exécutable par service_role');

SELECT * FROM finish();
ROLLBACK;
