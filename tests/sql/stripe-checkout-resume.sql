\set ON_ERROR_STOP on
-- Disposable, empty local database only. Never run on a project database.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public') THEN
    RAISE EXCEPTION 'fixture requires an empty database';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE TABLE public.user_profiles(id uuid PRIMARY KEY REFERENCES auth.users(id));
CREATE TABLE public.shop_products(id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL,
  stock integer NOT NULL DEFAULT 10, updated_at timestamptz, is_active boolean DEFAULT true, deleted_at timestamptz);
CREATE TABLE public.reward_accounts(user_id uuid PRIMARY KEY REFERENCES auth.users(id));
CREATE TABLE public.materiel_kits(id uuid PRIMARY KEY, user_id uuid, lineage_root_id uuid);
CREATE TABLE public.materiel_kit_items(kit_id uuid, product_id uuid);
CREATE TABLE public.hike_sessions(id uuid PRIMARY KEY, kit_id uuid, distance_km numeric);
CREATE TABLE public.loyalty_history(user_id uuid NOT NULL, points integer, action text, type text, source_id text);
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
\ir ../../supabase/migrations/20260715240000_inventory_stock_orders.sql
\ir ../../supabase/migrations/20260903030000_stripe_fix.sql
\ir ../../supabase/migrations/20260911400000_a11_kit_attributions.sql
\ir ../../supabase/migrations/20260911450000_a13_user_entitlements.sql
\ir ../../supabase/migrations/20261011180627_order_encashment.sql
\ir ../../supabase/migrations/20261029120000_stripe_checkout_resume.sql

BEGIN;
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.user_profiles SELECT id FROM auth.users;
INSERT INTO public.shop_products(id,name,slug,stock) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Paid article','paid-article',10),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Other article','other-article',10);
INSERT INTO public.materiel_kits(id,user_id,lineage_root_id) VALUES
 ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333');
INSERT INTO public.materiel_kit_items VALUES ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.hike_sessions VALUES ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333',2);
INSERT INTO public.orders(id,user_id,order_number,stripe_session_id,payment_method) VALUES
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','fixture','cs_fixture','card');
-- Interrupted legacy order: its persisted price must survive repair.
INSERT INTO public.order_items(order_id,product_id,quantity,unit_price_eur,total_price_eur) VALUES
 ('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2,12.34,24.68);
SELECT public.resume_stripe_checkout('55555555-5555-4555-8555-555555555555','cs_fixture',
 '[{"product_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","quantity":2,"total_cents":9999},
   {"product_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","quantity":1,"total_cents":500}]',2968,
 '{"plan":"expedition","pass":"trip"}');
