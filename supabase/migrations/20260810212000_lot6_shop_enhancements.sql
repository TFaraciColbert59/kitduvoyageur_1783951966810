-- LOT 6 : Boutique persistance complète - Tables complémentaires
-- Ajout des fonctionnalités manquantes pour une boutique complète

-- 1. Table pour le panier utilisateur (session-based)
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  session_id TEXT, -- Pour panier non-connecté
  added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id) -- Un produit par utilisateur dans le panier
);
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cart" ON public.cart_items FOR ALL USING (
  user_id = auth.uid() OR (user_id IS NULL AND session_id IS NOT NULL)
);

-- 2. Table pour la liste de souhaits
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wishlist" ON public.wishlist_items FOR ALL USING (user_id = auth.uid());

-- 3. Table pour les catégories de produits hiérarchiques
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  parent_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  image_url TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product categories" ON public.product_categories FOR SELECT USING (true);

-- 4. Table pour les variantes de produits (tailles, couleurs, etc.)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  weight_g INTEGER DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb, -- {size: 'M', color: 'blue'}
  image_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product variants" ON public.product_variants FOR SELECT USING (true);

-- 5. Table pour les images supplémentaires des produits
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product images" ON public.product_images FOR SELECT USING (true);

-- 6. Table pour les méthodes de livraison
CREATE TABLE IF NOT EXISTS public.shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_weight_g INTEGER DEFAULT 0,
  max_weight_g INTEGER DEFAULT 50000,
  estimated_days_min INTEGER DEFAULT 3,
  estimated_days_max INTEGER DEFAULT 7,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read shipping methods" ON public.shipping_methods FOR SELECT USING (true);

-- 7. Table pour les codes promotionnels
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'shipping')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order_amount NUMERIC(10,2) DEFAULT 0,
  max_uses INTEGER DEFAULT NULL,
  uses_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active discount codes" ON public.discount_codes FOR SELECT USING (active = true);

-- 8. Table pour les taux de taxe
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  rate NUMERIC(5,2) NOT NULL, -- 20.00 pour 20%
  name TEXT NOT NULL DEFAULT 'TVA',
  description TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(country_code)
);
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read tax rates" ON public.tax_rates FOR SELECT USING (true);

-- 9. Mise à jour de la table orders existante avec colonnes manquantes
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_method_id UUID REFERENCES public.shipping_methods(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES public.discount_codes(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_rate_id UUID REFERENCES public.tax_rates(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS billing_address JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- 10. Mise à jour de la table order_items avec variantes
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;
