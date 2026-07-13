-- ============================================================
-- KIT DU VOYAGEUR — Gamification & Loyalty Tables + Fixes
-- Adds missing tables: challenges, badges, user_challenges,
-- user_badges, loyalty_rewards, loyalty_history, loyalty_redemptions
-- Adds missing columns: xp, level to user_profiles
-- ============================================================

-- ─── 1. ADD MISSING COLUMNS TO USER_PROFILES ─────────────────────────────────
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- ─── 2. CHALLENGES TABLE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  xp INTEGER DEFAULT 100,
  category TEXT DEFAULT 'Général',
  difficulty TEXT DEFAULT 'Facile',
  total INTEGER DEFAULT 1,
  deadline TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_challenges" ON public.challenges;
CREATE POLICY "public_read_challenges" ON public.challenges FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_challenges" ON public.challenges;
CREATE POLICY "auth_manage_challenges" ON public.challenges FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 3. USER_CHALLENGES TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_challenges_unique ON public.user_challenges(user_id, challenge_id);

ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_user_challenges" ON public.user_challenges;
CREATE POLICY "public_read_user_challenges" ON public.user_challenges FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "users_manage_own_user_challenges" ON public.user_challenges;
CREATE POLICY "users_manage_own_user_challenges" ON public.user_challenges FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── 4. BADGES TABLE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '🏅',
  rarity TEXT DEFAULT 'Commun',
  holders_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_badges" ON public.badges;
