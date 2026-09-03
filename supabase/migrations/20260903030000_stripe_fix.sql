-- ============================================================================
-- 20260903030000_stripe_fix.sql
-- Chantier « Lignées de kits » — Lot 3 : réparation du tuyau Stripe.
--   • checkout_intents : panier validé serveur externalisé quand les metadata
--     débordent la limite Stripe de 500 caractères (écritures service_role
--     uniquement — les clients anon/authenticated n'y ont aucun accès).
--   • orders : complétion du schéma attendu par le webhook (colonnes v2
--     jamais appliquées) + stripe_session_id UNIQUE pour l'idempotence.
--   • decrement_stock_on_order : durcissement search_path (SECURITY DEFINER).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Panier validé externalisé (metadata overflow)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkout_intents (
  id         uuid PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payload    jsonb NOT NULL, -- [{id,name,quantity}] validé SERVEUR
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','used','expired')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_intents ENABLE ROW LEVEL SECURITY;

-- Aucune policy pour anon/authenticated → la route (service_role) et le
-- webhook (service_role) sont les SEULS à lire/écrire cette table.
DROP POLICY IF EXISTS "checkout_intents_service_all" ON public.checkout_intents;
CREATE POLICY "checkout_intents_service_all" ON public.checkout_intents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_checkout_intents_user ON public.checkout_intents (user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_intents_status ON public.checkout_intents (status);

-- ----------------------------------------------------------------------------
-- 2) orders : colonnes du schéma v2 jamais appliquées + idempotence
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method  text,
  ADD COLUMN IF NOT EXISTS subtotal_eur    numeric(10,2),
  ADD COLUMN IF NOT EXISTS shipping_eur    numeric(10,2),
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

-- Idempotence webhook : un index unique (les NULL multiples sont autorisés)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                 WHERE indexname = 'orders_stripe_session_id_key') THEN
    CREATE UNIQUE INDEX orders_stripe_session_id_key
      ON public.orders (stripe_session_id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3) decrement_stock_on_order : durcissement du search_path (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_regproc text;
BEGIN
  SELECT p.oid::regprocedure::text INTO v_regproc
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname = 'decrement_stock_on_order'
  LIMIT 1;
  IF v_regproc IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', v_regproc);
  END IF;
END $$;