-- ============================================================
-- KIT DU VOYAGEUR — Full Schema + Rich Seed Data
-- Community & Boutique fully populated
-- ============================================================

-- ─── 1. USER PROFILES ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  trust_score INTEGER DEFAULT 50,
  loyalty_points INTEGER DEFAULT 0,
  loyalty_level TEXT DEFAULT 'Explorateur',
  bio TEXT DEFAULT '',
  location TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_profiles" ON public.user_profiles;
CREATE POLICY "public_read_profiles" ON public.user_profiles FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "users_manage_own_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_profiles" ON public.user_profiles
FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ─── 2. PRODUCTS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Autre',
  activity TEXT[] DEFAULT '{}',
  weight_g INTEGER DEFAULT 0,
  price_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock INTEGER DEFAULT 10,
  image TEXT DEFAULT '',
  image_alt TEXT DEFAULT '',
  badge TEXT DEFAULT '',
  description TEXT DEFAULT '',
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_products" ON public.products;
CREATE POLICY "public_read_products" ON public.products FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_products" ON public.products;
CREATE POLICY "auth_manage_products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 3. KITS ─────────────────────────────────────────────────────────────────

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

ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_kits" ON public.kits;
CREATE POLICY "public_read_kits" ON public.kits FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_kits" ON public.kits;
CREATE POLICY "auth_manage_kits" ON public.kits FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 4. KIT ITEMS ────────────────────────────────────────────────────────────

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
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_kit_items" ON public.kit_items;
CREATE POLICY "public_read_kit_items" ON public.kit_items FOR SELECT TO public USING (true);

-- ─── 5. OCCASION ITEMS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.occasion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10,2) DEFAULT 0,
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

ALTER TABLE public.occasion_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_occasion" ON public.occasion_items;
CREATE POLICY "public_read_occasion" ON public.occasion_items FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_occasion" ON public.occasion_items;
CREATE POLICY "auth_manage_occasion" ON public.occasion_items FOR ALL TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

-- ─── 6. AUCTION ITEMS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_price NUMERIC(10,2) DEFAULT 0,
  current_bid NUMERIC(10,2) DEFAULT 0,
  buy_now_price NUMERIC(10,2) DEFAULT 0,
  condition TEXT DEFAULT 'bon',
  ends_at TIMESTAMPTZ,
  bids_count INTEGER DEFAULT 0,
  watchers_count INTEGER DEFAULT 0,
  image TEXT DEFAULT '',
  alt TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.auction_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_auctions" ON public.auction_items;
CREATE POLICY "public_read_auctions" ON public.auction_items FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_auctions" ON public.auction_items;
CREATE POLICY "auth_manage_auctions" ON public.auction_items FOR ALL TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

-- ─── 7. RENTAL ITEMS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rental_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_per_day NUMERIC(10,2) DEFAULT 0,
  price_per_week NUMERIC(10,2) DEFAULT 0,
  deposit NUMERIC(10,2) DEFAULT 0,
  condition TEXT DEFAULT 'excellent',
  location TEXT DEFAULT '',
  image TEXT DEFAULT '',
  alt TEXT DEFAULT '',
  available BOOLEAN DEFAULT true,
  available_from DATE,
  available_to DATE,
  rating NUMERIC(3,1) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.rental_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_rentals" ON public.rental_items;
CREATE POLICY "public_read_rentals" ON public.rental_items FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_rentals" ON public.rental_items;
CREATE POLICY "auth_manage_rentals" ON public.rental_items FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ─── 8. COMMUNITY POSTS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT DEFAULT '',
  image_alt TEXT DEFAULT '',
  post_type TEXT DEFAULT 'post' CHECK (post_type IN ('post','tip','question','share')),
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  is_trending BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_posts_read" ON public.community_posts;
CREATE POLICY "community_posts_read" ON public.community_posts FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "community_posts_insert" ON public.community_posts;
CREATE POLICY "community_posts_insert" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "community_posts_manage" ON public.community_posts;
CREATE POLICY "community_posts_manage" ON public.community_posts FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- ─── 9. POST LIKES ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_likes_unique ON public.post_likes(post_id, user_id);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_likes_read" ON public.post_likes;
CREATE POLICY "post_likes_read" ON public.post_likes FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "post_likes_manage" ON public.post_likes;
CREATE POLICY "post_likes_manage" ON public.post_likes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── 10. POST COMMENTS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_comments_read" ON public.post_comments;
CREATE POLICY "post_comments_read" ON public.post_comments FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "post_comments_manage" ON public.post_comments;
CREATE POLICY "post_comments_manage" ON public.post_comments FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- ─── 11. QA QUESTIONS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.qa_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  category TEXT DEFAULT 'Général',
  votes_count INTEGER DEFAULT 0,
  answers_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  is_solved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.qa_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_questions_read" ON public.qa_questions;
