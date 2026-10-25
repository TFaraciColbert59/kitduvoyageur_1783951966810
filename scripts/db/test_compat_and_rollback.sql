-- =====================================================================
-- SUITE DE VALIDATION COMPATIBILITÉ, RLS, PERMISSIONS & ROLLBACK
-- =====================================================================

BEGIN;

-- 1. Configuration des rôles et utilisateurs de test
DO $$
DECLARE
  v_user_a UUID := 'a0000000-0000-0000-0000-000000000001';
  v_user_b UUID := 'b0000000-0000-0000-0000-000000000002';
BEGIN
  -- Assurer que les rôles existent
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;

  INSERT INTO auth.users (id, email) VALUES
    (v_user_a, 'user_a@test.com'),
    (v_user_b, 'user_b@test.com')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ---------------------------------------------------------------------
-- TEST 1 : COMPATIBILITÉ PRODUCTS <-> SHOP_PRODUCTS (BI-DIRECTIONNELLE)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_prod_id UUID := gen_random_uuid();
  v_found_name TEXT;
  v_found_stock INT;
BEGIN
  RAISE NOTICE '=== TEST 1 : PRODUCTS <-> SHOP_PRODUCTS ===';

  -- Écriture depuis l'ancienne app (INSERT sur products)
  INSERT INTO public.products (id, slug, name, brand, category, price_eur, weight_g, stock, is_active)
  VALUES (v_prod_id, 'gourde-inox-1l', 'Gourde Inox 1L', 'LKV Gear', 'Hydratation', 25.00, 350, 15, true);

  -- Vérification que la table canonique shop_products a bien reçu la ligne
  SELECT name, stock INTO v_found_name, v_found_stock
  FROM public.shop_products WHERE id = v_prod_id;

  IF v_found_name <> 'Gourde Inox 1L' OR v_found_stock <> 15 THEN
    RAISE EXCEPTION 'TEST 1 ÉCHEC : shop_products non synchronisé depuis products. Attendu: Gourde Inox 1L / 15, trouvé: % / %', v_found_name, v_found_stock;
  END IF;
  RAISE NOTICE '  [OK] INSERT via products répercuté dans shop_products';

  -- Écriture depuis la nouvelle app (UPDATE sur shop_products stock décrémenté)
  UPDATE public.shop_products SET stock = 14, price_eur = 24.50 WHERE id = v_prod_id;

  -- Vérification que l'ancienne app lisant products voit immédiatement la modification
  SELECT stock, price_eur INTO v_found_stock, v_found_name
  FROM public.products WHERE id = v_prod_id;

  IF v_found_stock <> 14 THEN
    RAISE EXCEPTION 'TEST 1 ÉCHEC : products ne reflète pas la mise à jour de shop_products. Stock trouvé: %', v_found_stock;
  END IF;
  RAISE NOTICE '  [OK] UPDATE via shop_products immédiatement visible via products';

  -- Écriture depuis l'ancienne app (UPDATE stock sur products comme dans checkout/page.tsx)
  UPDATE public.products SET stock = 12 WHERE id = v_prod_id;

  SELECT stock INTO v_found_stock FROM public.shop_products WHERE id = v_prod_id;
  IF v_found_stock <> 12 THEN
    RAISE EXCEPTION 'TEST 1 ÉCHEC : UPDATE via products non répercuté dans shop_products';
  END IF;
  RAISE NOTICE '  [OK] UPDATE via products répercuté dans shop_products';

  -- Suppression depuis l'ancienne app (DELETE sur products)
  DELETE FROM public.products WHERE id = v_prod_id;

  IF EXISTS (SELECT 1 FROM public.shop_products WHERE id = v_prod_id) THEN
    RAISE EXCEPTION 'TEST 1 ÉCHEC : DELETE via products non répercuté dans shop_products';
  END IF;
  RAISE NOTICE '  [OK] DELETE via products répercuté dans shop_products';
END $$;

-- ---------------------------------------------------------------------
-- TEST 2 : COMPATIBILITÉ GEAR_ITEMS <-> PRODUCT_OWNERSHIP & RLS
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_user_a UUID := 'a0000000-0000-0000-0000-000000000001';
  v_user_b UUID := 'b0000000-0000-0000-0000-000000000002';
  v_gear_id UUID := gen_random_uuid();
  v_found_name TEXT;
  v_found_cents INT;