-- Retry must not debit stock or loyalty twice; plan cannot regress.
SELECT public.resume_stripe_checkout('55555555-5555-4555-8555-555555555555','cs_fixture',
 '[{"product_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","quantity":2,"total_cents":9999},
   {"product_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","quantity":1,"total_cents":500}]',2968,
 '{"plan":"explorer","pass":"weekend"}');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.order_items) <> 2 OR (SELECT count(*) FROM public.stock_movements) <> 2
    OR (SELECT stock FROM public.shop_products WHERE slug = 'paid-article') <> 8
    OR (SELECT total_price_eur FROM public.order_items WHERE product_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 24.68
    OR (SELECT count(*) FROM public.order_encashment_events) <> 1
    OR (SELECT plan FROM public.user_entitlements) <> 'expedition'
    OR NOT (SELECT active_passes @> '["trip","weekend"]' FROM public.user_entitlements) THEN
    RAISE EXCEPTION 'repair/idempotence/paid price/entitlements assertion failed';
  END IF;
END $$;
-- No pass, plan-only grant: the aggregate must remain [] rather than SQL NULL.
INSERT INTO public.orders(id,user_id,order_number,stripe_session_id,payment_method) VALUES
 ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','plan','cs_plan','card');
SELECT public.resume_stripe_checkout('66666666-6666-4666-8666-666666666666','cs_plan','[]',0,'{"plan":"explorer"}');
DO $$ BEGIN
  IF (SELECT active_passes FROM public.user_entitlements WHERE user_id = '22222222-2222-4222-8222-222222222222') <> '[]'::jsonb THEN
    RAISE EXCEPTION 'plan-only grant failed'; END IF;
END $$;
-- Attribution is idempotent and refund permanently closes late checkout effects.
SELECT public.insert_kit_attribution('33333333-3333-4333-8333-333333333333',
 (SELECT id FROM public.order_items WHERE product_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2468,300,
 '[{"beneficiary_id":"22222222-2222-4222-8222-222222222222","generation_gap":0,"share_cents":74}]',
 '11111111-1111-4111-8111-111111111111');
SELECT public.reverse_kit_attribution_by_session('cs_fixture');
SELECT public.resume_stripe_checkout('55555555-5555-4555-8555-555555555555','cs_fixture',
 '[{"product_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","quantity":5,"total_cents":500}]',2968,'{"plan":"group"}');
SELECT public.insert_kit_attribution('33333333-3333-4333-8333-333333333333',
 (SELECT id FROM public.order_items WHERE product_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2468,300,'[]','11111111-1111-4111-8111-111111111111');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.stock_movements) <> 2
    OR (SELECT count(*) FROM public.kit_attributions WHERE status <> 'reversed') <> 0
    OR (SELECT plan FROM public.user_entitlements WHERE user_id = '11111111-1111-4111-8111-111111111111') <> 'expedition' THEN
    RAISE EXCEPTION 'refund terminal guard failed'; END IF;
END $$;
-- Inject an encashment failure with a constraint. All earlier line/stock writes
-- in that RPC must roll back, then the same call must succeed after recovery.
ALTER TABLE public.loyalty_history ADD CONSTRAINT fixture_encashment_failure CHECK (action <> 'order_encashment') NOT VALID;
INSERT INTO public.orders(id,user_id,order_number,stripe_session_id,payment_method) VALUES
 ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','failure','cs_failure','card');
DO $$ BEGIN
  BEGIN
    PERFORM public.resume_stripe_checkout('77777777-7777-4777-8777-777777777777','cs_failure',
      '[{"product_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","quantity":1,"total_cents":500}]',500,'{}');
    RAISE EXCEPTION 'expected encashment failure';
  EXCEPTION WHEN check_violation THEN NULL; END;
  IF EXISTS(SELECT 1 FROM public.order_items WHERE order_id = '77777777-7777-4777-8777-777777777777')
    OR (SELECT stock FROM public.shop_products WHERE slug = 'other-article') <> 9 THEN
    RAISE EXCEPTION 'failed encashment left partial effects'; END IF;
END $$;
ALTER TABLE public.loyalty_history DROP CONSTRAINT fixture_encashment_failure;
SELECT public.resume_stripe_checkout('77777777-7777-4777-8777-777777777777','cs_failure',
 '[{"product_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","quantity":1,"total_cents":500}]',500,'{}');
DO $$ BEGIN
  IF (SELECT stock FROM public.shop_products WHERE slug = 'other-article') <> 8
    OR (SELECT count(*) FROM public.order_encashment_events WHERE order_id = '77777777-7777-4777-8777-777777777777') <> 1 THEN
    RAISE EXCEPTION 'retry after rollback failed'; END IF;
  IF has_function_privilege('authenticated','public.resume_stripe_checkout(uuid,text,jsonb,integer,jsonb)','EXECUTE')
    OR has_function_privilege('anon','public.resume_stripe_checkout(uuid,text,jsonb,integer,jsonb)','EXECUTE')
    OR has_function_privilege('service_role','public.insert_kit_attribution_before_audva03(uuid,uuid,uuid,integer,integer,jsonb,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'RPC privileges are too broad'; END IF;
END $$;
-- A partial refund may arrive after the order stub but before its first
-- encashment. This is a durable reconciliation case, never a successful retry.
INSERT INTO public.orders(id,user_id,order_number,stripe_session_id,payment_method) VALUES
 ('88888888-8888-4888-8888-888888888888','11111111-1111-4111-8111-111111111111','early-refund','cs_early_refund','card');
SELECT public.reverse_kit_attribution_by_session('cs_early_refund');
DO $$ BEGIN
  BEGIN
    PERFORM public.resume_stripe_checkout('88888888-8888-4888-8888-888888888888','cs_early_refund',
      '[{"product_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","quantity":1,"total_cents":500}]',500,'{"plan":"group"}');
    RAISE EXCEPTION 'early refund was silently acknowledged';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%financial reconciliation required%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM public.order_items WHERE order_id = '88888888-8888-4888-8888-888888888888') THEN
    RAISE EXCEPTION 'early refund resurrected delivery'; END IF;
END $$;
ROLLBACK;
