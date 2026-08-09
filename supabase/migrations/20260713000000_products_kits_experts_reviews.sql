-- ============================================================
-- KIT DU VOYAGEUR — Products, Kits, Experts, Reviews, Ambassadors, Orders, Gamification
-- ============================================================

-- 0. USER PROFILES (prerequisite — created here if not already present from earlier migrations)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  trust_score INTEGER DEFAULT 50,
  loyalty_points INTEGER DEFAULT 0,
  loyalty_level TEXT DEFAULT 'Explorateur',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on user_profiles if not already enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_profiles (idempotent)
DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
CREATE POLICY "users_read_own_profile" ON public.user_profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile" ON public.user_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;
CREATE POLICY "users_insert_own_profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS activity TEXT[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight_g INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_eur NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_alt TEXT DEFAULT '';

-- 1. PRODUCTS (catalogue)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Autre',
  activity TEXT[] DEFAULT '{}',
  weight_g INTEGER DEFAULT 0,
  price_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock INTEGER DEFAULT 0,
  image TEXT DEFAULT '',
  image_alt TEXT DEFAULT '',
  badge TEXT DEFAULT '',
  description TEXT DEFAULT '',
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.kits ADD COLUMN IF NOT EXISTS activite TEXT DEFAULT '';
ALTER TABLE public.kits ADD COLUMN IF NOT EXISTS alt TEXT DEFAULT '';
ALTER TABLE public.kits ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.kits ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE public.kits ADD COLUMN IF NOT EXISTS conseils TEXT[] DEFAULT '{}';

-- 2. KITS
CREATE TABLE IF NOT EXISTS public.kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  description TEXT DEFAULT '',
  destination TEXT DEFAULT '',
  saison TEXT DEFAULT '',
  poids_total_g INTEGER DEFAULT 0,
  prix_cents INTEGER DEFAULT 0,
  nb_articles INTEGER DEFAULT 0,
  difficulte TEXT DEFAULT 'Débutant',
  activite TEXT DEFAULT '',
  image TEXT DEFAULT '',
  alt TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  featured BOOLEAN DEFAULT false,
  conseils TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.kit_items ADD COLUMN IF NOT EXISTS slug TEXT DEFAULT '';
ALTER TABLE public.kit_items ADD COLUMN IF NOT EXISTS image TEXT DEFAULT '';
ALTER TABLE public.kit_items ADD COLUMN IF NOT EXISTS alt TEXT DEFAULT '';
ALTER TABLE public.kit_items ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 3. KIT ITEMS
CREATE TABLE IF NOT EXISTS public.kit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  categorie TEXT DEFAULT '',
  poids_g INTEGER DEFAULT 0,
  prix_cents INTEGER DEFAULT 0,
  quantite INTEGER DEFAULT 1,
  essentiel BOOLEAN DEFAULT false,
  slug TEXT DEFAULT '',
  image TEXT DEFAULT '',
  alt TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0
);

-- 4. EXPERTS
CREATE TABLE IF NOT EXISTS public.experts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  specialties TEXT[] DEFAULT '{}',
  destinations TEXT[] DEFAULT '{}',
  rating NUMERIC(3,2) DEFAULT 5.0,
  reviews_count INTEGER DEFAULT 0,
  consultations_count INTEGER DEFAULT 0,
  price_per_hour INTEGER DEFAULT 60,
  availability TEXT DEFAULT 'disponible',
  certifications TEXT[] DEFAULT '{}',
  bio TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  languages TEXT[] DEFAULT '{}',
  response_time TEXT DEFAULT '< 4h',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. EXPERT BOOKINGS
CREATE TABLE IF NOT EXISTS public.expert_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id UUID NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  topic TEXT DEFAULT '',
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'produit',
  target_name TEXT NOT NULL DEFAULT '',
  target_id TEXT DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 5,
  title TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  verified BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Allow seed/demo reviews without a linked user account
ALTER TABLE public.reviews ALTER COLUMN user_id DROP NOT NULL;

-- 7. REVIEW HELPFUL VOTES
CREATE TABLE IF NOT EXISTS public.review_helpful_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  UNIQUE(review_id, user_id)
);

-- 8. AMBASSADORS
CREATE TABLE IF NOT EXISTS public.ambassadors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  handle TEXT NOT NULL DEFAULT '',
  tier TEXT NOT NULL DEFAULT 'Explorer',
  followers TEXT DEFAULT '0',
  commission_pct INTEGER DEFAULT 8,
  earnings NUMERIC(10,2) DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  promo_code TEXT NOT NULL UNIQUE,
  avatar TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ambassadors_promo_code ON public.ambassadors(promo_code);

-- 9. PROMO CODES
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  uses INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL;
ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS uses INTEGER DEFAULT 0;
ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS revenue NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 10. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'en_preparation',
  total_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  items_count INTEGER DEFAULT 0,
  tracking_number TEXT DEFAULT '',
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. CHALLENGES
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  xp INTEGER DEFAULT 100,
  category TEXT DEFAULT 'Général',
  difficulty TEXT DEFAULT 'Moyen',
  total INTEGER DEFAULT 1,
  deadline TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. USER CHALLENGES
