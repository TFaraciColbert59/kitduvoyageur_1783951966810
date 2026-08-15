-- ============================================================
-- SEED — Exemple de carnet ultra complet (GR20, Corse)
-- Carnet + trace GPS (carte fonctionnelle) + 9 jours + moments + kit
-- ============================================================

-- Tables utilisées par /carnets/[id] si absentes en environnement neuf
CREATE TABLE IF NOT EXISTS public.carnet_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet_id UUID REFERENCES public.carnets(id) ON DELETE CASCADE,
  jour_numero INTEGER DEFAULT 1,
  heure TEXT,
  citation TEXT,
  auteur_nom TEXT DEFAULT 'Randonneur',
  lieu TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.carnet_kit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet_id UUID REFERENCES public.carnets(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  detail TEXT DEFAULT '',
  poids_g INTEGER DEFAULT 0,
  couleur_tag TEXT DEFAULT '#33463C',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.carnet_moments
  ADD COLUMN IF NOT EXISTS moment_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manuel',
  ADD COLUMN IF NOT EXISTS hike_session_id UUID REFERENCES public.hike_sessions(id) ON DELETE SET NULL;

-- Reading public
ALTER TABLE public.carnet_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carnet_kit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seed_public_read_carnet_moments" ON public.carnet_moments;
CREATE POLICY "seed_public_read_carnet_moments" ON public.carnet_moments
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "seed_public_read_carnet_kit_items" ON public.carnet_kit_items;
CREATE POLICY "seed_public_read_carnet_kit_items" ON public.carnet_kit_items
  FOR SELECT TO public USING (true);

DO $$
DECLARE
  v_author_id UUID;
  v_carnet_id UUID := gen_random_uuid();
  v_hike_id UUID := gen_random_uuid();
  v_exists_auth BOOLEAN;
BEGIN
  SELECT id INTO v_author_id FROM public.user_profiles ORDER BY created_at LIMIT 1;

  IF v_author_id IS NULL THEN
    RAISE NOTICE 'Aucun profil utilisateur — carnet exemple non inséré.';
    RETURN;
  END IF;

  -- ── 1. CARNET ───────────────────────────────────────────────────────────
  INSERT INTO public.carnets (
    id, author_id, title, destination, description, cover_image, cover_image_alt,
    start_date, end_date, weather, route_rating, visibility, tags, is_collaborative,
    likes_count, comments_count, favorites_count, views_count, verified, created_at
  ) VALUES (
    v_carnet_id,
    v_author_id,
    'GR20 — la grande traversée corse',
    'Corse · Calenzana → Conca',
    'On a mis les pieds sur le GR20 un matin de septembre, le sac à 14 kg et l''esprit libre. '
    || 'Onze jours de crêtes, des refuges accrochés au vent, des lacs couleur émeraude et deux barbes qui poussent. '
    || 'C''est la plus belle ligne droite de nos vies.',
    'https://images.unsplash.com/photo-1504280387948-406560940733?q=80&w=2000&auto=format&fit=crop',
    'Crêtes du GR20 en Corse au lever du soleil',
    '2026-09-03', '2026-09-13', 'Grand bleu, orage isolé le J6, neige au Cirque de la Solitude le J8',
    9.3,
    'public',
    ARRAY['GR20','Corse','haute-montagne','refuges','autonomie','trek-sac-de-9-jours'],
    false,
    34, 12, 18, 412, true,
    now() - interval '14 days'
  );

  -- ── 2. SESSION HIKE (trace GPS → carte) ─────────────────────────────────
  SELECT EXISTS (SELECT 1 FROM auth.users LIMIT 1) INTO v_exists_auth;

  IF v_exists_auth THEN
    INSERT INTO public.hike_sessions (
      id, user_id, carnet_id, started_at, ended_at, distance_km, duration_seconds,
      elevation_gain_m, positions_geojson, poi_events, narratives, created_at
    ) VALUES (
      v_hike_id,
      (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
      v_carnet_id,
      '2026-09-03T07:15:00Z',
      '2026-09-13T17:40:00Z',
      167.4,
      406800, -- ≈ 113 heures de marche
      9610,
      '{
        "type":"Feature",
        "geometry":{
          "type":"LineString",
          "coordinates":[
            [6.8700,45.9200,0],[6.8000,45.9000,0],[6.7300,45.8300,0],[6.6800,45.7500,0],
            [6.6900,45.7200,0],[6.7200,45.7100,0],[6.7700,45.7000,0],[6.8300,45.6900,0],
            [6.8900,45.6800,0],[6.9500,45.7000,0],[7.0100,45.7200,0],[7.0600,45.7400,0],
            [7.0800,45.7700,0],[7.0600,45.8000,0],[7.0400,45.8300,0],[7.0300,45.8600,0],
            [7.0400,45.8800,0],[7.0500,45.9000,0],[7.1200,45.9400,0],[7.1800,45.9800,0],
            [7.1600,46.0200,0],[7.0800,46.0500,0],[6.9800,46.0800,0],[6.9000,46.0900,0],
            [6.8200,46.0700,0],[6.7400,46.0400,0],[6.7000,46.0100,0],[6.7000,45.9700,0],
            [6.7400,45.9500,0],[6.8100,45.9300,0],[6.8700,45.9200,0]
          ]
        }
      }'::jsonb,
      '[
        {"label":"Départ du parking de Calenzana","lat":42.5103,"lng":8.8554,"day":1},
        {"label":"Refuge de l''Ortu di u Piobbu","lat":42.4067,"lng":8.7488,"day":1},
        {"label":"Cirque de la Solitude","lat":42.1698,"lng":9.0101,"day":8}
      ]'::jsonb,
      '{"summary":"Récit généré après la session GR20."}'::jsonb,
      now()
    );
  ELSE
    v_hike_id := NULL;
    RAISE NOTICE 'Aucun compte auth — trace GPS non insérée, carte masquée.';
  END IF;

  -- ── 3. MOMENTS (9 jours) ────────────────────────────────────────────────
  INSERT INTO public.carnet_moments (
    carnet_id, jour_numero, heure, citation, auteur_nom, lieu, source, hike_session_id
  ) VALUES
    (v_carnet_id, 1, '08:30', 'Le sentier s''enfonce direct dans le maquis. Déjà les pieds vibrent.', 'Léna', 'Calenzana → Ortu di u Piobbu', 'manuel', v_hike_id),
    (v_carnet_id, 1, '18:00', 'Refuge posé au-dessus des nuages. Premier coucher de soleil sur la mer.', 'Marc', 'Ortu di u Piobbu', 'manuel', v_hike_id),
    (v_carnet_id, 2, '09:10', 'Les yeux ne savent plus où regarder : mer d''un côté, dent de roche de l''autre.', 'Léna', 'Ortu di u Piobbu → Piedra Mala', 'manuel', v_hike_id),
    (v_carnet_id, 2, '16:30', 'L''eau du torrent est glacée. On remplit les gourdes, on rigole.', 'Marc', 'Caracutu', 'manuel', v_hike_id),
    (v_carnet_id, 3, '07:50', 'Le monte Rinosu au petit matin, une larme de lumière.', 'Léna', 'Caracutu → Manganu', 'manuel', v_hike_id),
    (v_carnet_id, 3, '19:20', 'Lac de Manganu à la lampe frontale. Les étoiles dansent.', 'Marc', 'Lac de Manganu', 'manuel', v_hike_id),
    (v_carnet_id, 4, '10:40', 'Déferlante de granit. On progresse comme des alpinistes, sans corde.', 'Léna', 'Sauvegarde du Manganu', 'manuel', v_hike_id),
    (v_carnet_id, 4, '14:15', 'La bergerie est un mirage. Pastis de bienvenue avant l''orage.', 'Marc', 'Capanelle', 'manuel', v_hike_id),
    (v_carnet_id, 5, '08:00', 'On traverse des forêts de pins laricio qui sentent le miel.', 'Léna', 'Capanelle → Vizzavona', 'manuel', v_hike_id),
    (v_carnet_id, 5, '17:30', 'Longue redescente vers la gare de Vizzavona. Un train siffle au loin.', 'Marc', 'Vizzavona', 'manuel', v_hike_id),
    (v_carnet_id, 6, '06:45', 'Orage la nuit passée. La roche luisante transforme chaque pas en prière.', 'Léna', 'Vizzavona → Monte d''Oro', 'manuel', v_hike_id),
    (v_carnet_id, 6, '16:00', 'Au refuge de Petra Piana, on fête la moitié du chemin au fromage.', 'Marc', 'Petra Piana', 'manuel', v_hike_id),
    (v_carnet_id, 7, '09:30', 'Les lacs de la grande montagne : un bleu que les mots n''épuisent pas.', 'Léna', 'lacs d''Orestello et Capitello', 'manuel', v_hike_id),
    (v_carnet_id, 7, '13:00', 'Agnone : épaule du GR20. On s''allonge, on boit, on se tait.', 'Marc', 'Col d''Agnone', 'manuel', v_hike_id),
    (v_carnet_id, 8, '08:20', 'Le Cirque de la Solitude. On se regarde : « on fait ça ensemble, ok ? »', 'Léna', 'Cirque de la Solitude', 'manuel', v_hike_id),
    (v_carnet_id, 8, '15:45', 'Chevaux sauvages au lac de Nino. Le corps a oublié le bruit de la ville.', 'Marc', 'Lac de Nino', 'manuel', v_hike_id),
    (v_carnet_id, 9, '07:00', 'L''aiguille de Bavella semble sculptée par le soleil.', 'Léna', 'Bavella', 'manuel', v_hike_id),
    (v_carnet_id, 9, '12:30', 'La mer encore. On descend vers Conca avec des jambes de caoutchouc.', 'Marc', 'Conca', 'manuel', v_hike_id);

  -- ── 4. KIT (inventaire souvenir pondéré) ────────────────────────────────
  INSERT INTO public.carnet_kit_items (carnet_id, nom, detail, poids_g, couleur_tag, sort_order) VALUES
    (v_carnet_id, 'Sac 52L Osprey Exos', '37 g de confort par litre', 1180, '#2D6B4A', 1),
    (v_carnet_id, 'Tente MSR Hubba NX', 'Deux places, 3 saisons', 1620, '#2D6B4A', 2),
    (v_carnet_id, 'Duvent de randonnée Padded', 'Imper-respirant, capuche rando', 480, '#4A5568', 3),
    (v_carnet_id, 'Réchaud MSR PocketRocket 2', 'Gaz isobutane compris', 340, '#D97746', 4),
    (v_carnet_id, 'Marmite Titane 1L Toaks', 'Légèreté absolue', 115, '#B0AFA8', 5),
    (v_carnet_id, 'Filtre à eau Sawyer Mini', 'Flux 0,3 L/min', 85, '#3B82C4', 6),
    (v_carnet_id, 'Trousse de secours complète', 'Pansements, antalgiques, compeed', 620, '#C4543B', 7),
    (v_carnet_id, 'Sacs étanches 3 × 13L', 'Organisation du paquetage', 300, '#7C8B5E', 8),
    (v_carnet_id, 'Chaussures GTX High', 'Semelle Vibram, reprise en 1.2 kg', 1250, '#7B5A2E', 9),
    (v_carnet_id, 'Polaire en laine légère', 'Garde un parfum d''incendie', 230, '#5C6B5E', 10),
    (v_carnet_id, 'Frontale 450 lm rec', '12 h en mode 100 lm', 92, '#3A63B2', 11),
    (v_carnet_id, 'Gourde filtrante 650 mL', 'Pour les gués douteux', 177, '#2D6B4A', 12),
    (v_carnet_id, 'Rations lyophilisées × 9', 'Environ 600 kcal/sachet', 980, '#D97746', 13),
    (v_carnet_id, 'Bâtons de marche carbone', 'Paire en crochets', 540, '#4A5568', 14);

  RAISE NOTICE 'Carnet exemple créé : %', v_carnet_id;
END $$;