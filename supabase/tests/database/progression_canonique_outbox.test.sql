-- P1 — Outbox, trigger de solde et revokes.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(6);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd','authenticated','authenticated','outbox@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd','Dan Outbox','outbox@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.reward_transactions (user_id, points, transaction_type, idempotency_key, counts_for_progression, affects_balance, effective_at)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 25, 'PROGRESSION_AWARD', 'outbox:1', true, false, now());
SELECT is((SELECT available_points FROM public.reward_accounts WHERE user_id='dddddddd-dddd-dddd-dddd-dddddddddddd'), 0, '1. affects_balance=false ne crédite pas le solde');

SELECT is((SELECT count(*)::int FROM public.progression_outbox WHERE reward_transaction_id = (SELECT id FROM public.reward_transactions WHERE idempotency_key='outbox:1')), 1, '2. outbox créée');
SELECT is((SELECT status FROM public.progression_outbox WHERE reward_transaction_id = (SELECT id FROM public.reward_transactions WHERE idempotency_key='outbox:1')), 'pending', '3. statut pending');

INSERT INTO public.reward_transactions (user_id, points, transaction_type, idempotency_key, counts_for_progression)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 5, 'ADMIN_ADJUSTMENT', 'outbox:2', false);
SELECT is((SELECT count(*)::int FROM public.progression_outbox o JOIN public.reward_transactions t ON t.id=o.reward_transaction_id WHERE t.idempotency_key='outbox:2'), 0, '4. counts_for_progression=false → aucune outbox');

SELECT is((SELECT has_table_privilege('authenticated','public.reward_transactions','INSERT')), false, '5. INSERT client révoqué');
SELECT is((SELECT has_table_privilege('authenticated','public.progression_outbox','SELECT')), false, '6. SELECT client outbox révoqué');

SELECT * FROM finish();
ROLLBACK;
