-- ============================================================
-- Migration: Auth trigger + RLS cleanup + sync fix
-- Timestamp: 20260713210000
-- ============================================================

-- ─── 1. Trigger: auto-create user_profiles on signup ─────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    trust_score,
    loyalty_points,
    loyalty_level,
    bio,
    location,
    xp,
    level
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    50,
    0,
    'Explorateur',
    '',
    '',
    0,
    1
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN public.user_profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.user_profiles.full_name END,
    updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─── 2. Fix unique constraint on post_likes ───────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_likes_unique ON public.post_likes (post_id, user_id);

-- ─── 3. Fix unique constraint on user_follows ────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_follows_unique ON public.user_follows (follower_id, following_id);

-- ─── 4. RLS: user_profiles ───────────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_user_profiles" ON public.user_profiles;
CREATE POLICY "public_read_user_profiles"
  ON public.user_profiles FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;
CREATE POLICY "users_insert_own_profile"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ─── 5. RLS: community_posts ─────────────────────────────────────────────────
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_community_posts" ON public.community_posts;
CREATE POLICY "public_read_community_posts"
  ON public.community_posts FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "auth_insert_community_posts" ON public.community_posts;
CREATE POLICY "auth_insert_community_posts"
  ON public.community_posts FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "auth_update_own_community_posts" ON public.community_posts;
CREATE POLICY "auth_update_own_community_posts"
  ON public.community_posts FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "auth_delete_own_community_posts" ON public.community_posts;
CREATE POLICY "auth_delete_own_community_posts"
  ON public.community_posts FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- ─── 6. RLS: post_likes ──────────────────────────────────────────────────────
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_post_likes" ON public.post_likes;
CREATE POLICY "public_read_post_likes"
  ON public.post_likes FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "auth_manage_own_post_likes" ON public.post_likes;
CREATE POLICY "auth_manage_own_post_likes"
  ON public.post_likes FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 7. RLS: post_comments ───────────────────────────────────────────────────
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_post_comments" ON public.post_comments;
CREATE POLICY "public_read_post_comments"
  ON public.post_comments FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "auth_insert_post_comments" ON public.post_comments;
CREATE POLICY "auth_insert_post_comments"
  ON public.post_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "auth_delete_own_post_comments" ON public.post_comments;
CREATE POLICY "auth_delete_own_post_comments"
  ON public.post_comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- ─── 8. RLS: products ────────────────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_products" ON public.products;
CREATE POLICY "public_read_products"
  ON public.products FOR SELECT
  TO public
  USING (true);

-- ─── 9. RLS: kits ────────────────────────────────────────────────────────────
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_kits" ON public.kits;
CREATE POLICY "public_read_kits"
  ON public.kits FOR SELECT
  TO public
  USING (true);

-- ─── 10. RLS: kit_items ──────────────────────────────────────────────────────
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_kit_items" ON public.kit_items;
CREATE POLICY "public_read_kit_items"
  ON public.kit_items FOR SELECT
  TO public
  USING (true);

-- ─── 11. RLS: occasion_items ─────────────────────────────────────────────────
ALTER TABLE public.occasion_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_occasion_items" ON public.occasion_items;
CREATE POLICY "public_read_occasion_items"
  ON public.occasion_items FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "auth_manage_own_occasion_items" ON public.occasion_items;
CREATE POLICY "auth_manage_own_occasion_items"
  ON public.occasion_items FOR ALL
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- ─── 12. RLS: auction_items ──────────────────────────────────────────────────
ALTER TABLE public.auction_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_auction_items" ON public.auction_items;
CREATE POLICY "public_read_auction_items"
  ON public.auction_items FOR SELECT
  TO public
  USING (true);

-- ─── 13. RLS: rental_items ───────────────────────────────────────────────────
ALTER TABLE public.rental_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_rental_items" ON public.rental_items;
CREATE POLICY "public_read_rental_items"
  ON public.rental_items FOR SELECT
  TO public
  USING (true);

-- ─── 14. RLS: qa_questions ───────────────────────────────────────────────────
ALTER TABLE public.qa_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_qa_questions" ON public.qa_questions;
CREATE POLICY "public_read_qa_questions"
  ON public.qa_questions FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "auth_insert_qa_questions" ON public.qa_questions;
CREATE POLICY "auth_insert_qa_questions"
  ON public.qa_questions FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "auth_update_own_qa_questions" ON public.qa_questions;
CREATE POLICY "auth_update_own_qa_questions"
  ON public.qa_questions FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- ─── 15. RLS: qa_answers ─────────────────────────────────────────────────────
ALTER TABLE public.qa_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_qa_answers" ON public.qa_answers;
CREATE POLICY "public_read_qa_answers"
  ON public.qa_answers FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "auth_insert_qa_answers" ON public.qa_answers;
CREATE POLICY "auth_insert_qa_answers"
  ON public.qa_answers FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

