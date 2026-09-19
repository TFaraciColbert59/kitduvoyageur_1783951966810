-- P1 — Rebuild depuis le ledger et compensation canonique.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(5);
UPDATE public.progression_rules SET payload = jsonb_set(payload, '{actions}',
  '{"test_hike":{"caps":{"daily":5,"weekly":10,"season":20}}}'::jsonb) WHERE active;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff','authenticated','authenticated','cons@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff','Flo Consommateur','cons@test.local') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.reward_accounts (user_id) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff') ON CONFLICT DO NOTHING;

SELECT (public.award_progression_gain('ffffffff-ffff-ffff-ffff-ffffffffffff','test_hike','hike_session','rb-1', now(), 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}','Rando'))->>'outcome';
SELECT (public.process_progression_outbox(10))->>'processed';

UPDATE public.user_progression SET lifetime_points = 999, skill_explorer_points = 999 WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff';
SELECT is((public.rebuild_progression_from_ledger('ffffffff-ffff-ffff-ffff-ffffffffffff'))->>'success', 'true', '1. rebuild exécuté');
SELECT is((SELECT lifetime_points FROM public.user_progression WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 40, '2. cumul reconstruit depuis le ledger');

SELECT is((public.reverse_progression_fraud_canonical((SELECT id FROM public.reward_transactions WHERE idempotency_key='hike_session:rb-1'), 'test fraude'))->>'success', 'true', '3. compensation créée');
SELECT is((public.process_progression_outbox(10))->>'processed', '1', '4. compensation consommée');
SELECT is((SELECT lifetime_points FROM public.user_progression WHERE user_id='ffffffff-ffff-ffff-ffff-ffffffffffff'), 0, '5. points corrigés sans réécriture d''historique');

SELECT * FROM finish();
ROLLBACK;
