-- Migration: Add missing carnets columns, related tables, seed data, and fix clubs type
-- Timestamp: 20260713230000

-- ─── 1. Add missing columns to carnets ────────────────────────────────────────
ALTER TABLE public.carnets
  ADD COLUMN IF NOT EXISTS map_points JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_collaborative BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS favorites_count INTEGER DEFAULT 0;

-- ─── 2. Create carnet_likes table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.carnet_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet_id UUID REFERENCES public.carnets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reaction TEXT DEFAULT 'useful',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(carnet_id, user_id)
);

ALTER TABLE public.carnet_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_carnet_likes" ON public.carnet_likes;
CREATE POLICY "public_read_carnet_likes" ON public.carnet_likes
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "users_manage_own_carnet_likes" ON public.carnet_likes;
CREATE POLICY "users_manage_own_carnet_likes" ON public.carnet_likes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 3. Create carnet_favorites table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.carnet_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet_id UUID REFERENCES public.carnets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(carnet_id, user_id)
);

ALTER TABLE public.carnet_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_carnet_favorites" ON public.carnet_favorites;
CREATE POLICY "public_read_carnet_favorites" ON public.carnet_favorites
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "users_manage_own_carnet_favorites" ON public.carnet_favorites;
CREATE POLICY "users_manage_own_carnet_favorites" ON public.carnet_favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 4. Create carnet_comments table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.carnet_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet_id UUID REFERENCES public.carnets(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.carnet_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_carnet_comments" ON public.carnet_comments;
CREATE POLICY "public_read_carnet_comments" ON public.carnet_comments
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "users_manage_own_carnet_comments" ON public.carnet_comments;
CREATE POLICY "users_manage_own_carnet_comments" ON public.carnet_comments
  FOR ALL TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- ─── 5. RLS for carnets (public read) ─────────────────────────────────────────
ALTER TABLE public.carnets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_carnets" ON public.carnets;
CREATE POLICY "public_read_carnets" ON public.carnets
  FOR SELECT TO public USING (visibility = 'public');

DROP POLICY IF EXISTS "users_manage_own_carnets" ON public.carnets;
CREATE POLICY "users_manage_own_carnets" ON public.carnets
  FOR ALL TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- ─── 6. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_carnets_author_id ON public.carnets(author_id);
CREATE INDEX IF NOT EXISTS idx_carnets_visibility ON public.carnets(visibility);
CREATE INDEX IF NOT EXISTS idx_carnet_likes_carnet_id ON public.carnet_likes(carnet_id);
CREATE INDEX IF NOT EXISTS idx_carnet_favorites_carnet_id ON public.carnet_favorites(carnet_id);
CREATE INDEX IF NOT EXISTS idx_carnet_comments_carnet_id ON public.carnet_comments(carnet_id);

-- ─── 7. Seed carnets data ─────────────────────────────────────────────────────
DO $$
DECLARE
  existing_user_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

    IF existing_user_id IS NOT NULL THEN
      INSERT INTO public.carnets (
        id, author_id, title, destination, description, cover_image, cover_image_alt,
        start_date, end_date, weather, route_rating, visibility, tags,
        map_points, is_collaborative, likes_count, comments_count, favorites_count,
        views_count, verified
      ) VALUES
      (
        gen_random_uuid(), existing_user_id,
        'Circuit des Annapurnas — 18 jours',
        'Népal',
        'Un trek exceptionnel autour du massif des Annapurnas. Nous avons traversé des villages sherpa authentiques, franchi le col de Thorong La à 5416m et découvert des paysages à couper le souffle. La météo était capricieuse mais les conditions globalement favorables.',
        'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800',
        'Vue panoramique sur les Annapurnas enneigées au lever du soleil',
        '2025-10-01', '2025-10-18',
        'Ensoleillé J1-J8, tempête de neige J9-J10, beau temps J11-J18',
        9.2, 'public',
        ARRAY['himalaya', 'trekking', 'altitude', 'népal'],
        '[{"lat": 28.5971, "lng": 83.8209, "label": "Pokhara", "day": 1}, {"lat": 28.7395, "lng": 83.9706, "label": "Manang", "day": 8}, {"lat": 28.7967, "lng": 83.9306, "label": "Col Thorong La 5416m", "day": 11}]'::jsonb,
        false, 47, 12, 23, 1240, true
      ),
      (
        gen_random_uuid(), existing_user_id,
        'GR20 Corse — La diagonale des fous',
        'Corse, France',
        'Le GR20 est considéré comme l''un des sentiers de grande randonnée les plus difficiles d''Europe. 180km de sentiers sauvages à travers les montagnes corses. Chaque étape est un défi physique et mental. Les refuges du parc naturel régional offrent un accueil chaleureux.',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        'Sentier rocheux du GR20 avec vue sur les crêtes corses',
        '2025-07-10', '2025-07-25',
        'Chaleur intense J1-J5, orages J6, idéal J7-J15',
        8.7, 'public',
        ARRAY['gr20', 'corse', 'randonnée', 'montagne'],
        '[{"lat": 42.5897, "lng": 8.9003, "label": "Calenzana - Départ", "day": 1}, {"lat": 42.1167, "lng": 9.1833, "label": "Vizzavona - Mi-parcours", "day": 8}, {"lat": 41.6833, "lng": 9.2167, "label": "Conca - Arrivée", "day": 15}]'::jsonb,
        false, 31, 8, 15, 890, true
      ),
      (
        gen_random_uuid(), existing_user_id,
        'Tour du Mont-Blanc — 11 jours',
        'France, Italie, Suisse',
        'Le TMB est le tour mythique autour du plus haut sommet des Alpes. 170km traversant trois pays avec des panoramas incroyables sur le massif du Mont-Blanc. Les refuges alpins offrent une hospitalité incomparable après de longues journées de marche.',
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        'Vue sur le Mont-Blanc depuis le col du Bonhomme',
        '2025-08-05', '2025-08-15',
        'Beau temps tout le séjour, quelques nuages en altitude',
        9.5, 'public',
        ARRAY['tmb', 'alpes', 'montagne', 'multi-pays'],
        '[{"lat": 45.9237, "lng": 6.8694, "label": "Les Houches - Départ", "day": 1}, {"lat": 45.7969, "lng": 6.9694, "label": "Courmayeur - Italie", "day": 4}, {"lat": 46.0667, "lng": 7.0333, "label": "Champex - Suisse", "day": 8}]'::jsonb,
        true, 62, 19, 38, 2100, true
      ),
      (
        gen_random_uuid(), existing_user_id,
        'Islande — Traversée des Hautes Terres',
        'Islande',
        'Une aventure de 14 jours à travers les hautes terres islandaises. Geysers, volcans, glaciers et aurores boréales au programme. Le Laugavegur Trail reste l''une des plus belles randonnées au monde. Équipement imperméable indispensable !',
        'https://images.unsplash.com/photo-1531168556467-80aace0d0144?w=800',
        'Paysage volcanique islandais avec vapeurs géothermiques',
        '2025-09-01', '2025-09-14',
        'Vent fort et pluie J1-J3, aurores boréales J4, beau J5-J14',
        8.9, 'public',
        ARRAY['islande', 'volcans', 'aurores', 'laugavegur'],
        '[{"lat": 63.9833, "lng": -19.0667, "label": "Landmannalaugar - Départ", "day": 1}, {"lat": 63.6833, "lng": -19.0167, "label": "Emstrur", "day": 3}, {"lat": 63.5333, "lng": -19.5167, "label": "Thorsmork - Arrivée", "day": 4}]'::jsonb,
        false, 55, 14, 29, 1680, false
      )
      ON CONFLICT (id) DO NOTHING;
    ELSE
      RAISE NOTICE 'No users found in user_profiles, skipping carnets seed data';
    END IF;
  ELSE
    RAISE NOTICE 'Table user_profiles does not exist';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Carnets seed failed: %', SQLERRM;
END $$;

-- ─── 8. Fix clubs type column (normalize accented values) ─────────────────────
-- The clubs table stores 'activite' but the app filters by 'activite' and 'pays'
-- Ensure existing data uses consistent values
DO $$
BEGIN
  -- Update any clubs with type 'activité' (with accent) to 'activite' (without)
  UPDATE public.clubs SET type = 'activite' WHERE type = 'activité';
  -- Update any clubs with type 'destination' to 'pays'
  UPDATE public.clubs SET type = 'pays' WHERE type = 'destination';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Clubs type fix failed: %', SQLERRM;
END $$;

-- ─── 9. Seed clubs data if empty ──────────────────────────────────────────────
DO $$
DECLARE
  existing_user_id UUID;
  club_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO club_count FROM public.clubs;

  IF club_count < 3 THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'user_profiles'
    ) THEN
      SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

      IF existing_user_id IS NOT NULL THEN
        INSERT INTO public.clubs (
          id, slug, name, type, emoji, description, cover_color, cover_image,
          category, rules, privacy, members_count, active_this_month, is_verified, created_by
        ) VALUES
        (
          gen_random_uuid(), 'club-himalaya-trekkers', 'Himalaya Trekkers',
          'activite', '🏔️',
          'Communauté de passionnés de trekking en Himalaya. Partagez vos expériences, conseils et photos de vos aventures en altitude.',
          'from-blue-600 to-indigo-700', '',
          'Trekking', 'Respectez les autres membres. Partagez des informations vérifiées. Aidez les débutants.',
          'open', 847, 124, true, existing_user_id
        ),
        (
          gen_random_uuid(), 'club-ultra-light', 'Ultra Light Hiking',
          'activite', '⚖️',
          'Le club des randonneurs minimalistes. Optimisation du poids du sac, matériel ultraléger, techniques de bivouac. Objectif : moins de 7kg pour une semaine en autonomie.',
          'from-emerald-600 to-teal-700', '',
          'Randonnée', 'Partagez vos pesées et astuces. Pas de pub. Entraide obligatoire.',
          'open', 423, 67, false, existing_user_id
        ),
        (
          gen_random_uuid(), 'club-islande-explorateurs', 'Islande Explorateurs',
          'pays', '🌋',
          'Tout sur l''Islande : randonnée, aurores boréales, road trip, camping sauvage. La communauté francophone de référence pour explorer l''île de feu et de glace.',
          'from-cyan-600 to-blue-700', '',
          'Islande', 'Informations pratiques uniquement. Pas de spam. Aidez les nouveaux voyageurs.',
          'open', 612, 89, true, existing_user_id
        ),
        (
          gen_random_uuid(), 'club-alpinisme-france', 'Alpinisme France',
          'activite', '🧗',
          'Club dédié à l''alpinisme en France et dans les Alpes. Courses en haute montagne, escalade, ski de randonnée. Tous niveaux bienvenus.',
          'from-stone-600 to-stone-800', '',
          'Alpinisme', 'Sécurité avant tout. Partagez vos retours d''expérience. Respectez la montagne.',
          'closed', 289, 45, false, existing_user_id
        )
        ON CONFLICT (slug) DO NOTHING;
      ELSE
        RAISE NOTICE 'No users found, skipping clubs seed data';
      END IF;
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Clubs seed failed: %', SQLERRM;
END $$;
