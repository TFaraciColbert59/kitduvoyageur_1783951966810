-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Create missing tables referenced by existing features
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Tables créées :
--   1. conversations, messages       → Messagerie (/messagerie)
--   2. events, event_participants, event_expenses → Événements (/evenements)
--   3. reviews                       → Avis (/avis)
--   4. ambassadors, promo_codes      → Ambassadeurs (/ambassadeurs)
--   5. experts, expert_bookings      → Experts (/experts)
--   6. expedition_reports            → Rapport d'expédition (/rapport-expedition)
--   7. products                      → Admin, rapport-kit, boutique fallback
--   8. listings                      → API /api/produit/occasion-check, /neuf-check
--   9. club_challenges               → Clubs, Communauté
--  10. gear_images, loans, gear_history  → Inventaire (queries.ts)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Messagerie ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('1to1', 'group', 'club', 'event')),
  name text NOT NULL,
  avatar text,
  members_count integer DEFAULT 2,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  type text DEFAULT 'text' CHECK (type IN ('text', 'gps', 'system')),
  gps_lat double precision,
  gps_lng double precision,
  gps_label text,
  gps_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Public read / authenticated write for conversations
CREATE POLICY "public_read_conversations" ON public.conversations
  FOR SELECT TO public USING (true);

CREATE POLICY "auth_insert_conversations" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "auth_update_conversations" ON public.conversations
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- Public read / authenticated write for messages
CREATE POLICY "public_read_messages" ON public.messages
  FOR SELECT TO public USING (true);

CREATE POLICY "auth_insert_messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- ── 2. Événements ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text DEFAULT 'rando',
  emoji text DEFAULT '🥾',
  organizer_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  event_date date NOT NULL,
  duration text,
  location text,
  country text DEFAULT 'France',
  max_participants integer DEFAULT 10,
  current_participants integer DEFAULT 0,
  description text,
  cover_image text,
  cover_alt text,
  shared_kitty numeric DEFAULT 0,
  kitty_goal numeric DEFAULT 0,
  min_trust_to_organize integer DEFAULT 0,
  status text DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'full', 'past')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.event_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric DEFAULT 0,
  paid boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_events" ON public.events FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "auth_update_events" ON public.events FOR UPDATE TO authenticated
  USING (auth.uid() = organizer_id OR public.is_admin());

CREATE POLICY "public_read_event_participants" ON public.event_participants FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_event_participants" ON public.event_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_delete_event_participants" ON public.event_participants FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "public_read_event_expenses" ON public.event_expenses FOR SELECT TO public USING (true);

-- ── 3. Avis ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('produit', 'kit', 'location', 'occasion')),
  target_name text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  comment text,
  verified boolean DEFAULT false,
  helpful_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_reviews" ON public.reviews FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_update_reviews" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ── 4. Ambassadeurs & Codes Promo ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ambassadors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  handle text,
  tier text DEFAULT 'Explorer',
  followers text,
  commission_pct numeric DEFAULT 8,
  earnings numeric DEFAULT 0,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  promo_code text,
  avatar text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_pct numeric,
  max_uses integer,
  uses integer DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_ambassadors" ON public.ambassadors FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_ambassadors" ON public.ambassadors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public_read_promo_codes" ON public.promo_codes FOR SELECT TO public USING (true);

-- ── 5. Experts ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.experts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text,
  specialties text[] DEFAULT '{}',
  destinations text[] DEFAULT '{}',
  rating numeric DEFAULT 0,
  reviews_count integer DEFAULT 0,
  consultations_count integer DEFAULT 0,
  price_per_hour numeric DEFAULT 0,
  availability text DEFAULT 'disponible',
  certifications text[] DEFAULT '{}',
  bio text,
  avatar text,
  languages text[] DEFAULT '{}',
  response_time text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expert_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid REFERENCES public.experts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  booking_date text,
  duration_minutes integer DEFAULT 60,
  topic text,
  message text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.experts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_experts" ON public.experts FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_expert_bookings" ON public.expert_bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_read_expert_bookings" ON public.expert_bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ── 6. Rapports d'Expédition ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.expedition_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  destination text NOT NULL,
  country text,
  start_date text,
  end_date text,
  duration text,
  type text,
  score numeric DEFAULT 0,
  notes text,
  budget_estimated numeric DEFAULT 0,
  budget_real numeric DEFAULT 0,
  image text,
  alt text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.expedition_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_expedition_reports" ON public.expedition_reports FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_expedition_reports" ON public.expedition_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_manage_expedition_reports" ON public.expedition_reports FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 7. Produits (legacy fallback table) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  brand text,
  category text,
  price_eur numeric DEFAULT 0,
  weight_g numeric DEFAULT 0,
  description text,
  image text,
  image_alt text,
  stock integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_products" ON public.products FOR SELECT TO public USING (true);
CREATE POLICY "admin_write_products" ON public.products FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 8. Listings (annonces unifiées) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id text,
  listing_type text NOT NULL CHECK (listing_type IN ('neuf', 'occasion', 'kit', 'enchere', 'location')),
  prix_cents integer NOT NULL DEFAULT 0,
  statut text DEFAULT 'actif',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_listings" ON public.listings FOR SELECT TO public USING (true);
CREATE POLICY "admin_write_listings" ON public.listings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 9. Défis de Club ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.club_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  xp_reward integer DEFAULT 0,
  active boolean DEFAULT true,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.club_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_club_challenges" ON public.club_challenges FOR SELECT TO public USING (true);
CREATE POLICY "auth_insert_club_challenges" ON public.club_challenges FOR INSERT TO authenticated WITH CHECK (true);

-- ── 10. Inventaire — tables auxiliaires ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gear_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gear_item_id uuid REFERENCES public.gear_items(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gear_item_id uuid REFERENCES public.gear_items(id) ON DELETE CASCADE,
  loaned_to text,
  loaned_at timestamptz,
  returned_at timestamptz,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gear_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gear_item_id uuid REFERENCES public.gear_items(id) ON DELETE CASCADE,
  event_type text,
  event_date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.gear_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gear_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_gear_images" ON public.gear_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_loans" ON public.loans FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_gear_history" ON public.gear_history FOR SELECT TO authenticated USING (true);
