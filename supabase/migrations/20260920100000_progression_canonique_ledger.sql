-- ============================================================================
-- P1 — Ledger canonique de progression : colonnes additives et validateur.
-- La progression devient une projection du Reward Engine (aucun moteur parallèle).
-- ============================================================================

ALTER TABLE public.reward_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES public.progression_seasons(id),
  ADD COLUMN IF NOT EXISTS rules_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS skill_allocations JSONB,
  ADD COLUMN IF NOT EXISTS counts_for_progression BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS affects_balance BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.reward_transactions DROP CONSTRAINT IF EXISTS reward_transactions_transaction_type_check;
ALTER TABLE public.reward_transactions ADD CONSTRAINT reward_transactions_transaction_type_check
  CHECK (transaction_type IN ('LIKE_REWARD','COMMENT_REWARD','POST_REWARD','JOURNAL_REWARD','GROUP_REWARD',
    'QUALITY_BONUS','FRAUD_REVERSAL','ADMIN_ADJUSTMENT','REDEMPTION','EXPIRATION','REFERRAL_REWARD','PROGRESSION_AWARD'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_transactions_idempotency
  ON public.reward_transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.progression_allocations_valid(p_points INTEGER, p_allocations JSONB)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT p_allocations IS NULL OR (
    jsonb_typeof(p_allocations) = 'array'
    AND COALESCE((SELECT SUM((e->>'points')::int) FROM jsonb_array_elements(p_allocations) e), 0) = p_points
    AND COALESCE((SELECT bool_and(
          COALESCE((e->>'weight')::numeric, 0) >= 0
          AND e->>'skill' IN ('explorer','preparer','partager','entraider')
        ) FROM jsonb_array_elements(p_allocations) e), true)
  );
$$;

ALTER TABLE public.reward_transactions DROP CONSTRAINT IF EXISTS chk_skill_allocations;
ALTER TABLE public.reward_transactions ADD CONSTRAINT chk_skill_allocations
  CHECK (skill_allocations IS NULL OR public.progression_allocations_valid(points, skill_allocations));
