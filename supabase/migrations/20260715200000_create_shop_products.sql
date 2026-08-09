-- Migration: Create shop_products table for the new boutique
-- Timestamp: 20260715200000

DROP TYPE IF EXISTS public.shop_transaction_type CASCADE;
CREATE TYPE public.shop_transaction_type AS ENUM ('achat', 'location', 'occasion', 'enchere');

ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS transaction_type public.shop_transaction_type NOT NULL DEFAULT 'achat';

CREATE TABLE IF NOT EXISTS public.shop_products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  brand             TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT '',
  weight_g          INTEGER NOT NULL DEFAULT 0,
  price_eur         NUMERIC(10,2) NOT NULL DEFAULT 0,
  image             TEXT NOT NULL DEFAULT '',
  image_alt         TEXT NOT NULL DEFAULT '',
  rating            NUMERIC(3,1) NOT NULL DEFAULT 0,
  review_count      INTEGER NOT NULL DEFAULT 0,
  available         BOOLEAN NOT NULL DEFAULT true,
  transaction_type  public.shop_transaction_type NOT NULL DEFAULT 'achat',
  price_per_day     NUMERIC(10,2),
  original_price    NUMERIC(10,2),
  condition         TEXT,
  starting_bid      NUMERIC(10,2),
  ends_at           TIMESTAMPTZ,
  savings           NUMERIC(10,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shop_products_transaction_type ON public.shop_products(transaction_type);
CREATE INDEX IF NOT EXISTS idx_shop_products_category ON public.shop_products(category);
CREATE INDEX IF NOT EXISTS idx_shop_products_price_eur ON public.shop_products(price_eur);
CREATE INDEX IF NOT EXISTS idx_shop_products_weight_g ON public.shop_products(weight_g);

ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_shop_products" ON public.shop_products;
CREATE POLICY "public_read_shop_products"
ON public.shop_products
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "admin_manage_shop_products" ON public.shop_products;
CREATE POLICY "admin_manage_shop_products"
ON public.shop_products
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Seed data
DO $$
BEGIN
  INSERT INTO public.shop_products (slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, savings)
  VALUES
    ('osprey-farpoint-40-achat', 'Osprey Farpoint 40', 'Osprey', 'Sacs à dos', 1420, 179, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Sac à dos Osprey Farpoint 40 gris anthracite', 4.8, 312, true, 'achat', 0),
    ('osprey-farpoint-40-location', 'Osprey Farpoint 40', 'Osprey', 'Sacs à dos', 1420, 9, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Sac à dos Osprey Farpoint 40 en location', 4.7, 89, true, 'location', 0),
    ('osprey-farpoint-40-occasion', 'Osprey Farpoint 40', 'Osprey', 'Sacs à dos', 1420, 112, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Sac à dos Osprey Farpoint 40 occasion très bon état', 4.6, 45, true, 'occasion', 67),
    ('osprey-farpoint-40-enchere', 'Osprey Farpoint 40', 'Osprey', 'Sacs à dos', 1420, 78, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Sac à dos Osprey Farpoint 40 enchère en cours', 4.5, 12, true, 'enchere', 101),
    ('msr-hubba-hubba-achat', 'MSR Hubba Hubba NX 2P', 'MSR', 'Tentes', 1720, 549, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 'Tente MSR Hubba Hubba NX 2 places orange montée en montagne', 4.9, 198, true, 'achat', 0),
    ('msr-hubba-hubba-location', 'MSR Hubba Hubba NX 2P', 'MSR', 'Tentes', 1720, 18, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 'Tente MSR Hubba Hubba NX 2 places en location', 4.8, 67, true, 'location', 0),
    ('msr-hubba-hubba-occasion', 'MSR Hubba Hubba NX 2P', 'MSR', 'Tentes', 1720, 320, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 'Tente MSR Hubba Hubba NX occasion bon état', 4.7, 23, true, 'occasion', 229),
    ('sea-to-summit-spark-achat', 'Sea to Summit Spark SP1', 'Sea to Summit', 'Couchage', 490, 299, 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80', 'Sac de couchage Sea to Summit Spark SP1 ultra léger bleu', 4.7, 156, true, 'achat', 0),
    ('sea-to-summit-spark-location', 'Sea to Summit Spark SP1', 'Sea to Summit', 'Couchage', 490, 12, 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80', 'Sac de couchage Sea to Summit Spark SP1 en location', 4.6, 34, true, 'location', 0),
    ('petzl-actik-core-achat', 'Petzl Actik Core', 'Petzl', 'Éclairage', 85, 49, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', 'Lampe frontale Petzl Actik Core rouge sur fond blanc', 4.6, 423, true, 'achat', 0),
    ('petzl-actik-core-occasion', 'Petzl Actik Core', 'Petzl', 'Éclairage', 85, 28, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', 'Lampe frontale Petzl Actik Core occasion', 4.4, 18, true, 'occasion', 21),
    ('nemo-tensor-achat', 'NEMO Tensor Insulated', 'NEMO', 'Couchage', 510, 189, 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80', 'Matelas gonflable NEMO Tensor Insulated orange déplié', 4.8, 201, true, 'achat', 0),
    ('nemo-tensor-occasion', 'NEMO Tensor Insulated', 'NEMO', 'Couchage', 510, 95, 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80', 'Matelas gonflable NEMO Tensor occasion', 4.6, 14, true, 'occasion', 94),
    ('katadyn-befree-achat', 'Katadyn BeFree 1L', 'Katadyn', 'Eau', 56, 44, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', 'Filtre à eau Katadyn BeFree 1 litre bleu transparent', 4.7, 334, true, 'achat', 0),
    ('garmin-inreach-mini-achat', 'Garmin inReach Mini 2', 'Garmin', 'Navigation', 100, 349, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', 'Communicateur satellite Garmin inReach Mini 2 orange', 4.9, 178, true, 'achat', 0),
    ('garmin-inreach-mini-location', 'Garmin inReach Mini 2', 'Garmin', 'Navigation', 100, 15, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', 'Communicateur satellite Garmin inReach Mini 2 en location', 4.8, 42, true, 'location', 0),
    ('arcteryx-beta-ar-achat', 'Arc''teryx Beta AR', 'Arc''teryx', 'Vêtements', 485, 699, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', 'Veste de randonnée Arc''teryx Beta AR rouge imperméable', 4.9, 89, true, 'achat', 0),
    ('arcteryx-beta-ar-occasion', 'Arc''teryx Beta AR', 'Arc''teryx', 'Vêtements', 485, 380, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', 'Veste Arc''teryx Beta AR occasion très bon état', 4.7, 31, true, 'occasion', 319),
    ('arcteryx-beta-ar-enchere', 'Arc''teryx Beta AR', 'Arc''teryx', 'Vêtements', 485, 290, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', 'Veste Arc''teryx Beta AR enchère en cours', 4.6, 8, true, 'enchere', 409),
    ('black-diamond-spot-achat', 'Black Diamond Spot 400', 'Black Diamond', 'Éclairage', 91, 39, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', 'Lampe frontale Black Diamond Spot 400 lumens noire', 4.5, 287, true, 'achat', 0)
  ON CONFLICT (slug) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'shop_products seed failed: %', SQLERRM;
END $$;