-- ─── 16. RLS: ama_sessions ───────────────────────────────────────────────────
ALTER TABLE public.ama_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_ama_sessions" ON public.ama_sessions;
CREATE POLICY "public_read_ama_sessions"
  ON public.ama_sessions FOR SELECT
  TO public
  USING (true);

-- ─── 17. RLS: ama_questions ──────────────────────────────────────────────────
ALTER TABLE public.ama_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_ama_questions" ON public.ama_questions;
CREATE POLICY "public_read_ama_questions"
  ON public.ama_questions FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "auth_insert_ama_questions" ON public.ama_questions;
CREATE POLICY "auth_insert_ama_questions"
  ON public.ama_questions FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

-- ─── 18. RLS: user_follows ───────────────────────────────────────────────────
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_user_follows" ON public.user_follows;
CREATE POLICY "public_read_user_follows"
  ON public.user_follows FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "auth_manage_own_follows" ON public.user_follows;
CREATE POLICY "auth_manage_own_follows"
  ON public.user_follows FOR ALL
  TO authenticated
  USING (follower_id = auth.uid())
  WITH CHECK (follower_id = auth.uid());

-- ─── 19. RLS: clubs ──────────────────────────────────────────────────────────
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_clubs" ON public.clubs;
CREATE POLICY "public_read_clubs"
  ON public.clubs FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "auth_insert_clubs" ON public.clubs;
CREATE POLICY "auth_insert_clubs"
  ON public.clubs FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- ─── 20. RLS: carnets ────────────────────────────────────────────────────────
ALTER TABLE public.carnets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_carnets" ON public.carnets;
CREATE POLICY "public_read_carnets"
  ON public.carnets FOR SELECT
  TO public
  USING (visibility = 'public' OR author_id = auth.uid());

DROP POLICY IF EXISTS "auth_manage_own_carnets" ON public.carnets;
CREATE POLICY "auth_manage_own_carnets"
  ON public.carnets FOR ALL
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- ─── 21. RLS: product_reviews ────────────────────────────────────────────────
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_product_reviews" ON public.product_reviews;
CREATE POLICY "public_read_product_reviews"
  ON public.product_reviews FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "auth_insert_product_reviews" ON public.product_reviews;
CREATE POLICY "auth_insert_product_reviews"
  ON public.product_reviews FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

-- ─── 22. RLS: challenges ─────────────────────────────────────────────────────
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_challenges" ON public.challenges;
CREATE POLICY "public_read_challenges"
  ON public.challenges FOR SELECT
  TO public
  USING (true);

-- ─── 23. RLS: user_challenges ────────────────────────────────────────────────
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_user_challenges" ON public.user_challenges;
CREATE POLICY "public_read_user_challenges"
  ON public.user_challenges FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "auth_manage_own_user_challenges" ON public.user_challenges;
CREATE POLICY "auth_manage_own_user_challenges"
  ON public.user_challenges FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 24. RLS: badges ─────────────────────────────────────────────────────────
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_badges" ON public.badges;
CREATE POLICY "public_read_badges"
  ON public.badges FOR SELECT
  TO public
  USING (true);

-- ─── 25. RLS: user_badges ────────────────────────────────────────────────────
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_user_badges" ON public.user_badges;
CREATE POLICY "public_read_user_badges"
  ON public.user_badges FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "auth_manage_own_user_badges" ON public.user_badges;
CREATE POLICY "auth_manage_own_user_badges"
  ON public.user_badges FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 26. RLS: loyalty_rewards ────────────────────────────────────────────────
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_loyalty_rewards" ON public.loyalty_rewards;
CREATE POLICY "public_read_loyalty_rewards"
  ON public.loyalty_rewards FOR SELECT
  TO public
  USING (true);

-- ─── 27. RLS: loyalty_history ────────────────────────────────────────────────
ALTER TABLE public.loyalty_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_own_loyalty_history" ON public.loyalty_history;
CREATE POLICY "auth_read_own_loyalty_history"
  ON public.loyalty_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "auth_insert_loyalty_history" ON public.loyalty_history;
CREATE POLICY "auth_insert_loyalty_history"
  ON public.loyalty_history FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ─── 28. RLS: loyalty_redemptions ────────────────────────────────────────────
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_own_loyalty_redemptions" ON public.loyalty_redemptions;
CREATE POLICY "auth_read_own_loyalty_redemptions"
  ON public.loyalty_redemptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "auth_insert_loyalty_redemptions" ON public.loyalty_redemptions;
CREATE POLICY "auth_insert_loyalty_redemptions"
  ON public.loyalty_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ─── 29. Add title column to community_posts if missing ──────────────────────
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';

-- ─── 30. Indexes for performance ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_community_posts_author_id ON public.community_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON public.community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_post_type ON public.community_posts (post_type);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles (email);
