-- ============================================================================
-- 20260911400000_a11_kit_attributions.sql
-- A11 — Réimplémentation additive du domaine « part créateur » (Lot 6).
--
-- Contexte : la migration historique `20260903050000_kit_attributions.sql` est
-- gelée dans `supabase/migrations_frozen/` (jamais appliquée en production,
-- absente du ledger baseline). Ce fichier la réimplémente proprement en
-- migration additive post-baseline, cohérente avec le schéma baseline actuel
-- (materiel_kits, order_items, shop_products, reward_accounts, auth.users)
-- et avec les consommateurs applicatifs :
--   • stripe webhook  → royalty_config (service_role), insert/reverse RPC ;
--   • cron finalize   → finalize_kit_attributions RPC ;
--   • /api/kits/my-royalties → kit_royalty_shares.created_at + RLS own.
--
-- Contenu : barème serveur, attributions (idempotentes par order_item),
-- parts par bénéficiaire × génération, crédit boutique (ledger append-only),
-- 3 RPC SECURITY DEFINER (search_path verrouillé), RLS + grants explicites,
-- suppression utilisateur en cascade (ON DELETE CASCADE sur auth.users).
--
-- Idempotente et additive : CREATE IF NOT EXISTS, DROP POLICY IF EXISTS,
-- CREATE OR REPLACE, ON CONFLICT DO NOTHING. Aucune donnée métier inventée
-- (les valeurs du barème sont celles ratifiées par le gel Lot 6).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Barème (config en base, lue par le serveur — jamais par le client)
--    global_bps=300 (3 %), répartition 70/20/10, profondeur max 3, plancher 1 c.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.royalty_config (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

INSERT INTO public.royalty_config (key, value)
VALUES (
  'global',
  '{"global_bps": 300, "weights": {"0": 7000, "1": 2000, "2": 1000}, "max_generations": 3, "floor_cents": 1}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Barème réservé au serveur : RLS active sans policy client, grants serveur seul.
ALTER TABLE public.royalty_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.royalty_config FROM anon, authenticated;
GRANT ALL ON TABLE public.royalty_config TO service_role;

-- ----------------------------------------------------------------------------
-- 2) Attributions + parts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kit_attributions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id        uuid NOT NULL REFERENCES public.materiel_kits(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id)   ON DELETE CASCADE,
  product_id    uuid REFERENCES public.shop_products(id)          ON DELETE SET NULL,
  amount_cents  integer NOT NULL CHECK (amount_cents >= 0),
  rate_bps      integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 2000),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','confirmed','reversed','paid')),
  confirmed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kit_attributions_order_item_key UNIQUE (order_item_id)
);

