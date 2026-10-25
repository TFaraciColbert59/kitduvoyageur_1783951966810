-- ============================================================================
-- P1 — Outbox de progression durable, trigger de solde respectueux du marquage,
-- révocation des écritures clientes directes.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_reward_account_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT COALESCE(NEW.affects_balance, true) THEN
    RETURN NEW; -- progression pure : aucun droit économique supplémentaire
  END IF;
  INSERT INTO public.reward_accounts (
    user_id, available_points, lifetime_points, eligible_points, earned_this_period, redeemed_points
  ) VALUES (
    NEW.user_id,
    GREATEST(0, NEW.points),
    GREATEST(0, NEW.points),
    GREATEST(0, NEW.points),
    GREATEST(0, NEW.points),
    CASE WHEN NEW.transaction_type = 'REDEMPTION' THEN ABS(NEW.points) ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    available_points = GREATEST(0, public.reward_accounts.available_points + NEW.points),
    lifetime_points = public.reward_accounts.lifetime_points + CASE WHEN NEW.points > 0 THEN NEW.points ELSE 0 END,
    eligible_points = GREATEST(0, public.reward_accounts.eligible_points + NEW.points),
    earned_this_period = GREATEST(0, public.reward_accounts.earned_this_period + CASE WHEN NEW.transaction_type <> 'REDEMPTION' THEN NEW.points ELSE 0 END),
    redeemed_points = public.reward_accounts.redeemed_points + CASE WHEN NEW.transaction_type = 'REDEMPTION' THEN ABS(NEW.points) ELSE 0 END,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TABLE IF NOT EXISTS public.progression_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_transaction_id UUID NOT NULL UNIQUE REFERENCES public.reward_transactions(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  season_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','processed','failed','dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  payload_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.progression_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_outbox FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_progression_outbox()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT COALESCE(NEW.counts_for_progression, false) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.progression_outbox (reward_transaction_id, user_id, season_id, payload_snapshot)
  VALUES (NEW.id, NEW.user_id, NEW.season_id,
    jsonb_build_object('points', NEW.points, 'allocations', NEW.skill_allocations,
      'transaction_type', NEW.transaction_type, 'effective_at', NEW.effective_at,
      'rules_version', NEW.rules_version, 'reference_type', NEW.reference_type))
  ON CONFLICT (reward_transaction_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_reward_transaction_progression_outbox ON public.reward_transactions;
CREATE TRIGGER on_reward_transaction_progression_outbox
  AFTER INSERT ON public.reward_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_progression_outbox();

DROP POLICY IF EXISTS "Allow admin write on reward_transactions" ON public.reward_transactions;
REVOKE INSERT, UPDATE, DELETE ON public.reward_transactions FROM anon, authenticated;
DROP POLICY IF EXISTS "Allow admin write on pending_contributions" ON public.pending_contributions;
REVOKE INSERT, UPDATE, DELETE ON public.pending_contributions FROM anon, authenticated;
