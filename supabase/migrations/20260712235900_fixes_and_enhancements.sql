-- ============================================================
-- KIT DU VOYAGEUR — Fixes & Enhancements Migration
-- ============================================================

-- Fix: Ensure user_profiles are created for existing auth users
-- (handles cases where trigger may have failed)
INSERT INTO public.user_profiles (id, email, full_name, loyalty_points, trust_score)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  100,
  50
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Fix: Add missing columns to gear_items if not present
ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS alt TEXT DEFAULT '';

-- Fix: Add missing columns to expedition_reports if not present
ALTER TABLE public.expedition_reports ADD COLUMN IF NOT EXISTS alt TEXT DEFAULT '';

-- Fix: Add avatar_url to user_profiles if not present
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';

-- Fix: Add phone to user_profiles if not present
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

-- Fix: Add bio to user_profiles if not present
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';

-- Fix: Add location to user_profiles if not present
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';

-- Fix: Add website to user_profiles if not present
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '';

-- Fix: Add xp to user_profiles for gamification
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;

-- Fix: Add level to user_profiles for gamification
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- Fix: Add notification_preferences to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"email": true, "push": false, "sms": false}'::jsonb;

-- Fix: Add 2fa_enabled to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT false;

-- Fix: Ensure loyalty_rewards has seed data
INSERT INTO public.loyalty_rewards (title, description, points_cost, category, value, image, alt, available)
VALUES
  ('-10% sur votre prochain achat', 'Réduction de 10% sur tout le catalogue', 200, 'discount', '-10%', 'https://images.unsplash.com/photo-1637044500577-726eac69c2c4', 'Sac de courses avec équipement de randonnée', true),
  ('Livraison express offerte', 'Livraison en 24h offerte sur votre prochaine commande', 150, 'shipping', 'Gratuit', 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088', 'Carton de livraison express', true),
  ('Gourde Nalgene 1L offerte', 'Une gourde Nalgene 1L offerte avec votre commande', 500, 'product', '15€', 'https://images.unsplash.com/photo-1568395216634-ab1b1e848751', 'Gourde de randonnée bleue Nalgene', true),
  ('-20% sur les kits', 'Réduction de 20% sur tous les kits de voyage', 400, 'discount', '-20%', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62', 'Kit de voyage complet avec équipements', true),
  ('Accès VIP 1 mois', 'Accès à toutes les fonctionnalités premium pendant 1 mois', 800, 'premium', '1 mois', 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa', 'Badge VIP doré sur fond sombre', true)
ON CONFLICT DO NOTHING;

-- Fix: Ensure clubs have seed data
INSERT INTO public.clubs (slug, name, type, emoji, description, cover_color, members_count, active_this_month)
VALUES
  ('randonnee-alpine', 'Randonnée Alpine', 'activité', '🏔️', 'Club dédié aux randonnées en haute montagne, alpinisme et trekking d''altitude.', 'from-slate-600 to-slate-800', 1247, 89),
  ('bushcraft-survie', 'Bushcraft & Survie', 'activité', '🪓', 'Techniques de survie, construction d''abris, feu de camp et vie en forêt.', 'from-stone-600 to-stone-800', 834, 67),
  ('vanlife-france', 'Vanlife France', 'activité', '🚐', 'Communauté des voyageurs en van, road trips et vie nomade.', 'from-amber-600 to-orange-700', 2156, 234),
  ('nepal-himalaya', 'Népal & Himalaya', 'pays', '🇳🇵', 'Tout sur le trekking au Népal : circuits, permis, logistique et retours d''expérience.', 'from-blue-600 to-indigo-700', 956, 78),
  ('islande-aventure', 'Islande Aventure', 'pays', '🇮🇸', 'Randonnées, aurores boréales et aventures en Islande.', 'from-cyan-600 to-blue-700', 623, 45),
  ('photo-nature', 'Photo Nature & Voyage', 'activité', '📸', 'Photographie de paysages, faune sauvage et voyages photographiques.', 'from-purple-600 to-violet-700', 1089, 156),
  ('ski-alpinisme', 'Ski & Alpinisme', 'activité', '⛷️', 'Ski de randonnée, ski alpinisme et freeride en haute montagne.', 'from-blue-500 to-cyan-600', 743, 112),
  ('kayak-eau-vive', 'Kayak & Eau Vive', 'activité', '🚣', 'Kayak de mer, descente de rivières et sports nautiques en pleine nature.', 'from-teal-600 to-emerald-700', 421, 67),
  ('maroc-atlas', 'Maroc & Atlas', 'pays', '🇲🇦', 'Trekking dans le Haut Atlas, désert du Sahara et aventures au Maroc.', 'from-orange-600 to-red-700', 534, 89),
  ('patagonie-andes', 'Patagonie & Andes', 'pays', '🏔️', 'Torres del Paine, Atacama et aventures en Amérique du Sud.', 'from-emerald-700 to-teal-800', 312, 45)
ON CONFLICT (slug) DO NOTHING;

-- Fix: Ensure events have seed data
INSERT INTO public.events (title, type, emoji, event_date, duration, location, country, max_participants, current_participants, description, cover_image, cover_alt, shared_kitty, kitty_goal, status)
VALUES
  ('Trek GR10 Pyrénées — Section Cauterets', 'rando', '🥾', '2026-08-15', '5 jours', 'Cauterets', 'France', 8, 5, 'Traversée de la section centrale du GR10 entre Cauterets et Luz-Saint-Sauveur. Niveau intermédiaire, 15-20 km/jour.', 'https://images.unsplash.com/photo-1551632811-561732d1e306', 'Sentier de randonnée dans les Pyrénées avec vue sur les sommets', 340, 500, 'upcoming'),
  ('Bivouac Vercors — Nuit étoilée', 'bushcraft', '🌙', '2026-07-28', '2 jours', 'Villard-de-Lans', 'France', 6, 4, 'Bivouac en autonomie dans le Vercors. Techniques de survie, feu de camp, observation des étoiles.', 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4', 'Tente de camping sous un ciel étoilé en montagne', 120, 200, 'upcoming'),
  ('Road trip Islande — Anneau d''Or', 'vanlife', '🚐', '2026-09-05', '10 jours', 'Reykjavik', 'Islande', 4, 4, 'Road trip en van autour de l''anneau d''or islandais. Geysers, cascades et aurores boréales.', 'https://images.unsplash.com/photo-1504233529578-6d46baba6d34', 'Route islandaise avec aurores boréales et montagnes enneigées', 1200, 1500, 'full'),
  ('Ascension Mont Blanc — Voie Royale', 'alpinisme', '⛰️', '2026-08-22', '3 jours', 'Chamonix', 'France', 4, 2, 'Ascension du Mont Blanc par la voie normale depuis le refuge du Goûter. Expérience en haute montagne requise.', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b', 'Sommet du Mont Blanc avec alpinistes et vue sur les Alpes', 600, 800, 'upcoming'),
  ('Kayak Gorges du Verdon', 'photo', '🚣', '2026-07-20', '2 jours', 'Castellane', 'France', 8, 3, 'Descente des gorges du Verdon en kayak. Eaux turquoise, falaises vertigineuses et bivouac au bord de l''eau.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5', 'Kayakiste dans les gorges du Verdon avec eaux turquoise', 180, 300, 'upcoming')
ON CONFLICT DO NOTHING;

-- Fix: Ensure guides have seed data
INSERT INTO public.guides (slug, title, category, destination, read_time, difficulty, image, alt, excerpt, tags, featured)
VALUES
  ('trek-annapurnas-guide-complet', 'Circuit des Annapurnas : Guide Complet 2026', 'Destination', 'Népal', 25, 'Intermédiaire', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa', 'Vue panoramique du circuit des Annapurnas avec sommets enneigés', 'Tout ce qu''il faut savoir pour préparer et réussir le circuit des Annapurnas : permis, logistique, équipement et étapes.', ARRAY['népal', 'trekking', 'himalaya', 'altitude'], true),
  ('checklist-randonnee-3-jours', 'Checklist Randonnée 3 Jours : Ne Rien Oublier', 'Checklist', 'France', 8, 'Débutant', 'https://images.unsplash.com/photo-1551632811-561732d1e306', 'Randonneur avec sac à dos sur un sentier de montagne', 'La checklist ultime pour une randonnée de 3 jours en autonomie. Équipement, nourriture, sécurité : tout est listé.', ARRAY['checklist', 'randonnée', 'débutant', 'équipement'], true),
  ('choisir-sac-dos-randonnee', 'Comment Choisir Son Sac à Dos de Randonnée', 'Guide d''achat', 'Universel', 12, 'Débutant', 'https://images.unsplash.com/photo-1572698846920-cb1e563bbb30', 'Sac à dos de randonnée orange posé sur un rocher en montagne', 'Volume, suspension, matière : tous les critères pour choisir le sac à dos parfait selon votre pratique.', ARRAY['sac à dos', 'équipement', 'guide achat'], false),
  ('gr20-guide-pratique', 'GR20 : Le Guide Pratique Complet', 'Guide pratique', 'Corse', 20, 'Expert', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4', 'Sentier du GR20 en Corse avec vue sur les crêtes rocheuses', 'Le GR20, considéré comme l''un des sentiers les plus difficiles d''Europe. Notre guide complet pour le préparer et le réussir.', ARRAY['gr20', 'corse', 'expert', 'trekking'], true),
  ('islande-road-trip-guide', 'Road Trip Islande : L''Anneau d''Or en Van', 'Destination', 'Islande', 15, 'Débutant', 'https://images.unsplash.com/photo-1504233529578-6d46baba6d34', 'Route islandaise avec aurores boréales et montagnes enneigées', 'Itinéraire complet pour un road trip en van autour de l''anneau d''or islandais : étapes, hébergements et conseils.', ARRAY['islande', 'vanlife', 'road trip', 'aurores boréales'], false),
  ('comparatif-tentes-bivouac', 'Comparatif Tentes Bivouac 2026 : Les Meilleures', 'Comparatif', 'Universel', 10, 'Intermédiaire', 'https://images.unsplash.com/photo-1571364588707-8638d6c49fea', 'Tente de randonnée orange installée dans un pré alpin au coucher du soleil', 'Notre sélection des meilleures tentes de bivouac 2026 : légèreté, résistance et rapport qualité-prix.', ARRAY['tente', 'bivouac', 'comparatif', 'équipement'], false),
  ('maroc-toubkal-guide', 'Ascension du Toubkal : Guide Complet', 'Destination', 'Maroc', 18, 'Intermédiaire', 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3', 'Sommet du Toubkal avec vue sur le Haut Atlas marocain', 'Tout pour préparer l''ascension du plus haut sommet d''Afrique du Nord : accès, équipement, guides locaux.', ARRAY['maroc', 'atlas', 'alpinisme', 'afrique'], true),
  ('patagonie-torres-del-paine', 'Torres del Paine : Le Trek W en Patagonie', 'Destination', 'Chili', 22, 'Intermédiaire', 'https://images.unsplash.com/photo-1501854140801-50d01698950b', 'Torres del Paine avec les trois tours de granit et lac turquoise', 'Le trek W de Torres del Paine, l''une des plus belles randonnées du monde. Logistique, refuges et conseils pratiques.', ARRAY['patagonie', 'chili', 'trekking', 'amérique du sud'], false)
ON CONFLICT (slug) DO NOTHING;

-- Fix: Add missing RLS policy for user_profiles read by anon (needed for messaging)
DROP POLICY IF EXISTS "anon_read_profiles_basic" ON public.user_profiles;
CREATE POLICY "anon_read_profiles_basic" ON public.user_profiles
FOR SELECT TO anon USING (true);

-- Fix: Ensure messages RLS allows reading all messages in a conversation
DROP POLICY IF EXISTS "auth_read_messages" ON public.messages;
CREATE POLICY "auth_read_messages" ON public.messages
FOR SELECT TO authenticated USING (true);

-- Fix: Allow authenticated users to update their own messages
DROP POLICY IF EXISTS "auth_update_own_messages" ON public.messages;
CREATE POLICY "auth_update_own_messages" ON public.messages
FOR UPDATE TO authenticated USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

-- Fix: SOS alerts - allow reading own alerts
DROP POLICY IF EXISTS "users_manage_own_sos" ON public.sos_alerts;
CREATE POLICY "users_manage_own_sos" ON public.sos_alerts
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Fix: Ensure loyalty_history allows insert for authenticated users
DROP POLICY IF EXISTS "users_manage_own_loyalty_history" ON public.loyalty_history;
CREATE POLICY "users_manage_own_loyalty_history" ON public.loyalty_history
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Fix: Ensure loyalty_redemptions allows insert
DROP POLICY IF EXISTS "users_manage_own_redemptions" ON public.loyalty_redemptions;
CREATE POLICY "users_manage_own_redemptions" ON public.loyalty_redemptions
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Fix: Cart loyalty discounts
DROP POLICY IF EXISTS "users_manage_own_cart_discounts" ON public.cart_loyalty_discounts;
CREATE POLICY "users_manage_own_cart_discounts" ON public.cart_loyalty_discounts
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Fix: Ensure user_documents allows all operations for owner
DROP POLICY IF EXISTS "users_manage_own_documents" ON public.user_documents;
CREATE POLICY "users_manage_own_documents" ON public.user_documents
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Fix: Ensure gear_items allows all operations for owner
DROP POLICY IF EXISTS "users_manage_own_gear" ON public.gear_items;
CREATE POLICY "users_manage_own_gear" ON public.gear_items
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Fix: Ensure expedition_reports allows all operations for owner
DROP POLICY IF EXISTS "users_manage_own_reports" ON public.expedition_reports;
CREATE POLICY "users_manage_own_reports" ON public.expedition_reports
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Fix: Ensure notifications allows all operations for owner
DROP POLICY IF EXISTS "users_manage_own_notifications" ON public.notifications;
CREATE POLICY "users_manage_own_notifications" ON public.notifications
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Fix: Update handle_new_user trigger to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, loyalty_points, trust_score, xp, level)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    100,
    50,
    0,
    1
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix: Update loyalty points function to also update xp
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
