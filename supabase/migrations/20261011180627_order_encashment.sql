-- ============================================================================
-- T38 — Encaissement réel autoritaire pour la fidélité future.
--
-- Constat P0/T03 : `status = confirmed` ne prouve PAS l'encaissement (des
-- commandes virement sont confirmées avant réception des fonds). Aucune
-- émission de fidélité nouvelle ne peut se fonder sur `confirmed`.
--
-- Cette migration livre le MOTEUR d'encaissement (idempotent par événement
-- source, remboursements partiels en centimes, jamais de solde négatif).
-- Le BRANCHEMENT du webhook Stripe reste une étape nommée : il exige la clé
-- webhook et un test de rejeu réel (gates P6). Tant qu'il n'est pas branché,
-- AUCUNE émission nouvelle n'a lieu — seule la réconciliation reste possible.
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_merchandise_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_merchandise_cents integer NOT NULL DEFAULT 0;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_state_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_state_check
  CHECK (payment_state IN ('pending', 'paid', 'partially_refunded', 'refunded'));

-- Journal d'événements d'encaissement (idempotence par identifiant STRIPE).
CREATE TABLE IF NOT EXISTS public.order_encashment_events (
  event_id text PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id),
  kind text NOT NULL CHECK (kind IN ('payment', 'refund')),
  merchandise_cents integer NOT NULL CHECK (merchandise_cents >= 0),
  credits_delta integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_encashment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_encashment_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.order_encashment_events TO service_role;

-- Encaissement : 10 crédits par euro de marchandises (centimes / 10).
-- Idempotent par event_id ; un remboursement avant paiement est sans effet.
CREATE OR REPLACE FUNCTION public.record_order_encashment_event(
  p_event_id text,
  p_order_id uuid,
  p_kind text,
  p_merchandise_cents integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_order RECORD; v_credits integer;
BEGIN
  IF p_kind NOT IN ('payment', 'refund') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'type_invalide');
  END IF;
  IF p_merchandise_cents IS NULL OR p_merchandise_cents < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'montant_invalide');
  END IF;

  SELECT id, user_id, payment_state, paid_merchandise_cents, refunded_merchandise_cents
    INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'commande_introuvable');
  END IF;

  IF p_kind = 'refund' AND v_order.payment_state = 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'paiement_non_encaisse');
  END IF;

  v_credits := FLOOR(p_merchandise_cents::numeric / 10)::int;
  IF p_kind = 'refund' THEN v_credits := -v_credits; END IF;

  INSERT INTO public.order_encashment_events (event_id, order_id, kind, merchandise_cents, credits_delta)
  VALUES (p_event_id, p_order_id, p_kind, p_merchandise_cents, v_credits)
  ON CONFLICT (event_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'creditsDelta', 0);
  END IF;

  UPDATE public.orders
  SET paid_merchandise_cents = paid_merchandise_cents + CASE WHEN p_kind = 'payment' THEN p_merchandise_cents ELSE 0 END,
      refunded_merchandise_cents = refunded_merchandise_cents + CASE WHEN p_kind = 'refund' THEN p_merchandise_cents ELSE 0 END,
      payment_state = CASE
        WHEN p_kind = 'refund'
          AND refunded_merchandise_cents + p_merchandise_cents >= paid_merchandise_cents THEN 'refunded'
        WHEN p_kind = 'refund' AND refunded_merchandise_cents + p_merchandise_cents > 0 THEN 'partially_refunded'
        ELSE 'paid'
      END
  WHERE id = p_order_id;

  -- Crédits dans le journal fidélité historique (jamais négatif : un
  -- remboursement ne peut retirer que ce qui a été réellement encaissé).
  INSERT INTO public.loyalty_history (user_id, points, action, type, source_id)
  VALUES (
    v_order.user_id,
    CASE
      WHEN p_kind = 'refund' THEN -LEAST(
        FLOOR(p_merchandise_cents::numeric / 10)::int,
        GREATEST(0, (SELECT COALESCE(SUM(points), 0) FROM public.loyalty_history h
                     WHERE h.user_id = v_order.user_id AND h.source_id LIKE 'order:%'))
      )
      ELSE FLOOR(p_merchandise_cents::numeric / 10)::int
    END,
    CASE WHEN p_kind = 'payment' THEN 'order_encashment' ELSE 'order_refund' END,
    CASE WHEN p_kind = 'payment' THEN 'import' ELSE 'spend' END,
    'order:' || p_order_id::text || ':' || p_event_id
  );

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'creditsDelta', v_credits);
END $$;
REVOKE ALL ON FUNCTION public.record_order_encashment_event(text, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_encashment_event(text, uuid, text, integer) TO service_role;

-- Désactivation des émissions NON AUTORITAIRES : les triggers legacy
-- créditaient 10 pts/€ dès la transition de statut (`confirmed` inclus pour un
-- virement non encaissé). Les fonctions sont CONSERVÉES (aucune destruction de
-- journal, aucun down destructif) ; les crédits historiques restent en place.
-- Désormais, SEUL un événement d'encaissement réel produit des crédits.
DROP TRIGGER IF EXISTS trigger_process_order_points ON public.orders;
DROP TRIGGER IF EXISTS trigger_process_pending_order_points ON public.orders;
