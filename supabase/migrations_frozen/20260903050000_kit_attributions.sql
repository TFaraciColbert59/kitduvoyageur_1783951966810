-- ============================================================================
-- 20260903050000_kit_attributions.sql
-- Chantier « Lignées de kits » — Lot 6 : la part créateur.
--   • royalty_config      — barème en base (global_bps=300, weights 70/20/10,
--                           max 3 générations, plancher 1 cent) modifiable sans
--                           migration (valeur ADMIN, jamais du client).
--   • kit_attributions    — une par order_item (UNIQUE → idempotence webhook) ;
--                           écriture service_role UNIQUEMENT (aucune policy client).
--   • kit_royalty_shares  — une part par bénéficiaire × génération ; RLS : un
--                           bénéficiaire ne lit que ses parts.
--   • store credit        — extension du reward engine (décision GATE 0) :
--                           reward_accounts.store_credit_cents + ledger
--                           append-only store_credit_ledger.
--   • RPC SECURITY DEFINER : insert_kit_attribution (idempotente, conditionnée à
--     la preuve terrain), finalize_kit_attributions (14 j + crédit),
--     reverse_kit_attribution_by_session (retour/remboursement).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Barème (config en base, lue par le serveur — jamais par le client)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.royalty_config (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

INSERT INTO public.royalty_config (key, value)
VALUES (
  'global',
  '{"global_bps": 300, "weights": {"0": 7000, "1": 2000, "2": 1000}, "max_generations": 3, "floor_cents": 1}'
)
ON CONFLICT (key) DO NOTHING;

GRANT SELECT ON public.royalty_config TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) Attributions + parts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kit_attributions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id        uuid NOT NULL REFERENCES public.materiel_kits(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id)   ON DELETE CASCADE,
  product_id    uuid REFERENCES public.shop_products(id) ON DELETE SET NULL,
  amount_cents  integer NOT NULL CHECK (amount_cents >= 0),
  rate_bps      integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 2000),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','confirmed','reversed','paid')),
  confirmed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_item_id)                -- idempotence sur rejeu du webhook
);

