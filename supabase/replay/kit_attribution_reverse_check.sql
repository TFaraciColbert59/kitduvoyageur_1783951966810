-- ============================================================================
-- Part créateur (Lot 6) — contrôle du remboursement d'un crédit déjà versé
-- (PLAN-100 1.1). Base JETABLE uniquement : le fichier recrée `public` et `auth`
-- avec des tables minimales, charge la migration A11 telle quelle, puis, avec
-- `-v fix=1`, le correctif non appliqué de `supabase/migrations_deferred/`.
--
--   createdb lkdv_kit_attr_check
--   psql -d lkdv_kit_attr_check -v ON_ERROR_STOP=1 -v fix=0 -f supabase/replay/kit_attribution_reverse_check.sql   # échoue (défaut)
--   psql -d lkdv_kit_attr_check -v ON_ERROR_STOP=1 -v fix=1 -f supabase/replay/kit_attribution_reverse_check.sql   # passe
--
-- Invariants : un crédit versé puis remboursé est repris ; la reprise est bornée
-- au solde (jamais négatif) ET le registre dit exactement ce qui a été repris
-- (somme du registre − dépenses = solde) ; rejouer le remboursement ne reprend
-- rien de plus ; une part non versée n'écrit rien au registre.
-- ============================================================================
\set ON_ERROR_STOP 1
SELECT current_database() = 'lkdv_kit_attr_check' AS on_scratch_db \gset
\if :on_scratch_db
\else
  \echo 'Refus : base jetable lkdv_kit_attr_check attendue (ce fichier supprime le schéma public).'
  \quit
\endif

SET client_min_messages = warning;
DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;
DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA auth;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.materiel_kits (id uuid PRIMARY KEY, user_id uuid, lineage_root_id uuid, ancestors uuid[]);
CREATE TABLE public.materiel_kit_items (kit_id uuid, product_id uuid);
CREATE TABLE public.shop_products (id uuid PRIMARY KEY);
CREATE TABLE public.orders (id uuid PRIMARY KEY, stripe_session_id text);
CREATE TABLE public.order_items (id uuid PRIMARY KEY, order_id uuid REFERENCES public.orders(id));
CREATE TABLE public.reward_accounts (user_id uuid PRIMARY KEY);
CREATE TABLE public.hike_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kit_id uuid, distance_km numeric);

\ir ../migrations/20260911400000_a11_kit_attributions.sql
\if :fix
\ir ../migrations_deferred/20261017000000_kit_attribution_reverse_bounded.sql
\endif

-- Fixtures : A (créatrice, dépense ensuite 70 c), B (créateur, ne dépense rien),
-- C (créateur d'une vente non encore versée), D acheteur. Trois ventes, trois sessions Stripe.
INSERT INTO auth.users VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000003'), ('dddddddd-0000-0000-0000-000000000004');
INSERT INTO public.shop_products VALUES ('eeeeeeee-0000-0000-0000-000000000001');
INSERT INTO public.materiel_kits VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b2', '{}'),
  ('00000000-0000-0000-0000-0000000000c3', 'cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c3', '{}');
INSERT INTO public.materiel_kit_items
SELECT id, 'eeeeeeee-0000-0000-0000-000000000001' FROM public.materiel_kits;
-- Preuve terrain (>= 1 km) sur chaque lignée : sans elle, aucune attribution.
INSERT INTO public.hike_sessions (kit_id, distance_km) SELECT id, 5 FROM public.materiel_kits;
INSERT INTO public.orders VALUES
  ('70000000-0000-0000-0000-000000000001', 'cs_a'), ('70000000-0000-0000-0000-000000000002', 'cs_b'),
  ('70000000-0000-0000-0000-000000000003', 'cs_c');
INSERT INTO public.order_items VALUES
  ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002'),
  ('60000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003');

SELECT public.insert_kit_attribution(k.kit, k.item, 'eeeeeeee-0000-0000-0000-000000000001', 3333, 300,
  jsonb_build_array(jsonb_build_object('beneficiary_id', k.benef, 'generation_gap', 0, 'share_cents', 100)),
  'dddddddd-0000-0000-0000-000000000004')
FROM (VALUES
  ('00000000-0000-0000-0000-0000000000a1'::uuid, '60000000-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid),
  ('00000000-0000-0000-0000-0000000000b2', '60000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-0000000000c3', '60000000-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000003')
) AS k(kit, item, benef) \g /dev/null

-- A et B passent le délai de 14 jours et sont versées ; C reste en attente.
UPDATE public.kit_attributions SET created_at = now() - interval '15 days'
WHERE order_item_id IN ('60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002');
SELECT public.finalize_kit_attributions() \g /dev/null
-- A dépense 70 c de son crédit (les dépenses ne passent pas par ce registre).
UPDATE public.reward_accounts SET store_credit_cents = store_credit_cents - 70
WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Les trois ventes sont remboursées ; le webhook rejoue A une seconde fois.
SELECT public.reverse_kit_attribution_by_session(s) FROM unnest(ARRAY['cs_a', 'cs_b', 'cs_c', 'cs_a']) AS s \g /dev/null

DO $$
DECLARE
  v_bal bigint;
  v_led bigint;
  v_n   integer;
BEGIN
  -- A : 100 versés, 70 dépensés → 30 repris, solde 0, registre = 100 − 30.
  SELECT store_credit_cents INTO v_bal FROM public.reward_accounts WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  SELECT coalesce(sum(amount_cents), 0) INTO v_led FROM public.store_credit_ledger WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  IF v_bal <> 0 THEN RAISE EXCEPTION 'A : solde % après remboursement, attendu 0 (crédit versé non repris)', v_bal; END IF;
  IF v_led - 70 <> v_bal THEN RAISE EXCEPTION 'A : registre % − dépenses 70 <> solde % (le registre ne dit pas ce qui a été repris)', v_led, v_bal; END IF;

  -- B : rien dépensé → 100 repris en entier, solde 0, registre 0.
  SELECT store_credit_cents INTO v_bal FROM public.reward_accounts WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  SELECT coalesce(sum(amount_cents), 0) INTO v_led FROM public.store_credit_ledger WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  IF v_bal <> 0 OR v_led <> 0 THEN RAISE EXCEPTION 'B : solde % et registre %, attendus 0 et 0', v_bal, v_led; END IF;

  -- Rejeu : une seule reprise par bénéficiaire.
  SELECT count(*) INTO v_n FROM public.store_credit_ledger WHERE entry_type = 'debit';
  IF v_n <> 2 THEN RAISE EXCEPTION '% lignes de reprise, attendues 2 (A et B, une fois chacun)', v_n; END IF;

  -- C : jamais versé → aucune ligne de registre, aucun compte crédité.
  SELECT count(*) INTO v_n FROM public.store_credit_ledger WHERE user_id = 'cccccccc-0000-0000-0000-000000000003';
  IF v_n <> 0 THEN RAISE EXCEPTION 'C : % lignes de registre pour une part jamais versée', v_n; END IF;

  -- Tout est reversed, et jamais de solde négatif.
  SELECT count(*) INTO v_n FROM public.kit_royalty_shares WHERE status <> 'reversed';
  IF v_n <> 0 THEN RAISE EXCEPTION '% parts non reversées', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.kit_attributions WHERE status <> 'reversed';
  IF v_n <> 0 THEN RAISE EXCEPTION '% attributions non reversées', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.reward_accounts WHERE store_credit_cents < 0;
  IF v_n <> 0 THEN RAISE EXCEPTION '% soldes négatifs', v_n; END IF;

  RAISE WARNING 'kit_attribution_reverse_check : OK';
END $$;
