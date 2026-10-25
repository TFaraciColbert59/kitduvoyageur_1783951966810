-- ============================================================
-- KIT DU VOYAGEUR — Full App Tables Migration v3
-- ============================================================

-- 1. USER PROFILES
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  trust_score INTEGER DEFAULT 50,
  loyalty_points INTEGER DEFAULT 100,
  loyalty_level TEXT DEFAULT 'Explorateur',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. GEAR / INVENTAIRE
CREATE TABLE IF NOT EXISTS public.gear_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  model TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'autre',
  condition TEXT NOT NULL DEFAULT 'bon',
  purchase_date DATE,
  purchase_price NUMERIC(10,2) DEFAULT 0,
  weight_g INTEGER DEFAULT 0,
  expiry_date DATE,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  notes TEXT DEFAULT '',
  serial_number TEXT DEFAULT '',
  usage_count INTEGER DEFAULT 0,
  image TEXT DEFAULT '',
  alt TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. DOCUMENTS
CREATE TABLE IF NOT EXISTS public.user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'autre',
  destination TEXT DEFAULT '',
  expiry DATE,
  file_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. EXPEDITION REPORTS
CREATE TABLE IF NOT EXISTS public.expedition_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  country TEXT DEFAULT '',
  start_date DATE,
  end_date DATE,
  duration TEXT DEFAULT '',
  type TEXT DEFAULT 'Trekking',
  score INTEGER DEFAULT 0,
  budget_estimated NUMERIC(10,2) DEFAULT 0,
  budget_real NUMERIC(10,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  image TEXT DEFAULT '',
  alt TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. CLUBS
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'activité',
  emoji TEXT DEFAULT '🏕️',
  description TEXT DEFAULT '',
  cover_color TEXT DEFAULT 'from-emerald-600 to-teal-700',
  members_count INTEGER DEFAULT 0,
  active_this_month INTEGER DEFAULT 0,
  min_trust_to_create INTEGER DEFAULT 60,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(club_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.club_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. EVENTS
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'rando',
  emoji TEXT DEFAULT '🥾',
  organizer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  event_date DATE NOT NULL,
  duration TEXT DEFAULT '',
  location TEXT DEFAULT '',
  country TEXT DEFAULT '',
  max_participants INTEGER DEFAULT 10,
  current_participants INTEGER DEFAULT 0,
  description TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  cover_alt TEXT DEFAULT '',
  shared_kitty NUMERIC(10,2) DEFAULT 0,
  kitty_goal NUMERIC(10,2) DEFAULT 0,
  min_trust_to_organize INTEGER DEFAULT 70,
  status TEXT DEFAULT 'upcoming',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.event_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC(10,2) DEFAULT 0,
  paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. GUIDES
CREATE TABLE IF NOT EXISTS public.guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'Destination',
  destination TEXT DEFAULT '',
  read_time INTEGER DEFAULT 5,
  difficulty TEXT DEFAULT 'Débutant',
  image TEXT DEFAULT '',
  alt TEXT DEFAULT '',
  excerpt TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  featured BOOLEAN DEFAULT false,
  content TEXT DEFAULT '',
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. NOTIFICATIONS / ALERTS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'trip',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  urgent BOOLEAN DEFAULT false,
  action_label TEXT DEFAULT '',
  action_href TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. SOS ALERTS
CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. MESSAGES
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT '1to1',
  name TEXT NOT NULL DEFAULT '',
  avatar TEXT DEFAULT '',
  members_count INTEGER DEFAULT 2,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  gps_label TEXT DEFAULT '',
  gps_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. LOYALTY POINTS HISTORY
CREATE TABLE IF NOT EXISTS public.loyalty_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'earned',
  reference_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. LOYALTY REWARDS
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  points_cost INTEGER NOT NULL,
  category TEXT DEFAULT 'discount',
  value TEXT DEFAULT '',
  image TEXT DEFAULT '',
  alt TEXT DEFAULT '',
  available BOOLEAN DEFAULT true,
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. LOYALTY REDEMPTIONS
CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. CART LOYALTY DISCOUNTS
CREATE TABLE IF NOT EXISTS public.cart_loyalty_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  discount_type TEXT DEFAULT 'free',
  discount_value NUMERIC(10,2) DEFAULT 0,
  applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_gear_items_user_id ON public.gear_items(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON public.user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_expedition_reports_user_id ON public.expedition_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_clubs_type ON public.clubs(type);
CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON public.club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user_id ON public.club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON public.event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user_id ON public.event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_guides_featured ON public.guides(featured);
CREATE INDEX IF NOT EXISTS idx_guides_category ON public.guides(category);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_user_id ON public.sos_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_history_user_id ON public.loyalty_history(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_user_id ON public.loyalty_redemptions(user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, loyalty_points, trust_score)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    100,
    50
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_loyalty_points(p_user_id UUID, p_points INTEGER, p_action TEXT, p_type TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_profiles
  SET loyalty_points = GREATEST(0, loyalty_points + p_points),
      loyalty_level = CASE
        WHEN GREATEST(0, loyalty_points + p_points) >= 7500 THEN 'Légende du Voyage'
        WHEN GREATEST(0, loyalty_points + p_points) >= 3500 THEN 'Guide de Montagne'
        WHEN GREATEST(0, loyalty_points + p_points) >= 1500 THEN 'Randonneur Expert'
        WHEN GREATEST(0, loyalty_points + p_points) >= 500 THEN 'Aventurier'
        ELSE 'Explorateur'
      END,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id;

  INSERT INTO public.loyalty_history (user_id, action, points, type)
  VALUES (p_user_id, p_action, p_points, p_type);
END;
$$;

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gear_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedition_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_loyalty_discounts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- user_profiles
DROP POLICY IF EXISTS "users_manage_own_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_profiles" ON public.user_profiles
FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_read_all_profiles" ON public.user_profiles;
CREATE POLICY "users_read_all_profiles" ON public.user_profiles
FOR SELECT TO authenticated USING (true);

-- gear_items
DROP POLICY IF EXISTS "users_manage_own_gear" ON public.gear_items;
CREATE POLICY "users_manage_own_gear" ON public.gear_items
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- user_documents
DROP POLICY IF EXISTS "users_manage_own_documents" ON public.user_documents;
CREATE POLICY "users_manage_own_documents" ON public.user_documents
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- expedition_reports
DROP POLICY IF EXISTS "users_manage_own_reports" ON public.expedition_reports;
CREATE POLICY "users_manage_own_reports" ON public.expedition_reports
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- clubs: public read, auth write
DROP POLICY IF EXISTS "public_read_clubs" ON public.clubs;
CREATE POLICY "public_read_clubs" ON public.clubs
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_clubs" ON public.clubs;
CREATE POLICY "auth_manage_clubs" ON public.clubs
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- club_members
DROP POLICY IF EXISTS "public_read_club_members" ON public.club_members;
CREATE POLICY "public_read_club_members" ON public.club_members
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "users_manage_own_memberships" ON public.club_members;
CREATE POLICY "users_manage_own_memberships" ON public.club_members
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- club_topics
DROP POLICY IF EXISTS "public_read_club_topics" ON public.club_topics;
CREATE POLICY "public_read_club_topics" ON public.club_topics
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_club_topics" ON public.club_topics;
CREATE POLICY "auth_manage_club_topics" ON public.club_topics
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- events: public read, auth write
DROP POLICY IF EXISTS "public_read_events" ON public.events;
CREATE POLICY "public_read_events" ON public.events
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_events" ON public.events;
CREATE POLICY "auth_manage_events" ON public.events
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- event_participants
DROP POLICY IF EXISTS "public_read_event_participants" ON public.event_participants;
CREATE POLICY "public_read_event_participants" ON public.event_participants
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "users_manage_own_participations" ON public.event_participants;
CREATE POLICY "users_manage_own_participations" ON public.event_participants
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- event_expenses
DROP POLICY IF EXISTS "public_read_event_expenses" ON public.event_expenses;
CREATE POLICY "public_read_event_expenses" ON public.event_expenses
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_event_expenses" ON public.event_expenses;
CREATE POLICY "auth_manage_event_expenses" ON public.event_expenses
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- guides: public read, auth write
DROP POLICY IF EXISTS "public_read_guides" ON public.guides;
CREATE POLICY "public_read_guides" ON public.guides
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_guides" ON public.guides;
CREATE POLICY "auth_manage_guides" ON public.guides
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- notifications
DROP POLICY IF EXISTS "users_manage_own_notifications" ON public.notifications;
CREATE POLICY "users_manage_own_notifications" ON public.notifications
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- sos_alerts
DROP POLICY IF EXISTS "users_manage_own_sos" ON public.sos_alerts;
CREATE POLICY "users_manage_own_sos" ON public.sos_alerts
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- conversations
DROP POLICY IF EXISTS "auth_read_conversations" ON public.conversations;
CREATE POLICY "auth_read_conversations" ON public.conversations
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_manage_conversations" ON public.conversations;
CREATE POLICY "auth_manage_conversations" ON public.conversations
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- conversation_members
DROP POLICY IF EXISTS "auth_read_conversation_members" ON public.conversation_members;
CREATE POLICY "auth_read_conversation_members" ON public.conversation_members
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users_manage_own_conv_members" ON public.conversation_members;
CREATE POLICY "users_manage_own_conv_members" ON public.conversation_members
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- messages
DROP POLICY IF EXISTS "auth_read_messages" ON public.messages;
CREATE POLICY "auth_read_messages" ON public.messages
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_messages" ON public.messages;
CREATE POLICY "auth_insert_messages" ON public.messages
FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "auth_delete_own_messages" ON public.messages;
CREATE POLICY "auth_delete_own_messages" ON public.messages
FOR DELETE TO authenticated USING (sender_id = auth.uid());

-- loyalty_history
DROP POLICY IF EXISTS "users_manage_own_loyalty_history" ON public.loyalty_history;
CREATE POLICY "users_manage_own_loyalty_history" ON public.loyalty_history
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- loyalty_rewards: public read
DROP POLICY IF EXISTS "public_read_loyalty_rewards" ON public.loyalty_rewards;
CREATE POLICY "public_read_loyalty_rewards" ON public.loyalty_rewards
FOR SELECT TO public USING (true);

-- loyalty_redemptions
DROP POLICY IF EXISTS "users_manage_own_redemptions" ON public.loyalty_redemptions;
CREATE POLICY "users_manage_own_redemptions" ON public.loyalty_redemptions
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- cart_loyalty_discounts
DROP POLICY IF EXISTS "users_manage_own_cart_discounts" ON public.cart_loyalty_discounts;
CREATE POLICY "users_manage_own_cart_discounts" ON public.cart_loyalty_discounts
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED DATA
-- ============================================================

-- Seed loyalty rewards
INSERT INTO public.loyalty_rewards (title, description, points_cost, category, value, image, alt, available)
VALUES
  ('-10% sur votre prochain achat', 'Réduction de 10% sur tout le catalogue', 200, 'discount', '-10%', 'https://images.unsplash.com/photo-1637044500577-726eac69c2c4', 'Sac de courses avec équipement de randonnée', true),
  ('Livraison express offerte', 'Livraison en 24h offerte sur votre prochaine commande', 150, 'shipping', 'Gratuit', 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088', 'Carton de livraison express', true),
  ('Gourde Nalgene 1L offerte', 'Une gourde Nalgene 1L offerte avec votre commande', 500, 'product', '15€', 'https://images.unsplash.com/photo-1568395216634-ab1b1e848751', 'Gourde de randonnée bleue Nalgene', true),
  ('-20% sur les kits', 'Réduction de 20% sur tous les kits de voyage', 400, 'discount', '-20%', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62', 'Kit de voyage complet avec équipements', true),
  ('Accès VIP 1 mois', 'Accès à toutes les fonctionnalités premium pendant 1 mois', 800, 'premium', '1 mois', 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa', 'Badge VIP doré sur fond sombre', true)
ON CONFLICT DO NOTHING;

-- Seed clubs
INSERT INTO public.clubs (slug, name, type, emoji, description, cover_color, members_count, active_this_month)
VALUES
  ('randonnee-alpine', 'Randonnée Alpine', 'activité', '🏔️', 'Club dédié aux randonnées en haute montagne, alpinisme et trekking d''altitude.', 'from-slate-600 to-slate-800', 1247, 89),
  ('bushcraft-survie', 'Bushcraft & Survie', 'activité', '🪓', 'Techniques de survie, construction d''abris, feu de camp et vie en forêt.', 'from-stone-600 to-stone-800', 834, 67),
  ('vanlife-france', 'Vanlife France', 'activité', '🚐', 'Communauté des voyageurs en van, road trips et vie nomade.', 'from-amber-600 to-orange-700', 2156, 234),
  ('nepal-himalaya', 'Népal & Himalaya', 'pays', '🇳🇵', 'Tout sur le trekking au Népal : circuits, permis, logistique et retours d''expérience.', 'from-blue-600 to-indigo-700', 956, 78),
  ('islande-aventure', 'Islande Aventure', 'pays', '🇮🇸', 'Randonnées, aurores boréales et aventures en Islande.', 'from-cyan-600 to-blue-700', 623, 45),
  ('photo-nature', 'Photo Nature & Voyage', 'activité', '📸', 'Photographie de paysages, faune sauvage et voyages photographiques.', 'from-purple-600 to-violet-700', 1089, 156)
ON CONFLICT (slug) DO NOTHING;

-- Seed club topics
DO $$
DECLARE
  club_id_rando UUID;
  club_id_bush UUID;
  club_id_van UUID;
  prof_id UUID;
BEGIN
  SELECT id INTO club_id_rando FROM public.clubs WHERE slug = 'randonnee-alpine' LIMIT 1;
  SELECT id INTO club_id_bush FROM public.clubs WHERE slug = 'bushcraft-survie' LIMIT 1;
  SELECT id INTO club_id_van FROM public.clubs WHERE slug = 'vanlife-france' LIMIT 1;
  SELECT id INTO prof_id FROM public.user_profiles LIMIT 1;

  IF club_id_rando IS NOT NULL AND prof_id IS NOT NULL THEN
    INSERT INTO public.club_topics (club_id, author_id, title, content) VALUES
      (club_id_rando, prof_id, 'Conditions sentiers Chamonix — juillet 2026', 'Quelqu''un a des infos sur l''état des sentiers côté Aiguille du Midi ?'),
      (club_id_rando, prof_id, 'Meilleur sac 60L pour le GR20 ?', 'Je cherche un sac entre 60 et 70L pour le GR20 en août. Vos recommandations ?'),
      (club_id_rando, prof_id, 'Retour circuit des Annapurnas mars 2026', 'Je viens de rentrer du circuit des Annapurnas, AMA !')
    ON CONFLICT DO NOTHING;
  END IF;

  IF club_id_bush IS NOT NULL AND prof_id IS NOT NULL THEN
    INSERT INTO public.club_topics (club_id, author_id, title, content) VALUES
      (club_id_bush, prof_id, 'Techniques de feu par temps humide', 'Partage de techniques pour allumer un feu sous la pluie.'),
      (club_id_bush, prof_id, 'Couteau bushcraft : lequel choisir ?', 'Comparatif des meilleurs couteaux pour le bushcraft.')
    ON CONFLICT DO NOTHING;
  END IF;

  IF club_id_van IS NOT NULL AND prof_id IS NOT NULL THEN
    INSERT INTO public.club_topics (club_id, author_id, title, content) VALUES
      (club_id_van, prof_id, 'Aires de camping-car gratuites en Bretagne', 'Liste des meilleures aires gratuites en Bretagne.'),
      (club_id_van, prof_id, 'Aménagement van : isolation thermique', 'Conseils pour isoler son van pour l''hiver.')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Seed events
INSERT INTO public.events (title, type, emoji, event_date, duration, location, country, max_participants, current_participants, description, cover_image, cover_alt, shared_kitty, kitty_goal, status)
VALUES
  ('Trek GR10 Pyrénées — Section Cauterets', 'rando', '🥾', '2026-08-15', '5 jours', 'Cauterets', 'France', 8, 5, 'Traversée de la section centrale du GR10 entre Cauterets et Luz-Saint-Sauveur. Niveau intermédiaire, 15-20 km/jour.', 'https://images.unsplash.com/photo-1551632811-561732d1e306', 'Sentier de randonnée dans les Pyrénées avec vue sur les sommets', 340, 500, 'upcoming'),
  ('Bivouac Vercors — Nuit étoilée', 'bushcraft', '🌙', '2026-07-28', '2 jours', 'Villard-de-Lans', 'France', 6, 4, 'Bivouac en autonomie dans le Vercors. Techniques de survie, feu de camp, observation des étoiles.', 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4', 'Tente de camping sous un ciel étoilé en montagne', 120, 200, 'upcoming'),
  ('Road trip Islande — Anneau d''Or', 'vanlife', '🚐', '2026-09-05', '10 jours', 'Reykjavik', 'Islande', 4, 4, 'Road trip en van autour de l''anneau d''or islandais. Geysers, cascades et aurores boréales.', 'https://images.unsplash.com/photo-1504233529578-6d46baba6d34', 'Route islandaise avec aurores boréales et montagnes enneigées', 1200, 1500, 'full')
ON CONFLICT DO NOTHING;

-- Seed event expenses
DO $$
DECLARE
  ev_id UUID;
BEGIN
  SELECT id INTO ev_id FROM public.events WHERE title LIKE 'Trek GR10%' LIMIT 1;
  IF ev_id IS NOT NULL THEN
    INSERT INTO public.event_expenses (event_id, label, amount, paid) VALUES
      (ev_id, 'Location refuge nuit 1', 120, true),
      (ev_id, 'Navette retour Luz', 80, false),
      (ev_id, 'Nourriture collective', 150, false),
      (ev_id, 'Assurance groupe', 50, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Seed guides
INSERT INTO public.guides (slug, title, category, destination, read_time, difficulty, image, alt, excerpt, tags, featured)
VALUES
  ('trek-annapurnas-guide-complet', 'Circuit des Annapurnas : Guide Complet 2026', 'Destination', 'Népal', 25, 'Intermédiaire', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa', 'Vue panoramique du circuit des Annapurnas avec sommets enneigés', 'Tout ce qu''il faut savoir pour préparer et réussir le circuit des Annapurnas : permis, logistique, équipement et étapes.', ARRAY['népal', 'trekking', 'himalaya', 'altitude'], true),
  ('checklist-randonnee-3-jours', 'Checklist Randonnée 3 Jours : Ne Rien Oublier', 'Checklist', 'France', 8, 'Débutant', 'https://images.unsplash.com/photo-1551632811-561732d1e306', 'Randonneur avec sac à dos sur un sentier de montagne', 'La checklist ultime pour une randonnée de 3 jours en autonomie. Équipement, nourriture, sécurité : tout est listé.', ARRAY['checklist', 'randonnée', 'débutant', 'équipement'], true),
  ('choisir-sac-dos-randonnee', 'Comment Choisir Son Sac à Dos de Randonnée', 'Guide d''achat', 'Universel', 12, 'Débutant', 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30', 'Sac à dos de randonnée orange posé sur un rocher en montagne', 'Volume, suspension, matière : tous les critères pour choisir le sac à dos parfait selon votre pratique.', ARRAY['sac à dos', 'équipement', 'guide achat'], false),
  ('gr20-guide-pratique', 'GR20 : Le Guide Pratique Complet', 'Guide pratique', 'Corse', 20, 'Expert', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4', 'Sentier du GR20 en Corse avec vue sur les crêtes rocheuses', 'Le GR20, considéré comme l''un des sentiers les plus difficiles d''Europe. Notre guide complet pour le préparer et le réussir.', ARRAY['gr20', 'corse', 'expert', 'trekking'], true),
  ('islande-road-trip-guide', 'Road Trip Islande : L''Anneau d''Or en Van', 'Destination', 'Islande', 15, 'Débutant', 'https://images.unsplash.com/photo-1504233529578-6d46baba6d34', 'Route islandaise avec aurores boréales et montagnes enneigées', 'Itinéraire complet pour un road trip en van autour de l''anneau d''or islandais : étapes, hébergements et conseils.', ARRAY['islande', 'vanlife', 'road trip', 'aurores boréales'], false),
  ('comparatif-tentes-bivouac', 'Comparatif Tentes Bivouac 2026 : Les Meilleures', 'Comparatif', 'Universel', 10, 'Intermédiaire', 'https://images.unsplash.com/photo-1571364588707-8638d6c49fea', 'Tente de randonnée orange installée dans un pré alpin au coucher du soleil', 'Notre sélection des meilleures tentes de bivouac 2026 : légèreté, résistance et rapport qualité-prix.', ARRAY['tente', 'bivouac', 'comparatif', 'équipement'], false)
ON CONFLICT (slug) DO NOTHING;