CREATE TABLE IF NOT EXISTS public.user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, challenge_id)
);

-- 13. BADGES
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '🏅',
  rarity TEXT DEFAULT 'Commun',
  holders_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. USER BADGES
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, badge_id)
);

-- 15. OCCASION ITEMS (second-hand marketplace)
CREATE TABLE IF NOT EXISTS public.occasion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  original_price NUMERIC(10,2) DEFAULT 0,
  condition TEXT DEFAULT 'bon',
  location TEXT DEFAULT '',
  image TEXT DEFAULT '',
  alt TEXT DEFAULT '',
  negotiable BOOLEAN DEFAULT false,
  shipping BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 16. AUCTION ITEMS
CREATE TABLE IF NOT EXISTS public.auction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  current_bid NUMERIC(10,2) DEFAULT 0,
  buy_now_price NUMERIC(10,2) DEFAULT 0,
  condition TEXT DEFAULT 'bon',
  ends_at TIMESTAMPTZ NOT NULL,
  bids_count INTEGER DEFAULT 0,
  watchers_count INTEGER DEFAULT 0,
  image TEXT DEFAULT '',
  alt TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 17. RENTAL ITEMS
CREATE TABLE IF NOT EXISTS public.rental_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price_per_day NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_week NUMERIC(10,2) DEFAULT 0,
  deposit NUMERIC(10,2) DEFAULT 0,
  condition TEXT DEFAULT 'bon',
  location TEXT DEFAULT '',
  distance_km NUMERIC(5,1) DEFAULT 0,
  available BOOLEAN DEFAULT true,
  rating NUMERIC(3,2) DEFAULT 5.0,
  reviews_count INTEGER DEFAULT 0,
  image TEXT DEFAULT '',
  alt TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_kits_slug ON public.kits(slug);
CREATE INDEX IF NOT EXISTS idx_kits_featured ON public.kits(featured);
CREATE INDEX IF NOT EXISTS idx_kit_items_kit_id ON public.kit_items(kit_id);
CREATE INDEX IF NOT EXISTS idx_experts_availability ON public.experts(availability);
CREATE INDEX IF NOT EXISTS idx_reviews_type ON public.reviews(type);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id ON public.user_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_occasion_items_seller_id ON public.occasion_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_auction_items_ends_at ON public.auction_items(ends_at);
CREATE INDEX IF NOT EXISTS idx_rental_items_available ON public.rental_items(available);

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_helpful_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occasion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- products: public read
DROP POLICY IF EXISTS "public_read_products" ON public.products;
CREATE POLICY "public_read_products" ON public.products FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth_manage_products" ON public.products;
CREATE POLICY "auth_manage_products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- kits: public read
DROP POLICY IF EXISTS "public_read_kits" ON public.kits;
CREATE POLICY "public_read_kits" ON public.kits FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth_manage_kits" ON public.kits;
CREATE POLICY "auth_manage_kits" ON public.kits FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- kit_items: public read
DROP POLICY IF EXISTS "public_read_kit_items" ON public.kit_items;
CREATE POLICY "public_read_kit_items" ON public.kit_items FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth_manage_kit_items" ON public.kit_items;
CREATE POLICY "auth_manage_kit_items" ON public.kit_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- experts: public read
DROP POLICY IF EXISTS "public_read_experts" ON public.experts;
CREATE POLICY "public_read_experts" ON public.experts FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth_manage_experts" ON public.experts;
CREATE POLICY "auth_manage_experts" ON public.experts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- expert_bookings: user owns
DROP POLICY IF EXISTS "users_manage_own_bookings" ON public.expert_bookings;
CREATE POLICY "users_manage_own_bookings" ON public.expert_bookings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- reviews: public read, auth write own
DROP POLICY IF EXISTS "public_read_reviews" ON public.reviews;
CREATE POLICY "public_read_reviews" ON public.reviews FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "users_manage_own_reviews" ON public.reviews;
CREATE POLICY "users_manage_own_reviews" ON public.reviews FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- review_helpful_votes
DROP POLICY IF EXISTS "users_manage_own_helpful_votes" ON public.review_helpful_votes;
CREATE POLICY "users_manage_own_helpful_votes" ON public.review_helpful_votes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "public_read_helpful_votes" ON public.review_helpful_votes;
CREATE POLICY "public_read_helpful_votes" ON public.review_helpful_votes FOR SELECT TO public USING (true);

