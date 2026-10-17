-- ============================================================================
-- 20261017000000_kit_attribution_reverse_bounded.sql — NON APPLIQUÉE
-- Part créateur (Lot 6), PLAN-100 1.1 : reprise d'un crédit déjà versé.
--
-- Deux défauts de `reverse_kit_attribution_by_session` (A11), reproduits par
-- `supabase/replay/kit_attribution_reverse_check.sql` (base jetable) :
--   1. la reprise n'avait lieu que si l'ATTRIBUTION était 'paid', or
--      `finalize_kit_attributions` passe les PARTS à 'paid' et laisse
--      l'attribution 'confirmed' : un crédit versé puis remboursé n'était
--      jamais repris (ni compte, ni registre) ;
--   2. dans cette branche, le registre débitait la part entière alors que le
--      compte n'était débité que du solde restant (GREATEST(0, …)) : registre
--      et compte divergeaient.
-- Correctif : la reprise suit le statut de la PART ('paid'), quel que soit
-- celui de l'attribution ; par bénéficiaire, elle prend au plus le solde (ligne
-- de compte verrouillée), et le registre écrit exactement ce montant (aucune
-- ligne à 0). Idempotence inchangée : les parts passent ensuite à 'reversed',
-- un rejeu ne reprend rien. Aucun versement ajouté, aucun droit élargi.
-- Ce qui n'a pu être repris (déjà dépensé) n'est pas une dette : le compte ne
-- descend jamais sous 0 (règle d'A11 conservée).
--
-- Application manuelle quand la boutique (Stripe) est rallumée, après passage
-- du contrôle ci-dessus avec `-v fix=1` (voir README de ce dossier).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reverse_kit_attribution_by_session(
  p_stripe_session_id text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reversed integer := 0;
  r          record;
  d          record;
  v_balance  bigint;
  v_take     bigint;
BEGIN
  FOR r IN
    SELECT a.id AS attribution_id
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.kit_attributions a ON a.order_item_id = oi.id
    WHERE o.stripe_session_id = p_stripe_session_id
      AND a.status IN ('pending','confirmed','paid')
    FOR UPDATE OF a
  LOOP
    -- Reprise des parts déjà versées, par bénéficiaire, bornée au solde.
    FOR d IN
      SELECT s.beneficiary_id, sum(s.share_cents)::bigint AS total_cents
      FROM public.kit_royalty_shares s
      WHERE s.attribution_id = r.attribution_id AND s.status = 'paid'
      GROUP BY s.beneficiary_id
      ORDER BY s.beneficiary_id
    LOOP
      SELECT ra.store_credit_cents INTO v_balance
      FROM public.reward_accounts ra
      WHERE ra.user_id = d.beneficiary_id
      FOR UPDATE;
      v_take := LEAST(d.total_cents, GREATEST(0, COALESCE(v_balance, 0)));
      IF v_take > 0 THEN
        INSERT INTO public.store_credit_ledger (user_id, attribution_id, amount_cents, entry_type)
        VALUES (d.beneficiary_id, r.attribution_id, -v_take, 'debit');
        UPDATE public.reward_accounts
        SET store_credit_cents = store_credit_cents - v_take
        WHERE user_id = d.beneficiary_id;
      END IF;
    END LOOP;

    UPDATE public.kit_royalty_shares SET status = 'reversed'
    WHERE attribution_id = r.attribution_id
      AND status IN ('pending','confirmed','paid');
    UPDATE public.kit_attributions SET status = 'reversed', confirmed_at = now()
    WHERE id = r.attribution_id;

    v_reversed := v_reversed + 1;
  END LOOP;

  RETURN v_reversed;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_kit_attribution_by_session(text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_kit_attribution_by_session(text)
  TO service_role;

COMMENT ON FUNCTION public.reverse_kit_attribution_by_session(text) IS
  'Remboursement Stripe : reverse des parts ; reprise des parts versées bornée au solde, registre = montant repris ; service_role uniquement.';
