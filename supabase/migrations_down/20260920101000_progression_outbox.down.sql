-- Rollback 20260920101000 — retire l'outbox et le trigger, restaure l'état antérieur
-- (y compris les privilèges d'écriture admin d'origine : un rollback est fidèle
-- à l'état précédent, durcissements compris).
DROP TRIGGER IF EXISTS on_reward_transaction_progression_outbox ON public.reward_transactions;
DROP FUNCTION IF EXISTS public.enqueue_progression_outbox();
DROP TABLE IF EXISTS public.progression_outbox;

CREATE OR REPLACE FUNCTION public.update_reward_account_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.reward_accounts (
    user_id, available_points, lifetime_points, eligible_points, earned_this_period, redeemed_points
  ) VALUES (
    NEW.user_id, GREATEST(0, NEW.points), GREATEST(0, NEW.points), GREATEST(0, NEW.points),
    GREATEST(0, NEW.points), CASE WHEN NEW.transaction_type = 'REDEMPTION' THEN ABS(NEW.points) ELSE 0 END
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Allow admin write on reward_transactions" ON public.reward_transactions;
CREATE POLICY "Allow admin write on reward_transactions"
  ON public.reward_transactions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT INSERT, UPDATE, DELETE ON public.reward_transactions TO authenticated;

DROP POLICY IF EXISTS "Allow admin write on pending_contributions" ON public.pending_contributions;
CREATE POLICY "Allow admin write on pending_contributions"
  ON public.pending_contributions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT INSERT, UPDATE, DELETE ON public.pending_contributions TO authenticated;