-- ambassadors: public read
DROP POLICY IF EXISTS "public_read_ambassadors" ON public.ambassadors;
CREATE POLICY "public_read_ambassadors" ON public.ambassadors FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth_manage_ambassadors" ON public.ambassadors;
CREATE POLICY "auth_manage_ambassadors" ON public.ambassadors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- promo_codes: public read
DROP POLICY IF EXISTS "public_read_promo_codes" ON public.promo_codes;
CREATE POLICY "public_read_promo_codes" ON public.promo_codes FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth_manage_promo_codes" ON public.promo_codes;
CREATE POLICY "auth_manage_promo_codes" ON public.promo_codes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- orders: user owns
DROP POLICY IF EXISTS "users_manage_own_orders" ON public.orders;
CREATE POLICY "users_manage_own_orders" ON public.orders FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- challenges: public read
DROP POLICY IF EXISTS "public_read_challenges" ON public.challenges;
CREATE POLICY "public_read_challenges" ON public.challenges FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth_manage_challenges" ON public.challenges;
CREATE POLICY "auth_manage_challenges" ON public.challenges FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- user_challenges
DROP POLICY IF EXISTS "users_manage_own_challenges" ON public.user_challenges;
CREATE POLICY "users_manage_own_challenges" ON public.user_challenges FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "public_read_user_challenges" ON public.user_challenges;
CREATE POLICY "public_read_user_challenges" ON public.user_challenges FOR SELECT TO public USING (true);

-- badges: public read
DROP POLICY IF EXISTS "public_read_badges" ON public.badges;
CREATE POLICY "public_read_badges" ON public.badges FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "auth_manage_badges" ON public.badges;
CREATE POLICY "auth_manage_badges" ON public.badges FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- user_badges
DROP POLICY IF EXISTS "users_manage_own_badges" ON public.user_badges;
CREATE POLICY "users_manage_own_badges" ON public.user_badges FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "public_read_user_badges" ON public.user_badges;
CREATE POLICY "public_read_user_badges" ON public.user_badges FOR SELECT TO public USING (true);

-- occasion_items: public read, seller manages own
DROP POLICY IF EXISTS "public_read_occasion_items" ON public.occasion_items;
CREATE POLICY "public_read_occasion_items" ON public.occasion_items FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "sellers_manage_own_occasion_items" ON public.occasion_items;
CREATE POLICY "sellers_manage_own_occasion_items" ON public.occasion_items FOR ALL TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

-- auction_items: public read, seller manages own
DROP POLICY IF EXISTS "public_read_auction_items" ON public.auction_items;
CREATE POLICY "public_read_auction_items" ON public.auction_items FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "sellers_manage_own_auction_items" ON public.auction_items;
CREATE POLICY "sellers_manage_own_auction_items" ON public.auction_items FOR ALL TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

-- rental_items: public read, owner manages own
DROP POLICY IF EXISTS "public_read_rental_items" ON public.rental_items;
CREATE POLICY "public_read_rental_items" ON public.rental_items FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "owners_manage_own_rental_items" ON public.rental_items;
CREATE POLICY "owners_manage_own_rental_items" ON public.rental_items FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- SEED DATA
-- ============================================================

