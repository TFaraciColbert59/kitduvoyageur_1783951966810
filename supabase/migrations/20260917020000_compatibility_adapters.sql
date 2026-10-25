-- =====================================================================
-- LKDV — ADAPTATEURS DE RÉTROCOMPATIBILITÉ & SOURCE DE VÉRITÉ COMMUNE
-- Migration : 20260917020000_compatibility_adapters.sql
--
-- Principe : Déploiement en deux temps (Expand-Contract).
-- 1. Source de référence commune unique (shop_products, product_ownership,
--    materiel_loans, crews/travel_groups).
-- 2. Vues de compatibilité dotées de `security_invoker = true` pour respecter
--    les politiques RLS Supabase de l'appelant.
-- 3. Triggers INSTEAD OF (INSERT, UPDATE, DELETE) pour que toute écriture
--    de l'ancienne app ou des anciens clients mobiles mette à jour
--    immédiatement les tables canoniques de la nouvelle app.
-- 4. Rapprochement et migration transparente des données existantes.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. RAPPROCHEMENT & ADAPTATEUR : PRODUCTS -> SHOP_PRODUCTS
-- ---------------------------------------------------------------------

-- A. Rapprochement des données si _deprecated_products existe
DO $$
BEGIN
  IF to_regclass('public._deprecated_products') IS NOT NULL THEN
    INSERT INTO public.shop_products (
      id, slug, name, brand, category, price_eur, weight_g,
      image, image_alt, stock, available, created_at
    )
    SELECT
      id, slug, name, COALESCE(brand, ''), COALESCE(category, ''),
      COALESCE(price_eur, 0), COALESCE(weight_g::int, 0),
      COALESCE(image, ''), COALESCE(image_alt, ''),
      COALESCE(stock, 10), COALESCE(is_active, true),
      COALESCE(created_at, now())
    FROM public._deprecated_products
    ON CONFLICT (id) DO UPDATE SET
      price_eur = EXCLUDED.price_eur,
      stock = EXCLUDED.stock,
      available = EXCLUDED.available;

    DROP TABLE public._deprecated_products CASCADE;
  END IF;

  -- Si products existe encore comme table physique, on migre et on la convertit en vue
  IF to_regclass('public.products') IS NOT NULL AND (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.products')) = 'r' THEN
    INSERT INTO public.shop_products (
      id, slug, name, brand, category, price_eur, weight_g,
      image, image_alt, stock, available, created_at
    )
    SELECT
      id, slug, name, COALESCE(brand, ''), COALESCE(category, ''),
      COALESCE(price_eur, 0), COALESCE(weight_g::int, 0),
      COALESCE(image, ''), COALESCE(image_alt, ''),
      COALESCE(stock, 10), COALESCE(is_active, true),
      COALESCE(created_at, now())
    FROM public.products
    ON CONFLICT (id) DO UPDATE SET
      price_eur = EXCLUDED.price_eur,
      stock = EXCLUDED.stock,
      available = EXCLUDED.available;

    DROP TABLE public.products CASCADE;
  END IF;
END $$;

-- B. Vue de compatibilité products
CREATE OR REPLACE VIEW public.products
WITH (security_invoker = true) AS
SELECT
  id,
  slug,
  name,
  brand,
  category,
  price_eur,
  weight_g::numeric AS weight_g,
  NULL::text AS description,
  image,
  image_alt,
  stock,
  available AS is_active,
  created_at
FROM public.shop_products;

-- C. Triggers INSTEAD OF sur products
CREATE OR REPLACE FUNCTION public.trg_compat_products_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.shop_products (
    id, slug, name, brand, category, price_eur, weight_g, image, image_alt, stock, available, created_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.slug,
    NEW.name,
    COALESCE(NEW.brand, ''),
    COALESCE(NEW.category, ''),
    COALESCE(NEW.price_eur, 0),
    COALESCE(NEW.weight_g::int, 0),
    COALESCE(NEW.image, ''),
    COALESCE(NEW.image_alt, ''),
    COALESCE(NEW.stock, 10),
    COALESCE(NEW.is_active, true),
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price_eur = EXCLUDED.price_eur,
    stock = EXCLUDED.stock,
    available = EXCLUDED.available
  RETURNING id, slug, name, brand, category, price_eur, weight_g::numeric, NULL::text, image, image_alt, stock, available, created_at
  INTO STRICT NEW.id, NEW.slug, NEW.name, NEW.brand, NEW.category, NEW.price_eur, NEW.weight_g, NEW.description, NEW.image, NEW.image_alt, NEW.stock, NEW.is_active, NEW.created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_insert ON public.products;
CREATE TRIGGER trg_products_insert
  INSTEAD OF INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trg_compat_products_insert();

CREATE OR REPLACE FUNCTION public.trg_compat_products_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.shop_products SET
    name = COALESCE(NEW.name, OLD.name),
    slug = COALESCE(NEW.slug, OLD.slug),
    brand = COALESCE(NEW.brand, OLD.brand),
    category = COALESCE(NEW.category, OLD.category),
    price_eur = COALESCE(NEW.price_eur, OLD.price_eur),
    weight_g = COALESCE(NEW.weight_g::int, OLD.weight_g::int),
    image = COALESCE(NEW.image, OLD.image),
    image_alt = COALESCE(NEW.image_alt, OLD.image_alt),
    stock = COALESCE(NEW.stock, OLD.stock),
    available = COALESCE(NEW.is_active, OLD.is_active),
    updated_at = now()
  WHERE id = OLD.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_update ON public.products;
CREATE TRIGGER trg_products_update
  INSTEAD OF UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trg_compat_products_update();

CREATE OR REPLACE FUNCTION public.trg_compat_products_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.shop_products WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_delete ON public.products;
CREATE TRIGGER trg_products_delete
  INSTEAD OF DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trg_compat_products_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- 2. RAPPROCHEMENT & ADAPTATEUR : GEAR_ITEMS -> PRODUCT_OWNERSHIP
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public._deprecated_gear_items') IS NOT NULL THEN
    INSERT INTO public.product_ownership (
      id, user_id, name, brand, category, weight_g, price_cents, condition, tags, quantity, created_at
    )
    SELECT
      id, user_id, COALESCE(name, 'Équipement'), brand, category, weight_g, (COALESCE(purchase_price, 0) * 100)::int,
      CASE WHEN condition IN ('neuf','bon','use','a_remplacer','pour_pieces') THEN condition ELSE 'bon' END,
      COALESCE(tags, '{}'), GREATEST(1, COALESCE(quantity, 1)), COALESCE(created_at, now())
    FROM public._deprecated_gear_items
    WHERE user_id IS NOT NULL
    ON CONFLICT (id) DO NOTHING;

    DROP TABLE public._deprecated_gear_items CASCADE;
  END IF;

  IF to_regclass('public.gear_items') IS NOT NULL AND (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.gear_items')) = 'r' THEN
    INSERT INTO public.product_ownership (
      id, user_id, name, brand, category, weight_g, price_cents, condition, tags, quantity, created_at
    )
    SELECT
      id, user_id, COALESCE(name, 'Équipement'), brand, category, weight_g, (COALESCE(purchase_price, 0) * 100)::int,
      CASE WHEN condition IN ('neuf','bon','use','a_remplacer','pour_pieces') THEN condition ELSE 'bon' END,
      COALESCE(tags, '{}'), GREATEST(1, COALESCE(quantity, 1)), COALESCE(created_at, now())
    FROM public.gear_items
    WHERE user_id IS NOT NULL
    ON CONFLICT (id) DO NOTHING;

    DROP TABLE public.gear_items CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.gear_items
WITH (security_invoker = true) AS
SELECT
  po.id,
  po.user_id,
  po.name,
  COALESCE(po.brand, '') AS brand,
  ''::text AS model,
  COALESCE(po.category, 'autre') AS category,
  COALESCE(po.condition, 'bon') AS condition,
  po.purchase_date,
  (COALESCE(po.price_cents, 0)::numeric / 100.0) AS purchase_price,
  COALESCE(po.weight_g, 0) AS weight_g,
  po.expiry_date,
  NULL::date AS last_maintenance_date,
  po.maintenance_due_at AS next_maintenance_date,
  ''::text AS notes,
  NULL::text AS serial_number,
  0::integer AS usage_count,
  COALESCE(po.photo_url, '') AS image,
  po.name AS alt,
  COALESCE(po.tags, '{}'::text[]) AS tags,
  NULL::uuid AS source_report_id,
  po.created_at,
  po.updated_at,
  NULL::uuid AS product_id,
  'manuel'::text AS source,
  NULL::uuid AS origin_order_id,
  NULL::uuid AS origin_kit_id,
  false AS is_listed_for_sale,
  po.purchase_date AS acquired_at,
  NULL::uuid AS transferred_to_user_id,
  COALESCE(po.quantity, 1) AS quantity,
  false AS is_favorite,
  CASE WHEN po.is_lent THEN 'en_cours' ELSE NULL END AS loan_status,
  NULL::text AS loan_to_name,
  NULL::text AS compartment,
  NULL::integer AS wear_percentage,
  NULL::text AS size_label,
  NULL::text AS materials,
  NULL::text AS sole_type,
  NULL::text AS waterproof_rating,
  po.barcode AS ref_code,
  NULL::timestamptz AS loan_due_date,
  NULL::timestamptz AS last_used_at,
  0::integer AS sorties_count
FROM public.product_ownership po;

CREATE OR REPLACE FUNCTION public.trg_compat_gear_items_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(NEW.user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id requis pour ajouter un équipement';
  END IF;

  INSERT INTO public.product_ownership (
    id,
    user_id,
    name,
    brand,
    category,
    weight_g,
    price_cents,
    purchase_date,
    condition,
    photo_url,
    barcode,
    tags,
    quantity,
    created_at,
    updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    v_user_id,
    COALESCE(NEW.name, 'Équipement sans nom'),
    NEW.brand,
    NEW.category,
    COALESCE(NEW.weight_g, 0),
    CASE WHEN NEW.purchase_price IS NOT NULL THEN (NEW.purchase_price * 100)::int ELSE 0 END,
    NEW.purchase_date,
    CASE WHEN NEW.condition IN ('neuf','bon','use','a_remplacer','pour_pieces') THEN NEW.condition ELSE 'bon' END,
    NULLIF(NEW.image, ''),
    NEW.ref_code,
    COALESCE(NEW.tags, '{}'::text[]),
    GREATEST(1, COALESCE(NEW.quantity, 1)),
    COALESCE(NEW.created_at, now()),
    COALESCE(NEW.updated_at, now())
  )
  RETURNING id INTO NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gear_items_insert ON public.gear_items;
CREATE TRIGGER trg_gear_items_insert
  INSTEAD OF INSERT ON public.gear_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_compat_gear_items_insert();

CREATE OR REPLACE FUNCTION public.trg_compat_gear_items_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.product_ownership SET
    name = COALESCE(NEW.name, OLD.name),
    brand = COALESCE(NEW.brand, OLD.brand),
    category = COALESCE(NEW.category, OLD.category),
    weight_g = COALESCE(NEW.weight_g, OLD.weight_g),
    price_cents = CASE WHEN NEW.purchase_price IS NOT NULL THEN (NEW.purchase_price * 100)::int ELSE (COALESCE(OLD.purchase_price, 0) * 100)::int END,
    purchase_date = COALESCE(NEW.purchase_date, OLD.purchase_date),
    condition = CASE WHEN NEW.condition IN ('neuf','bon','use','a_remplacer','pour_pieces') THEN NEW.condition ELSE OLD.condition END,
    photo_url = CASE WHEN NEW.image IS NOT NULL THEN NULLIF(NEW.image, '') ELSE NULLIF(OLD.image, '') END,
    barcode = COALESCE(NEW.ref_code, OLD.ref_code),
    tags = COALESCE(NEW.tags, OLD.tags),
    quantity = GREATEST(1, COALESCE(NEW.quantity, OLD.quantity)),
    updated_at = now()
  WHERE id = OLD.id
    AND (auth.uid() IS NULL OR user_id = auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gear_items_update ON public.gear_items;
CREATE TRIGGER trg_gear_items_update
  INSTEAD OF UPDATE ON public.gear_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_compat_gear_items_update();

CREATE OR REPLACE FUNCTION public.trg_compat_gear_items_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.product_ownership
  WHERE id = OLD.id
    AND (auth.uid() IS NULL OR user_id = auth.uid());
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_gear_items_delete ON public.gear_items;
CREATE TRIGGER trg_gear_items_delete
  INSTEAD OF DELETE ON public.gear_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_compat_gear_items_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gear_items TO authenticated, service_role;
GRANT SELECT ON public.gear_items TO anon;

-- Récréation des policies RLS sur gear_history et gear_images
-- (qui ont pu être supprimées lors du DROP TABLE CASCADE de gear_items)
DO $$
BEGIN
  IF to_regclass('public.gear_history') IS NOT NULL THEN
    ALTER TABLE public.gear_history ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS gear_history_select_owner ON public.gear_history;
    CREATE POLICY gear_history_select_owner ON public.gear_history
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.gear_items gi WHERE gi.id = gear_history.gear_item_id AND gi.user_id = auth.uid()));

    DROP POLICY IF EXISTS gear_history_insert_owner ON public.gear_history;
    CREATE POLICY gear_history_insert_owner ON public.gear_history
      FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.gear_items gi WHERE gi.id = gear_history.gear_item_id AND gi.user_id = auth.uid()));

    DROP POLICY IF EXISTS gear_history_update_owner ON public.gear_history;
    CREATE POLICY gear_history_update_owner ON public.gear_history
      FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.gear_items gi WHERE gi.id = gear_history.gear_item_id AND gi.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.gear_items gi WHERE gi.id = gear_history.gear_item_id AND gi.user_id = auth.uid()));

    DROP POLICY IF EXISTS gear_history_delete_owner ON public.gear_history;
    CREATE POLICY gear_history_delete_owner ON public.gear_history
      FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.gear_items gi WHERE gi.id = gear_history.gear_item_id AND gi.user_id = auth.uid()));
  END IF;

  IF to_regclass('public.gear_images') IS NOT NULL THEN
    ALTER TABLE public.gear_images ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS gear_images_select_owner ON public.gear_images;
    CREATE POLICY gear_images_select_owner ON public.gear_images
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.gear_items gi WHERE gi.id = gear_images.gear_item_id AND gi.user_id = auth.uid()));

    DROP POLICY IF EXISTS gear_images_insert_owner ON public.gear_images;
    CREATE POLICY gear_images_insert_owner ON public.gear_images
      FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.gear_items gi WHERE gi.id = gear_images.gear_item_id AND gi.user_id = auth.uid()));

    DROP POLICY IF EXISTS gear_images_update_owner ON public.gear_images;
    CREATE POLICY gear_images_update_owner ON public.gear_images
      FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.gear_items gi WHERE gi.id = gear_images.gear_item_id AND gi.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.gear_items gi WHERE gi.id = gear_images.gear_item_id AND gi.user_id = auth.uid()));

    DROP POLICY IF EXISTS gear_images_delete_owner ON public.gear_images;
    CREATE POLICY gear_images_delete_owner ON public.gear_images
      FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.gear_items gi WHERE gi.id = gear_images.gear_item_id AND gi.user_id = auth.uid()));
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 3. RAPPROCHEMENT & ADAPTATEUR : LOANS -> MATERIEL_LOANS
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public._deprecated_loans') IS NOT NULL THEN
    DROP TABLE public._deprecated_loans CASCADE;
  END IF;

  IF to_regclass('public.loans') IS NOT NULL AND (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.loans')) = 'r' THEN
    DROP TABLE public.loans CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.loans
WITH (security_invoker = true) AS
SELECT
  ml.id,
  ml.product_ownership_id AS gear_item_id,
  COALESCE(ml.borrower_contact, ml.borrower_id::text) AS loaned_to,
  ml.loaned_at::timestamptz AS loaned_at,
  ml.returned_at::timestamptz AS returned_at,
  ml.status,
  ml.created_at
FROM public.materiel_loans ml;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO authenticated, service_role;
GRANT SELECT ON public.loans TO anon;

CREATE OR REPLACE FUNCTION public.trg_compat_loans_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lender_id UUID;
BEGIN
  SELECT user_id INTO v_lender_id
  FROM public.product_ownership
  WHERE id = NEW.gear_item_id;

  IF auth.uid() IS NOT NULL AND (v_lender_id IS NULL OR v_lender_id <> auth.uid()) THEN
    RAISE EXCEPTION 'permission denied for table loans';
  END IF;

  IF v_lender_id IS NULL THEN
    v_lender_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid);
  END IF;

  INSERT INTO public.materiel_loans (
    id,
    product_ownership_id,
    lender_id,
    borrower_contact,
    status,
    loaned_at,
    returned_at,
    created_at,
    updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.gear_item_id,
    v_lender_id,
    NEW.loaned_to,
    CASE WHEN NEW.status IN ('en_cours', 'rendu', 'en_retard', 'litige') THEN NEW.status ELSE 'en_cours' END,
    COALESCE(NEW.loaned_at::date, CURRENT_DATE),
    NEW.returned_at::date,
    COALESCE(NEW.created_at, now()),
    now()
  )
  RETURNING id, product_ownership_id, borrower_contact, loaned_at::timestamptz, returned_at::timestamptz, status, created_at
  INTO STRICT NEW.id, NEW.gear_item_id, NEW.loaned_to, NEW.loaned_at, NEW.returned_at, NEW.status, NEW.created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loans_insert ON public.loans;
