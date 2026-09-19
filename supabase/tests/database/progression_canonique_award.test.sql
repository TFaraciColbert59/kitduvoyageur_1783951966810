-- P1 — Attribution canonique : idempotence, allocation, saison, refus.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(8);
UPDATE public.progression_rules SET payload = jsonb_set(payload, '{actions}',
  '{"test_hike":{"caps":{"daily":2,"weekly":5,"season":10}},"test_prep":{"caps":{"daily":5,"weekly":10,"season":20}}}'::jsonb) WHERE active;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','authenticated','authenticated','award@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','Eve Award','award@test.local')
ON CONFLICT (id) DO NOTHING;

SELECT is((public.award_progression_gain('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','test_hike','hike_session','s-1', now(), 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}', 'Randonnée terminée'))->>'outcome', 'awarded', '1. attribution validée');
SELECT is((SELECT COUNT(*)::int FROM public.reward_transactions WHERE idempotency_key='hike_session:s-1' AND counts_for_progression), 1, '2. transaction canonique unique');
SELECT is((SELECT (skill_allocations->0->>'points')::int FROM public.reward_transactions WHERE idempotency_key='hike_session:s-1'), 40, '3. allocation explorer = 40');
SELECT is((SELECT COUNT(*)::int FROM public.progression_outbox o JOIN public.reward_transactions t ON t.id=o.reward_transaction_id WHERE t.idempotency_key='hike_session:s-1'), 1, '4. outbox créée');

SELECT is((public.award_progression_gain('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','test_hike','hike_session','s-1', now(), 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}', 'Randonnée terminée'))->>'idempotent', 'true', '5. rejeu idempotent');
SELECT is((SELECT COUNT(*)::int FROM public.reward_transactions WHERE idempotency_key='hike_session:s-1'), 1, '6. pas de double crédit');

SELECT is((public.award_progression_gain('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','test_prep','trail_prep','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee:r-1', now(), 30,
  '{"explorer":0.5,"preparer":0.2,"partager":0,"entraider":0}', 'x'))->>'outcome', 'refused', '7. somme des poids ≠ 1 refusée');
SELECT is((SELECT outcome FROM public.progression_decisions WHERE idempotency_key='trail_prep:eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee:r-1'), 'refused', '8. refus conservé');

SELECT * FROM finish();
ROLLBACK;