-- Seed products
INSERT INTO public.products (slug, name, brand, category, activity, weight_g, price_eur, stock, image, image_alt, badge, featured)
VALUES
  ('osprey-exos-58', 'Osprey Exos 58 L', 'Osprey', 'Sacs', ARRAY['Randonnée', 'Trekking'], 1060, 249, 12, 'https://images.unsplash.com/photo-1687755541812-15786d01a728', 'Sac à dos de randonnée rouge suspendu contre un mur de pierre, bretelles ergonomiques visibles', 'Bestseller', true),
  ('big-agnes-copper-spur', 'Big Agnes Copper Spur HV2', 'Big Agnes', 'Tentes', ARRAY['Camping', 'Randonnée', 'Trekking'], 1080, 549, 5, 'https://images.unsplash.com/photo-1571364588707-8638d6c49fea', 'Tente légère orange installée sur prairie alpine au coucher du soleil, montagnes en arrière-plan', 'Léger', true),
  ('sea-to-summit-reactor', 'Sea to Summit Reactor +5°C', 'Sea to Summit', 'Sacs de couchage', ARRAY['Camping', 'Randonnée'], 680, 175, 20, 'https://img.rocket.new/generatedImages/rocket_gen_img_1d9318392-1766063031269.png', 'Sac de couchage bleu déplié sur sol de forêt, texture lisse et coutures apparentes', '', false),
  ('msr-pocket-rocket', 'MSR PocketRocket 2', 'MSR', 'Cuisine', ARRAY['Camping', 'Alpinisme', 'Randonnée'], 73, 48, 35, 'https://images.unsplash.com/photo-1729872416347-38d7dfbef04e', 'Réchaud à gaz compact posé sur rocher avec casserole en titane, fond de forêt floue', 'Ultra-léger', false),
  ('sawyer-squeeze', 'Sawyer Squeeze Filter', 'Sawyer', 'Eau', ARRAY['Randonnée', 'Trekking', 'Survie'], 85, 34, 48, 'https://images.unsplash.com/photo-1735281257493-83be781b6483', 'Filtre à eau compact bleu posé sur pierres au bord d''un ruisseau de montagne', '', false),
  ('arcteryx-beta-jacket', 'Arc''teryx Beta SL Jacket', 'Arc''teryx', 'Vêtements', ARRAY['Alpinisme', 'Randonnée', 'Trekking'], 315, 375, 8, 'https://images.unsplash.com/photo-1618143928355-3d9afff6ec23', 'Veste imperméable rouge portée par randonneur sur crête rocheuse, ciel nuageux dramatique', 'Premium', true),
  ('black-diamond-spot', 'Black Diamond Spot 400', 'Black Diamond', 'Éclairage', ARRAY['Camping', 'Alpinisme', 'Randonnée'], 91, 42, 30, 'https://images.unsplash.com/photo-1570612117355-e3f8b19b1c08', 'Lampe frontale noire posée sur table de camping avec faisceau lumineux visible dans l''obscurité', '', false),
  ('thermarest-neoair', 'Therm-a-Rest NeoAir XLite', 'Therm-a-Rest', 'Sommeil', ARRAY['Camping', 'Randonnée', 'Trekking'], 354, 199, 14, 'https://images.unsplash.com/photo-1663707333537-9808bb2a84a0', 'Matelas gonflable argenté déroulé dans tente, texture alvéolaire visible, fond de toile verte', 'Top confort', false),
  ('leki-micro-vario', 'LEKI Micro Vario Carbon', 'LEKI', 'Bâtons', ARRAY['Randonnée', 'Trekking', 'Alpinisme'], 430, 159, 22, 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0', 'Bâtons de randonnée carbone appuyés contre rocher sur sentier de montagne ensoleillé', '', false),
  ('platypus-gravityworks', 'Platypus GravityWorks 4L', 'Platypus', 'Eau', ARRAY['Camping', 'Randonnée'], 170, 72, 18, 'https://images.unsplash.com/photo-1631329426101-b7250cde7fd7', 'Système de filtration d''eau suspendu à branche avec poches bleues, fond de forêt', '', false),
  ('patagonia-nano-puff', 'Patagonia Nano Puff Jacket', 'Patagonia', 'Vêtements', ARRAY['Randonnée', 'Vanlife', 'Camping'], 298, 249, 7, 'https://images.unsplash.com/photo-1613237875420-a4c416b1767a', 'Doudoune légère verte accrochée à branche d''arbre, forêt automnale en arrière-plan', 'Éco', false),
  ('garmin-inreach-mini', 'Garmin inReach Mini 2', 'Garmin', 'Sécurité', ARRAY['Alpinisme', 'Trekking', 'Randonnée'], 100, 329, 9, 'https://img.rocket.new/generatedImages/rocket_gen_img_1b4042735-1772899176488.png', 'Balise de secours orange compacte posée sur carte topographique, fond de planification d''expédition', 'Sécurité', false)
ON CONFLICT (slug) DO NOTHING;

-- Seed kits
INSERT INTO public.kits (slug, nom, description, destination, saison, poids_total_g, prix_cents, nb_articles, difficulte, activite, image, alt, tags, featured, conseils)
VALUES
  ('islande-trek', 'Kit Islande — Trek & Volcans', 'Équipement complet pour affronter les conditions extrêmes islandaises : vent, pluie, froid et terrains volcaniques.', 'Islande', 'Été / Automne', 8400, 89900, 24, 'Intermédiaire', 'Trek', 'https://images.unsplash.com/photo-1701541906495-f8cd3ccb7ef0', 'Paysage volcanique islandais avec randonneurs sur sentier de lave noire sous ciel nuageux', ARRAY['Imperméable', 'Froid', 'Volcanique'], true, ARRAY['En Islande, la météo change toutes les 5 minutes. Gardez toujours la veste hardshell accessible.', 'Les terrains volcaniques usent rapidement les semelles. Vérifiez l''état de vos chaussures avant le départ.', 'L''eau des rivières glaciaires est potable mais froide. Un filtre n''est pas indispensable mais recommandé.']),
  ('gr20-corse', 'Kit GR20 — Corse Intégrale', 'Le kit optimisé pour le GR20, l''un des sentiers les plus exigeants d''Europe. Chaque gramme compte.', 'Corse', 'Juin — Septembre', 7200, 74900, 21, 'Expert', 'Randonnée', 'https://img.rocket.new/generatedImages/rocket_gen_img_13e14bedf-1783673760784.png', 'Randonneur sur crête rocheuse du GR20 en Corse avec vue panoramique sur montagnes', ARRAY['Ultra-léger', 'Montagne', 'Multi-jours'], true, ARRAY['Le GR20 se fait du nord (Calenzana) au sud (Conca). Prévoyez 15 jours minimum.', 'Les refuges sont souvent complets en juillet-août. Réservez à l''avance ou prévoyez le bivouac.', 'L''eau est disponible régulièrement sur le parcours. Pas besoin de porter plus de 2L.']),
  ('vanlife-europe', 'Kit Vanlife — Europe', 'Tout ce qu''il faut pour vivre et dormir dans son van à travers l''Europe. Compact, fonctionnel, durable.', 'Europe', 'Toute l''année', 12600, 119900, 32, 'Débutant', 'Vanlife', 'https://images.unsplash.com/photo-1675912739409-84ab21c16004', 'Van aménagé garé devant paysage montagneux au coucher du soleil avec équipement de camping visible', ARRAY['Confort', 'Autonomie', 'Cuisine'], true, ARRAY['Vérifiez les réglementations locales sur le camping sauvage. Elles varient beaucoup selon les pays.', 'Un panneau solaire de 100W suffit pour charger téléphones, ordinateur et maintenir la glacière.', 'Rejoignez les communautés vanlife locales pour les bons spots et les conseils pratiques.']),
  ('nepal-everest-bc', 'Kit Népal — Everest Base Camp', 'Équipement haute altitude pour le trek vers le camp de base de l''Everest. Chaleur, légèreté, fiabilité.', 'Népal', 'Mars — Mai / Oct — Nov', 9800, 134900, 28, 'Expert', 'Alpinisme', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa', 'Trek en haute altitude avec vue sur sommets enneigés de l''Himalaya et drapeaux de prières tibétains', ARRAY['Haute altitude', 'Froid extrême', 'Léger'], false, ARRAY['Acclimatez-vous progressivement. Ne montez pas de plus de 500m par jour au-dessus de 3000m.', 'Prévoyez des couches thermiques pour les nuits à -15°C au camp de base.', 'Engagez un guide local certifié pour la sécurité et le soutien logistique.']),
  ('desert-maroc', 'Kit Désert — Maroc & Sahara', 'Survie et confort en milieu désertique. Protection solaire maximale, hydratation, nuits fraîches.', 'Maroc', 'Oct — Avril', 6800, 64900, 19, 'Intermédiaire', 'Désert', 'https://images.unsplash.com/photo-1596382431850-471c7c99382d', 'Dunes de sable dorées du Sahara marocain au coucher du soleil avec silhouette de randonneur', ARRAY['Chaleur', 'UV', 'Hydratation'], false, ARRAY['Portez toujours une protection solaire indice 50+ et un chapeau à large bord.', 'Buvez au minimum 4 litres d''eau par jour. Ne rationnez jamais l''eau.', 'Les nuits dans le désert peuvent être très froides. Prévoyez un sac de couchage adapté.']),
  ('photo-voyage', 'Kit Photo — Voyage & Nature', 'Le kit du photographe voyageur : protection du matériel, accessoires terrain, sac optimisé.', 'Universel', 'Toute l''année', 5400, 54900, 16, 'Débutant', 'Photo', 'https://images.unsplash.com/photo-1734902204925-4544ef4eb744', 'Photographe avec appareil reflex sur trépied devant paysage naturel spectaculaire au lever du soleil', ARRAY['Protection', 'Léger', 'Universel'], false, ARRAY['Protégez votre matériel avec des housses imperméables. L''humidité est l''ennemi des appareils photo.', 'Emportez des batteries supplémentaires. Le froid réduit leur autonomie de 30 à 50%.', 'Un trépied léger en carbone est indispensable pour les photos en basse lumière.'])
ON CONFLICT (slug) DO NOTHING;

-- Seed kit items for islande-trek
DO $$
DECLARE
  kit_id_islande UUID;
  kit_id_gr20 UUID;
  kit_id_van UUID;
BEGIN
  SELECT id INTO kit_id_islande FROM public.kits WHERE slug = 'islande-trek' LIMIT 1;
  SELECT id INTO kit_id_gr20 FROM public.kits WHERE slug = 'gr20-corse' LIMIT 1;
  SELECT id INTO kit_id_van FROM public.kits WHERE slug = 'vanlife-europe' LIMIT 1;

  IF kit_id_islande IS NOT NULL THEN
    INSERT INTO public.kit_items (kit_id, nom, categorie, poids_g, prix_cents, quantite, essentiel, slug, image, alt, sort_order) VALUES
      (kit_id_islande, 'Veste hardshell imperméable', 'Vêtements', 420, 18900, 1, true, 'veste-hardshell', 'https://img.rocket.new/generatedImages/rocket_gen_img_1cf6f69bc-1783673760798.png', 'Veste hardshell imperméable rouge pour randonnée en conditions extrêmes', 1),
      (kit_id_islande, 'Pantalon softshell', 'Vêtements', 380, 8900, 1, true, 'pantalon-softshell', 'https://img.rocket.new/generatedImages/rocket_gen_img_1f80a888a-1764696739523.png', 'Pantalon softshell gris pour randonnée en montagne', 2),
      (kit_id_islande, 'Chaussures de trek imperméables', 'Chaussures', 980, 16900, 1, true, 'chaussures-trek', 'https://img.rocket.new/generatedImages/rocket_gen_img_193e78989-1772348738060.png', 'Chaussures de trek imperméables marron avec semelle Vibram', 3),
      (kit_id_islande, 'Sac à dos 45L', 'Sac', 1200, 12900, 1, true, 'sac-45l', 'https://img.rocket.new/generatedImages/rocket_gen_img_1ee1d81ec-1767549166754.png', 'Sac à dos de randonnée 45 litres vert avec ceinture ventrale', 4),
      (kit_id_islande, 'Tente 2 places légère', 'Bivouac', 1800, 24900, 1, true, 'tente-2p', 'https://img.rocket.new/generatedImages/rocket_gen_img_1d5d6c9aa-1783673761002.png', 'Tente légère orange montée dans paysage volcanique islandais', 5),
      (kit_id_islande, 'Sac de couchage -5°C', 'Bivouac', 900, 8900, 1, true, 'sac-couchage', 'https://images.unsplash.com/photo-1604266702400-b77c0c014ef0', 'Sac de couchage bleu compressé dans son sac de transport', 6),
      (kit_id_islande, 'Réchaud à gaz compact', 'Cuisine', 280, 4900, 1, false, 'rechaud-gaz', 'https://img.rocket.new/generatedImages/rocket_gen_img_1752053d0-1772218550042.png', 'Réchaud à gaz compact avec casserole en titane sur rocher', 7),
      (kit_id_islande, 'Bâtons de randonnée pliables', 'Accessoires', 440, 5900, 2, false, 'batons-pliables', 'https://img.rocket.new/generatedImages/rocket_gen_img_17db774b2-1772222040348.png', 'Paire de bâtons de randonnée pliables en aluminium', 8)
    ON CONFLICT DO NOTHING;
  END IF;

  IF kit_id_gr20 IS NOT NULL THEN
    INSERT INTO public.kit_items (kit_id, nom, categorie, poids_g, prix_cents, quantite, essentiel, slug, image, alt, sort_order) VALUES
      (kit_id_gr20, 'Veste coupe-vent ultra-légère', 'Vêtements', 180, 12900, 1, true, 'veste-ultralight', 'https://img.rocket.new/generatedImages/rocket_gen_img_1f665a878-1764696745977.png', 'Veste coupe-vent ultra-légère jaune compressible dans sa poche', 1),
      (kit_id_gr20, 'Short de randonnée technique', 'Vêtements', 160, 5900, 1, true, 'short-rando', 'https://img.rocket.new/generatedImages/rocket_gen_img_11fd96575-1768188264807.png', 'Short de randonnée technique gris avec poches zippées', 2),
      (kit_id_gr20, 'Chaussures trail légères', 'Chaussures', 620, 13900, 1, true, 'chaussures-trail', 'https://img.rocket.new/generatedImages/rocket_gen_img_12b4b2dc4-1772990731239.png', 'Chaussures de trail légères orange avec semelle crantée pour terrain rocheux', 3),
      (kit_id_gr20, 'Sac à dos 35L ultralight', 'Sac', 780, 15900, 1, true, 'sac-35l-ul', 'https://img.rocket.new/generatedImages/rocket_gen_img_1723279ea-1767876070196.png', 'Sac à dos ultralight 35 litres rouge avec armature carbone', 4),
      (kit_id_gr20, 'Tarp bivouac 1 place', 'Bivouac', 650, 8900, 1, true, 'tarp-bivouac', 'https://img.rocket.new/generatedImages/rocket_gen_img_141d1cf21-1783673760038.png', 'Tarp de bivouac léger tendu entre deux arbres en forêt corse', 5),
      (kit_id_gr20, 'Sac de couchage duvet 0°C', 'Bivouac', 680, 18900, 1, true, 'sac-duvet', 'https://img.rocket.new/generatedImages/rocket_gen_img_133df3617-1772222050429.png', 'Sac de couchage en duvet compressé dans son sac de compression', 6),
      (kit_id_gr20, 'Filtre à eau Sawyer', 'Eau', 57, 3900, 1, true, 'filtre-sawyer', 'https://img.rocket.new/generatedImages/rocket_gen_img_1d487a40d-1772086804189.png', 'Filtre à eau Sawyer Squeeze bleu avec poche souple', 7)
    ON CONFLICT DO NOTHING;
  END IF;

  IF kit_id_van IS NOT NULL THEN
    INSERT INTO public.kit_items (kit_id, nom, categorie, poids_g, prix_cents, quantite, essentiel, slug, image, alt, sort_order) VALUES
      (kit_id_van, 'Matelas mousse haute densité', 'Couchage', 2800, 8900, 1, true, 'matelas-van', 'https://img.rocket.new/generatedImages/rocket_gen_img_14d9d1a04-1783673759950.png', 'Matelas mousse haute densité gris découpé aux dimensions d''un van', 1),
      (kit_id_van, 'Réchaud 2 feux + casseroles', 'Cuisine', 1800, 6900, 1, true, 'rechaud-2feux', 'https://img.rocket.new/generatedImages/rocket_gen_img_1243458bc-1766063030542.png', 'Réchaud camping 2 feux avec set de casseroles empilables', 2),
      (kit_id_van, 'Glacière électrique 30L', 'Cuisine', 3200, 18900, 1, false, 'glaciere-elec', 'https://img.rocket.new/generatedImages/rocket_gen_img_1aeca806b-1783673761895.png', 'Glacière électrique portable 30 litres branchée sur prise 12V', 3),
      (kit_id_van, 'Panneau solaire 100W pliable', 'Énergie', 1600, 14900, 1, false, 'panneau-solaire', 'https://img.rocket.new/generatedImages/rocket_gen_img_1cdde226c-1772091916416.png', 'Panneau solaire pliable 100W posé sur le toit d''un van', 4),
      (kit_id_van, 'Douche solaire 20L', 'Hygiène', 420, 2900, 1, true, 'douche-solaire', 'https://img.rocket.new/generatedImages/rocket_gen_img_1ef2d2f29-1783673759048.png', 'Poche douche solaire noire 20 litres suspendue à un arbre', 5),
      (kit_id_van, 'Kit premiers secours complet', 'Sécurité', 680, 4900, 1, true, 'kit-secours', 'https://img.rocket.new/generatedImages/rocket_gen_img_1aeb8983a-1766791137461.png', 'Kit de premiers secours complet dans boîte rouge avec croix blanche', 6),
      (kit_id_van, 'Chaises pliantes légères (x2)', 'Confort', 1100, 5900, 2, false, 'chaises-pliantes', 'https://images.unsplash.com/photo-1699276454090-e890655a18cc', 'Deux chaises de camping pliantes légères installées devant un van', 7)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Seed experts
INSERT INTO public.experts (name, title, specialties, destinations, rating, reviews_count, consultations_count, price_per_hour, availability, certifications, bio, avatar, languages, response_time)
VALUES
  ('Marc Dubois', 'Guide haute montagne IFMGA', ARRAY['Alpinisme', 'Ski de randonnée', 'Cascade de glace'], ARRAY['Alpes', 'Himalaya', 'Patagonie', 'Alaska'], 4.97, 284, 1240, 85, 'disponible', ARRAY['IFMGA', 'PGHM', 'Secouriste montagne'], 'Guide haute montagne depuis 18 ans, spécialiste des 8000m. A guidé 3 expéditions au K2 et 7 au Mont Blanc.', 'MD', ARRAY['FR', 'EN', 'DE'], '< 2h'),
  ('Amina Benali', 'Experte désert & survie', ARRAY['Désert', 'Survie', 'Navigation', 'Ethnobotanique'], ARRAY['Sahara', 'Atacama', 'Namib', 'Gobi'], 4.92, 156, 780, 65, 'disponible', ARRAY['BEES Randonnée', 'Survie SERE', 'Secourisme PSE2'], 'Née au Maroc, spécialiste des environnements arides. Traverse le Sahara chaque année depuis 12 ans.', 'AB', ARRAY['FR', 'EN', 'AR'], '< 4h'),
  ('Kenji Watanabe', 'Guide trek & jungle', ARRAY['Jungle', 'Trek', 'Ornithologie', 'Photographie nature'], ARRAY['Amazonie', 'Bornéo', 'Papouasie', 'Japon'], 4.88, 203, 920, 70, 'sur-demande', ARRAY['UIAGM', 'Wilderness First Responder'], 'Biologiste de formation, guide certifié depuis 15 ans. Expert des écosystèmes tropicaux et de la faune sauvage.', 'KW', ARRAY['FR', 'EN', 'JP'], '< 6h'),
  ('Sofia Eriksson', 'Experte arctique & ski', ARRAY['Arctique', 'Ski de fond', 'Traîneau à chiens', 'Aurores boréales'], ARRAY['Islande', 'Norvège', 'Svalbard', 'Groenland'], 4.95, 118, 560, 90, 'occupé', ARRAY['IFMGA', 'Wilderness Medicine', 'Avalanche Pro'], 'Suédoise d''origine, guide arctique depuis 10 ans. Spécialiste des traversées polaires et du ski de randonnée nordique.', 'SE', ARRAY['FR', 'EN', 'SV', 'NO'], '< 8h')
ON CONFLICT DO NOTHING;

-- Seed reviews
INSERT INTO public.reviews (type, target_name, rating, title, comment, verified, helpful_count)
VALUES
  ('produit', 'Osprey Atmos AG 65', 5, 'Parfait pour la haute montagne', 'Utilisé 3 semaines au Népal, le sac a tenu sans aucun problème. Le système Anti-Gravity est vraiment révolutionnaire pour les longues distances chargées. Aucun point de pression même avec 18kg. Je recommande vivement pour tout trek de plusieurs jours.', true, 24),
  ('kit', 'Kit GR20 Corse 15 jours', 4, 'Excellent kit, quelques ajustements', 'Le kit GR20 est très bien pensé. J''ai juste remplacé la tente par une version plus légère et ajouté un filtre à eau. Tout le reste était parfait pour 15 jours en Corse. La liste de poids est précise.', true, 18),
  ('location', 'Tente MSR Hubba Hubba NX 2P', 5, 'Location parfaite, propriétaire au top', 'Thomas était très disponible, le matériel était exactement comme décrit. La tente était propre et en parfait état. Je la louerais à nouveau sans hésiter. Le système de caution est rassurant pour les deux parties.', true, 12),
  ('occasion', 'Arc''teryx Beta AR Jacket', 4, 'Très bon état, conforme à l''annonce', 'La veste était exactement comme décrite. Quelques petites traces d''usure normales pour une veste de cette gamme. Le vendeur a été réactif et l''envoi rapide. Je suis satisfaite de mon achat.', true, 9),
  ('produit', 'Crampons Petzl Vasak 10 pointes', 5, 'Incontournable pour l''alpinisme', 'Les crampons Petzl Vasak sont une référence. Utilisés sur plusieurs courses en Écrins, ils n''ont jamais failli. Le système de fixation est rapide et sécurisé. Indispensable dans tout kit d''alpinisme sérieux.', true, 31)
ON CONFLICT DO NOTHING;

-- Seed ambassadors
INSERT INTO public.ambassadors (name, handle, tier, followers, commission_pct, earnings, clicks, conversions, promo_code, avatar, status)
VALUES
  ('Léa Montagne', '@leamontagne', 'Legend', '248K', 15, 4820, 12400, 312, 'LEA15', 'LM', 'active'),
  ('Romain Trek', '@romaintrek', 'Trailblazer', '87K', 12, 2140, 6800, 178, 'ROMAIN12', 'RT', 'active'),
  ('Jade Explore', '@jadeexplore', 'Explorer', '31K', 8, 890, 2900, 74, 'JADE8', 'JE', 'active')
ON CONFLICT (promo_code) DO NOTHING;

-- Seed promo codes
DO $$
DECLARE
  amb_lea UUID;
  amb_jade UUID;
BEGIN
  SELECT id INTO amb_lea FROM public.ambassadors WHERE promo_code = 'LEA15' LIMIT 1;
  SELECT id INTO amb_jade FROM public.ambassadors WHERE promo_code = 'JADE8' LIMIT 1;

  INSERT INTO public.promo_codes (code, ambassador_id, uses, revenue, status) VALUES
    ('LEA15', amb_lea, 312, 77688, 'active'),
    ('SUMMER24', NULL, 1847, 184700, 'expired'),
    ('TREK10', NULL, 892, 89200, 'expired'),
    ('JADE8', amb_jade, 74, 14726, 'active')
  ON CONFLICT (code) DO NOTHING;
END $$;

-- Seed challenges
INSERT INTO public.challenges (title, description, xp, category, difficulty, total, deadline, active)
VALUES
  ('Premier Kit Complet', 'Configurez votre premier kit complet avec le configurateur IA', 500, 'Équipement', 'Facile', 1, '', true),
  ('Explorateur de Destinations', 'Consultez les fiches de 10 destinations différentes', 750, 'Découverte', 'Moyen', 10, '', true),
  ('Communauté Active', 'Répondez à 5 questions dans le forum communautaire', 600, 'Social', 'Moyen', 5, '', true),
  ('Bilan Carbone Zéro', 'Compensez l''empreinte carbone de 3 voyages consécutifs', 1200, 'Éco', 'Difficile', 3, '', true),
  ('Légende des Sommets', 'Complétez 5 expéditions en haute altitude (>4000m) et publiez vos fiches', 5000, 'Expédition', 'Légendaire', 5, '31 déc. 2026', true),
  ('Maître du Budget', 'Terminez 3 voyages avec un budget réel inférieur à l''estimation', 800, 'Finance', 'Moyen', 3, '', true)
ON CONFLICT DO NOTHING;

-- Seed badges
INSERT INTO public.badges (name, description, icon, rarity, holders_count)
VALUES
  ('Premier Pas', 'Premier kit configuré', '🥾', 'Commun', 4820),
  ('Alpiniste Confirmé', 'Expédition > 4000m complétée', '⛰️', 'Rare', 342),
  ('Éco-Voyageur', 'Empreinte carbone compensée sur 3 voyages', '🌿', 'Épique', 89),
  ('Légende des 7 Continents', 'Expéditions sur les 7 continents', '🌍', 'Légendaire', 12),
  ('Expert Communauté', '50 réponses validées dans le forum', '🎓', 'Épique', 67),
  ('Nomade Numérique', '12 mois d''abonnement consécutifs', '💻', 'Rare', 1240),
  ('Chasseur de Promo', 'Économisé plus de 500€ via les alertes prix', '🏷️', 'Commun', 2100),
  ('Pionnier Phase 5', 'Membre actif dès le lancement Phase 5', '🚀', 'Épique', 234)
ON CONFLICT DO NOTHING;

-- Seed occasion items (no seller_id required for seed data - use a placeholder approach)
-- We skip occasion/auction/rental seed data as they require real user accounts