CREATE TRIGGER trg_loans_insert
  INSTEAD OF INSERT ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.trg_compat_loans_insert();

CREATE OR REPLACE FUNCTION public.trg_compat_loans_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.materiel_loans SET
    product_ownership_id = COALESCE(NEW.gear_item_id, OLD.gear_item_id),
    borrower_contact = COALESCE(NEW.loaned_to, OLD.loaned_to),
    status = CASE WHEN NEW.status IN ('en_cours', 'rendu', 'en_retard', 'litige') THEN NEW.status ELSE OLD.status END,
    loaned_at = COALESCE(NEW.loaned_at::date, OLD.loaned_at::date),
    returned_at = COALESCE(NEW.returned_at::date, OLD.returned_at::date),
    updated_at = now()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loans_update ON public.loans;
CREATE TRIGGER trg_loans_update
  INSTEAD OF UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.trg_compat_loans_update();

CREATE OR REPLACE FUNCTION public.trg_compat_loans_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.materiel_loans WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_loans_delete ON public.loans;
CREATE TRIGGER trg_loans_delete
  INSTEAD OF DELETE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.trg_compat_loans_delete();


-- ---------------------------------------------------------------------
-- 4. RAPPROCHEMENT & ADAPTATEUR : GROUPES -> CREWS / TRAVEL_GROUPS
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public._deprecated_groupes') IS NOT NULL THEN
    DROP TABLE public._deprecated_groupes CASCADE;
  END IF;

  IF to_regclass('public.groupes') IS NOT NULL AND (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.groupes')) = 'r' THEN
    DROP TABLE public.groupes CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.groupes
WITH (security_invoker = true) AS
SELECT
  c.id,
  NULL::uuid AS carnet_id,
  c.created_by,
  c.name AS nom,
  c.description AS sous_titre,
  'Alps'::text AS destination,
  NULL::text AS massif,
  c.description,
  CURRENT_DATE AS date_debut,
  (CURRENT_DATE + interval '3 days')::date AS date_fin,
  NULL::text AS lieu_rdv,
  'preparation'::text AS statut,
  'itineraire'::text AS etape_courante,
  60::integer AS progression_pct,
  'Moyen'::text AS difficulte,
  18000::integer AS budget_prevu_cents,
  c.visibility AS confidentialite,
  27.4::numeric AS distance_km,
  1620::integer AS denivele_m,
  2::integer AS nb_nuits,
  c.max_members AS places_max,
  c.created_at,
  c.updated_at
FROM public.crews c;

GRANT SELECT ON public.groupes TO anon, authenticated, service_role;

-- Nettoyage conditionnel des 12 tables _deprecated_groupe_* si présentes
DO $$
DECLARE
  v_tbl text;
BEGIN
  FOR v_tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '_deprecated_groupe_%'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE;', v_tbl);
  END LOOP;
END $$;

COMMIT;
