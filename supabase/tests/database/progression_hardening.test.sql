-- Stabilisation — correctifs de la revue : collision place_review, refus
-- temporaires réévaluables, REVOKE des fonctions, borne et outils d'outbox.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(13);
UPDATE public.progression_rules SET payload = jsonb_set(payload, '{actions}',
  '{"test_hike":{"caps":{"daily":1,"weekly":10,"season":20}},
    "place_review":{"points":15,"max_points":15,
      "weights":{"explorer":0,"preparer":0,"partager":1,"entraider":0},
      "caps":{"daily":3,"weekly":10,"season":50}}}'::jsonb) WHERE active;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001','authenticated','authenticated','h1@test.local','x','{}','{}',now(),now()),
  ('bbbbbbbb-0000-4000-8000-000000000002','authenticated','authenticated','h2@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email)
VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001','Hélène Un','h1@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002','Hugo Deux','h2@test.local')
ON CONFLICT (id) DO NOTHING;

-- 1-3. place_review : la clé inclut l'auteur, deux utilisateurs = deux gains.
SELECT is((public.award_progression_gain('bbbbbbbb-0000-4000-8000-000000000001','place_review','place_review',
  'bbbbbbbb-0000-4000-8000-000000000001:place-1', now(), 15,
  '{"explorer":0,"preparer":0,"partager":1,"entraider":0}','Avis A'))->>'outcome', 'awarded', '1. premier avis crédité');
SELECT is((public.award_progression_gain('bbbbbbbb-0000-4000-8000-000000000002','place_review','place_review',
  'bbbbbbbb-0000-4000-8000-000000000002:place-1', now(), 15,
  '{"explorer":0,"preparer":0,"partager":1,"entraider":0}','Avis B'))->>'outcome', 'awarded', '2. second auteur crédité (pas de collision)');
SELECT is((SELECT count(*)::int FROM public.reward_transactions WHERE transaction_type = 'PROGRESSION_AWARD'
   AND idempotency_key IN ('place_review:bbbbbbbb-0000-4000-8000-000000000001:place-1','place_review:bbbbbbbb-0000-4000-8000-000000000002:place-1')), 2, '3. deux gains distincts');

-- 4-6. Refus temporaire (plafond) : jamais persisté, réévalué après relèvement.
SELECT is((public.award_progression_gain('bbbbbbbb-0000-4000-8000-000000000001','test_hike','hike_session','h-1', now(), 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}','R1'))->>'outcome', 'awarded', '4. premier gain dans le plafond');
SELECT is((public.award_progression_gain('bbbbbbbb-0000-4000-8000-000000000001','test_hike','hike_session','h-2', now(), 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}','R2'))->>'reason', 'plafond_quotidien', '5. second refusé par plafond');
SELECT is((SELECT count(*)::int FROM public.progression_decisions WHERE idempotency_key = 'hike_session:h-2'), 0, '6. refus temporaire NON gravé');
UPDATE public.progression_rules SET payload = jsonb_set(payload, '{actions,test_hike,caps,daily}', '5'::jsonb) WHERE active;
SELECT is((public.award_progression_gain('bbbbbbbb-0000-4000-8000-000000000001','test_hike','hike_session','h-2', now(), 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}','R2'))->>'outcome', 'awarded', '7. réévaluation possible après le plafond');

-- 8. Refus définitif (poids) : conservé pour explicabilité.
SELECT is((public.award_progression_gain('bbbbbbbb-0000-4000-8000-000000000001','test_hike','hike_session','h-3', now(), 40,
  '{"explorer":0.5,"preparer":0,"partager":0,"entraider":0}','R3'))->>'outcome', 'refused', '8. poids invalides refusés');
SELECT is((SELECT count(*)::int FROM public.progression_decisions WHERE idempotency_key = 'hike_session:h-3' AND outcome = 'refused'), 1, '9. refus définitif conservé');

-- 10-12. Privilèges et outils d'outbox.
SELECT is((SELECT bool_and(NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')) FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('update_loyalty_points','progression_level_for',
     'progression_allocations_valid','enqueue_progression_outbox','purge_progression_outbox','replay_dead_progression_outbox')), true,
  '10. fonctions sensibles non exécutables par authenticated (claim_reward_points volontairement différé)');
SELECT is((SELECT has_function_privilege('authenticated', 'public.claim_reward_points(uuid,text,uuid,text,jsonb)', 'EXECUTE')), true,
  '10b. claim_reward_points conserve EXECUTE pour authenticated pendant la phase de transition');
INSERT INTO public.reward_transactions (user_id, points, transaction_type, idempotency_key, counts_for_progression, affects_balance)
VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001', 5, 'PROGRESSION_AWARD', 'hard:o1', true, false),
  ('bbbbbbbb-0000-4000-8000-000000000001', 5, 'PROGRESSION_AWARD', 'hard:o2', true, false),
  ('bbbbbbbb-0000-4000-8000-000000000001', 5, 'PROGRESSION_AWARD', 'hard:o3', true, false);
SELECT is((public.process_progression_outbox(1))->>'processed', '1', '11. p_limit=1 borne réellement le lot');
UPDATE public.progression_outbox SET status='dead' WHERE reward_transaction_id IN
  (SELECT id FROM public.reward_transactions WHERE idempotency_key IN ('hard:o2','hard:o3'));
SELECT is((SELECT count(*)::int FROM public.progression_outbox WHERE status='dead' AND reward_transaction_id IN
  (SELECT id FROM public.reward_transactions WHERE idempotency_key='hard:o2')), 1, '12. état dead posé');
SELECT * FROM finish();
ROLLBACK;