CREATE TABLE IF NOT EXISTS public.kit_royalty_shares (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES public.kit_attributions(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_gap smallint NOT NULL,     -- 0 = forkeur, 1 = parent, 2 = grand-parent
  share_cents    integer NOT NULL CHECK (share_cents > 0),
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','confirmed','reversed','paid')),
  UNIQUE (attribution_id, beneficiary_id)
);

CREATE INDEX IF NOT EXISTS idx_kit_attributions_kit ON public.kit_attributions (kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_royalty_shares_beneficiary
  ON public.kit_royalty_shares (beneficiary_id, status);

-- RLS : les attributions ne sont JAMAIS écrites/lues par le client.
ALTER TABLE public.kit_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_royalty_shares ENABLE ROW LEVEL SECURITY;

-- Un bénéficiaire ne lit que ses propres parts.
DROP POLICY IF EXISTS "royalty_shares_select_own" ON public.kit_royalty_shares;
CREATE POLICY "royalty_shares_select_own" ON public.kit_royalty_shares
  FOR SELECT USING (auth.uid() = beneficiary_id);

-- ----------------------------------------------------------------------------
-- 3) Crédit boutique (extension reward engine, décision GATE 0)
-- ----------------------------------------------------------------------------
ALTER TABLE public.reward_accounts
  ADD COLUMN IF NOT EXISTS store_credit_cents bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.store_credit_ledger (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attribution_id uuid REFERENCES public.kit_attributions(id) ON DELETE SET NULL,
  amount_cents   integer NOT NULL CHECK (amount_cents <> 0),
  entry_type     text NOT NULL CHECK (entry_type IN ('credit','debit')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_credit_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_credit_ledger_select_own" ON public.store_credit_ledger;
CREATE POLICY "store_credit_ledger_select_own" ON public.store_credit_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4) RPC — créer une attribution (webhook). Idempotente, conditionnée au terrain.
--    SECURITY DEFINER, search_path verrouillé, écriture service_role uniquement.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_kit_attribution(
  p_kit_id         uuid,
  p_order_item_id  uuid,
  p_product_id     uuid,
  p_amount_cents   integer,
  p_rate_bps       integer,
  p_shares         jsonb,   -- [{beneficiary_id, generation_gap, share_cents}]
  p_buyer_user_id  uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kit      public.materiel_kits%ROWTYPE;
  v_attr_id  uuid;
  v_share    jsonb;
  v_benef    uuid;
  v_gap      smallint;
  v_cents    integer;
  v_field    bigint;
BEGIN
  SELECT * INTO v_kit FROM public.materiel_kits WHERE id = p_kit_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Condition d'activation : au moins une session >= 1 km dans la DESCENDANCE.
  SELECT count(*) INTO v_field
  FROM public.hike_sessions s
  JOIN public.materiel_kits m ON m.id = s.kit_id
  WHERE m.lineage_root_id = v_kit.lineage_root_id AND s.distance_km >= 1;
  IF v_field = 0 THEN RETURN NULL; END IF;

  -- Le produit acheté doit figurer dans le kit.
  IF NOT EXISTS (SELECT 1 FROM public.materiel_kit_items
                 WHERE kit_id = p_kit_id AND product_id = p_product_id) THEN
    RETURN NULL;
  END IF;

  -- Idempotence : UNIQUE(order_item_id).
  INSERT INTO public.kit_attributions (kit_id, order_item_id, product_id,
                                       amount_cents, rate_bps)
  VALUES (p_kit_id, p_order_item_id, p_product_id, p_amount_cents, p_rate_bps)
  ON CONFLICT (order_item_id) DO NOTHING
  RETURNING id INTO v_attr_id;

  IF v_attr_id IS NULL THEN
    SELECT id INTO v_attr_id FROM public.kit_attributions
    WHERE order_item_id = p_order_item_id;
    RETURN v_attr_id; -- déjà traitée (rejeu)
  END IF;

  FOR v_share IN SELECT * FROM jsonb_array_elements(p_shares) LOOP
    v_benef := (v_share->>'beneficiary_id')::uuid;
    v_gap   := (v_share->>'generation_gap')::smallint;
    v_cents := (v_share->>'share_cents')::integer;
    IF v_benef IS NOT NULL AND v_cents > 0 AND v_benef <> p_buyer_user_id THEN
      INSERT INTO public.kit_royalty_shares (attribution_id, beneficiary_id,
                                             generation_gap, share_cents)
      VALUES (v_attr_id, v_benef, v_gap, v_cents);
    END IF;
  END LOOP;

  RETURN v_attr_id;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_kit_attribution(uuid,uuid,uuid,integer,integer,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_kit_attribution(uuid,uuid,uuid,integer,integer,jsonb,uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 5) RPC — finalisation (job planifié) : pending -> confirmed après 14 jours,
--    puis CRÉDIT STORE pour chaque part confirmée (ledger + compte).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_kit_attributions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_paid integer := 0;
  r      record;
BEGIN
  -- 1) Confirmation après le délai légal de rétractation (14 jours).
  UPDATE public.kit_attributions
  SET status = 'confirmed', confirmed_at = now()
  WHERE status = 'pending'
    AND created_at <= now() - interval '14 days';

  -- 2) Crédit store de chaque part confirmée (une seule fois → status 'paid').
  FOR r IN
    SELECT s.id AS share_id, s.beneficiary_id, s.share_cents, s.attribution_id
    FROM public.kit_royalty_shares s
    JOIN public.kit_attributions a ON a.id = s.attribution_id
    WHERE s.status = 'confirmed' AND a.status = 'confirmed'
    LIMIT 500
  LOOP
    INSERT INTO public.store_credit_ledger (user_id, attribution_id, amount_cents, entry_type)
    VALUES (r.beneficiary_id, r.attribution_id, r.share_cents, 'credit');

    INSERT INTO public.reward_accounts (user_id, store_credit_cents)
    VALUES (r.beneficiary_id, r.share_cents)
    ON CONFLICT (user_id) DO UPDATE
    SET store_credit_cents = public.reward_accounts.store_credit_cents + r.share_cents;

    UPDATE public.kit_royalty_shares SET status = 'paid' WHERE id = r.share_id;
    v_paid := v_paid + 1;
  END LOOP;

  RETURN v_paid;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_kit_attributions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_kit_attributions() TO service_role;

-- ----------------------------------------------------------------------------
-- 6) RPC — retour/remboursement (webhook Stripe) : reverse par session.
--    Si une part avait déjà été créditée, on la débite (ledger + compte).
-- ----------------------------------------------------------------------------
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
BEGIN
  FOR r IN
    SELECT a.id AS attribution_id, a.status
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.kit_attributions a ON a.order_item_id = oi.id
    WHERE o.stripe_session_id = p_stripe_session_id
      AND a.status IN ('pending','confirmed','paid')
  LOOP
    IF r.status = 'paid' THEN
      -- Débit du crédit déjà versé (meilleur-effort, ne passe jamais en négatif).
      INSERT INTO public.store_credit_ledger (user_id, attribution_id, amount_cents, entry_type)
      SELECT s.beneficiary_id, s.attribution_id, -s.share_cents, 'debit'
      FROM public.kit_royalty_shares s WHERE s.attribution_id = r.attribution_id AND s.status = 'paid';

      UPDATE public.reward_accounts ra
      SET store_credit_cents = GREATEST(0, ra.store_credit_cents - (
        SELECT COALESCE(sum(s.share_cents), 0) FROM public.kit_royalty_shares s
        WHERE s.attribution_id = r.attribution_id AND s.status = 'paid'
      ))
      FROM public.kit_royalty_shares s
      WHERE ra.user_id = s.beneficiary_id AND s.attribution_id = r.attribution_id;
    END IF;

    UPDATE public.kit_royalty_shares SET status = 'reversed'
    WHERE attribution_id = r.attribution_id AND status IN ('pending','confirmed','paid');
    UPDATE public.kit_attributions SET status = 'reversed', confirmed_at = now()
    WHERE id = r.attribution_id;

    v_reversed := v_reversed + 1;
  END LOOP;

  RETURN v_reversed;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_kit_attribution_by_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_kit_attribution_by_session(text) TO service_role;