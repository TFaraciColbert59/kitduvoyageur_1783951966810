-- ============================================================
-- KIT DU VOYAGEUR — Migration: App tables v1
-- ============================================================

-- 1. USER PROFILES
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

-- 2. CLUBS
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
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.club_topics ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.user_profiles(id);

-- 3. EVENTS
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

-- 4. GUIDES
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

-- 5. NOTIFICATIONS / ALERTS
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

-- 6. SOS ALERTS
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

-- 7. LOYALTY POINTS HISTORY
CREATE TABLE IF NOT EXISTS public.loyalty_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'earned',
  reference_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. LOYALTY REWARDS
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

-- 9. LOYALTY REDEMPTIONS
CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. CART LOYALTY DISCOUNTS
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
CREATE INDEX IF NOT EXISTS idx_loyalty_history_user_id ON public.loyalty_history(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_user_id ON public.loyalty_redemptions(user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Handle new user registration
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

-- Update user loyalty points
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
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
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

DROP POLICY IF EXISTS "public_read_profiles" ON public.user_profiles;
CREATE POLICY "public_read_profiles" ON public.user_profiles
FOR SELECT TO public USING (true);

-- clubs (public read, auth write)
DROP POLICY IF EXISTS "public_read_clubs" ON public.clubs;
CREATE POLICY "public_read_clubs" ON public.clubs
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_create_clubs" ON public.clubs;
CREATE POLICY "auth_create_clubs" ON public.clubs
FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "creator_manage_clubs" ON public.clubs;
CREATE POLICY "creator_manage_clubs" ON public.clubs
FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- club_members
DROP POLICY IF EXISTS "public_read_club_members" ON public.club_members;
CREATE POLICY "public_read_club_members" ON public.club_members
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_own_membership" ON public.club_members;
CREATE POLICY "auth_manage_own_membership" ON public.club_members
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- club_topics
ALTER TABLE public.club_topics ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.user_profiles(id);
DROP POLICY IF EXISTS "public_read_topics" ON public.club_topics;
CREATE POLICY "public_read_topics" ON public.club_topics
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_create_topics" ON public.club_topics;
CREATE POLICY "auth_create_topics" ON public.club_topics
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- events
DROP POLICY IF EXISTS "public_read_events" ON public.events;
CREATE POLICY "public_read_events" ON public.events
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_create_events" ON public.events;
CREATE POLICY "auth_create_events" ON public.events
FOR INSERT TO authenticated WITH CHECK (organizer_id = auth.uid());

DROP POLICY IF EXISTS "organizer_manage_events" ON public.events;
CREATE POLICY "organizer_manage_events" ON public.events
FOR UPDATE TO authenticated USING (organizer_id = auth.uid()) WITH CHECK (organizer_id = auth.uid());

-- event_participants
DROP POLICY IF EXISTS "public_read_event_participants" ON public.event_participants;
CREATE POLICY "public_read_event_participants" ON public.event_participants
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_own_participation" ON public.event_participants;
CREATE POLICY "auth_manage_own_participation" ON public.event_participants
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- event_expenses
DROP POLICY IF EXISTS "public_read_expenses" ON public.event_expenses;
CREATE POLICY "public_read_expenses" ON public.event_expenses
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_manage_expenses" ON public.event_expenses;
CREATE POLICY "auth_manage_expenses" ON public.event_expenses
FOR ALL TO authenticated WITH CHECK (true);

-- guides
DROP POLICY IF EXISTS "public_read_guides" ON public.guides;
CREATE POLICY "public_read_guides" ON public.guides
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "auth_create_guides" ON public.guides;
CREATE POLICY "auth_create_guides" ON public.guides
FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "author_manage_guides" ON public.guides;
CREATE POLICY "author_manage_guides" ON public.guides
FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- notifications
DROP POLICY IF EXISTS "users_own_notifications" ON public.notifications;
CREATE POLICY "users_own_notifications" ON public.notifications
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- sos_alerts
DROP POLICY IF EXISTS "users_own_sos" ON public.sos_alerts;
CREATE POLICY "users_own_sos" ON public.sos_alerts
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- loyalty_history
DROP POLICY IF EXISTS "users_own_loyalty_history" ON public.loyalty_history;
CREATE POLICY "users_own_loyalty_history" ON public.loyalty_history
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- loyalty_rewards (public read)
DROP POLICY IF EXISTS "public_read_rewards" ON public.loyalty_rewards;
CREATE POLICY "public_read_rewards" ON public.loyalty_rewards
FOR SELECT TO public USING (true);

-- loyalty_redemptions
DROP POLICY IF EXISTS "users_own_redemptions" ON public.loyalty_redemptions;
CREATE POLICY "users_own_redemptions" ON public.loyalty_redemptions
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- cart_loyalty_discounts
DROP POLICY IF EXISTS "users_own_cart_discounts" ON public.cart_loyalty_discounts;
CREATE POLICY "users_own_cart_discounts" ON public.cart_loyalty_discounts
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
INSERT INTO public.loyalty_rewards (id, title, description, points_cost, category, value, image, alt, available)
VALUES
  (gen_random_uuid(), '-10% sur votre prochain achat', 'Code de réduction valable 30 jours sur tout le catalogue.', 200, 'discount', '-10%', 'https://images.unsplash.com/photo-1637044500577-726eac69c2c4', 'Sac de courses avec équipement de randonnée et étiquette de réduction', true),
  (gen_random_uuid(), 'Livraison express offerte', 'Livraison en 24h gratuite pour votre prochaine commande.', 150, 'shipping', 'Gratuit', 'https://img.rocket.new/generatedImages/rocket_gen_img_1c0c92ee0-1767681355393.png', 'Carton de livraison express avec logo de transport rapide', true),
  (gen_random_uuid(), 'Gourde Nalgene 1L offerte', 'Gourde Nalgene Tritan 1L, coloris au choix. Valeur 15€.', 500, 'gear', '15€', 'https://images.unsplash.com/photo-1602142937810-fac7755f19da', 'Gourde de randonnée bleue Nalgene posée sur un rocher en montagne', true),
  (gen_random_uuid(), 'Kit premiers secours Lifesystems', 'Trousse de premiers secours compacte pour la randonnée. Valeur 35€.', 900, 'gear', '35€', 'https://img.rocket.new/generatedImages/rocket_gen_img_1aeb8983a-1766791137461.png', 'Trousse de premiers secours rouge ouverte avec matériel médical de randonnée', true),
  (gen_random_uuid(), 'Consultation équipement 1h', 'Session vidéo 1h avec un expert équipement pour préparer votre expédition.', 1200, 'experience', '60€', 'https://img.rocket.new/generatedImages/rocket_gen_img_19fffd4ee-1767548175457.png', 'Expert équipement montagne présentant du matériel de randonnée sur une table', true),
  (gen_random_uuid(), '-20% Decathlon partenaire', 'Code de réduction exclusif sur la gamme Forclaz chez Decathlon.', 350, 'partner', '-20%', 'https://images.unsplash.com/photo-1637666544359-0e88de7b3206', 'Rayon équipement de randonnée dans un magasin de sport avec sacs et chaussures', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.club_topics ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.user_profiles(id);

-- Seed clubs
DO $$
DECLARE
  club1_id UUID := gen_random_uuid();
  club2_id UUID := gen_random_uuid();
  club3_id UUID := gen_random_uuid();
  club4_id UUID := gen_random_uuid();
  club5_id UUID := gen_random_uuid();
  club6_id UUID := gen_random_uuid();
  prof_id UUID;
BEGIN
  INSERT INTO public.clubs (id, slug, name, type, emoji, description, cover_color, members_count, active_this_month, min_trust_to_create)
  VALUES
    (club1_id, 'c-rando', 'Club Randonnée', 'activité', '🥾', 'Randonnée pédestre toutes distances, du week-end local aux grandes traversées. Partage de tracés, retours terrain, organisation de sorties groupées.', 'from-emerald-600 to-teal-700', 2847, 312, 60),
    (club2_id, 'c-vanlife', 'Club Vanlife', 'activité', '🚐', 'Aménagement, itinéraires, spots de nuit, vie nomade en van. La communauté des voyageurs sur roues.', 'from-amber-600 to-orange-700', 1923, 241, 60),
    (club3_id, 'c-bushcraft', 'Club Bushcraft', 'activité', '🪓', 'Techniques de survie, vie en forêt, feu de camp, abris naturels. Pour ceux qui voyagent avec le minimum.', 'from-stone-600 to-stone-800', 1456, 178, 60),
    (club4_id, 'c-gr20', 'Club GR20', 'pays', '🏔️', 'La référence pour le GR20 corse. Conditions du sentier en temps réel, points d''eau, refuges, météo.', 'from-blue-600 to-indigo-700', 3241, 487, 60),
    (club5_id, 'c-islande', 'Club Islande', 'pays', '🌋', 'Tout sur l''Islande : Laugavegur, Fimmvörðuháls, routes F, aurores boréales.', 'from-cyan-600 to-blue-700', 1678, 203, 60),
    (club6_id, 'c-alpinisme', 'Club Alpinisme', 'activité', '⛏️', 'Alpinisme technique, escalade en haute montagne, courses glaciaires. Membres vérifiés par niveau.', 'from-slate-600 to-slate-800', 892, 134, 60)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO prof_id FROM public.user_profiles LIMIT 1;
  IF prof_id IS NOT NULL THEN
    INSERT INTO public.club_topics (club_id, author_id, title)
    VALUES
      (club1_id, prof_id, 'Meilleures chaussures pour terrain mixte'),
      (club1_id, prof_id, 'Filtration eau en montagne'),
      (club1_id, prof_id, 'Bivouac légal en France'),
      (club4_id, prof_id, 'Conditions juillet 2026 — rapport hebdo'),
      (club4_id, prof_id, 'Refuge Ciottulu di i Mori complet ?'),
      (club5_id, prof_id, 'Route F35 praticable en juillet ?'),
      (club5_id, prof_id, 'Camping sauvage réglementation 2026')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Seed events
DO $$
DECLARE
  ev1_id UUID := gen_random_uuid();
  ev2_id UUID := gen_random_uuid();
  ev3_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.events (id, title, type, emoji, event_date, duration, location, country, max_participants, current_participants, description, cover_image, cover_alt, shared_kitty, kitty_goal, min_trust_to_organize, status)
  VALUES
    (ev1_id, 'Traversée GR10 Pyrénées — Section Centrale', 'rando', '🥾', '2026-08-15', '7 jours', 'Pyrénées, Cauterets → Gavarnie', 'France', 8, 5, 'Traversée de la section centrale du GR10 en 7 jours, de Cauterets à Gavarnie via le col de la Fache. Niveau intermédiaire, 15–20 km/jour, bivouac autorisé.', 'https://images.unsplash.com/photo-1649956688202-51e042251f27', 'Groupe de randonneurs sur crête pyrénéenne avec vue sur vallée verdoyante', 340, 480, 70, 'upcoming'),
    (ev2_id, 'Stage Bushcraft Forêt des Landes — 3 jours', 'bushcraft', '🪓', '2026-08-22', '3 jours', 'Forêt des Landes, Gironde', 'France', 6, 6, 'Stage intensif de 3 jours : construction d''abri naturel, feu par friction, filtration d''eau, plantes comestibles.', 'https://img.rocket.new/generatedImages/rocket_gen_img_1ebdde7a2-1783704681603.png', 'Feu de camp dans forêt avec participants autour apprenant techniques de survie', 180, 180, 70, 'full'),
    (ev3_id, 'Rassemblement Vanlife Bretagne — Finistère', 'vanlife', '🚐', '2026-08-29', '4 jours', 'Pointe du Raz, Finistère', 'France', 20, 12, 'Rassemblement vanlife sur la côte bretonne. Spot de nuit collectif, ateliers aménagement, partage de bons plans.', 'https://images.unsplash.com/photo-1637690244677-320c56d21de2', 'Vans aménagés garés en cercle sur falaise bretonne au coucher du soleil', 240, 400, 70, 'upcoming')
  ON CONFLICT (id) DO NOTHING;

  -- Seed event expenses
  INSERT INTO public.event_expenses (event_id, label, amount, paid)
  VALUES
    (ev1_id, 'Location réchaud groupe', 45, true),
    (ev1_id, 'Nourriture collective J1–J3', 120, true),
    (ev1_id, 'Nourriture collective J4–J7', 160, false),
    (ev1_id, 'Transport retour', 155, false),
    (ev2_id, 'Matériel pédagogique', 80, true),
    (ev2_id, 'Assurance groupe', 60, true),
    (ev2_id, 'Transport collectif', 40, true),
    (ev3_id, 'Repas collectifs (4 soirs)', 280, false),
    (ev3_id, 'Location sono/matériel', 120, false)
  ON CONFLICT DO NOTHING;
END $$;

-- Seed guides
INSERT INTO public.guides (slug, title, category, destination, read_time, difficulty, image, alt, excerpt, tags, featured)
VALUES
  ('preparer-trek-islande', 'Préparer son trek en Islande : guide complet', 'Destination', 'Islande', 12, 'Intermédiaire', 'https://img.rocket.new/generatedImages/rocket_gen_img_1ec6da3c0-1772248919073.png', 'Randonneur face à un paysage volcanique islandais avec aurores boréales en arrière-plan', 'Météo imprévisible, terrains volcaniques, midges en été — tout ce qu''il faut savoir pour réussir son trek en Islande sans mauvaise surprise.', ARRAY['Trek', 'Froid', 'Imperméable', 'Volcanique'], true),
  ('checklist-gr20-corse', 'Checklist GR20 : les 21 essentiels pour finir le sentier', 'Checklist', 'Corse', 8, 'Expert', 'https://img.rocket.new/generatedImages/rocket_gen_img_1a50e9500-1783675387427.png', 'Randonneur sur crête rocheuse du GR20 avec vue panoramique sur les montagnes corses', 'Le GR20 est l''un des sentiers les plus exigeants d''Europe. Cette checklist ultra-légère vous garantit de ne rien oublier d''essentiel.', ARRAY['Checklist', 'Ultra-léger', 'Montagne'], true),
  ('guide-everest-base-camp', 'Trek Everest Base Camp : altitude, acclimatation et équipement', 'Destination', 'Népal', 15, 'Expert', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa', 'Trek en haute altitude avec vue sur sommets enneigés de l''Himalaya et drapeaux de prières tibétains', 'Atteindre le camp de base de l''Everest à 5 364 m demande une préparation rigoureuse. Voici le guide complet pour y arriver en sécurité.', ARRAY['Haute altitude', 'Froid extrême', 'Acclimatation'], true),
  ('vanlife-europe-equipement', 'Vanlife en Europe : équiper son van pour 6 mois', 'Guide pratique', 'Europe', 10, 'Débutant', 'https://images.unsplash.com/photo-1675912739409-84ab21c16004', 'Van aménagé garé devant paysage montagneux au coucher du soleil avec équipement de camping visible', 'Cuisine, sommeil, énergie solaire, stockage — tout ce qu''il faut pour aménager son van et partir vivre sur la route en Europe.', ARRAY['Vanlife', 'Confort', 'Autonomie'], false),
  ('desert-maroc-sahara', 'Traversée du Sahara marocain : survie et confort en désert', 'Destination', 'Maroc', 9, 'Intermédiaire', 'https://images.unsplash.com/photo-1596382431850-471c7c99382d', 'Dunes de sable dorées du Sahara marocain au coucher du soleil avec silhouette de randonneur', 'Chaleur extrême le jour, froid la nuit, sable partout — le désert marocain exige un équipement spécifique et une hydratation irréprochable.', ARRAY['Désert', 'Chaleur', 'Hydratation'], false),
  ('checklist-voyage-photo', 'Checklist photographe voyageur : protéger et transporter son matériel', 'Checklist', 'Universel', 7, 'Débutant', 'https://images.unsplash.com/photo-1734902204925-4544ef4eb744', 'Photographe avec appareil reflex sur trépied devant paysage naturel spectaculaire au lever du soleil', 'Boîtier, objectifs, filtres, batteries, cartes mémoire — la checklist complète pour ne jamais rater une photo faute de matériel.', ARRAY['Photo', 'Protection', 'Léger'], false),
  ('choisir-sac-randonnee', 'Comment choisir son sac à dos de randonnée : guide 2026', 'Guide d''achat', 'Universel', 11, 'Débutant', 'https://images.unsplash.com/photo-1687755541812-15786d01a728', 'Sac à dos de randonnée rouge suspendu contre un mur de pierre, bretelles ergonomiques visibles', 'Volume, suspension, matière, poids — tout ce qu''il faut savoir pour choisir le sac parfait selon votre pratique et votre morphologie.', ARRAY['Équipement', 'Sac', 'Conseils'], false),
  ('tente-ultralight-comparatif', 'Tentes ultralight 2026 : comparatif des 8 meilleures options', 'Comparatif', 'Universel', 14, 'Intermédiaire', 'https://images.unsplash.com/photo-1571364588707-8638d6c49fea', 'Tente légère orange installée sur prairie alpine au coucher du soleil, montagnes en arrière-plan', 'Big Agnes, Nemo, MSR, Zpacks — on a comparé les 8 meilleures tentes ultralight du marché sur 12 critères. Voici notre verdict.', ARRAY['Tente', 'Ultra-léger', 'Comparatif'], false)
ON CONFLICT (slug) DO NOTHING;