CREATE TABLE IF NOT EXISTS public.kit_royalty_shares (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES public.kit_attributions(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES auth.users(id)              ON DELETE CASCADE,
  generation_gap smallint NOT NULL CHECK (generation_gap BETWEEN 0 AND 2),
  share_cents    integer NOT NULL CHECK (share_cents > 0),
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','confirmed','reversed','paid')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kit_royalty_shares_attribution_beneficiary_key
    UNIQUE (attribution_id, beneficiary_id)
);

CREATE INDEX IF NOT EXISTS idx_kit_attributions_kit
  ON public.kit_attributions (kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_attributions_status_created
  ON public.kit_attributions (status, created_at);
CREATE INDEX IF NOT EXISTS idx_kit_royalty_shares_beneficiary
  ON public.kit_royalty_shares (beneficiary_id, status);

-- RLS : écriture service_role exclusivement ; un bénéficiaire ne lit que ses
-- parts et l'attribution associée (embed PostgREST /api/kits/my-royalties).
ALTER TABLE public.kit_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_royalty_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kit_attributions_select_beneficiary" ON public.kit_attributions;
CREATE POLICY "kit_attributions_select_beneficiary" ON public.kit_attributions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.kit_royalty_shares s
      WHERE s.attribution_id = kit_attributions.id
        AND s.beneficiary_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "royalty_shares_select_own" ON public.kit_royalty_shares;
CREATE POLICY "royalty_shares_select_own" ON public.kit_royalty_shares
  FOR SELECT TO authenticated
  USING (auth.uid() = beneficiary_id);

-- ----------------------------------------------------------------------------
-- 3) Crédit boutique (extension reward engine, décision GATE 0)
-- ----------------------------------------------------------------------------
ALTER TABLE public.reward_accounts
  ADD COLUMN IF NOT EXISTS store_credit_cents bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.store_credit_ledger (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id)              ON DELETE CASCADE,
  attribution_id uuid REFERENCES public.kit_attributions(id)          ON DELETE SET NULL,
  amount_cents   integer NOT NULL CHECK (amount_cents <> 0),
  entry_type     text NOT NULL CHECK (entry_type IN ('credit','debit')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_credit_ledger_user
  ON public.store_credit_ledger (user_id, created_at DESC);

ALTER TABLE public.store_credit_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_credit_ledger_select_own" ON public.store_credit_ledger;
CREATE POLICY "store_credit_ledger_select_own" ON public.store_credit_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Grants explicites (les default privileges Supabase sont conservés en filet).
GRANT SELECT ON TABLE public.kit_attributions, public.kit_royalty_shares,
  public.store_credit_ledger TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.kit_attributions,
  public.kit_royalty_shares, public.store_credit_ledger FROM anon, authenticated;
GRANT ALL ON TABLE public.kit_attributions, public.kit_royalty_shares,
  public.store_credit_ledger TO service_role;

-- ----------------------------------------------------------------------------
-- 4) RPC — créer une attribution (webhook). Idempotente (UNIQUE order_item),
--    conditionnée à la preuve terrain de la lignée et au produit du kit.
--    Écriture service_role uniquement.
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
  v_kit     public.materiel_kits%ROWTYPE;
  v_attr_id uuid;
  v_share   jsonb;
  v_benef   uuid;
  v_gap     smallint;
  v_cents   integer;
  v_field   bigint;
BEGIN
  SELECT * INTO v_kit FROM public.materiel_kits WHERE id = p_kit_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Condition d'activation : au moins une session >= 1 km sur la lignée du kit
  -- (le kit vendu lui-même compte : la preuve terrain peut être la sienne).
  SELECT count(*) INTO v_field
  FROM public.hike_sessions s
  JOIN public.materiel_kits m ON m.id = s.kit_id
  WHERE m.lineage_root_id = COALESCE(v_kit.lineage_root_id, v_kit.id)
    AND s.distance_km >= 1;
  IF v_field = 0 THEN RETURN NULL; END IF;

  -- Le produit acheté doit figurer dans le kit.
  IF NOT EXISTS (
    SELECT 1 FROM public.materiel_kit_items
    WHERE kit_id = p_kit_id AND product_id = p_product_id
  ) THEN
    RETURN NULL;
  END IF;

  -- Idempotence : UNIQUE(order_item_id) — rejeu de webhook sans doublon.
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

  FOR v_share IN SELECT * FROM jsonb_array_elements(COALESCE(p_shares, '[]'::jsonb))
  LOOP
    v_benef := (v_share->>'beneficiary_id')::uuid;
    v_gap   := (v_share->>'generation_gap')::smallint;
    v_cents := (v_share->>'share_cents')::integer;
    -- Auto-achat : aucune part pour l'acheteur lui-même.
    IF v_benef IS NOT NULL AND v_cents > 0 AND v_benef <> p_buyer_user_id THEN
      INSERT INTO public.kit_royalty_shares (attribution_id, beneficiary_id,
                                             generation_gap, share_cents)
      VALUES (v_attr_id, v_benef, v_gap, v_cents)
      ON CONFLICT (attribution_id, beneficiary_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_attr_id;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_kit_attribution(uuid,uuid,uuid,integer,integer,jsonb,uuid)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_kit_attribution(uuid,uuid,uuid,integer,integer,jsonb,uuid)
  TO service_role;

COMMENT ON FUNCTION public.insert_kit_attribution(uuid,uuid,uuid,integer,integer,jsonb,uuid) IS
  'A11 — attribution de part créateur : idempotente par order_item, conditionnée à la preuve terrain, service_role uniquement.';

-- ----------------------------------------------------------------------------
-- 5) RPC — finalisation (job planifié) : pending -> confirmed après 14 jours,
--    confirmation des parts, puis crédit boutique (ledger + compte) une fois.
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
  -- 1) Attribution confirmée après le délai légal de rétractation (14 jours),
  --    puis parts de ces attributions confirmées (jamais exposées avant).
  WITH confirmed AS (
    UPDATE public.kit_attributions
    SET status = 'confirmed', confirmed_at = now()
    WHERE status = 'pending'
      AND created_at <= now() - interval '14 days'
    RETURNING id
  )
  UPDATE public.kit_royalty_shares s
  SET status = 'confirmed'
  FROM confirmed c
  WHERE s.attribution_id = c.id
    AND s.status = 'pending';

  -- 2) Crédit store de chaque part confirmée (une seule fois → status 'paid').
  FOR r IN
    SELECT s.id AS share_id, s.beneficiary_id, s.share_cents, s.attribution_id
    FROM public.kit_royalty_shares s
    JOIN public.kit_attributions a ON a.id = s.attribution_id
    WHERE s.status = 'confirmed' AND a.status = 'confirmed'
    ORDER BY s.id
    FOR UPDATE OF s SKIP LOCKED
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

REVOKE ALL ON FUNCTION public.finalize_kit_attributions() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_kit_attributions() TO service_role;

COMMENT ON FUNCTION public.finalize_kit_attributions() IS
  'A11 — confirmation 14 jours puis versement du crédit boutique (idempotent par statut paid), service_role uniquement.';

-- ----------------------------------------------------------------------------
-- 6) RPC — retour/remboursement (webhook Stripe) : reverse par session.
--    Si des parts avaient déjà été créditées, chaque bénéficiaire est débité
--    une seule fois (ledger + compte, jamais négatif), puis tout est reversed.
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
    FOR UPDATE OF a
  LOOP
    IF r.status = 'paid' THEN
      -- Débit du crédit déjà versé : une ligne de ledger par part payée.
      INSERT INTO public.store_credit_ledger (user_id, attribution_id, amount_cents, entry_type)
      SELECT s.beneficiary_id, s.attribution_id, -s.share_cents, 'debit'
      FROM public.kit_royalty_shares s
      WHERE s.attribution_id = r.attribution_id AND s.status = 'paid';

      -- Débit des comptes par bénéficiaire, borné à 0 (jamais négatif).
      UPDATE public.reward_accounts ra
      SET store_credit_cents = GREATEST(0, ra.store_credit_cents - d.total_cents)
      FROM (
        SELECT s.beneficiary_id, sum(s.share_cents) AS total_cents
        FROM public.kit_royalty_shares s
        WHERE s.attribution_id = r.attribution_id AND s.status = 'paid'
        GROUP BY s.beneficiary_id
      ) d
      WHERE ra.user_id = d.beneficiary_id;
    END IF;

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
  'A11 — remboursement Stripe : reverse des parts et débit par bénéficiaire, service_role uniquement.';