BEGIN
  RAISE NOTICE '=== TEST 2 : GEAR_ITEMS <-> PRODUCT_OWNERSHIP ===';

  -- Écriture via gear_items pour user_a
  INSERT INTO public.gear_items (id, user_id, name, brand, category, weight_g, purchase_price, condition)
  VALUES (v_gear_id, v_user_a, 'Tente Dôme Ultralight', 'MSR', 'abri', 1200, 399.99, 'bon');

  -- Vérification dans product_ownership (table canonique)
  SELECT name, price_cents INTO v_found_name, v_found_cents
  FROM public.product_ownership WHERE id = v_gear_id;

  IF v_found_name <> 'Tente Dôme Ultralight' OR v_found_cents <> 39999 THEN
    RAISE EXCEPTION 'TEST 2 ÉCHEC : product_ownership non synchronisé. Trouvé: % / %', v_found_name, v_found_cents;
  END IF;
  RAISE NOTICE '  [OK] INSERT via gear_items répercuté dans product_ownership';

  -- Mise à jour depuis la nouvelle app (sur product_ownership)
  UPDATE public.product_ownership SET weight_g = 1150 WHERE id = v_gear_id;

  -- Vérification que l'ancienne app voit la mise à jour
  SELECT weight_g INTO v_found_cents FROM public.gear_items WHERE id = v_gear_id;
  IF v_found_cents <> 1150 THEN
    RAISE EXCEPTION 'TEST 2 ÉCHEC : gear_items ne voit pas la mise à jour de product_ownership';
  END IF;
  RAISE NOTICE '  [OK] UPDATE via product_ownership immédiatement visible via gear_items';

  -- Mise à jour depuis l'ancienne app (sur gear_items)
  UPDATE public.gear_items SET name = 'Tente Dôme Modifiée' WHERE id = v_gear_id;

  SELECT name INTO v_found_name FROM public.product_ownership WHERE id = v_gear_id;
  IF v_found_name <> 'Tente Dôme Modifiée' THEN
    RAISE EXCEPTION 'TEST 2 ÉCHEC : UPDATE via gear_items non répercuté dans product_ownership';
  END IF;
  RAISE NOTICE '  [OK] UPDATE via gear_items répercuté dans product_ownership';

  -- Nettoyage
  DELETE FROM public.gear_items WHERE id = v_gear_id;
  IF EXISTS (SELECT 1 FROM public.product_ownership WHERE id = v_gear_id) THEN
    RAISE EXCEPTION 'TEST 2 ÉCHEC : DELETE via gear_items non répercuté';
  END IF;
  RAISE NOTICE '  [OK] DELETE via gear_items répercuté dans product_ownership';
END $$;

-- ---------------------------------------------------------------------
-- TEST 3 : SÉCURITÉ RLS & SECURITY_INVOKER SUR GEAR_ITEMS
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_user_a UUID := 'a0000000-0000-0000-0000-000000000001';
  v_user_b UUID := 'b0000000-0000-0000-0000-000000000002';
  v_gear_a UUID := gen_random_uuid();
  v_count INT;
  v_found_name TEXT;
BEGIN
  RAISE NOTICE '=== TEST 3 : RLS & SECURITY_INVOKER SUR GEAR_ITEMS ===';

  -- Créer un objet pour User A
  INSERT INTO public.product_ownership (id, user_id, name, condition)
  VALUES (v_gear_a, v_user_a, 'Sac à dos User A', 'bon');

  -- Simuler la session de User B
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);

  -- User B requiert gear_items : ne doit PAS voir l'objet de User A
  SELECT count(*) INTO v_count FROM public.gear_items WHERE id = v_gear_a;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 3 ÉCHEC DE SÉCURITÉ : User B voit l objet de User A via gear_items (count=%)', v_count;
  END IF;
  RAISE NOTICE '  [OK] User B ne peut pas lire l objet de User A via gear_items (RLS respecté)';

  -- User B tente d'UPDATE l'objet de User A via gear_items
  UPDATE public.gear_items SET name = 'Hack tentative' WHERE id = v_gear_a;

  -- Revenir en rôle superuser pour vérifier
  PERFORM set_config('role', 'postgres', true);
  SELECT name INTO v_found_name FROM public.product_ownership WHERE id = v_gear_a;
  IF v_found_name = 'Hack tentative' THEN
    RAISE EXCEPTION 'TEST 3 ÉCHEC DE SÉCURITÉ : User B a pu modifier l objet de User A via gear_items';
  END IF;
  RAISE NOTICE '  [OK] User B ne peut pas modifier l objet de User A via gear_items';

  -- Nettoyage
  DELETE FROM public.product_ownership WHERE id = v_gear_a;
END $$;

-- ---------------------------------------------------------------------
-- TEST 4 : GARANTIE DU FEATURE FLAG LEADERBOARD & REFUS D'ACCÈS
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_user_a UUID := 'a0000000-0000-0000-0000-000000000001';
  v_res JSONB;
  v_enabled BOOLEAN;
