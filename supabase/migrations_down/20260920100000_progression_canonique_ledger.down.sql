-- Rollback 20260920100000 — retire les colonnes et le validateur d'allocations.
ALTER TABLE public.reward_transactions DROP CONSTRAINT IF EXISTS chk_skill_allocations;
DROP FUNCTION IF EXISTS public.progression_allocations_valid(integer, jsonb);
DROP INDEX IF EXISTS public.uq_reward_transactions_idempotency;
ALTER TABLE public.reward_transactions DROP CONSTRAINT IF EXISTS reward_transactions_transaction_type_check;
-- Les gains de progression n'existaient pas avant la migration : le rollback les
-- reclasse (aucune perte d'audit, les colonnes techniques sont retirées juste après).
UPDATE public.reward_transactions SET transaction_type = 'ADMIN_ADJUSTMENT'
WHERE transaction_type = 'PROGRESSION_AWARD';
ALTER TABLE public.reward_transactions ADD CONSTRAINT reward_transactions_transaction_type_check
  CHECK (transaction_type IN ('LIKE_REWARD','COMMENT_REWARD','POST_REWARD','JOURNAL_REWARD','GROUP_REWARD',
    'QUALITY_BONUS','FRAUD_REVERSAL','ADMIN_ADJUSTMENT','REDEMPTION','EXPIRATION','REFERRAL_REWARD'));
ALTER TABLE public.reward_transactions
  DROP COLUMN IF EXISTS affects_balance,
  DROP COLUMN IF EXISTS counts_for_progression,
  DROP COLUMN IF EXISTS skill_allocations,
  DROP COLUMN IF EXISTS rules_version,
  DROP COLUMN IF EXISTS season_id,
  DROP COLUMN IF EXISTS effective_at,
  DROP COLUMN IF EXISTS idempotency_key;
