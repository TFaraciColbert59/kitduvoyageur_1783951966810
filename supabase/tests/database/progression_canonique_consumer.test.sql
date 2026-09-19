-- P1 — Consommateur d'outbox et projections par saison.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(9);
UPDATE public.progression_rules SET payload = jsonb_set(payload, '{actions}',
  '{"test_hike":{"caps":{"daily":5,"weekly":10,"season":20}}}'::jsonb) WHERE active;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff','authenticated','authenticated','cons@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff','Flo Consommateur','cons@test.local') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.reward_accounts (user_id) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff') ON CONFLICT DO NOTHING;

SELECT (public.award_progression_gain('ffffffff-ffff-ffff-ffff-ffffffffffff','test_hike','hike_session','c-1', now(), 40,
  '{"explorer":0.75,"preparer":0.25,"partager":0,"entraider":0}','Rando'))->>'outcome';
SELECT is((public.process_progression_outbox(10))->>'processed', '1', '1. un événement consommé');
SELECT is((SELECT lifetime_points FROM public.user_progression WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 40, '2. cumul à vie = 40');
SELECT is((SELECT skill_explorer_points FROM public.user_progression WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 30, '3. explorer = 30');
SELECT is((SELECT season_points FROM public.user_season_progress s WHERE s.user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 40, '4. points de saison = 40');
SELECT is((SELECT status FROM public.progression_outbox o JOIN public.reward_transactions t ON t.id=o.reward_transaction_id WHERE t.idempotency_key='hike_session:c-1'), 'processed', '5. outbox traitée');
SELECT is((SELECT count(*)::int FROM public.progression_events e JOIN public.reward_transactions t ON t.id=e.reward_transaction_id WHERE t.idempotency_key='hike_session:c-1'), 1, '6. journal de projection écrit');

SELECT is((public.process_progression_outbox(10))->>'processed', '0', '7. rien à retraiter');
SELECT is((SELECT lifetime_points FROM public.user_progression WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 40, '8. cumul inchangé');

INSERT INTO public.reward_transactions (user_id, points, transaction_type, idempotency_key, effective_at, season_id, rules_version, skill_allocations, counts_for_progression, affects_balance)
SELECT 'ffffffff-ffff-ffff-ffff-ffffffffffff', -40, 'FRAUD_REVERSAL', 'fraud_reversal:c-1', now(), season_id, 'v1',
  '[{"skill":"explorer","weight":0.75,"points":-30},{"skill":"preparer","weight":0.25,"points":-10},{"skill":"partager","weight":0,"points":0},{"skill":"entraider","weight":0,"points":0}]'::jsonb, true, false
FROM public.reward_transactions WHERE idempotency_key='hike_session:c-1';
SELECT (public.process_progression_outbox(10))->>'processed';
SELECT is((SELECT lifetime_points FROM public.user_progression WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 0, '9. compensation appliquée sans négatif');

SELECT * FROM finish();
ROLLBACK;