CREATE POLICY "public_read_badges" ON public.badges FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_badges" ON public.badges;
CREATE POLICY "auth_manage_badges" ON public.badges FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 5. USER_BADGES TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_badges_unique ON public.user_badges(user_id, badge_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_user_badges" ON public.user_badges;
CREATE POLICY "public_read_user_badges" ON public.user_badges FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "users_manage_own_user_badges" ON public.user_badges;
CREATE POLICY "users_manage_own_user_badges" ON public.user_badges FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── 6. LOYALTY_REWARDS TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  points_cost INTEGER DEFAULT 100,
  category TEXT DEFAULT 'Réduction',
  value TEXT DEFAULT '',
  available BOOLEAN DEFAULT true,
  image TEXT DEFAULT '',
  alt TEXT DEFAULT '',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_loyalty_rewards" ON public.loyalty_rewards;
CREATE POLICY "public_read_loyalty_rewards" ON public.loyalty_rewards FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_loyalty_rewards" ON public.loyalty_rewards;
CREATE POLICY "auth_manage_loyalty_rewards" ON public.loyalty_rewards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 7. LOYALTY_HISTORY TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  type TEXT DEFAULT 'earned',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.loyalty_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_loyalty_history" ON public.loyalty_history;
CREATE POLICY "users_read_own_loyalty_history" ON public.loyalty_history FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_manage_own_loyalty_history" ON public.loyalty_history;
CREATE POLICY "users_manage_own_loyalty_history" ON public.loyalty_history FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── 8. LOYALTY_REDEMPTIONS TABLE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reward_id UUID REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  points_spent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_redemptions" ON public.loyalty_redemptions;
CREATE POLICY "users_read_own_redemptions" ON public.loyalty_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_manage_own_redemptions" ON public.loyalty_redemptions;
CREATE POLICY "users_manage_own_redemptions" ON public.loyalty_redemptions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── 9. FIX RLS ON EXISTING TABLES (ensure public can read) ──────────────────

-- community_posts: ensure public read
DROP POLICY IF EXISTS "public_read_community_posts" ON public.community_posts;
CREATE POLICY "public_read_community_posts" ON public.community_posts FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_insert_community_posts" ON public.community_posts;
CREATE POLICY "auth_insert_community_posts" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "auth_update_own_community_posts" ON public.community_posts;
CREATE POLICY "auth_update_own_community_posts" ON public.community_posts FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "auth_delete_own_community_posts" ON public.community_posts;
CREATE POLICY "auth_delete_own_community_posts" ON public.community_posts FOR DELETE TO authenticated USING (author_id = auth.uid());

-- post_comments: ensure public read
DROP POLICY IF EXISTS "public_read_post_comments" ON public.post_comments;
CREATE POLICY "public_read_post_comments" ON public.post_comments FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_own_post_comments" ON public.post_comments;
CREATE POLICY "auth_manage_own_post_comments" ON public.post_comments FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- post_likes: ensure public read
DROP POLICY IF EXISTS "public_read_post_likes" ON public.post_likes;
CREATE POLICY "public_read_post_likes" ON public.post_likes FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_own_post_likes" ON public.post_likes;
CREATE POLICY "auth_manage_own_post_likes" ON public.post_likes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- products: ensure public read
DROP POLICY IF EXISTS "public_read_products" ON public.products;
CREATE POLICY "public_read_products" ON public.products FOR SELECT TO public USING (true);

-- kits: ensure public read
DROP POLICY IF EXISTS "public_read_kits" ON public.kits;
CREATE POLICY "public_read_kits" ON public.kits FOR SELECT TO public USING (true);

-- kit_items: ensure public read
DROP POLICY IF EXISTS "public_read_kit_items" ON public.kit_items;
CREATE POLICY "public_read_kit_items" ON public.kit_items FOR SELECT TO public USING (true);

-- occasion_items: ensure public read
DROP POLICY IF EXISTS "public_read_occasion_items" ON public.occasion_items;
CREATE POLICY "public_read_occasion_items" ON public.occasion_items FOR SELECT TO public USING (true);

-- auction_items: ensure public read
DROP POLICY IF EXISTS "public_read_auction_items" ON public.auction_items;
CREATE POLICY "public_read_auction_items" ON public.auction_items FOR SELECT TO public USING (true);

-- rental_items: ensure public read
DROP POLICY IF EXISTS "public_read_rental_items" ON public.rental_items;
CREATE POLICY "public_read_rental_items" ON public.rental_items FOR SELECT TO public USING (true);

-- qa_questions: ensure public read
DROP POLICY IF EXISTS "public_read_qa_questions" ON public.qa_questions;
CREATE POLICY "public_read_qa_questions" ON public.qa_questions FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_own_qa_questions" ON public.qa_questions;
CREATE POLICY "auth_manage_own_qa_questions" ON public.qa_questions FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- qa_answers: ensure public read
DROP POLICY IF EXISTS "public_read_qa_answers" ON public.qa_answers;
CREATE POLICY "public_read_qa_answers" ON public.qa_answers FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_own_qa_answers" ON public.qa_answers;
CREATE POLICY "auth_manage_own_qa_answers" ON public.qa_answers FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- ama_sessions: ensure public read
DROP POLICY IF EXISTS "public_read_ama_sessions" ON public.ama_sessions;
CREATE POLICY "public_read_ama_sessions" ON public.ama_sessions FOR SELECT TO public USING (true);

-- ama_questions: ensure public read
DROP POLICY IF EXISTS "public_read_ama_questions" ON public.ama_questions;
CREATE POLICY "public_read_ama_questions" ON public.ama_questions FOR SELECT TO public USING (true);

-- clubs: ensure public read
DROP POLICY IF EXISTS "public_read_clubs" ON public.clubs;
CREATE POLICY "public_read_clubs" ON public.clubs FOR SELECT TO public USING (true);

-- user_profiles: ensure public read
DROP POLICY IF EXISTS "public_read_profiles" ON public.user_profiles;
CREATE POLICY "public_read_profiles" ON public.user_profiles FOR SELECT TO public USING (true);

-- product_reviews: ensure public read
DROP POLICY IF EXISTS "public_read_product_reviews" ON public.product_reviews;
CREATE POLICY "public_read_product_reviews" ON public.product_reviews FOR SELECT TO public USING (true);

-- user_follows: ensure public read
DROP POLICY IF EXISTS "public_read_user_follows" ON public.user_follows;
CREATE POLICY "public_read_user_follows" ON public.user_follows FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_own_user_follows" ON public.user_follows;
CREATE POLICY "auth_manage_own_user_follows" ON public.user_follows FOR ALL TO authenticated USING (follower_id = auth.uid()) WITH CHECK (follower_id = auth.uid());

-- ─── 10. SEED CHALLENGES ─────────────────────────────────────────────────────
DO $$
BEGIN
  INSERT INTO public.challenges (id, title, description, xp, category, difficulty, total, deadline, active) VALUES
    (gen_random_uuid(), 'Premier pas', 'Publiez votre premier post dans la communauté', 100, 'Communauté', 'Facile', 1, '2026-12-31', true),
    (gen_random_uuid(), 'Explorateur actif', 'Consultez 10 fiches destinations différentes', 200, 'Exploration', 'Facile', 10, '2026-12-31', true),
    (gen_random_uuid(), 'Critique équipement', 'Rédigez 3 avis produits détaillés', 350, 'Boutique', 'Moyen', 3, '2026-12-31', true),
    (gen_random_uuid(), 'Mentor de la communauté', 'Répondez à 5 questions dans le Q&A', 500, 'Communauté', 'Moyen', 5, '2026-12-31', true),
    (gen_random_uuid(), 'Kit parfait', 'Configurez et sauvegardez un kit complet', 300, 'Équipement', 'Moyen', 1, '2026-12-31', true),
    (gen_random_uuid(), 'Carnet d''expédition', 'Publiez votre premier carnet de voyage', 400, 'Communauté', 'Moyen', 1, '2026-12-31', true),
    (gen_random_uuid(), 'Grand voyageur', 'Ajoutez 5 pays à votre liste de destinations', 600, 'Exploration', 'Difficile', 5, '2026-12-31', true),
    (gen_random_uuid(), 'Légende vivante', 'Atteignez le niveau Ambassadeur', 2000, 'Fidélité', 'Légendaire', 1, '2026-12-31', true),
    (gen_random_uuid(), 'Réseau social', 'Suivez 10 aventuriers de la communauté', 250, 'Communauté', 'Facile', 10, '2026-12-31', true),
    (gen_random_uuid(), 'Chasseur de bonnes affaires', 'Achetez 3 articles d''occasion', 450, 'Boutique', 'Difficile', 3, '2026-12-31', true)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ─── 11. SEED BADGES ─────────────────────────────────────────────────────────
DO $$
BEGIN
  INSERT INTO public.badges (id, name, description, icon, rarity, holders_count) VALUES
    (gen_random_uuid(), 'Premier Pas', 'A publié son premier post', '🌱', 'Commun', 1247),
    (gen_random_uuid(), 'Explorateur', 'A visité 5 destinations', '🗺️', 'Commun', 892),
    (gen_random_uuid(), 'Critique Expert', 'A rédigé 10 avis produits', '⭐', 'Rare', 234),
    (gen_random_uuid(), 'Mentor', 'A répondu à 20 questions', '🎓', 'Rare', 156),
    (gen_random_uuid(), 'Kit Master', 'A configuré 5 kits complets', '🎒', 'Épique', 89),
    (gen_random_uuid(), 'Légende du Voyage', 'A atteint le niveau maximum', '🌍', 'Légendaire', 12),
    (gen_random_uuid(), 'Photographe Aventurier', 'A partagé 20 photos de voyage', '📸', 'Rare', 178),
    (gen_random_uuid(), 'Ambassadeur', 'A parrainé 5 nouveaux membres', '🏅', 'Épique', 67),
    (gen_random_uuid(), 'Chasseur d''Enchères', 'A remporté 3 enchères', '⚡', 'Rare', 203),
    (gen_random_uuid(), 'Ultra-léger', 'A configuré un kit sous 5kg', '🪶', 'Épique', 45),
    (gen_random_uuid(), 'Solidaire', 'A aidé 10 membres en difficulté', '🤝', 'Rare', 312),
    (gen_random_uuid(), 'Pionnier', 'Membre depuis les débuts', '🔭', 'Légendaire', 28)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ─── 12. SEED LOYALTY REWARDS ────────────────────────────────────────────────
DO $$
BEGIN
  INSERT INTO public.loyalty_rewards (id, title, description, points_cost, category, value, available, image, alt) VALUES
    (gen_random_uuid(), 'Réduction 10€', 'Valable sur tout le catalogue boutique', 500, 'Réduction', '-10€', true, 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400', 'Bon de réduction boutique outdoor'),
    (gen_random_uuid(), 'Livraison gratuite', 'Livraison offerte sur votre prochaine commande', 300, 'Livraison', 'Gratuit', true, 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400', 'Livraison gratuite colis'),
    (gen_random_uuid(), 'Réduction 25€', 'Sur les kits complets uniquement', 1200, 'Réduction', '-25€', true, 'https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=400', 'Kit de randonnée complet'),
    (gen_random_uuid(), 'Accès VIP 1 mois', 'Fonctionnalités premium pendant 30 jours', 800, 'Premium', '1 mois VIP', true, 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400', 'Aventurier en montagne vue panoramique'),
    (gen_random_uuid(), 'Consultation équipement', 'Session 30min avec un expert équipement', 1500, 'Service', '30 min', true, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400', 'Expert équipement outdoor conseil'),
    (gen_random_uuid(), 'Réduction 50€', 'Sur votre prochain achat de 200€ minimum', 2500, 'Réduction', '-50€', true, 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400', 'Paysage montagne randonnée'),
    (gen_random_uuid(), 'Badge exclusif', 'Badge Légende du Voyage sur votre profil', 3000, 'Badge', 'Badge rare', true, 'https://images.unsplash.com/photo-1527004013197-933b977e7b5e?w=400', 'Trophée récompense dorée'),
    (gen_random_uuid(), 'Kit découverte offert', 'Kit débutant randonnée journée complet', 5000, 'Produit', '89€', true, 'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=400', 'Kit randonnée débutant sac dos')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ─── 13. UPDATE USER_PROFILES XP/LEVEL ───────────────────────────────────────
DO $$
BEGIN
  UPDATE public.user_profiles SET xp = 4200, level = 1 WHERE xp = 0 OR xp IS NULL;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not update xp: %', SQLERRM;
END $$;