BEGIN
  RAISE NOTICE '=== TEST 4 : FEATURE FLAG LEADERBOARD 1 KM ===';

  -- Cas A : Le flag était précédemment à TRUE
  INSERT INTO public.feature_flags (id, enabled) VALUES ('local_leaderboard_active', true)
  ON CONFLICT (id) DO UPDATE SET enabled = true;

  -- Exécuter la commande de migration corrigée
  INSERT INTO public.feature_flags (id, enabled) VALUES ('local_leaderboard_active', false)
  ON CONFLICT (id) DO UPDATE SET enabled = false;

  SELECT enabled INTO v_enabled FROM public.feature_flags WHERE id = 'local_leaderboard_active';
  IF v_enabled <> false THEN
    RAISE EXCEPTION 'TEST 4 ÉCHEC : le flag n a pas été forcé à false (trouvé: %)', v_enabled;
  END IF;
  RAISE NOTICE '  [OK] ON CONFLICT DO UPDATE SET enabled = false garantit le passage à false';

  -- Vérification du comportement de get_leaderboard quand flag = false
  v_res := public.get_leaderboard(v_user_a, 'local');
  IF (v_res->>'local_unavailable') <> 'true' OR (v_res->>'reason') <> 'flag_off' THEN
    RAISE EXCEPTION 'TEST 4 ÉCHEC : get_leaderboard n a pas refusé l accès avec flag=false. Résultat: %', v_res;
  END IF;
  RAISE NOTICE '  [OK] get_leaderboard refuse l accès avec local_unavailable=true quand flag=false';

  -- Cas B : Le flag est carrément absent de feature_flags
  DELETE FROM public.feature_flags WHERE id = 'local_leaderboard_active';

  v_res := public.get_leaderboard(v_user_a, 'local');
  IF (v_res->>'local_unavailable') <> 'true' OR (v_res->>'reason') <> 'flag_off' THEN
    RAISE EXCEPTION 'TEST 4 ÉCHEC : get_leaderboard n a pas refusé l accès avec flag absent. Résultat: %', v_res;
  END IF;
  RAISE NOTICE '  [OK] get_leaderboard refuse l accès avec local_unavailable=true quand flag absent';

  -- Remettre le flag à false proprement
  INSERT INTO public.feature_flags (id, enabled) VALUES ('local_leaderboard_active', false);
END $$;

-- ---------------------------------------------------------------------
-- TEST 5 : SIMULATION SCÉNARIO ROLLBACK AVEC ÉCRITURES INTERMÉDIAIRES
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_user_a UUID := 'a0000000-0000-0000-0000-000000000001';
  v_gear_id UUID := gen_random_uuid();
  v_prod_id UUID := gen_random_uuid();
  v_trip_id UUID := gen_random_uuid();
  v_rec_count INT;
BEGIN
  RAISE NOTICE '=== TEST 5 : SCÉNARIO ROLLBACK COMPLET AVEC ÉCRITURES ===';

  -- Étape 1 : Ancienne app écrit un item
  INSERT INTO public.gear_items (id, user_id, name, brand, category, weight_g, purchase_price)
  VALUES (v_gear_id, v_user_a, 'Matelas gonflable Thermarest', 'Thermarest', 'couchage', 350, 149.00);

  -- Étape 2 : Nouvelle app écrit un voyage et de nouvelles données
  INSERT INTO public.trips (id, slug, user_id, title, destination_name)
  VALUES (v_trip_id, 'tmb-septembre-2026', v_user_a, 'TMB Septembre 2026', 'Mont Blanc')
  ON CONFLICT DO NOTHING;

  -- Étape 3 : Nouvelle app met à jour l'item écrit à l'étape 1
  UPDATE public.product_ownership
  SET condition = 'use', tags = ARRAY['tmb-2026', 'valide']
  WHERE id = v_gear_id;

  -- Étape 4 : SIMULATION DU ROLLBACK DE L'APPLICATION
  -- L'application est remise en version ancienne (main).
  -- Elle exécute ses requêtes classiques (sur gear_items et products) :
  SELECT count(*) INTO v_rec_count
  FROM public.gear_items
  WHERE id = v_gear_id AND 'tmb-2026' = ANY(tags) AND condition = 'use';

  IF v_rec_count <> 1 THEN
    RAISE EXCEPTION 'TEST 5 ÉCHEC ROLLBACK : L ancienne app ne retrouve pas les écritures intermédiaires réalisées par la nouvelle app';
  END IF;
  RAISE NOTICE '  [OK] L ancienne app retrouve 100%% des modifications effectuées pendant la période nouvelle app';

  -- Nettoyage
  DELETE FROM public.gear_items WHERE id = v_gear_id;
  DELETE FROM public.trips WHERE id = v_trip_id;
END $$;

COMMIT;
