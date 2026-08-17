-- ============================================================
-- Community Features Migration
-- Carnets d'expédition, Clubs (full), Communauté feed, Q&A, AMAs
-- ============================================================

-- ─── 1. CARNETS D'EXPÉDITION ─────────────────────────────────────────────────

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
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','private','friends')),
  tags TEXT[] DEFAULT '{}',
  map_points JSONB DEFAULT '[]',
  is_collaborative BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  favorites_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.carnet_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet_id UUID REFERENCES public.carnets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reaction TEXT DEFAULT 'useful' CHECK (reaction IN ('useful','security','bag','fire','heart')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_carnet_likes_unique ON public.carnet_likes(carnet_id, user_id);

CREATE TABLE IF NOT EXISTS public.carnet_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet_id UUID REFERENCES public.carnets(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.carnet_comments(id) ON DELETE CASCADE,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.carnet_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet_id UUID REFERENCES public.carnets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_carnet_favorites_unique ON public.carnet_favorites(carnet_id, user_id);

CREATE TABLE IF NOT EXISTS public.carnet_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet_id UUID REFERENCES public.carnets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'contributor' CHECK (role IN ('owner','contributor','viewer')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_carnet_collab_unique ON public.carnet_collaborators(carnet_id, user_id);

CREATE TABLE IF NOT EXISTS public.carnet_gear_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet_id UUID REFERENCES public.carnets(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── 2. CLUBS ENHANCEMENTS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'activité' CHECK (type IN ('activité','pays')),
  emoji TEXT DEFAULT '🏕️',
  description TEXT DEFAULT '',
  cover_color TEXT DEFAULT 'from-emerald-600 to-teal-700',
  cover_image TEXT DEFAULT '',
  category TEXT DEFAULT '',
  rules TEXT DEFAULT '',
  privacy TEXT DEFAULT 'open' CHECK (privacy IN ('open','closed','secret')),
  members_count INTEGER DEFAULT 0,
  active_this_month INTEGER DEFAULT 0,
  min_trust_to_create INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin','moderator','member')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','banned','pending')),
  joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_members_unique ON public.club_members(club_id, user_id);

CREATE TABLE IF NOT EXISTS public.club_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.club_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  is_pinned BOOLEAN DEFAULT false,
  is_announcement BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT true,
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  reports_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.club_topic_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.club_topics(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT true,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.club_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  target_type TEXT DEFAULT 'topic' CHECK (target_type IN ('topic','reply','member')),
  target_id UUID,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.club_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  xp INTEGER DEFAULT 100,
  deadline TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.club_challenge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES public.club_challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  proof_text TEXT DEFAULT '',
  proof_image TEXT DEFAULT '',
  score INTEGER DEFAULT 0,
  validated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.club_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  organizer_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  event_date TIMESTAMPTZ,
  location TEXT DEFAULT '',
  max_participants INTEGER DEFAULT 0,
  participants_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.club_recommended_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  kit_id UUID REFERENCES public.kits(id) ON DELETE CASCADE,
  recommended_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── 3. COMMUNITY FEED ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT DEFAULT '',
  image_alt TEXT DEFAULT '',
  post_type TEXT DEFAULT 'post' CHECK (post_type IN ('post','tip','question','share')),
  linked_carnet_id UUID REFERENCES public.carnets(id) ON DELETE SET NULL,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  is_trending BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_likes_unique ON public.post_likes(post_id, user_id);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_follows_unique ON public.user_follows(follower_id, following_id);

-- ─── 4. Q&R / CONSEILS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.qa_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  category TEXT DEFAULT 'général',
  votes_count INTEGER DEFAULT 0,
  answers_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  is_solved BOOLEAN DEFAULT false,
  accepted_answer_id UUID,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.qa_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.qa_questions(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  votes_count INTEGER DEFAULT 0,
  is_accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.qa_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  target_type TEXT CHECK (target_type IN ('question','answer')),
  target_id UUID,
  vote INTEGER DEFAULT 1 CHECK (vote IN (1,-1)),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_votes_unique ON public.qa_votes(user_id, target_type, target_id);

-- ─── 5. AMA SESSIONS ─────────────────────────────────────────────────────────

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

CREATE TABLE IF NOT EXISTS public.ama_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ama_sessions(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  votes_count INTEGER DEFAULT 0,
  is_answered BOOLEAN DEFAULT false,
  answer TEXT DEFAULT '',
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.ama_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.ama_questions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ama_votes_unique ON public.ama_votes(question_id, user_id);

-- ─── 6. INDEXES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_carnets_author ON public.carnets(author_id);
CREATE INDEX IF NOT EXISTS idx_carnets_visibility ON public.carnets(visibility);
CREATE INDEX IF NOT EXISTS idx_carnets_created ON public.carnets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_carnet_comments_carnet ON public.carnet_comments(carnet_id);
CREATE INDEX IF NOT EXISTS idx_club_members_club ON public.club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user ON public.club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_topics_club ON public.club_topics(club_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON public.community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_questions_created ON public.qa_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);

-- ─── 7. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.carnets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carnet_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carnet_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carnet_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carnet_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carnet_gear_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_topic_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_challenge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_recommended_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ama_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ama_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ama_votes ENABLE ROW LEVEL SECURITY;

-- Carnets: public read for public carnets, owner manages
DROP POLICY IF EXISTS "carnets_public_read" ON public.carnets;
CREATE POLICY "carnets_public_read" ON public.carnets FOR SELECT TO public USING (visibility = 'public');

DROP POLICY IF EXISTS "carnets_auth_read" ON public.carnets;
CREATE POLICY "carnets_auth_read" ON public.carnets FOR SELECT TO authenticated USING (visibility = 'public' OR author_id = auth.uid());

DROP POLICY IF EXISTS "carnets_owner_manage" ON public.carnets;
CREATE POLICY "carnets_owner_manage" ON public.carnets FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- Carnet likes
DROP POLICY IF EXISTS "carnet_likes_read" ON public.carnet_likes;
CREATE POLICY "carnet_likes_read" ON public.carnet_likes FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "carnet_likes_manage" ON public.carnet_likes;
CREATE POLICY "carnet_likes_manage" ON public.carnet_likes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Carnet comments
DROP POLICY IF EXISTS "carnet_comments_read" ON public.carnet_comments;
CREATE POLICY "carnet_comments_read" ON public.carnet_comments FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "carnet_comments_manage" ON public.carnet_comments;
CREATE POLICY "carnet_comments_manage" ON public.carnet_comments FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- Carnet favorites
DROP POLICY IF EXISTS "carnet_favorites_manage" ON public.carnet_favorites;
CREATE POLICY "carnet_favorites_manage" ON public.carnet_favorites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Carnet collaborators
DROP POLICY IF EXISTS "carnet_collab_read" ON public.carnet_collaborators;
CREATE POLICY "carnet_collab_read" ON public.carnet_collaborators FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "carnet_collab_manage" ON public.carnet_collaborators;
CREATE POLICY "carnet_collab_manage" ON public.carnet_collaborators FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Carnet gear links
DROP POLICY IF EXISTS "carnet_gear_read" ON public.carnet_gear_links;
CREATE POLICY "carnet_gear_read" ON public.carnet_gear_links FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "carnet_gear_manage" ON public.carnet_gear_links;
CREATE POLICY "carnet_gear_manage" ON public.carnet_gear_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Clubs: public read
DROP POLICY IF EXISTS "clubs_public_read" ON public.clubs;
CREATE POLICY "clubs_public_read" ON public.clubs FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "clubs_auth_manage" ON public.clubs;
CREATE POLICY "clubs_auth_manage" ON public.clubs FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "clubs_auth_insert" ON public.clubs;
CREATE POLICY "clubs_auth_insert" ON public.clubs FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- Club members
DROP POLICY IF EXISTS "club_members_read" ON public.club_members;
CREATE POLICY "club_members_read" ON public.club_members FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "club_members_manage" ON public.club_members;
CREATE POLICY "club_members_manage" ON public.club_members FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Club join requests
DROP POLICY IF EXISTS "club_join_requests_manage" ON public.club_join_requests;
CREATE POLICY "club_join_requests_manage" ON public.club_join_requests FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "club_join_requests_read" ON public.club_join_requests;
CREATE POLICY "club_join_requests_read" ON public.club_join_requests FOR SELECT TO authenticated USING (true);

-- Club topics
DROP POLICY IF EXISTS "club_topics_read" ON public.club_topics;
CREATE POLICY "club_topics_read" ON public.club_topics FOR SELECT TO public USING (is_approved = true);
DROP POLICY IF EXISTS "club_topics_manage" ON public.club_topics;
CREATE POLICY "club_topics_manage" ON public.club_topics FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "club_topics_insert" ON public.club_topics;
CREATE POLICY "club_topics_insert" ON public.club_topics FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

-- Club topic replies
DROP POLICY IF EXISTS "club_replies_read" ON public.club_topic_replies;
CREATE POLICY "club_replies_read" ON public.club_topic_replies FOR SELECT TO public USING (is_approved = true);
DROP POLICY IF EXISTS "club_replies_manage" ON public.club_topic_replies;
CREATE POLICY "club_replies_manage" ON public.club_topic_replies FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- Club reports
DROP POLICY IF EXISTS "club_reports_manage" ON public.club_reports;
CREATE POLICY "club_reports_manage" ON public.club_reports FOR ALL TO authenticated USING (reporter_id = auth.uid()) WITH CHECK (reporter_id = auth.uid());

-- Club challenges
DROP POLICY IF EXISTS "club_challenges_read" ON public.club_challenges;
CREATE POLICY "club_challenges_read" ON public.club_challenges FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "club_challenges_manage" ON public.club_challenges;
CREATE POLICY "club_challenges_manage" ON public.club_challenges FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Club challenge entries
DROP POLICY IF EXISTS "club_challenge_entries_read" ON public.club_challenge_entries;
CREATE POLICY "club_challenge_entries_read" ON public.club_challenge_entries FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "club_challenge_entries_manage" ON public.club_challenge_entries;
CREATE POLICY "club_challenge_entries_manage" ON public.club_challenge_entries FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Club events
DROP POLICY IF EXISTS "club_events_read" ON public.club_events;
CREATE POLICY "club_events_read" ON public.club_events FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "club_events_manage" ON public.club_events;
CREATE POLICY "club_events_manage" ON public.club_events FOR ALL TO authenticated USING (organizer_id = auth.uid()) WITH CHECK (organizer_id = auth.uid());

-- Club recommended kits
DROP POLICY IF EXISTS "club_kits_read" ON public.club_recommended_kits;
CREATE POLICY "club_kits_read" ON public.club_recommended_kits FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "club_kits_manage" ON public.club_recommended_kits;
CREATE POLICY "club_kits_manage" ON public.club_recommended_kits FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Community posts
DROP POLICY IF EXISTS "community_posts_read" ON public.community_posts;
CREATE POLICY "community_posts_read" ON public.community_posts FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "community_posts_manage" ON public.community_posts;
CREATE POLICY "community_posts_manage" ON public.community_posts FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "community_posts_insert" ON public.community_posts;
CREATE POLICY "community_posts_insert" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

-- Post likes
DROP POLICY IF EXISTS "post_likes_read" ON public.post_likes;
CREATE POLICY "post_likes_read" ON public.post_likes FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "post_likes_manage" ON public.post_likes;
CREATE POLICY "post_likes_manage" ON public.post_likes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Post comments
DROP POLICY IF EXISTS "post_comments_read" ON public.post_comments;
CREATE POLICY "post_comments_read" ON public.post_comments FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "post_comments_manage" ON public.post_comments;
CREATE POLICY "post_comments_manage" ON public.post_comments FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- User follows
DROP POLICY IF EXISTS "user_follows_read" ON public.user_follows;
CREATE POLICY "user_follows_read" ON public.user_follows FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "user_follows_manage" ON public.user_follows;
CREATE POLICY "user_follows_manage" ON public.user_follows FOR ALL TO authenticated USING (follower_id = auth.uid()) WITH CHECK (follower_id = auth.uid());

-- Q&A
DROP POLICY IF EXISTS "qa_questions_read" ON public.qa_questions;
CREATE POLICY "qa_questions_read" ON public.qa_questions FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "qa_questions_manage" ON public.qa_questions;
CREATE POLICY "qa_questions_manage" ON public.qa_questions FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "qa_questions_insert" ON public.qa_questions;
CREATE POLICY "qa_questions_insert" ON public.qa_questions FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "qa_answers_read" ON public.qa_answers;
CREATE POLICY "qa_answers_read" ON public.qa_answers FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "qa_answers_manage" ON public.qa_answers;
CREATE POLICY "qa_answers_manage" ON public.qa_answers FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "qa_answers_insert" ON public.qa_answers;
CREATE POLICY "qa_answers_insert" ON public.qa_answers FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "qa_votes_manage" ON public.qa_votes;
CREATE POLICY "qa_votes_manage" ON public.qa_votes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AMA
DROP POLICY IF EXISTS "ama_sessions_read" ON public.ama_sessions;
CREATE POLICY "ama_sessions_read" ON public.ama_sessions FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ama_sessions_manage" ON public.ama_sessions;
CREATE POLICY "ama_sessions_manage" ON public.ama_sessions FOR ALL TO authenticated USING (expert_id = auth.uid()) WITH CHECK (expert_id = auth.uid());

DROP POLICY IF EXISTS "ama_questions_read" ON public.ama_questions;
CREATE POLICY "ama_questions_read" ON public.ama_questions FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ama_questions_manage" ON public.ama_questions;
CREATE POLICY "ama_questions_manage" ON public.ama_questions FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "ama_questions_insert" ON public.ama_questions;
CREATE POLICY "ama_questions_insert" ON public.ama_questions FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "ama_votes_manage" ON public.ama_votes;
CREATE POLICY "ama_votes_manage" ON public.ama_votes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── 8. SEED DATA ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  user1_id UUID;
  user2_id UUID;
  user3_id UUID;
  club1_id UUID := gen_random_uuid();
  club2_id UUID := gen_random_uuid();
  club3_id UUID := gen_random_uuid();
  club4_id UUID := gen_random_uuid();
  club5_id UUID := gen_random_uuid();
  club6_id UUID := gen_random_uuid();
  carnet1_id UUID := gen_random_uuid();
  carnet2_id UUID := gen_random_uuid();
  carnet3_id UUID := gen_random_uuid();
  post1_id UUID := gen_random_uuid();
  post2_id UUID := gen_random_uuid();
  post3_id UUID := gen_random_uuid();
  qa1_id UUID := gen_random_uuid();
  qa2_id UUID := gen_random_uuid();
  ama1_id UUID := gen_random_uuid();
  topic1_id UUID := gen_random_uuid();
  topic2_id UUID := gen_random_uuid();
  topic3_id UUID := gen_random_uuid();
BEGIN
  -- Get existing users
  SELECT id INTO user1_id FROM public.user_profiles ORDER BY created_at LIMIT 1;
  SELECT id INTO user2_id FROM public.user_profiles ORDER BY created_at OFFSET 1 LIMIT 1;
  SELECT id INTO user3_id FROM public.user_profiles ORDER BY created_at OFFSET 2 LIMIT 1;

  IF user1_id IS NULL THEN
    RAISE NOTICE 'No users found, skipping seed data';
    RETURN;
  END IF;

  IF user2_id IS NULL THEN user2_id := user1_id; END IF;
  IF user3_id IS NULL THEN user3_id := user1_id; END IF;

  -- Clubs
  INSERT INTO public.clubs (id, slug, name, type, emoji, description, cover_color, category, rules, privacy, members_count, active_this_month, is_verified, created_by)
  VALUES
    (club1_id, 'club-randonnee', 'Club Randonnée', 'activité', '🥾', 'La communauté des randonneurs passionnés. Partagez vos itinéraires, conseils et expériences sur les sentiers du monde entier.', 'from-emerald-600 to-teal-700', 'Randonnée', 'Respectez les autres membres. Partagez des informations vérifiées. Pas de spam.', 'open', 2847, 312, true, user1_id),
    (club2_id, 'club-vanlife', 'Club Vanlife', 'activité', '🚐', 'Voyageurs en van, fourgons aménagés et road-trippers. Spots, conseils mécaniques et vie nomade.', 'from-amber-600 to-orange-700', 'Vanlife', 'Partagez vos spots avec respect. Laissez les lieux propres.', 'open', 1923, 241, false, user1_id),
    (club3_id, 'club-bushcraft', 'Club Bushcraft', 'activité', '🪓', 'Survie, bushcraft et vie en pleine nature. Techniques ancestrales et matériel adapté.', 'from-stone-600 to-stone-800', 'Bushcraft', 'Sécurité avant tout. Respectez la nature et la réglementation locale.', 'open', 1204, 178, false, user2_id),
    (club4_id, 'club-gr20', 'Club GR20', 'pays', '🏔️', 'Le sentier le plus difficile d''Europe. Conditions, hébergements, matériel et conseils pour réussir le GR20.', 'from-blue-600 to-indigo-700', 'Corse', 'Partagez des informations à jour sur les conditions du sentier.', 'open', 3241, 445, true, user1_id),
    (club5_id, 'club-islande', 'Club Islande', 'pays', '🌋', 'Tout sur l''Islande : Laugavegur, Fimmvörðuháls, camping sauvage et road-trip sur la Route 1.', 'from-cyan-600 to-blue-700', 'Islande', 'Respectez la réglementation islandaise sur le camping sauvage.', 'open', 987, 134, false, user2_id),
    (club6_id, 'club-alpinisme', 'Club Alpinisme', 'activité', '⛏️', 'Alpinisme, escalade et haute montagne. Formations, conditions et matériel pour les sommets.', 'from-slate-600 to-gray-800', 'Alpinisme', 'Sécurité obligatoire. Partagez uniquement des informations vérifiées sur les conditions.', 'closed', 756, 89, false, user3_id)
  ON CONFLICT (slug) DO NOTHING;

  -- Club members
  INSERT INTO public.club_members (club_id, user_id, role, status)
  VALUES
    (club1_id, user1_id, 'admin', 'active'),
    (club4_id, user1_id, 'admin', 'active'),
    (club2_id, user2_id, 'admin', 'active'),
    (club3_id, user2_id, 'admin', 'active'),
    (club5_id, user2_id, 'admin', 'active'),
    (club6_id, user3_id, 'admin', 'active')
  ON CONFLICT (club_id, user_id) DO NOTHING;

  -- Club topics
  INSERT INTO public.club_topics (id, club_id, author_id, title, content, is_pinned, is_announcement, likes_count, replies_count)
  VALUES
    (topic1_id, club1_id, user1_id, 'Meilleures chaussures terrain mixte 2026', 'Après avoir testé une dizaine de modèles cette saison, voici mon classement...', true, false, 47, 23),
    (topic2_id, club1_id, user2_id, 'Filtration eau en montagne — comparatif', 'Sawyer Squeeze vs Katadyn BeFree vs MSR Guardian...', false, false, 31, 15),
    (topic3_id, club4_id, user1_id, 'Conditions étape 7 — sentier glissant après pluie', 'Attention : l''étape 7 entre Vizzavona et Bergeries de Capannelle est très glissante...', true, true, 89, 34)
  ON CONFLICT (id) DO NOTHING;

  -- Club challenges
  INSERT INTO public.club_challenges (club_id, title, description, xp, deadline, active)
  VALUES
    (club1_id, 'Défi 100km en juillet', 'Parcourez 100km de sentiers balisés en juillet et partagez vos traces GPS.', 500, '2026-07-31 23:59:00+00', true),
    (club4_id, 'GR20 Complet', 'Terminez le GR20 de bout en bout et partagez votre carnet d''expédition.', 1000, '2026-09-30 23:59:00+00', true),
    (club3_id, 'Nuit en abri naturel', 'Construisez et dormez dans un abri naturel sans tente. Partagez photos et technique.', 300, '2026-08-31 23:59:00+00', true)
  ON CONFLICT (id) DO NOTHING;

  -- Club events
  INSERT INTO public.club_events (club_id, organizer_id, title, description, event_date, location, max_participants, participants_count)
  VALUES
    (club1_id, user1_id, 'Sortie GR10 — Section Centrale', 'Traversée de la section centrale du GR10 sur 7 jours. Niveau intermédiaire requis.', '2026-08-15 08:00:00+00', 'Cauterets → Gavarnie', 8, 5),
    (club3_id, user2_id, 'Stage Bushcraft Forêt Landaise', 'Stage de 3 jours sur les techniques de survie en forêt. Allumage feu, abris, plantes.', '2026-08-22 09:00:00+00', 'Landes, 40', 12, 9),
    (club4_id, user1_id, 'Rencontre GR20 — Bastia', 'Soirée de rencontre pour les futurs randonneurs du GR20. Partage d''expériences.', '2026-07-20 19:00:00+00', 'Bastia, Corse', 30, 18)
  ON CONFLICT (id) DO NOTHING;

  -- Carnets
  INSERT INTO public.carnets (id, author_id, title, destination, description, cover_image, cover_image_alt, start_date, end_date, weather, route_rating, visibility, tags, likes_count, comments_count, favorites_count, verified)
  VALUES
    (carnet1_id, user1_id, 'Circuit des Annapurnas — 18 jours en autonomie', 'Népal', 'Départ de Besisahar le 12 mars. Conditions météo exceptionnelles jusqu''au col Thorong La (5416m), puis tempête de neige les 3 derniers jours. Matériel testé à l''extrême.', 'https://img.rocket.new/generatedImages/rocket_gen_img_154b5bc61-1768404553520.png', 'Randonneur sur sentier himalayan avec vue Annapurna', '2026-03-12', '2026-03-30', 'Ensoleillé J1–J14, tempête J15–J18, -18°C au col', 9.2, 'public', ARRAY['himalaya','nepal','autonomie','haute-altitude'], 203, 34, 87, true),
    (carnet2_id, user2_id, 'GR20 Corse — 15 jours de bout en bout', 'Corse', 'Le GR20 reste l''un des sentiers les plus exigeants d''Europe. Voici mon retour complet avec le matériel utilisé, les hébergements et les conditions météo.', 'https://images.unsplash.com/photo-1588453812365-876c78cb896c', 'Randonneuse sur sentier rocheux corse avec vue mer', '2026-06-05', '2026-06-20', 'Chaud et sec, orage J8', 8.8, 'public', ARRAY['gr20','corse','trek','europe'], 156, 21, 42, true),
    (carnet3_id, user3_id, 'Islande — Tour de l''île en van 3 semaines', 'Islande', 'Route 1 complète + détours Westfjords. Conditions imprévisibles, matériel testé à fond. Van aménagé Sprinter 2020.', 'https://images.unsplash.com/photo-1606948741419-a61fcfed813d', 'Paysage volcanique islandais avec randonneur', '2026-06-01', '2026-06-21', 'Variable, vent fort, 2 tempêtes', 9.5, 'public', ARRAY['islande','vanlife','roadtrip','nature'], 178, 28, 65, false)
  ON CONFLICT (id) DO NOTHING;

  -- Community posts
  INSERT INTO public.community_posts (id, author_id, content, post_type, likes_count, comments_count, is_trending)
  VALUES
    (post1_id, user1_id, 'Retour de 3 semaines en Patagonie 🏔️ Le vent était incroyable — jusqu''à 120 km/h sur le circuit W. Mon sac de 12kg a tenu le coup. Je partage mon carnet complet cette semaine !', 'post', 234, 45, true),
    (post2_id, user2_id, '💡 Conseil du jour : Pour les longues randonnées, privilégiez les chaussettes en laine mérinos même en été. Elles régulent mieux la température et résistent aux ampoules. Testé sur 500km cette saison.', 'tip', 189, 32, true),
    (post3_id, user3_id, 'Question : Quelqu''un a testé le filtre Katadyn BeFree sur des sources glaciaires ? Je pars au Kirghizistan en août et je cherche un retour d''expérience sur la qualité de filtration à basse température.', 'question', 67, 18, false)
  ON CONFLICT (id) DO NOTHING;

  -- Q&A
  INSERT INTO public.qa_questions (id, author_id, title, content, tags, category, votes_count, answers_count, views_count)
  VALUES
    (qa1_id, user1_id, 'Quel matelas de sol pour bivouac hivernal sous -10°C ?', 'Je prépare une traversée des Alpes en hiver et je cherche un matelas avec un R-value d''au moins 6. Budget 200€ max. Quelles sont vos recommandations ?', ARRAY['bivouac','hiver','matelas','alpinisme'], 'matériel', 47, 8, 234),
    (qa2_id, user2_id, 'Réglementation camping sauvage en Islande 2026 ?', 'Suite aux nouvelles lois de 2025, est-ce que le camping sauvage est toujours autorisé en dehors des zones protégées ? Quelqu''un a des infos récentes ?', ARRAY['islande','camping','réglementation','2026'], 'réglementation', 89, 12, 456)
  ON CONFLICT (id) DO NOTHING;

  -- Q&A answers
  INSERT INTO public.qa_answers (question_id, author_id, content, votes_count, is_accepted)
  VALUES
    (qa1_id, user2_id, 'Le Therm-a-Rest NeoAir XTherm est la référence avec un R-value de 7.3. Il est dans ton budget et pèse seulement 430g. Je l''utilise depuis 3 ans pour mes bivouacs hivernaux dans les Alpes.', 34, true),
    (qa1_id, user3_id, 'Le Sea to Summit Ether Light XT Extreme est aussi excellent (R-value 6.2) et plus abordable. Bon compromis poids/isolation.', 21, false),
    (qa2_id, user1_id, 'Oui, le camping sauvage reste autorisé en Islande en dehors des zones protégées et des terres agricoles. La loi de 2025 a surtout renforcé les sanctions pour les infractions dans les zones protégées.', 67, true)
  ON CONFLICT (id) DO NOTHING;

  -- AMA session
  INSERT INTO public.ama_sessions (id, expert_id, title, description, scheduled_at, duration_minutes, status, participants_count, questions_count)
  VALUES
    (ama1_id, user1_id, 'AMA : Himalaya en autonomie — Retour d''expérience', 'Posez toutes vos questions sur la préparation, le matériel et la logistique pour un trek himalayan en autonomie complète. 15 ans d''expérience, 8 expéditions.', '2026-07-20 18:00:00+00', 90, 'upcoming', 0, 0)
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data error: %', SQLERRM;
END $$;
