-- P1 — Ledger canonique : colonnes additives, type PROGRESSION_AWARD, validateur.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(8);

SELECT has_column('public', 'reward_transactions', 'idempotency_key', '1. idempotency_key existe');
SELECT has_column('public', 'reward_transactions', 'skill_allocations', '2. skill_allocations existe');
SELECT has_column('public', 'reward_transactions', 'affects_balance', '3. affects_balance existe');

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc','authenticated','authenticated','ledger@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc','Carol Ledger','ledger@test.local')
ON CONFLICT (id) DO NOTHING;

SELECT lives_ok(
  $$INSERT INTO public.reward_transactions (user_id, points, transaction_type, idempotency_key, counts_for_progression, affects_balance)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 10, 'PROGRESSION_AWARD', 'test:1', true, false)$$,
  '4. PROGRESSION_AWARD accepté'
);

SELECT throws_ok(
  $$INSERT INTO public.reward_transactions (user_id, points, transaction_type, idempotency_key)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 10, 'ADMIN_ADJUSTMENT', 'test:1')$$,
  '23505', NULL, '5. idempotency_key dupliquée refusée'
);

SELECT ok(public.progression_allocations_valid(20, '[{"skill":"explorer","weight":1,"points":20}]'::jsonb), '6. allocation exacte valide');
SELECT ok(NOT public.progression_allocations_valid(20, '[{"skill":"explorer","weight":1,"points":19}]'::jsonb), '7. somme incorrecte refusée');
SELECT throws_ok(
  $$INSERT INTO public.reward_transactions (user_id, points, transaction_type, skill_allocations)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 20, 'PROGRESSION_AWARD', '[{"skill":"explorer","weight":1,"points":19}]'::jsonb)$$,
  '23514', NULL, '8. contrainte CHECK des allocations appliquée'
);

SELECT * FROM finish();
ROLLBACK;