CREATE POLICY "qa_questions_read" ON public.qa_questions FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "qa_questions_manage" ON public.qa_questions;
CREATE POLICY "qa_questions_manage" ON public.qa_questions FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- ─── 12. QA ANSWERS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.qa_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.qa_questions(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  votes_count INTEGER DEFAULT 0,
  is_accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.qa_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_answers_read" ON public.qa_answers;
CREATE POLICY "qa_answers_read" ON public.qa_answers FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "qa_answers_manage" ON public.qa_answers;
CREATE POLICY "qa_answers_manage" ON public.qa_answers FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- ─── 13. AMA SESSIONS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ama_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 60,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','live','ended')),
  participants_count INTEGER DEFAULT 0,
  questions_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.ama_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ama_sessions_read" ON public.ama_sessions;
CREATE POLICY "ama_sessions_read" ON public.ama_sessions FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "ama_sessions_manage" ON public.ama_sessions;
CREATE POLICY "ama_sessions_manage" ON public.ama_sessions FOR ALL TO authenticated USING (expert_id = auth.uid()) WITH CHECK (expert_id = auth.uid());

-- ─── 14. AMA QUESTIONS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ama_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ama_sessions(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  votes_count INTEGER DEFAULT 0,
  is_answered BOOLEAN DEFAULT false,
  answer TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.ama_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ama_questions_read" ON public.ama_questions;
CREATE POLICY "ama_questions_read" ON public.ama_questions FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "ama_questions_manage" ON public.ama_questions;
CREATE POLICY "ama_questions_manage" ON public.ama_questions FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- ─── 15. USER FOLLOWS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_follows_unique ON public.user_follows(follower_id, following_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_follows_read" ON public.user_follows;
CREATE POLICY "user_follows_read" ON public.user_follows FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "user_follows_manage" ON public.user_follows;
CREATE POLICY "user_follows_manage" ON public.user_follows FOR ALL TO authenticated USING (follower_id = auth.uid()) WITH CHECK (follower_id = auth.uid());

-- ─── 16. CLUBS ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'activite',
  emoji TEXT DEFAULT '🏕️',
  description TEXT DEFAULT '',
  cover_color TEXT DEFAULT 'from-emerald-600 to-teal-700',
  cover_image TEXT DEFAULT '',
  category TEXT DEFAULT '',
  privacy TEXT DEFAULT 'open',
  members_count INTEGER DEFAULT 0,
  active_this_month INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clubs_read" ON public.clubs;
CREATE POLICY "clubs_read" ON public.clubs FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "clubs_manage" ON public.clubs;
CREATE POLICY "clubs_manage" ON public.clubs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 17. CARNETS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.carnets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  destination TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  cover_image_alt TEXT DEFAULT '',
  start_date DATE,
  end_date DATE,
  weather TEXT DEFAULT '',
  route_rating NUMERIC(3,1) DEFAULT 0,
  visibility TEXT DEFAULT 'public',
  tags TEXT[] DEFAULT '{}',
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.carnets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carnets_read" ON public.carnets;
CREATE POLICY "carnets_read" ON public.carnets FOR SELECT TO public USING (visibility = 'public');

DROP POLICY IF EXISTS "carnets_manage" ON public.carnets;
CREATE POLICY "carnets_manage" ON public.carnets FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- ─── 18. PRODUCT REVIEWS ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rating INTEGER DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  verified_purchase BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_read" ON public.product_reviews;
CREATE POLICY "reviews_read" ON public.product_reviews FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "reviews_manage" ON public.product_reviews;
CREATE POLICY "reviews_manage" ON public.product_reviews FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- ─── 19. HANDLE NEW USER TRIGGER ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 20. SEED DATA ────────────────────────────────────────────────────────────

DO $$
DECLARE
  u1  UUID := 'aa000001-0000-0000-0000-000000000001';
  u2  UUID := 'aa000001-0000-0000-0000-000000000002';
  u3  UUID := 'aa000001-0000-0000-0000-000000000003';
  u4  UUID := 'aa000001-0000-0000-0000-000000000004';
  u5  UUID := 'aa000001-0000-0000-0000-000000000005';
  u6  UUID := 'aa000001-0000-0000-0000-000000000006';
  u7  UUID := 'aa000001-0000-0000-0000-000000000007';
  u8  UUID := 'aa000001-0000-0000-0000-000000000008';
  u9  UUID := 'aa000001-0000-0000-0000-000000000009';
  u10 UUID := 'aa000001-0000-0000-0000-000000000010';

  p1  UUID := 'bb000002-0000-0000-0000-000000000001';
  p2  UUID := 'bb000002-0000-0000-0000-000000000002';
  p3  UUID := 'bb000002-0000-0000-0000-000000000003';
  p4  UUID := 'bb000002-0000-0000-0000-000000000004';
  p5  UUID := 'bb000002-0000-0000-0000-000000000005';
  p6  UUID := 'bb000002-0000-0000-0000-000000000006';
  p7  UUID := 'bb000002-0000-0000-0000-000000000007';
  p8  UUID := 'bb000002-0000-0000-0000-000000000008';
  p9  UUID := 'bb000002-0000-0000-0000-000000000009';
  p10 UUID := 'bb000002-0000-0000-0000-000000000010';
  p11 UUID := 'bb000002-0000-0000-0000-000000000011';
  p12 UUID := 'bb000002-0000-0000-0000-000000000012';

  k1  UUID := 'cc000003-0000-0000-0000-000000000001';
  k2  UUID := 'cc000003-0000-0000-0000-000000000002';
  k3  UUID := 'cc000003-0000-0000-0000-000000000003';
  k4  UUID := 'cc000003-0000-0000-0000-000000000004';

  cp1 UUID := 'dd000004-0000-0000-0000-000000000001';
  cp2 UUID := 'dd000004-0000-0000-0000-000000000002';
  cp3 UUID := 'dd000004-0000-0000-0000-000000000003';
  cp4 UUID := 'dd000004-0000-0000-0000-000000000004';
  cp5 UUID := 'dd000004-0000-0000-0000-000000000005';
  cp6 UUID := 'dd000004-0000-0000-0000-000000000006';
  cp7 UUID := 'dd000004-0000-0000-0000-000000000007';
  cp8 UUID := 'dd000004-0000-0000-0000-000000000008';
  cp9 UUID := 'dd000004-0000-0000-0000-000000000009';
  cp10 UUID := 'dd000004-0000-0000-0000-000000000010';
  cp11 UUID := 'dd000004-0000-0000-0000-000000000011';
  cp12 UUID := 'dd000004-0000-0000-0000-000000000012';

  q1  UUID := 'ee000005-0000-0000-0000-000000000001';
  q2  UUID := 'ee000005-0000-0000-0000-000000000002';
  q3  UUID := 'ee000005-0000-0000-0000-000000000003';
  q4  UUID := 'ee000005-0000-0000-0000-000000000004';
  q5  UUID := 'ee000005-0000-0000-0000-000000000005';

  qa1 UUID := 'ff000006-0000-0000-0000-000000000001';
  qa2 UUID := 'ff000006-0000-0000-0000-000000000002';
  qa3 UUID := 'ff000006-0000-0000-0000-000000000003';
  qa4 UUID := 'ff000006-0000-0000-0000-000000000004';
  qa5 UUID := 'ff000006-0000-0000-0000-000000000005';

  ama1 UUID := 'a7000007-0000-0000-0000-000000000001';
  ama2 UUID := 'a7000007-0000-0000-0000-000000000002';

  amaq1 UUID := 'a8000008-0000-0000-0000-000000000001';
  amaq2 UUID := 'a8000008-0000-0000-0000-000000000002';
  amaq3 UUID := 'a8000008-0000-0000-0000-000000000003';
  amaq4 UUID := 'a8000008-0000-0000-0000-000000000004';

  oc1 UUID := 'a9000009-0000-0000-0000-000000000001';
  oc2 UUID := 'a9000009-0000-0000-0000-000000000002';
  oc3 UUID := 'a9000009-0000-0000-0000-000000000003';
  oc4 UUID := 'a9000009-0000-0000-0000-000000000004';
  oc5 UUID := 'a9000009-0000-0000-0000-000000000005';
  oc6 UUID := 'a9000009-0000-0000-0000-000000000006';

  au1 UUID := 'b0000010-0000-0000-0000-000000000001';
  au2 UUID := 'b0000010-0000-0000-0000-000000000002';
  au3 UUID := 'b0000010-0000-0000-0000-000000000003';

  re1 UUID := 'b1000011-0000-0000-0000-000000000001';
  re2 UUID := 'b1000011-0000-0000-0000-000000000002';
  re3 UUID := 'b1000011-0000-0000-0000-000000000003';

  cl1 UUID := 'b2000012-0000-0000-0000-000000000001';
  cl2 UUID := 'b2000012-0000-0000-0000-000000000002';
  cl3 UUID := 'b2000012-0000-0000-0000-000000000003';
  cl4 UUID := 'b2000012-0000-0000-0000-000000000004';
  cl5 UUID := 'b2000012-0000-0000-0000-000000000005';

BEGIN

  -- ── AUTH USERS ──────────────────────────────────────────────────────────────
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'marie.dupont@kitduvoyageur.fr', crypt('Voyage2024!', gen_salt('bf', 10)), now() - interval '180 days', now() - interval '180 days', now(),
     jsonb_build_object('full_name', 'Marie Dupont', 'avatar_url', 'https://i.pravatar.cc/150?img=1'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'thomas.martin@kitduvoyageur.fr', crypt('Rando2024!', gen_salt('bf', 10)), now() - interval '150 days', now() - interval '150 days', now(),
     jsonb_build_object('full_name', 'Thomas Martin', 'avatar_url', 'https://i.pravatar.cc/150?img=2'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sophie.bernard@kitduvoyageur.fr', crypt('Trek2024!', gen_salt('bf', 10)), now() - interval '120 days', now() - interval '120 days', now(),
     jsonb_build_object('full_name', 'Sophie Bernard', 'avatar_url', 'https://i.pravatar.cc/150?img=3'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'lucas.petit@kitduvoyageur.fr', crypt('Alpin2024!', gen_salt('bf', 10)), now() - interval '90 days', now() - interval '90 days', now(),
     jsonb_build_object('full_name', 'Lucas Petit', 'avatar_url', 'https://i.pravatar.cc/150?img=4'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'camille.leroy@kitduvoyageur.fr', crypt('Kayak2024!', gen_salt('bf', 10)), now() - interval '75 days', now() - interval '75 days', now(),
     jsonb_build_object('full_name', 'Camille Leroy', 'avatar_url', 'https://i.pravatar.cc/150?img=5'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u6, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'antoine.moreau@kitduvoyageur.fr', crypt('Velo2024!', gen_salt('bf', 10)), now() - interval '60 days', now() - interval '60 days', now(),
     jsonb_build_object('full_name', 'Antoine Moreau', 'avatar_url', 'https://i.pravatar.cc/150?img=6'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u7, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'julie.simon@kitduvoyageur.fr', crypt('Surf2024!', gen_salt('bf', 10)), now() - interval '45 days', now() - interval '45 days', now(),
     jsonb_build_object('full_name', 'Julie Simon', 'avatar_url', 'https://i.pravatar.cc/150?img=7'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u8, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'maxime.garcia@kitduvoyageur.fr', crypt('Ski2024!', gen_salt('bf', 10)), now() - interval '30 days', now() - interval '30 days', now(),
     jsonb_build_object('full_name', 'Maxime Garcia', 'avatar_url', 'https://i.pravatar.cc/150?img=8'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u9, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'lea.rousseau@kitduvoyageur.fr', crypt('Moto2024!', gen_salt('bf', 10)), now() - interval '20 days', now() - interval '20 days', now(),
     jsonb_build_object('full_name', 'Léa Rousseau', 'avatar_url', 'https://i.pravatar.cc/150?img=9'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u10, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'pierre.lambert@kitduvoyageur.fr', crypt('Camp2024!', gen_salt('bf', 10)), now() - interval '10 days', now() - interval '10 days', now(),
     jsonb_build_object('full_name', 'Pierre Lambert', 'avatar_url', 'https://i.pravatar.cc/150?img=10'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
  ON CONFLICT (id) DO NOTHING;

  -- ── USER PROFILES ────────────────────────────────────────────────────────────
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, trust_score, loyalty_points, loyalty_level, bio, location) VALUES
    (u1,  'marie.dupont@kitduvoyageur.fr',   'Marie Dupont',   'https://i.pravatar.cc/150?img=1',  92, 4800, 'Ambassadeur', 'Randonneuse passionnée, 15 ans de trek en haute montagne. Je partage mes expériences pour aider les autres voyageurs.', 'Chamonix, France'),
    (u2,  'thomas.martin@kitduvoyageur.fr',  'Thomas Martin',  'https://i.pravatar.cc/150?img=2',  85, 3200, 'Expert',      'Guide de montagne certifié. Spécialiste des Alpes et des Pyrénées. Ultra-light hiking advocate.', 'Grenoble, France'),
    (u3,  'sophie.bernard@kitduvoyageur.fr', 'Sophie Bernard', 'https://i.pravatar.cc/150?img=3',  78, 2100, 'Expert',      'Kayakiste et randonneuse. Passionnée par les voyages en autonomie totale.', 'Lyon, France'),
    (u4,  'lucas.petit@kitduvoyageur.fr',    'Lucas Petit',    'https://i.pravatar.cc/150?img=4',  71, 1500, 'Aventurier',  'Alpiniste amateur, fan de bivouac et de photographie de montagne.', 'Annecy, France'),
    (u5,  'camille.leroy@kitduvoyageur.fr',  'Camille Leroy',  'https://i.pravatar.cc/150?img=5',  65, 980,  'Aventurier',  'Cycliste et randonneuse. Je prépare un tour du monde à vélo pour 2025 !', 'Bordeaux, France'),
    (u6,  'antoine.moreau@kitduvoyageur.fr', 'Antoine Moreau', 'https://i.pravatar.cc/150?img=6',  60, 720,  'Aventurier',  'Vélotouriste et campeur. Toujours à la recherche du meilleur rapport poids/performance.', 'Nantes, France'),
    (u7,  'julie.simon@kitduvoyageur.fr',    'Julie Simon',    'https://i.pravatar.cc/150?img=7',  55, 450,  'Explorateur', 'Débutante en randonnée, je découvre le monde du trekking avec enthousiasme !', 'Paris, France'),
    (u8,  'maxime.garcia@kitduvoyageur.fr',  'Maxime Garcia',  'https://i.pravatar.cc/150?img=8',  50, 280,  'Explorateur', 'Skieur et randonneur hivernal. Je cherche les meilleurs équipements pour la neige.', 'Toulouse, France'),
    (u9,  'lea.rousseau@kitduvoyageur.fr',   'Léa Rousseau',   'https://i.pravatar.cc/150?img=9',  48, 150,  'Explorateur', 'Nouvelle venue dans la communauté. Passionnée de nature et de voyages slow.', 'Marseille, France'),
    (u10, 'pierre.lambert@kitduvoyageur.fr', 'Pierre Lambert', 'https://i.pravatar.cc/150?img=10', 45, 80,   'Explorateur', 'Randonneur du dimanche qui veut progresser. Merci pour tous vos conseils !', 'Strasbourg, France')
  ON CONFLICT (id) DO NOTHING;

  -- ── PRODUCTS ─────────────────────────────────────────────────────────────────
  INSERT INTO public.products (id, slug, name, brand, category, weight_g, price_eur, stock, image, image_alt, badge, description, featured) VALUES
    (p1,  'osprey-atmos-65',         'Osprey Atmos AG 65',              'Osprey',     'Sacs',        2100, 329.00, 8,  'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80', 'Sac à dos Osprey Atmos AG 65 litres orange sur fond blanc', 'Bestseller', 'Sac à dos 65L avec système Anti-Gravity pour un confort exceptionnel en randonnée multi-jours.', true),
    (p2,  'big-agnes-copper-spur',   'Big Agnes Copper Spur HV UL2',    'Big Agnes',  'Tentes',      1060, 549.00, 5,  'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', 'Tente Big Agnes Copper Spur ultralight montée dans un pré vert', 'Ultra-light', 'Tente 2 personnes ultra-légère 1060g. Idéale pour le trekking et le bivouac.', true),
    (p3,  'arc-teryx-beta-jacket',   'Arc''teryx Beta AR Jacket',       'Arc''teryx', 'Vêtements',   485,  749.00, 12, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&q=80', 'Veste de randonnée Arc''teryx Beta AR rouge imperméable', 'Premium', 'Veste hardshell Gore-Tex Pro. Protection maximale contre les éléments.', true),
    (p4,  'salomon-speedcross-6',    'Salomon Speedcross 6',            'Salomon',    'Chaussures',  310,  139.00, 20, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80', 'Chaussures de trail Salomon Speedcross 6 bleues sur rocher', 'Nouveau', 'Chaussures de trail running avec grip agressif. Parfaites pour les terrains techniques.', true),
    (p5,  'petzl-actik-core',        'Petzl Actik Core',                'Petzl',      'Éclairage',   87,   59.90, 30, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', 'Lampe frontale Petzl Actik Core rouge allumée dans l''obscurité', '', 'Lampe frontale rechargeable 450 lumens. Légère et polyvalente pour toutes les activités outdoor.', false),
    (p6,  'msr-pocket-rocket-2',     'MSR PocketRocket 2',              'MSR',        'Cuisine',     73,   49.90, 25, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80', 'Réchaud MSR PocketRocket 2 compact avec casserole en aluminium', '', 'Réchaud ultra-compact 73g. Ébullition en 3.5 min. Le standard du bivouac léger.', false),
    (p7,  'katadyn-befree',          'Katadyn BeFree 1L',               'Katadyn',    'Eau',         56,   44.90, 18, 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&q=80', 'Filtre à eau Katadyn BeFree avec gourde souple transparente', '', 'Filtre à eau souple 1L. Filtre 0.1 micron. Idéal pour la randonnée et le trekking.', false),
    (p8,  'black-diamond-distance',  'Black Diamond Distance Carbon Z', 'Black Diamond', 'Bâtons',   254,  169.00, 15, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&q=80', 'Bâtons de randonnée Black Diamond Distance Carbon Z pliables noirs', 'Carbone', 'Bâtons pliables carbone 254g la paire. Rigidité et légèreté pour les longues distances.', false),
    (p9,  'sea-to-summit-sleeping',  'Sea to Summit Spark SP1',         'Sea to Summit', 'Sommeil',  395,  289.00, 10, 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400&q=80', 'Sac de couchage Sea to Summit Spark SP1 bleu compact dans son sac de compression', 'Léger', 'Sac de couchage duvet 395g. Confort jusqu''à -1°C. Compressible à l''extrême.', false),
    (p10, 'garmin-inreach-mini',     'Garmin inReach Mini 2',           'Garmin',     'Sécurité',   100,  399.00, 7,  'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&q=80', 'Communicateur satellite Garmin inReach Mini 2 orange avec antenne', 'SOS', 'Communicateur satellite bidirectionnel. SOS mondial, météo, tracking GPS.', true),
    (p11, 'nemo-tensor-pad',         'Nemo Tensor Insulated',           'Nemo',       'Sommeil',    410,  179.00, 14, 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400&q=80', 'Matelas gonflable Nemo Tensor Insulated vert déployé sur herbe', '', 'Matelas gonflable isolé R-value 3.5. Confort et légèreté pour 3 saisons.', false),
    (p12, 'patagonia-nano-puff',     'Patagonia Nano Puff Jacket',      'Patagonia',  'Vêtements',  311,  249.00, 16, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&q=80', 'Doudoune Patagonia Nano Puff verte portée par une randonneuse en montagne', 'Éco', 'Doudoune synthétique 311g. Isolation PrimaLoft. Résistante à l''humidité.', false)
  ON CONFLICT (slug) DO NOTHING;

  -- ── KITS ─────────────────────────────────────────────────────────────────────
  INSERT INTO public.kits (id, slug, nom, description, destination, saison, poids_total_g, prix_cents, nb_articles, difficulte, activite, image, alt, tags, featured, conseils) VALUES
    (k1, 'kit-alpes-ete', 'Kit Alpes Été', 'Kit complet pour 5 jours en autonomie dans les Alpes. Optimisé pour le confort et la légèreté.', 'Alpes', 'Été', 8200, 129900, 18, 'Intermédiaire', 'Randonnée', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', 'Vue panoramique des Alpes avec randonneur au sommet au coucher du soleil', ARRAY['alpes','été','autonomie','5 jours'], true, ARRAY['Portez toujours une couche imperméable même en été','Prévoyez 500g de nourriture par jour','Testez votre kit avant le départ']),
    (k2, 'kit-trek-nepal', 'Kit Trek Népal', 'Kit spécialement conçu pour le circuit des Annapurnas. Adapté aux variations de température extrêmes.', 'Népal', 'Automne', 9800, 189900, 22, 'Avancé', 'Trekking', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&q=80', 'Panorama de l''Himalaya avec les sommets enneigés des Annapurnas', ARRAY['népal','himalaya','trek','altitude'], true, ARRAY['Acclimatez-vous progressivement à l''altitude','Emportez des médicaments contre le mal des montagnes','Prévoyez des couches chaudes même en basse saison']),
    (k3, 'kit-velo-touring', 'Kit Vélo Touring', 'Tout le nécessaire pour un voyage à vélo en autonomie. Léger et fonctionnel pour les longues distances.', 'Europe', 'Printemps/Été', 6500, 89900, 15, 'Débutant', 'Vélo', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', 'Vélo de touring chargé avec sacoches sur une route de campagne française', ARRAY['vélo','touring','europe','autonomie'], false, ARRAY['Répartissez le poids équitablement','Emportez un kit de réparation complet','Prévoyez des vêtements de pluie accessibles rapidement']),
    (k4, 'kit-bivouac-hiver', 'Kit Bivouac Hiver', 'Kit pour bivouac hivernal en conditions difficiles. Conçu pour survivre jusqu''à -20°C.', 'Montagne', 'Hiver', 12000, 249900, 20, 'Expert', 'Alpinisme', 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', 'Bivouac hivernal avec tente dans la neige et ciel étoilé', ARRAY['hiver','bivouac','neige','froid'], true, ARRAY['Ne jamais sortir seul en conditions hivernales','Vérifiez la météo 48h avant','Emportez toujours un moyen de communication satellite'])
  ON CONFLICT (slug) DO NOTHING;

  -- ── KIT ITEMS ─────────────────────────────────────────────────────────────────
  INSERT INTO public.kit_items (kit_id, nom, categorie, poids_g, prix_cents, quantite, essentiel, slug) VALUES
    (k1, 'Osprey Atmos AG 65', 'Sac', 2100, 32900, 1, true, 'osprey-atmos-65'),
    (k1, 'Big Agnes Copper Spur HV UL2', 'Tente', 1060, 54900, 1, true, 'big-agnes-copper-spur'),
    (k1, 'Sea to Summit Spark SP1', 'Sommeil', 395, 28900, 1, true, 'sea-to-summit-sleeping'),
    (k1, 'Nemo Tensor Insulated', 'Sommeil', 410, 17900, 1, true, 'nemo-tensor-pad'),
    (k1, 'MSR PocketRocket 2', 'Cuisine', 73, 4990, 1, true, 'msr-pocket-rocket-2'),
    (k1, 'Katadyn BeFree 1L', 'Eau', 56, 4490, 1, true, 'katadyn-befree'),
    (k1, 'Petzl Actik Core', 'Éclairage', 87, 5990, 1, true, 'petzl-actik-core'),
    (k2, 'Osprey Atmos AG 65', 'Sac', 2100, 32900, 1, true, 'osprey-atmos-65'),
    (k2, 'Big Agnes Copper Spur HV UL2', 'Tente', 1060, 54900, 1, true, 'big-agnes-copper-spur'),
    (k2, 'Arc''teryx Beta AR Jacket', 'Vêtements', 485, 74900, 1, true, 'arc-teryx-beta-jacket'),
    (k2, 'Garmin inReach Mini 2', 'Sécurité', 100, 39900, 1, true, 'garmin-inreach-mini')
  ON CONFLICT DO NOTHING;

  -- ── COMMUNITY POSTS ──────────────────────────────────────────────────────────
  INSERT INTO public.community_posts (id, author_id, content, image_url, image_alt, post_type, likes_count, comments_count, shares_count, is_trending, created_at) VALUES
    (cp1,  u1,  'Retour de 10 jours sur le GR20 en Corse ! 🏔️ Un itinéraire absolument magnifique mais exigeant. Mon kit pesait 9,2 kg avec 3 jours de nourriture. La clé : ne prendre que l''essentiel. Je partage mon retour d''expérience complet dans les commentaires !', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', 'Vue panoramique du GR20 en Corse avec sentier rocheux et maquis', 'post', 47, 12, 8, true, now() - interval '2 hours'),
    (cp2,  u2,  '💡 Conseil ultra-light : Remplacez votre sac de couchage classique par un quilt ! J''ai économisé 400g et gagné en confort. Le Enlightened Equipment Revelation est mon choix pour les 3 saisons. Quelqu''un a déjà testé ?', '', '', 'tip', 38, 9, 5, true, now() - interval '4 hours'),
    (cp3,  u3,  '❓ Question pour les kayakistes : Quelle combinaison recommandez-vous pour le kayak de mer en Bretagne en septembre ? La température de l''eau est autour de 16°C. Néoprène ou drysuit ?', '', '', 'question', 24, 15, 3, false, now() - interval '6 hours'),
    (cp4,  u4,  'Bivouac au lac Blanc hier soir 🌟 Vue incroyable sur le Mont-Blanc. Température : -3°C au sol. Mon sac de couchage Sea to Summit Spark SP1 a parfaitement tenu. Lever à 5h pour voir le lever de soleil sur les Aiguilles de Chamonix.', 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80', 'Bivouac au lac Blanc avec vue sur le Mont-Blanc au lever du soleil', 'post', 89, 23, 14, true, now() - interval '8 hours'),
    (cp5,  u5,  '🔗 Je partage mon spreadsheet de préparation pour mon tour du monde à vélo ! 3 ans de préparation, 15 pays planifiés, budget détaillé. Lien en commentaire. Vos retours sont les bienvenus !', '', '', 'share', 56, 18, 22, true, now() - interval '12 hours'),
    (cp6,  u6,  '💡 Astuce pour les cyclotouristes : Utilisez des sacoches Ortlieb Back-Roller Classic plutôt que les modèles bon marché. Après 8000 km, les miennes sont toujours étanches et intactes. L''investissement vaut vraiment le coup.', '', '', 'tip', 31, 7, 4, false, now() - interval '1 day'),
    (cp7,  u7,  'Première randonnée de 3 jours terminée ! 🎉 J''ai suivi vos conseils pour alléger mon sac et je suis passée de 14 kg à 9 kg. Merci à toute la communauté pour votre aide ! Les bâtons Black Diamond ont fait une énorme différence.', 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', 'Randonneuse souriante au sommet d''une montagne avec vue dégagée', 'post', 72, 19, 6, true, now() - interval '1 day 4 hours'),
    (cp8,  u8,  '❓ Quelqu''un a de l''expérience avec les raquettes à neige Tubbs Flex RDG ? Je cherche des raquettes pour du hors-piste en Chartreuse. Budget 200€ max.', '', '', 'question', 18, 11, 2, false, now() - interval '2 days'),
    (cp9,  u9,  'Je viens de recevoir ma Patagonia Nano Puff et je suis bluffée par la compressibilité ! Elle rentre dans sa propre poche. Pour un voyage léger, c''est parfait. Quelqu''un l''a testée sous la pluie ?', '', '', 'post', 29, 8, 3, false, now() - interval '2 days 6 hours'),
    (cp10, u10, '💡 Pour les débutants : Commencez par des randonnées d''une journée avant de vous lancer dans le multi-jours. Testez votre équipement progressivement. J''ai fait l''erreur de partir 5 jours avec un kit jamais testé... catastrophe !', '', '', 'tip', 44, 13, 9, false, now() - interval '3 days'),
    (cp11, u1,  '🔗 Article que j''ai écrit sur la nutrition en randonnée : comment calculer ses besoins caloriques, les meilleurs aliments légers, et mes recettes de repas déshydratés maison. 2500 kcal/jour pour 800g de nourriture, c''est possible !', '', '', 'share', 63, 21, 17, true, now() - interval '3 days 8 hours'),
    (cp12, u2,  'Test comparatif : Osprey Atmos 65 vs Deuter Aircontact Lite 65. Après 200 km de randonnée avec les deux, voici mon verdict... L''Osprey gagne sur le confort, le Deuter sur la durabilité. Détails en commentaires.', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Comparaison de deux sacs à dos de randonnée Osprey et Deuter posés côte à côte', 'post', 51, 16, 7, false, now() - interval '4 days')
  ON CONFLICT (id) DO NOTHING;

  -- ── POST COMMENTS ─────────────────────────────────────────────────────────────
  INSERT INTO public.post_comments (post_id, author_id, content, created_at) VALUES
    (cp1, u2, 'Bravo Marie ! Le GR20 est sur ma liste depuis des années. Tu as dormi en refuge ou en bivouac ?', now() - interval '1 hour 30 min'),
    (cp1, u3, 'Superbe aventure ! 9,2 kg c''est déjà très bien pour 10 jours. Quel était ton sac de couchage ?', now() - interval '1 hour'),
    (cp1, u1, 'Merci ! J''ai mixé refuges et bivouac. Sac de couchage : Sea to Summit Spark SP1. Je détaille tout dans mon carnet d''expédition !', now() - interval '45 min'),
    (cp4, u1, 'Magnifique photo ! Le lac Blanc est un de mes spots préférés. Tu y es allé par quel itinéraire ?', now() - interval '7 hours'),
    (cp4, u2, 'Le Spark SP1 à -3°C, c''est limite non ? Tu avais une couche supplémentaire ?', now() - interval '6 hours'),
    (cp4, u4, 'Oui j''avais ma Nano Puff en plus. Combinaison parfaite ! Itinéraire : depuis la Flégère en 2h30.', now() - interval '5 hours'),
    (cp7, u1, 'Félicitations Julie ! C''est une vraie transformation. Quel sac tu utilises maintenant ?', now() - interval '23 hours'),
    (cp7, u2, 'Bravo ! Les bâtons font vraiment la différence sur les longues descentes. Continue comme ça !', now() - interval '22 hours'),
    (cp3, u2, 'Pour la Bretagne en septembre, je recommande une combinaison néoprène 5/4mm. La drysuit c''est pour l''hiver.', now() - interval '5 hours'),
    (cp3, u4, 'D''accord avec Thomas. 5/4mm minimum. Et prends une cagoule néoprène, l''eau de Bretagne est froide !', now() - interval '4 hours')
  ON CONFLICT DO NOTHING;

  -- ── QA QUESTIONS ─────────────────────────────────────────────────────────────
  INSERT INTO public.qa_questions (id, author_id, title, content, tags, category, votes_count, answers_count, views_count, is_solved, created_at) VALUES
    (q1, u7, 'Quelle tente ultra-légère pour 2 personnes sous 1,5 kg ?', 'Je cherche une tente 2 personnes pesant moins de 1,5 kg pour des randonnées en Alpes. Budget 500€ max. Quelles sont vos recommandations ?', ARRAY['tente','ultra-light','alpes','2 personnes'], 'Équipement', 34, 8, 245, true, now() - interval '5 days'),
    (q2, u8, 'Comment gérer l''altitude au-dessus de 4000m ?', 'Je prépare une ascension du Mont-Blanc. C''est ma première fois au-dessus de 4000m. Quels sont les signes du mal des montagnes et comment les prévenir ?', ARRAY['altitude','mont-blanc','mal des montagnes','sécurité'], 'Sécurité', 28, 12, 389, true, now() - interval '7 days'),
    (q3, u9, 'Meilleur filtre à eau pour le trekking en Asie du Sud-Est ?', 'Je pars 3 mois au Vietnam, Laos et Cambodge. Quelle solution de filtration d''eau recommandez-vous ? Steripen, Sawyer, Katadyn ?', ARRAY['eau','filtre','asie','trekking'], 'Équipement', 19, 6, 178, false, now() - interval '3 days'),
    (q4, u10, 'Comment réduire le poids de son sac de 15 à 10 kg ?', 'Mon sac pèse 15 kg pour une semaine. Je veux descendre à 10 kg. Par où commencer ? Quels sont les postes de poids les plus importants à optimiser ?', ARRAY['ultra-light','poids','optimisation','débutant'], 'Technique', 45, 15, 512, true, now() - interval '10 days'),
    (q5, u5, 'Vélo touring vs gravel pour un tour d''Europe ?', 'Je prépare un tour d''Europe de 6 mois. Faut-il mieux partir avec un vélo de touring classique ou un gravel ? Avantages et inconvénients de chaque option ?', ARRAY['vélo','touring','gravel','europe'], 'Vélo', 22, 9, 267, false, now() - interval '2 days')
  ON CONFLICT (id) DO NOTHING;

  -- ── QA ANSWERS ───────────────────────────────────────────────────────────────
  INSERT INTO public.qa_answers (id, question_id, author_id, content, votes_count, is_accepted, created_at) VALUES
    (qa1, q1, u2, 'La Big Agnes Copper Spur HV UL2 est ma recommandation numéro 1 : 1060g, excellente habitabilité, très résistante. Sinon la MSR Hubba Hubba NX à 1720g est plus abordable. Pour rester sous 1,5 kg avec 2 personnes, regardez aussi la Zpacks Duplex (560g !) mais le budget monte.', 28, true, now() - interval '4 days 20 hours'),
    (qa2, q2, u1, 'Signes du MAM : maux de tête, nausées, fatigue excessive, insomnie. Prévention : montez progressivement (max 500m/jour au-dessus de 3000m), hydratez-vous bien, évitez l''alcool. Diamox peut aider mais consultez un médecin avant. Sur le Mont-Blanc, acclimatez-vous 2-3 jours à Chamonix avant l''ascension.', 31, true, now() - interval '6 days 12 hours'),
    (qa3, q3, u3, 'Pour l''Asie du Sud-Est, je recommande le Sawyer Squeeze : léger, efficace, pas de cartouche à changer. Complétez avec des pastilles de chlore pour les situations d''urgence. Le Steripen est bien mais les piles sont un problème en zone reculée.', 15, false, now() - interval '2 days 8 hours'),
    (qa4, q4, u2, 'Les 3 postes à optimiser en priorité : 1) Sac de couchage (souvent 1-2 kg d''économie possible), 2) Tente (passez à une tente ultra-light), 3) Vêtements (éliminez les doublons). Pesez chaque article et questionnez sa nécessité. La règle : si vous ne l''utilisez pas chaque jour, laissez-le.', 38, true, now() - interval '9 days 6 hours'),
    (qa5, q5, u6, 'J''ai fait 8000 km en touring classique et je ne regrette pas. Plus stable chargé, plus confortable sur les longues distances. Le gravel est plus polyvalent mais moins confortable sur l''asphalte avec des charges lourdes. Pour 6 mois, je recommande le touring.', 18, false, now() - interval '1 day 14 hours')
  ON CONFLICT (id) DO NOTHING;

  -- ── AMA SESSIONS ─────────────────────────────────────────────────────────────
  INSERT INTO public.ama_sessions (id, expert_id, title, description, scheduled_at, duration_minutes, status, participants_count, questions_count, created_at) VALUES
    (ama1, u2, 'AMA : Guide de montagne — Préparer son premier 4000m', 'Thomas Martin, guide de montagne certifié avec 15 ans d''expérience, répond à toutes vos questions sur la préparation d''une ascension de 4000m. Équipement, entraînement, sécurité, météo...', now() + interval '3 days', 90, 'upcoming', 127, 0, now() - interval '2 days'),
    (ama2, u1, 'AMA : Ultra-light hiking — Passer sous les 7 kg', 'Marie Dupont, randonneuse ultra-light avec 15 ans d''expérience, partage ses secrets pour réduire le poids de son sac sans sacrifier le confort ni la sécurité.', now() - interval '5 days', 60, 'ended', 89, 24, now() - interval '10 days')
  ON CONFLICT (id) DO NOTHING;

  -- ── AMA QUESTIONS ────────────────────────────────────────────────────────────
  INSERT INTO public.ama_questions (id, session_id, author_id, content, votes_count, is_answered, answer, created_at) VALUES
    (amaq1, ama2, u7, 'Par quoi commencer quand on veut passer en ultra-light ? Quel est le premier équipement à changer ?', 22, true, 'Commencez par le sac de couchage et la tente : ce sont les deux postes les plus lourds. Un bon sac de couchage léger peut vous faire économiser 500g à 1kg. Ensuite, regardez vos chaussures et votre sac à dos.', now() - interval '5 days 2 hours'),
    (amaq2, ama2, u8, 'Est-ce que l''ultra-light est compatible avec la sécurité en montagne ?', 18, true, 'Absolument, à condition de ne jamais sacrifier les équipements de sécurité : trousse de premiers secours, moyen de communication, couverture de survie. On allège sur le confort, jamais sur la sécurité.', now() - interval '5 days 1 hour'),
    (amaq3, ama2, u10, 'Quel est votre kit complet pour une semaine en Alpes ?', 31, true, 'Mon kit semaine Alpes : sac 45L (1,2 kg), tente ultralight (1 kg), sac de couchage (400g), matelas (350g), réchaud (73g), nourriture (3,5 kg), eau (1L), vêtements (1,5 kg). Total : environ 9 kg avec eau et nourriture.', now() - interval '5 days 30 min'),
    (amaq4, ama1, u9, 'Quelle est la différence de préparation physique entre un 3000m et un 4000m ?', 14, false, '', now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;

  -- ── OCCASION ITEMS ───────────────────────────────────────────────────────────
  INSERT INTO public.occasion_items (id, seller_id, title, description, price, original_price, condition, location, image, alt, negotiable, shipping, status, created_at) VALUES
    (oc1, u1, 'Osprey Atmos AG 65 — Excellent état', 'Utilisé 3 fois seulement. Aucune trace d''usure. Vendu car passage en ultra-light. Toutes les sangles et ceintures en parfait état.', 189.00, 329.00, 'comme_neuf', 'Chamonix (74)', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80', 'Sac à dos Osprey Atmos AG 65 orange en excellent état sur fond blanc', true, true, 'active', now() - interval '1 day'),
    (oc2, u2, 'Arc''teryx Beta AR Jacket — Taille M', 'Veste hardshell Gore-Tex Pro. Utilisée 2 saisons. Imperméabilité parfaite. Quelques traces d''usure légères sur les coudes.', 420.00, 749.00, 'tres_bon', 'Grenoble (38)', 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&q=80', 'Veste Arc''teryx Beta AR rouge imperméable en très bon état', false, false, 'active', now() - interval '3 days'),
    (oc3, u3, 'Big Agnes Copper Spur HV UL2 — Complète', 'Tente complète avec toutes les sardines et le sac de transport. Utilisée 8 nuits. Aucun trou ni déchirure.', 320.00, 549.00, 'tres_bon', 'Lyon (69)', 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', 'Tente Big Agnes Copper Spur UL2 montée dans un jardin en très bon état', true, true, 'active', now() - interval '5 days'),
    (oc4, u4, 'Salomon Speedcross 6 — Taille 43', 'Chaussures de trail peu utilisées (3 sorties). Semelle encore neuve. Vendu car mauvaise taille.', 75.00, 139.00, 'comme_neuf', 'Annecy (74)', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80', 'Chaussures de trail Salomon Speedcross 6 bleues en excellent état', true, true, 'active', now() - interval '2 days'),
    (oc5, u5, 'Garmin inReach Mini 2 + abonnement 3 mois', 'Communicateur satellite avec 3 mois d''abonnement Freedom inclus. Parfait état. Vendu car changement de destination.', 280.00, 399.00, 'excellent', 'Bordeaux (33)', 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&q=80', 'Communicateur satellite Garmin inReach Mini 2 orange avec boîte d''origine', false, true, 'active', now() - interval '4 days'),
    (oc6, u6, 'MSR PocketRocket 2 + casserole MSR', 'Réchaud + casserole 1,1L MSR. Utilisé une dizaine de fois. Parfait fonctionnement. Vendu car passage au réchaud à alcool.', 55.00, 89.00, 'tres_bon', 'Nantes (44)', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80', 'Réchaud MSR PocketRocket 2 avec casserole aluminium en très bon état', true, true, 'active', now() - interval '6 days')
  ON CONFLICT (id) DO NOTHING;

  -- ── AUCTION ITEMS ─────────────────────────────────────────────────────────────
  INSERT INTO public.auction_items (id, seller_id, title, description, start_price, current_bid, buy_now_price, condition, ends_at, bids_count, watchers_count, image, alt, status, created_at) VALUES
    (au1, u1, 'Sac Osprey Exos 58 — Ultra-light', 'Sac ultra-light 58L en excellent état. Idéal pour le trekking longue distance. Système de suspension AirSpeed.', 80.00, 145.00, 220.00, 'tres_bon', now() + interval '2 days 14 hours', 7, 23, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80', 'Sac à dos Osprey Exos 58 gris ultra-léger en très bon état', 'active', now() - interval '3 days'),
    (au2, u3, 'Tente MSR Hubba Hubba NX 2P', 'Tente 2 personnes légère. Utilisée 5 nuits. Toutes les pièces présentes. Imperméabilité vérifiée.', 150.00, 210.00, 350.00, 'bon', now() + interval '1 day 8 hours', 5, 18, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', 'Tente MSR Hubba Hubba NX 2 personnes orange montée sur herbe', 'active', now() - interval '4 days'),
    (au3, u4, 'Kit complet alpinisme débutant', 'Piolet, crampons 10 pointes, baudrier, casque. Matériel de qualité peu utilisé. Parfait pour débuter l''alpinisme.', 120.00, 185.00, 280.00, 'tres_bon', now() + interval '4 days 6 hours', 9, 31, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&q=80', 'Kit d''alpinisme complet avec piolet crampons et baudrier sur fond blanc', 'active', now() - interval '2 days')
  ON CONFLICT (id) DO NOTHING;

  -- ── RENTAL ITEMS ──────────────────────────────────────────────────────────────
  INSERT INTO public.rental_items (id, owner_id, title, description, price_per_day, price_per_week, deposit, condition, location, image, alt, available, available_from, available_to, rating, reviews_count, status, created_at) VALUES
    (re1, u2, 'Tente Big Agnes Copper Spur UL2', 'Location de ma tente ultra-légère pour vos aventures. Parfait état. Livraison possible sur Grenoble.', 15.00, 90.00, 100.00, 'excellent', 'Grenoble (38)', 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', 'Tente Big Agnes Copper Spur UL2 disponible à la location en excellent état', true, CURRENT_DATE + 7, CURRENT_DATE + 90, 4.9, 12, 'available', now() - interval '5 days'),
    (re2, u1, 'Kit randonnée complet 5 jours', 'Sac 65L + tente + sac de couchage + matelas. Tout le nécessaire pour une randonnée de 5 jours. Parfait pour tester avant d''acheter.', 35.00, 210.00, 200.00, 'excellent', 'Chamonix (74)', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80', 'Kit complet de randonnée 5 jours avec sac à dos tente et sac de couchage', true, CURRENT_DATE + 3, CURRENT_DATE + 60, 4.8, 8, 'available', now() - interval '7 days'),
    (re3, u3, 'Kayak de mer Prijon Seayak', 'Kayak de mer 1 place en polyéthylène. Stable et maniable. Parfait pour débuter. Pagaie et gilet inclus.', 45.00, 270.00, 300.00, 'tres_bon', 'Lyon (69)', 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&q=80', 'Kayak de mer Prijon Seayak jaune sur l''eau avec pagaie', true, CURRENT_DATE + 1, CURRENT_DATE + 120, 4.7, 5, 'available', now() - interval '10 days')
  ON CONFLICT (id) DO NOTHING;

  -- ── CLUBS ─────────────────────────────────────────────────────────────────────
  INSERT INTO public.clubs (id, slug, name, type, emoji, description, cover_color, category, privacy, members_count, active_this_month, is_verified, created_by, created_at) VALUES
    (cl1, 'randonneurs-alpes', 'Randonneurs des Alpes', 'activite', '🏔️', 'Club dédié aux randonneurs passionnés des Alpes françaises et suisses. Partagez vos itinéraires, conseils et photos !', 'from-blue-600 to-indigo-700', 'Randonnée', 'open', 847, 234, true, u1, now() - interval '200 days'),
    (cl2, 'ultra-light-france', 'Ultra-Light France', 'activite', '⚡', 'La communauté française du trekking ultra-léger. Techniques, équipements, retours d''expérience pour voyager plus léger.', 'from-emerald-600 to-teal-700', 'Ultra-light', 'open', 523, 189, true, u2, now() - interval '150 days'),
    (cl3, 'cyclotouristes-fr', 'Cyclotouristes de France', 'activite', '🚴', 'Pour tous les passionnés de voyage à vélo. Routes, équipements, récits d''aventures à deux roues.', 'from-orange-500 to-red-600', 'Vélo', 'open', 412, 156, false, u5, now() - interval '120 days'),
    (cl4, 'kayak-mer-bretagne', 'Kayak de Mer Bretagne', 'pays', '🌊', 'Club des kayakistes de mer bretons. Spots, conditions, sécurité et convivialité sur les côtes bretonnes.', 'from-cyan-600 to-blue-700', 'Kayak', 'open', 198, 87, false, u3, now() - interval '90 days'),
    (cl5, 'alpinistes-debutants', 'Alpinistes Débutants', 'activite', '⛰️', 'Un espace bienveillant pour les débutants en alpinisme. Posez vos questions sans jugement, progressez ensemble.', 'from-gray-600 to-slate-700', 'Alpinisme', 'open', 334, 112, false, u4, now() - interval '60 days')
  ON CONFLICT (slug) DO NOTHING;

  -- ── PRODUCT REVIEWS ───────────────────────────────────────────────────────────
  INSERT INTO public.product_reviews (product_id, author_id, rating, title, content, verified_purchase, helpful_count, created_at) VALUES
    (p1, u1, 5, 'Le meilleur sac que j''ai jamais porté', 'Après 500 km de randonnée avec l''Atmos AG 65, je peux confirmer que c''est le sac le plus confortable du marché. Le système Anti-Gravity est révolutionnaire. Aucune douleur au dos même avec 15 kg.', true, 34, now() - interval '30 days'),
    (p1, u4, 4, 'Excellent mais lourd pour l''ultra-light', 'Sac de très bonne qualité, confortable et bien organisé. Seul bémol : 2,1 kg c''est lourd pour qui veut faire de l''ultra-light. Parfait pour le randonneur classique.', true, 18, now() - interval '45 days'),
    (p2, u2, 5, 'La référence des tentes ultra-légères', 'Utilisée 40 nuits en conditions variées. Résistante au vent, imperméable, habitabilité excellente pour 2 personnes. Le rapport poids/performance est imbattable.', true, 42, now() - interval '60 days'),
    (p3, u1, 5, 'Investissement qui vaut chaque euro', 'Ma Beta AR m''a sauvé la mise lors d''une tempête en haute montagne. Imperméabilité parfaite après 3 saisons. Arc''teryx, c''est cher mais ça dure.', true, 29, now() - interval '90 days'),
    (p4, u7, 4, 'Parfaites pour débuter le trail', 'Mes premières chaussures de trail. Grip excellent sur tous les terrains. Un peu rigides au début mais elles se sont assouplies après 50 km.', true, 15, now() - interval '20 days'),
    (p10, u2, 5, 'Indispensable pour les zones reculées', 'Le Garmin inReach Mini 2 m''a donné une tranquillité d''esprit totale lors de mes expéditions en zones sans réseau. L''interface avec l''app est intuitive. SOS testé (accidentellement) : réponse en 4 minutes !', true, 51, now() - interval '15 days')
  ON CONFLICT DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data error: %', SQLERRM;
END $$;
