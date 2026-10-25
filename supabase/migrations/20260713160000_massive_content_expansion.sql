-- ============================================================
-- MASSIVE CONTENT EXPANSION — Kit du Voyageur
-- Enrichissement maximal de toutes les tables
-- ============================================================

DO $$
DECLARE
  -- Nouveaux utilisateurs
  u13 UUID := gen_random_uuid();
  u14 UUID := gen_random_uuid();
  u15 UUID := gen_random_uuid();
  u16 UUID := gen_random_uuid();
  u17 UUID := gen_random_uuid();
  u18 UUID := gen_random_uuid();
  u19 UUID := gen_random_uuid();
  u20 UUID := gen_random_uuid();

  -- UUIDs carnets supplémentaires
  c9  UUID := gen_random_uuid();
  c10 UUID := gen_random_uuid();
  c11 UUID := gen_random_uuid();
  c12 UUID := gen_random_uuid();
  c13 UUID := gen_random_uuid();
  c14 UUID := gen_random_uuid();
  c15 UUID := gen_random_uuid();
  c16 UUID := gen_random_uuid();
  c17 UUID := gen_random_uuid();
  c18 UUID := gen_random_uuid();

  -- UUIDs clubs supplémentaires
  cl6  UUID := gen_random_uuid();
  cl7  UUID := gen_random_uuid();
  cl8  UUID := gen_random_uuid();
  cl9  UUID := gen_random_uuid();
  cl10 UUID := gen_random_uuid();
  cl11 UUID := gen_random_uuid();
  cl12 UUID := gen_random_uuid();

  -- UUIDs posts communauté supplémentaires
  p11 UUID := gen_random_uuid();
  p12 UUID := gen_random_uuid();
  p13 UUID := gen_random_uuid();
  p14 UUID := gen_random_uuid();
  p15 UUID := gen_random_uuid();
  p16 UUID := gen_random_uuid();
  p17 UUID := gen_random_uuid();
  p18 UUID := gen_random_uuid();
  p19 UUID := gen_random_uuid();
  p20 UUID := gen_random_uuid();
  p21 UUID := gen_random_uuid();
  p22 UUID := gen_random_uuid();
  p23 UUID := gen_random_uuid();
  p24 UUID := gen_random_uuid();
  p25 UUID := gen_random_uuid();
  p26 UUID := gen_random_uuid();
  p27 UUID := gen_random_uuid();
  p28 UUID := gen_random_uuid();
  p29 UUID := gen_random_uuid();
  p30 UUID := gen_random_uuid();

  -- UUIDs Q&R supplémentaires
  q6  UUID := gen_random_uuid();
  q7  UUID := gen_random_uuid();
  q8  UUID := gen_random_uuid();
  q9  UUID := gen_random_uuid();
  q10 UUID := gen_random_uuid();
  q11 UUID := gen_random_uuid();
  q12 UUID := gen_random_uuid();
  q13 UUID := gen_random_uuid();
  q14 UUID := gen_random_uuid();
  q15 UUID := gen_random_uuid();
  qa7  UUID := gen_random_uuid();
  qa8  UUID := gen_random_uuid();
  qa9  UUID := gen_random_uuid();
  qa10 UUID := gen_random_uuid();
  qa11 UUID := gen_random_uuid();
  qa12 UUID := gen_random_uuid();
  qa13 UUID := gen_random_uuid();
  qa14 UUID := gen_random_uuid();
  qa15 UUID := gen_random_uuid();
  qa16 UUID := gen_random_uuid();
  qa17 UUID := gen_random_uuid();
  qa18 UUID := gen_random_uuid();

  -- UUIDs AMA supplémentaires
  ama3 UUID := gen_random_uuid();
  ama4 UUID := gen_random_uuid();
  ama5 UUID := gen_random_uuid();
  ama6 UUID := gen_random_uuid();
  amaq5  UUID := gen_random_uuid();
  amaq6  UUID := gen_random_uuid();
  amaq7  UUID := gen_random_uuid();
  amaq8  UUID := gen_random_uuid();
  amaq9  UUID := gen_random_uuid();
  amaq10 UUID := gen_random_uuid();
  amaq11 UUID := gen_random_uuid();
  amaq12 UUID := gen_random_uuid();

  -- UUIDs occasion / enchères / location supplémentaires
  oc6  UUID := gen_random_uuid();
  oc7  UUID := gen_random_uuid();
  oc8  UUID := gen_random_uuid();
  oc9  UUID := gen_random_uuid();
  oc10 UUID := gen_random_uuid();
  oc11 UUID := gen_random_uuid();
  oc12 UUID := gen_random_uuid();
  oc13 UUID := gen_random_uuid();
  oc14 UUID := gen_random_uuid();
  oc15 UUID := gen_random_uuid();
  au4  UUID := gen_random_uuid();
  au5  UUID := gen_random_uuid();
  au6  UUID := gen_random_uuid();
  au7  UUID := gen_random_uuid();
  au8  UUID := gen_random_uuid();
  re5  UUID := gen_random_uuid();
  re6  UUID := gen_random_uuid();
  re7  UUID := gen_random_uuid();
  re8  UUID := gen_random_uuid();
  re9  UUID := gen_random_uuid();
  re10 UUID := gen_random_uuid();

  -- UUIDs topics clubs supplémentaires
  t7  UUID := gen_random_uuid();
  t8  UUID := gen_random_uuid();
  t9  UUID := gen_random_uuid();
  t10 UUID := gen_random_uuid();
  t11 UUID := gen_random_uuid();
  t12 UUID := gen_random_uuid();
  t13 UUID := gen_random_uuid();
  t14 UUID := gen_random_uuid();
  t15 UUID := gen_random_uuid();

  -- UUIDs events clubs supplémentaires
  ev4 UUID := gen_random_uuid();
  ev5 UUID := gen_random_uuid();
  ev6 UUID := gen_random_uuid();
  ev7 UUID := gen_random_uuid();
  ev8 UUID := gen_random_uuid();

  -- UUIDs challenges clubs supplémentaires
  ch4 UUID := gen_random_uuid();
  ch5 UUID := gen_random_uuid();
  ch6 UUID := gen_random_uuid();
  ch7 UUID := gen_random_uuid();

  -- Récupération des UUIDs existants
  u1_id UUID;
  u2_id UUID;
  u3_id UUID;
  u4_id UUID;
  u5_id UUID;
  u6_id UUID;
  u7_id UUID;
  u8_id UUID;
  u9_id UUID;
  u10_id UUID;
  u11_id UUID;
  u12_id UUID;
  cl1_id UUID;
  cl2_id UUID;
  cl3_id UUID;
  cl4_id UUID;
  cl5_id UUID;

BEGIN

  -- Récupération des utilisateurs existants
  SELECT id INTO u1_id FROM auth.users WHERE email = 'marie.dupont@email.fr' LIMIT 1;
  SELECT id INTO u2_id FROM auth.users WHERE email = 'thomas.martin@email.fr' LIMIT 1;
  SELECT id INTO u3_id FROM auth.users WHERE email = 'sophie.bernard@email.fr' LIMIT 1;
  SELECT id INTO u4_id FROM auth.users WHERE email = 'lucas.petit@email.fr' LIMIT 1;
  SELECT id INTO u5_id FROM auth.users WHERE email = 'camille.leroy@email.fr' LIMIT 1;
  SELECT id INTO u6_id FROM auth.users WHERE email = 'antoine.moreau@email.fr' LIMIT 1;
  SELECT id INTO u7_id FROM auth.users WHERE email = 'julie.simon@email.fr' LIMIT 1;
  SELECT id INTO u8_id FROM auth.users WHERE email = 'maxime.garcia@email.fr' LIMIT 1;
  SELECT id INTO u9_id FROM auth.users WHERE email = 'lea.roux@email.fr' LIMIT 1;
  SELECT id INTO u10_id FROM auth.users WHERE email = 'nicolas.blanc@email.fr' LIMIT 1;
  SELECT id INTO u11_id FROM auth.users WHERE email = 'emma.henry@email.fr' LIMIT 1;
  SELECT id INTO u12_id FROM auth.users WHERE email = 'pierre.lambert@email.fr' LIMIT 1;
  SELECT id INTO cl1_id FROM public.clubs WHERE slug = 'trekkeurs-alpes' LIMIT 1;
  SELECT id INTO cl2_id FROM public.clubs WHERE slug = 'bikepacking-france' LIMIT 1;
  SELECT id INTO cl3_id FROM public.clubs WHERE slug = 'kayak-mer-atlantique' LIMIT 1;
  SELECT id INTO cl4_id FROM public.clubs WHERE slug = 'ultra-trail-runners' LIMIT 1;
  SELECT id INTO cl5_id FROM public.clubs WHERE slug = 'voyageurs-maroc' LIMIT 1;

  -- ============================================================
  -- 1. NOUVEAUX UTILISATEURS
  -- ============================================================
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (u13, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'clara.fontaine@email.fr', crypt('Patagonie2024!', gen_salt('bf', 10)), now() - interval '200 days', now() - interval '200 days', now(),
     jsonb_build_object('full_name', 'Clara Fontaine', 'avatar_url', 'https://i.pravatar.cc/150?img=13'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u14, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'hugo.renard@email.fr', crypt('Himalaya2024!', gen_salt('bf', 10)), now() - interval '170 days', now() - interval '170 days', now(),
     jsonb_build_object('full_name', 'Hugo Renard', 'avatar_url', 'https://i.pravatar.cc/150?img=14'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u15, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ines.chevalier@email.fr', crypt('Islande2024!', gen_salt('bf', 10)), now() - interval '140 days', now() - interval '140 days', now(),
     jsonb_build_object('full_name', 'Inès Chevalier', 'avatar_url', 'https://i.pravatar.cc/150?img=15'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u16, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'romain.leblanc@email.fr', crypt('Corse2024!', gen_salt('bf', 10)), now() - interval '110 days', now() - interval '110 days', now(),
     jsonb_build_object('full_name', 'Romain Leblanc', 'avatar_url', 'https://i.pravatar.cc/150?img=16'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u17, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'alice.perrin@email.fr', crypt('Vanlife2024!', gen_salt('bf', 10)), now() - interval '85 days', now() - interval '85 days', now(),
     jsonb_build_object('full_name', 'Alice Perrin', 'avatar_url', 'https://i.pravatar.cc/150?img=17'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u18, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'felix.dumont@email.fr', crypt('Escalade2024!', gen_salt('bf', 10)), now() - interval '65 days', now() - interval '65 days', now(),
     jsonb_build_object('full_name', 'Félix Dumont', 'avatar_url', 'https://i.pravatar.cc/150?img=18'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u19, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'manon.girard@email.fr', crypt('Trail2024!', gen_salt('bf', 10)), now() - interval '40 days', now() - interval '40 days', now(),
     jsonb_build_object('full_name', 'Manon Girard', 'avatar_url', 'https://i.pravatar.cc/150?img=19'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u20, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'theo.marceau@email.fr', crypt('Plongee2024!', gen_salt('bf', 10)), now() - interval '22 days', now() - interval '22 days', now(),
     jsonb_build_object('full_name', 'Théo Marceau', 'avatar_url', 'https://i.pravatar.cc/150?img=20'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.user_profiles SET trust_score = 95, loyalty_points = 5200, loyalty_level = 'Explorateur Elite', created_at = now() - interval '200 days' WHERE id = u13;
  UPDATE public.user_profiles SET trust_score = 91, loyalty_points = 4100, loyalty_level = 'Explorateur Elite', created_at = now() - interval '170 days' WHERE id = u14;
  UPDATE public.user_profiles SET trust_score = 87, loyalty_points = 3200, loyalty_level = 'Aventurier', created_at = now() - interval '140 days' WHERE id = u15;
  UPDATE public.user_profiles SET trust_score = 82, loyalty_points = 2600, loyalty_level = 'Aventurier', created_at = now() - interval '110 days' WHERE id = u16;
  UPDATE public.user_profiles SET trust_score = 76, loyalty_points = 1800, loyalty_level = 'Explorateur', created_at = now() - interval '85 days' WHERE id = u17;
  UPDATE public.user_profiles SET trust_score = 71, loyalty_points = 1100, loyalty_level = 'Explorateur', created_at = now() - interval '65 days' WHERE id = u18;
  UPDATE public.user_profiles SET trust_score = 63, loyalty_points = 650, loyalty_level = 'Découvreur', created_at = now() - interval '40 days' WHERE id = u19;
  UPDATE public.user_profiles SET trust_score = 57, loyalty_points = 290, loyalty_level = 'Novice', created_at = now() - interval '22 days' WHERE id = u20;

  -- ============================================================
  -- 2. PRODUITS SUPPLÉMENTAIRES (40+ nouveaux)
  -- ============================================================
  INSERT INTO public.products (slug, name, brand, category, activity, weight_g, price_eur, stock, image, image_alt, badge, description, featured)
  VALUES
    -- Sacs
    ('deuter-aircontact-65', 'Deuter Aircontact Lite 65+10', 'Deuter', 'Sacs', ARRAY['Randonnée', 'Trekking', 'Camping'], 1800, 219, 15, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62', 'Sac à dos de randonnée Deuter bleu avec système de ventilation dorsal', 'Confort', 'Le sac à dos idéal pour les treks de plusieurs jours. Système de suspension VariFlex pour un confort optimal.', false),
    ('gregory-baltoro-75', 'Gregory Baltoro 75 L', 'Gregory', 'Sacs', ARRAY['Trekking', 'Alpinisme', 'Expédition'], 2100, 299, 8, 'https://images.unsplash.com/photo-1687755541812-15786d01a728', 'Sac à dos d''expédition Gregory vert avec armature rigide et ceinture ventrale large', 'Expédition', 'Le sac de référence pour les expéditions longues. Capacité de chargement exceptionnelle avec confort maintenu.', false),
    ('hyperlite-3400', 'Hyperlite Mountain Gear 3400 SW', 'Hyperlite', 'Sacs', ARRAY['Randonnée', 'Trekking'], 510, 325, 4, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62', 'Sac à dos ultralight blanc en Dyneema avec structure minimaliste', 'Ultra-léger', 'Le sac ultralight par excellence. Dyneema imperméable, 510g seulement. Pour les puristes du gramme.', true),
    ('osprey-talon-22', 'Osprey Talon 22 L', 'Osprey', 'Sacs', ARRAY['Trail', 'Randonnée', 'Vélo'], 680, 119, 20, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62', 'Sac à dos de trail Osprey orange avec poche hydratation et bretelles ergonomiques', '', 'Sac polyvalent pour les sorties d''une journée. Parfait pour le trail running et les randonnées techniques.', false),
    -- Tentes
    ('hilleberg-nallo-2', 'Hilleberg Nallo 2 GT', 'Hilleberg', 'Tentes', ARRAY['Camping', 'Alpinisme', 'Trekking'], 2100, 749, 3, 'https://images.unsplash.com/photo-1571364588707-8638d6c49fea', 'Tente Hilleberg rouge montée dans un paysage arctique enneigé avec aurores boréales', 'Arctique', 'La tente 4 saisons de référence. Résiste aux vents violents et aux tempêtes de neige. Investissement pour la vie.', true),
    ('naturehike-cloud-up-2', 'Naturehike Cloud-Up 2', 'Naturehike', 'Tentes', ARRAY['Camping', 'Randonnée', 'Trekking'], 1290, 189, 25, 'https://images.unsplash.com/photo-1571364588707-8638d6c49fea', 'Tente légère verte Naturehike montée dans une prairie alpine au coucher du soleil', 'Rapport qualité/prix', 'Le meilleur rapport qualité/prix du marché. Légère, imperméable, facile à monter. Idéale pour débuter.', false),
    ('msr-hubba-nx-2', 'MSR Hubba Hubba NX 2P', 'MSR', 'Tentes', ARRAY['Camping', 'Randonnée', 'Trekking'], 1720, 499, 7, 'https://images.unsplash.com/photo-1571364588707-8638d6c49fea', 'Tente MSR orange montée sur terrain rocheux avec vue sur montagne', 'Best-seller', 'La tente 2 places la plus populaire. Légère, spacieuse, imperméable. Le choix de milliers de randonneurs.', true),
    ('tarptent-protrail', 'Tarptent ProTrail Li', 'Tarptent', 'Tentes', ARRAY['Trail', 'Randonnée'], 390, 279, 6, 'https://images.unsplash.com/photo-1571364588707-8638d6c49fea', 'Tente ultralight Tarptent verte tendue avec bâtons de randonnée dans une forêt', 'Ultra-léger', 'La tente la plus légère du marché pour une personne. 390g seulement. Pour les ultralight hikers.', false),
    -- Vêtements
    ('mammut-nordwand-jacket', 'Mammut Nordwand Pro HS Hooded', 'Mammut', 'Vêtements', ARRAY['Alpinisme', 'Ski', 'Randonnée'], 380, 450, 5, 'https://images.unsplash.com/photo-1618143928355-3d9afff6ec23', 'Veste hardshell Mammut noire portée par alpiniste sur arête rocheuse enneigée', 'Alpinisme', 'La veste des alpinistes professionnels. Gore-Tex Pro 3 couches, coupe technique, résistance maximale.', false),
    ('rab-microlight-alpine', 'Rab Microlight Alpine Down Jacket', 'Rab', 'Vêtements', ARRAY['Alpinisme', 'Randonnée', 'Camping'], 340, 280, 9, 'https://images.unsplash.com/photo-1613237875420-a4c416b1767a', 'Doudoune légère Rab bleue compressée dans sa poche de rangement', 'Duvet', 'Doudoune duvet 750 cuin. Légère, chaude, compressible. Idéale comme couche intermédiaire en montagne.', false),
    ('salewa-ortles-jacket', 'Salewa Ortles Hybrid TW Jacket', 'Salewa', 'Vêtements', ARRAY['Alpinisme', 'Ski', 'Randonnée'], 420, 320, 6, 'https://images.unsplash.com/photo-1618143928355-3d9afff6ec23', 'Veste hybride Salewa rouge avec panneaux softshell et insulation synthétique', '', 'Veste hybride polyvalente. Softshell sur les zones mobiles, isolation sur le corps. Parfaite pour l''alpinisme.', false),
    ('icebreaker-200-oasis', 'Icebreaker 200 Oasis Crew', 'Icebreaker', 'Vêtements', ARRAY['Randonnée', 'Trekking', 'Camping'], 145, 85, 30, 'https://images.unsplash.com/photo-1618143928355-3d9afff6ec23', 'T-shirt en laine mérinos Icebreaker gris sur fond blanc', 'Mérinos', 'Le t-shirt de base en laine mérinos. Thermorégulant, anti-odeur, confortable. Indispensable pour tout voyage.', false),
    ('buff-merino-wool', 'Buff Merino Wool Lightweight', 'Buff', 'Vêtements', ARRAY['Randonnée', 'Trail', 'Ski'], 35, 28, 50, 'https://images.unsplash.com/photo-1618143928355-3d9afff6ec23', 'Tour de cou Buff en laine mérinos gris porté par randonneur en montagne', '', 'Le tour de cou multifonction en laine mérinos. Cagoule, bandeau, écharpe... 12 façons de le porter.', false),
    -- Chaussures
    ('hoka-speedgoat-5', 'Hoka Speedgoat 5', 'Hoka', 'Chaussures', ARRAY['Trail', 'Randonnée'], 290, 155, 18, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff', 'Chaussures de trail Hoka bleues avec semelle Vibram Megagrip sur fond blanc', 'Trail', 'La chaussure de trail la plus populaire. Amorti maximal, accroche Vibram, légèreté. Pour tous les terrains.', true),
    ('scarpa-ribelle-run', 'Scarpa Ribelle Run', 'Scarpa', 'Chaussures', ARRAY['Trail', 'Alpinisme léger'], 280, 175, 10, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff', 'Chaussures de trail Scarpa orange avec semelle crantée sur terrain rocheux', '', 'La chaussure pour les terrains techniques. Légère, précise, avec une accroche exceptionnelle sur rocher.', false),
    ('la-sportiva-tx5', 'La Sportiva TX5 GTX', 'La Sportiva', 'Chaussures', ARRAY['Randonnée', 'Alpinisme léger', 'Via ferrata'], 680, 195, 12, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff', 'Chaussures de randonnée La Sportiva jaunes et noires sur terrain rocheux alpin', 'Polyvalent', 'La chaussure polyvalente par excellence. Entre trail et alpinisme léger. Imperméable Gore-Tex.', false),
    ('salomon-xa-pro-3d', 'Salomon XA Pro 3D V9 GTX', 'Salomon', 'Chaussures', ARRAY['Randonnée', 'Trail', 'Trekking'], 380, 145, 22, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff', 'Chaussures de randonnée Salomon grises et vertes avec semelle crantée', '', 'La chaussure de randonnée polyvalente de Salomon. Imperméable, stable, confortable. Un classique.', false),
    -- Cuisine
    ('jetboil-flash', 'Jetboil Flash Cooking System', 'Jetboil', 'Cuisine', ARRAY['Camping', 'Randonnée', 'Alpinisme'], 371, 89, 20, 'https://images.unsplash.com/photo-1729872416347-38d7dfbef04e', 'Système de cuisson Jetboil orange avec indicateur de température sur fond blanc', 'Rapide', 'Ébullition en 100 secondes. Le système de cuisson le plus rapide du marché. Idéal pour les bivouacs.', false),
    ('snow-peak-titanium-spork', 'Snow Peak Titanium Spork', 'Snow Peak', 'Cuisine', ARRAY['Camping', 'Randonnée', 'Trekking'], 27, 18, 60, 'https://images.unsplash.com/photo-1729872416347-38d7dfbef04e', 'Cuillère-fourchette en titane Snow Peak sur fond blanc', 'Ultra-léger', 'La cuillère-fourchette en titane. 27g seulement. Indispensable dans tout kit ultralight.', false),
    ('sea-to-summit-x-pot', 'Sea to Summit X-Pot 1.4L', 'Sea to Summit', 'Cuisine', ARRAY['Camping', 'Randonnée'], 175, 55, 25, 'https://images.unsplash.com/photo-1729872416347-38d7dfbef04e', 'Casserole pliable Sea to Summit rouge avec couvercle sur fond blanc', '', 'La casserole pliable révolutionnaire. Se compresse à 3cm de hauteur. Légère et pratique.', false),
    ('primus-eta-spider', 'Primus EtaSpider Stove', 'Primus', 'Cuisine', ARRAY['Camping', 'Alpinisme', 'Randonnée'], 280, 75, 15, 'https://images.unsplash.com/photo-1729872416347-38d7dfbef04e', 'Réchaud à gaz Primus avec pieds araignée sur rocher en montagne', '', 'Réchaud stable pour les grandes casseroles. Idéal pour les groupes. Résistant au vent.', false),
    -- Eau
    ('katadyn-befree', 'Katadyn BeFree 1L', 'Katadyn', 'Eau', ARRAY['Randonnée', 'Trekking', 'Trail'], 56, 45, 35, 'https://images.unsplash.com/photo-1735281257493-83be781b6483', 'Filtre à eau Katadyn BeFree bleu avec poche souple sur fond blanc', '', 'Le filtre à eau le plus léger du marché. 56g, débit rapide, compatible avec les gourdes souples.', false),
    ('lifestraw-peak-series', 'LifeStraw Peak Series 1L', 'LifeStraw', 'Eau', ARRAY['Randonnée', 'Survie', 'Camping'], 68, 39, 40, 'https://images.unsplash.com/photo-1735281257493-83be781b6483', 'Gourde filtrante LifeStraw verte avec filtre intégré sur fond blanc', 'Survie', 'Gourde filtrante tout-en-un. Élimine 99.9999% des bactéries. Idéale pour les zones reculées.', false),
    ('nalgene-wide-mouth', 'Nalgene Wide Mouth 1L', 'Nalgene', 'Eau', ARRAY['Camping', 'Randonnée', 'Trekking'], 180, 15, 80, 'https://images.unsplash.com/photo-1735281257493-83be781b6483', 'Gourde Nalgene transparente 1 litre avec bouchon large sur fond blanc', '', 'La gourde indestructible. Résiste aux chocs, au gel, aux UV. Un classique indémodable.', false),
    -- Éclairage
    ('petzl-actik-core', 'Petzl Actik Core 450 lm', 'Petzl', 'Éclairage', ARRAY['Randonnée', 'Trail', 'Camping'], 87, 55, 28, 'https://images.unsplash.com/photo-1570612117355-e3f8b19b1c08', 'Lampe frontale Petzl rouge avec batterie rechargeable sur fond blanc', '', 'Lampe frontale rechargeable 450 lumens. Légère, puissante, avec mode rouge pour préserver la vision nocturne.', false),
    ('ledlenser-neo10r', 'Ledlenser NEO10R 600 lm', 'Ledlenser', 'Éclairage', ARRAY['Trail', 'Randonnée', 'Cyclisme'], 100, 75, 15, 'https://images.unsplash.com/photo-1570612117355-e3f8b19b1c08', 'Lampe frontale Ledlenser noire avec faisceau puissant sur fond sombre', 'Trail', 'La lampe frontale des traileurs. 600 lumens, rechargeable, avec capteur de mouvement pour ajuster l''intensité.', false),
    -- Sommeil
    ('western-mountaineering-ultralite', 'Western Mountaineering UltraLite 20°F', 'Western Mountaineering', 'Sommeil', ARRAY['Alpinisme', 'Trekking', 'Camping'], 680, 499, 4, 'https://images.unsplash.com/photo-1663707333537-9808bb2a84a0', 'Sac de couchage en duvet Western Mountaineering bleu déplié sur fond blanc', 'Premium', 'Le sac de couchage duvet le plus léger du marché pour sa température. 680g pour -7°C. Investissement à vie.', true),
    ('cumulus-panyam-450', 'Cumulus Panyam 450 -5°C', 'Cumulus', 'Sommeil', ARRAY['Camping', 'Randonnée', 'Trekking'], 750, 299, 8, 'https://images.unsplash.com/photo-1663707333537-9808bb2a84a0', 'Sac de couchage Cumulus vert compressé dans son sac de transport', '', 'Duvet polonais 850 cuin. Excellent rapport qualité/prix pour les températures négatives.', false),
    ('exped-synmat-ul', 'Exped SynMat UL 7 M', 'Exped', 'Sommeil', ARRAY['Camping', 'Randonnée', 'Trekking'], 395, 149, 12, 'https://images.unsplash.com/photo-1663707333537-9808bb2a84a0', 'Matelas gonflable Exped gris avec valve rapide sur fond blanc', '', 'Matelas gonflable léger avec isolation synthétique. R-value 3.3, idéal pour 3 saisons.', false),
    -- Sécurité
    ('petzl-grigri-plus', 'Petzl GriGri+ Assureur', 'Petzl', 'Sécurité', ARRAY['Escalade', 'Alpinisme'], 175, 89, 18, 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0', 'Assureur Petzl GriGri+ orange avec mécanisme anti-panique sur fond blanc', 'Escalade', 'L''assureur de référence pour l''escalade. Système anti-panique, compatible simple et double brin.', false),
    ('black-diamond-momentum', 'Black Diamond Momentum Harness', 'Black Diamond', 'Sécurité', ARRAY['Escalade', 'Via ferrata', 'Alpinisme'], 380, 65, 14, 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0', 'Baudrier d''escalade Black Diamond rouge avec boucles de réglage sur fond blanc', '', 'Le baudrier polyvalent pour l''escalade et l''alpinisme. Confortable, léger, facile à régler.', false),
    ('ortovox-diract-voice', 'Ortovox Diract Voice DVA', 'Ortovox', 'Sécurité', ARRAY['Ski', 'Alpinisme', 'Randonnée hivernale'], 250, 299, 6, 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0', 'DVA de recherche avalanche Ortovox noir avec interface vocale sur fond blanc', 'Avalanche', 'Le DVA avec guidage vocal. Recherche intuitive même sous stress. Indispensable pour le ski hors-piste.', false),
    ('bca-float-22', 'BCA Float 22 Airbag Pack', 'BCA', 'Sécurité', ARRAY['Ski', 'Alpinisme'], 2200, 649, 3, 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0', 'Sac airbag BCA noir avec système de déclenchement rouge sur fond blanc', 'Avalanche', 'Le sac airbag qui peut vous sauver la vie. Système de déclenchement fiable, capacité 22L.', false),
    -- Navigation
    ('garmin-gpsmap-67', 'Garmin GPSMAP 67', 'Garmin', 'Navigation', ARRAY['Randonnée', 'Trekking', 'Alpinisme'], 218, 349, 9, 'https://img.rocket.new/generatedImages/rocket_gen_img_1b4042735-1772899176488.png', 'GPS de randonnée Garmin GPSMAP 67 avec cartographie topo sur fond blanc', 'GPS', 'Le GPS de randonnée le plus complet. Cartographie topo intégrée, 36h d''autonomie, résistant aux chocs.', false),
    ('suunto-vertical', 'Suunto Vertical Titanium Solar', 'Suunto', 'Navigation', ARRAY['Trail', 'Randonnée', 'Alpinisme'], 89, 699, 5, 'https://img.rocket.new/generatedImages/rocket_gen_img_1b4042735-1772899176488.png', 'Montre GPS Suunto Vertical en titane avec cadran cartographique sur fond blanc', 'Premium', 'La montre GPS solaire pour les aventuriers. Cartographie offline, 60 jours d''autonomie en mode GPS.', true),
    ('coros-vertix-3', 'Coros Vertix 3 Solar', 'Coros', 'Navigation', ARRAY['Trail', 'Randonnée', 'Triathlon'], 79, 599, 7, 'https://img.rocket.new/generatedImages/rocket_gen_img_1b4042735-1772899176488.png', 'Montre GPS Coros Vertix 3 noire avec bracelet sport sur fond blanc', 'Nouveau', 'La montre GPS solaire de Coros. Excellente autonomie, cartographie topo, suivi santé avancé.', false),
    -- Accessoires
    ('sea-to-summit-dry-sack', 'Sea to Summit Ultra-Sil Dry Sack 8L', 'Sea to Summit', 'Accessoires', ARRAY['Kayak', 'Randonnée', 'Camping'], 38, 22, 45, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62', 'Sac étanche Sea to Summit bleu 8 litres avec fermeture roll-top sur fond blanc', '', 'Le sac étanche ultraléger. 38g seulement. Protège votre matériel de l''eau et de l''humidité.', false),
    ('trekology-ultralight-pillow', 'Trekology Ultralight Pillow', 'Trekology', 'Accessoires', ARRAY['Camping', 'Randonnée', 'Trekking'], 58, 25, 55, 'https://images.unsplash.com/photo-1663707333537-9808bb2a84a0', 'Oreiller gonflable ultralight Trekology gris compressé dans sa pochette sur fond blanc', '', 'L''oreiller gonflable le plus léger. 58g, confortable, se gonfle en 3 souffles. Indispensable pour les bivouacs.', false),
    ('petzl-reverso-4', 'Petzl Reverso 4 Assureur/Descendeur', 'Petzl', 'Accessoires', ARRAY['Escalade', 'Alpinisme', 'Canyoning'], 68, 28, 30, 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0', 'Assureur descendeur Petzl Reverso 4 orange sur fond blanc', '', 'L''assureur/descendeur polyvalent. Compatible avec toutes les cordes, léger et fiable.', false),
    ('black-diamond-camalot-c4', 'Black Diamond Camalot C4 #2', 'Black Diamond', 'Accessoires', ARRAY['Escalade', 'Alpinisme'], 120, 75, 12, 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0', 'Friend d''escalade Black Diamond Camalot C4 rouge sur fond blanc', 'Escalade', 'Le friend de référence pour l''escalade en fissure. Fiable, résistant, plage de placement large.', false),
    ('silva-compass-ranger', 'Silva Ranger S Compass', 'Silva', 'Navigation', ARRAY['Randonnée', 'Trekking', 'Survie'], 42, 35, 40, 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0', 'Boussole Silva Ranger avec miroir de visée sur fond blanc', '', 'La boussole de référence pour la navigation en montagne. Miroir de visée, déclinaison réglable.', false),
    ('lifesystems-first-aid', 'Lifesystems Adventurer First Aid Kit', 'Lifesystems', 'Sécurité', ARRAY['Randonnée', 'Trekking', 'Camping'], 280, 42, 35, 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0', 'Kit de premiers secours Lifesystems rouge ouvert avec contenu visible sur fond blanc', 'Sécurité', 'Kit de premiers secours complet pour les aventuriers. 42 pièces, léger, compact, waterproof.', false)
  ON CONFLICT (slug) DO NOTHING;

  -- ============================================================
  -- 3. KITS SUPPLÉMENTAIRES
  -- ============================================================
  INSERT INTO public.kits (slug, nom, description, destination, saison, poids_total_g, prix_cents, nb_articles, difficulte, activite, image, alt, tags, featured, conseils)
  VALUES
    ('patagonie-hiver', 'Kit Patagonie — Hiver & Vent', 'L''équipement ultime pour affronter les vents violents et les conditions extrêmes de Patagonie. Chaque pièce a été sélectionnée pour sa résistance et sa légèreté.', 'Patagonie, Chili/Argentine', 'Nov — Mars', 11200, 149900, 31, 'Expert', 'Alpinisme', 'https://img.rocket.new/generatedImages/rocket_gen_img_17b4a31a9-1783680161528.png', 'Torres del Paine avec randonneur équipé face au vent violent et aux nuages dramatiques', ARRAY['Vent', 'Froid extrême', 'Imperméable'], true, ARRAY['En Patagonie, le vent peut dépasser 150 km/h. Votre tente doit être certifiée pour ces conditions.', 'Prévoyez le double de temps pour chaque étape. Les conditions peuvent vous clouer au camp plusieurs jours.', 'Les couches de base en laine mérinos sont indispensables. Évitez le coton qui tue en conditions humides.']),
    ('japon-randonnee', 'Kit Japon — Randonnée & Temples', 'Équipement léger et polyvalent pour explorer les sentiers japonais entre randonnée en montagne et visites culturelles.', 'Japon', 'Avril — Novembre', 7800, 84900, 22, 'Intermédiaire', 'Randonnée', 'https://images.unsplash.com/photo-1528360983277-13d401cdc186', 'Randonneur sur sentier japonais avec vue sur le Mont Fuji et forêt de cerisiers en fleurs', ARRAY['Polyvalent', 'Culturel', 'Léger'], false, ARRAY['Au Japon, les sentiers de montagne sont très bien balisés. Une carte papier suffit souvent.', 'Prévoyez des vêtements respectueux pour les temples. Un pantalon léger est indispensable.', 'L''eau est potable partout au Japon. Pas besoin de filtre, mais une gourde réutilisable est appréciée.']),
    ('ecosse-highlands', 'Kit Écosse — Highlands & Munros', 'Équipement pour les Highlands écossais : pluie, vent, midges et paysages à couper le souffle. Imperméabilité maximale.', 'Écosse', 'Mai — Septembre', 9400, 99900, 26, 'Intermédiaire', 'Randonnée', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4', 'Randonneur sur crête des Highlands écossais avec loch et bruyère en arrière-plan', ARRAY['Pluie', 'Vent', 'Midges'], false, ARRAY['Les midges (moucherons) sont une vraie plaie en été. Emportez un répulsif spécial midges.', 'La météo change très vite en Écosse. Gardez toujours votre veste imperméable à portée de main.', 'Le wild camping est légal en Écosse. Profitez-en pour bivouaquer dans des endroits magiques.']),
    ('nouvelle-zelande-trek', 'Kit Nouvelle-Zélande — Great Walks', 'L''équipement parfait pour les Great Walks de Nouvelle-Zélande. Polyvalent, imperméable, adapté aux conditions changeantes.', 'Nouvelle-Zélande', 'Nov — Avril', 8600, 94900, 24, 'Intermédiaire', 'Trekking', 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800', 'Randonneur sur sentier des Great Walks en Nouvelle-Zélande avec fjords et forêts tropicales', ARRAY['Imperméable', 'Polyvalent', 'Great Walks'], false, ARRAY['Réservez les huts des Great Walks plusieurs mois à l''avance. Ils sont très demandés en saison.', 'La Nouvelle-Zélande a des règles strictes sur la biosécurité. Nettoyez bien vos chaussures avant d''entrer.', 'Les sandflies (moucherons) sont présentes dans les fjords. Emportez un répulsif efficace.']),
    ('trail-ultra-kit', 'Kit Ultra-Trail — Compétition', 'Le kit complet pour les coureurs d''ultra-trail. Léger, fonctionnel, conforme aux règlements UTMB et ITRA.', 'Universel', 'Toute l''année', 3200, 44900, 18, 'Expert', 'Trail', 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571', 'Coureur de trail sur sentier de montagne avec sac de trail et équipement obligatoire visible', ARRAY['Ultra-léger', 'Compétition', 'UTMB'], true, ARRAY['Vérifiez la liste du matériel obligatoire de votre course. Elle change chaque année.', 'Testez tout votre équipement à l''entraînement avant la course. Jamais de nouveau matériel le jour J.', 'La veste imperméable est obligatoire sur la plupart des ultras. Choisissez-la légère mais efficace.']),
    ('ski-rando-kit', 'Kit Ski de Randonnée — Alpes', 'Équipement complet pour le ski de randonnée en Alpes. Sécurité avalanche, légèreté, performance.', 'Alpes', 'Décembre — Avril', 14500, 169900, 28, 'Expert', 'Ski', 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256', 'Skieur de randonnée en montée avec peaux de phoque, paysage alpin enneigé et ciel bleu', ARRAY['Avalanche', 'Sécurité', 'Performance'], false, ARRAY['Le kit DVA/sonde/pelle est obligatoire. Entraînez-vous régulièrement à la recherche avalanche.', 'Les peaux de phoque doivent être adaptées à vos skis. Vérifiez la compatibilité avant d''acheter.', 'Partez toujours avec un bulletin d''enneigement et de risque avalanche. Ne négligez jamais ce point.']),
    ('escalade-grande-voie', 'Kit Escalade — Grande Voie', 'Tout le matériel nécessaire pour les grandes voies en falaise et en montagne. Sécurité et légèreté.', 'Universel', 'Toute l''année', 8900, 119900, 35, 'Expert', 'Escalade', 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0', 'Grimpeur en grande voie sur paroi rocheuse avec équipement d''escalade complet visible', ARRAY['Sécurité', 'Grande voie', 'Léger'], false, ARRAY['Vérifiez votre matériel avant chaque sortie. Un équipement défectueux peut coûter la vie.', 'En grande voie, prévoyez toujours un kit de bivouac. Les descentes peuvent prendre plus de temps que prévu.', 'Apprenez à lire les conditions météo. L''orage en paroi est extrêmement dangereux.']),
    ('bikepacking-alpes', 'Kit Bikepacking — Tour des Alpes', 'L''équipement optimisé pour le bikepacking en montagne. Léger, compact, résistant aux conditions alpines.', 'Alpes', 'Juin — Septembre', 16800, 134900, 30, 'Intermédiaire', 'Vélo', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64', 'Cycliste avec vélo chargé de sacoches sur col alpin avec vue panoramique sur les sommets', ARRAY['Bikepacking', 'Alpes', 'Autonomie'], false, ARRAY['Répartissez le poids équitablement entre l''avant et l''arrière du vélo pour une meilleure stabilité.', 'Prévoyez un kit de réparation complet. Les crevaisons sont fréquentes sur les routes de montagne.', 'Les cols alpins peuvent être fermés en début de saison. Vérifiez les conditions avant de partir.']),
    ('plongee-voyage', 'Kit Plongée — Voyage Tropical', 'L''équipement de plongée du voyageur. Léger, compact, adapté aux vols et aux destinations tropicales.', 'Tropiques', 'Toute l''année', 4200, 59900, 14, 'Intermédiaire', 'Plongée', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5', 'Plongeur sous-marin avec équipement léger dans eau turquoise tropicale avec coraux colorés', ARRAY['Plongée', 'Voyage', 'Tropical'], false, ARRAY['Votre équipement personnel (masque, palmes, combinaison) vaut l''investissement. Le reste peut se louer.', 'Vérifiez les réglementations locales sur la plongée. Certaines zones sont protégées.', 'Emportez votre carnet de plongée et vos certifications. Ils sont demandés partout.']),
    ('survie-wilderness', 'Kit Survie — Wilderness', 'Le kit de survie complet pour les situations d''urgence en milieu sauvage. Compact, léger, potentiellement vital.', 'Universel', 'Toute l''année', 1800, 29900, 20, 'Expert', 'Survie', 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0', 'Kit de survie ouvert avec couteau, allumettes, sifflet et couverture de survie sur fond de forêt', ARRAY['Survie', 'Urgence', 'Compact'], false, ARRAY['Un kit de survie ne sert à rien si vous ne savez pas l''utiliser. Formez-vous aux techniques de survie.', 'Vérifiez et renouvelez régulièrement les éléments périssables de votre kit.', 'Le kit de survie est le dernier recours. La prévention et la préparation restent les meilleures protections.'])
  ON CONFLICT (slug) DO NOTHING;

  -- ============================================================
  -- 4. EXPERTS SUPPLÉMENTAIRES
  -- ============================================================
  INSERT INTO public.experts (name, title, specialties, destinations, rating, reviews_count, consultations_count, price_per_hour, availability, certifications, bio, avatar, languages, response_time)
  VALUES
    ('Pierre Chamonix', 'Guide de haute montagne & Alpiniste', ARRAY['Alpinisme', 'Escalade', 'Ski de randonnée', 'Cascade de glace'], ARRAY['Alpes', 'Himalaya', 'Andes', 'Caucase'], 4.98, 412, 1850, 95, 'disponible', ARRAY['IFMGA', 'PGHM Chamonix', 'Secouriste montagne', 'Avalanche Pro'], 'Guide IFMGA basé à Chamonix depuis 20 ans. Spécialiste des voies techniques en Alpes et des expéditions himalayennes. A guidé plus de 50 ascensions du Mont Blanc.', 'PC', ARRAY['FR', 'EN', 'IT', 'DE'], '< 1h'),
    ('Yasmine Touareg', 'Experte trek & cultures nomades', ARRAY['Trek', 'Désert', 'Cultures nomades', 'Photographie'], ARRAY['Sahara', 'Maroc', 'Mauritanie', 'Mali', 'Niger'], 4.94, 287, 1120, 70, 'disponible', ARRAY['BEES Randonnée', 'Guide officiel Maroc', 'Secourisme PSE1'], 'Née à Marrakech, guide et ethnologue. Spécialiste des cultures nomades du Sahara. Organise des treks authentiques depuis 14 ans.', 'YT', ARRAY['FR', 'EN', 'AR', 'Tamazight'], '< 3h'),
    ('Lars Svensson', 'Expert arctique & expéditions polaires', ARRAY['Arctique', 'Ski de fond', 'Traîneau à chiens', 'Survie polaire'], ARRAY['Svalbard', 'Groenland', 'Antarctique', 'Laponie'], 4.96, 198, 780, 110, 'sur-demande', ARRAY['IFMGA', 'Polar Guide', 'Wilderness Medicine', 'Avalanche Pro'], 'Suédois, guide polaire depuis 15 ans. A traversé le Groenland 3 fois et guidé des expéditions en Antarctique. Expert en survie polaire.', 'LS', ARRAY['FR', 'EN', 'SV', 'NO', 'DA'], '< 12h'),
    ('Fatima Okafor', 'Guide trek & faune africaine', ARRAY['Safari', 'Trek', 'Ornithologie', 'Conservation'], ARRAY['Kenya', 'Tanzanie', 'Éthiopie', 'Rwanda', 'Ouganda'], 4.91, 334, 1340, 80, 'disponible', ARRAY['Kenya Wildlife Guide', 'Wilderness First Responder', 'Bird Guide Africa'], 'Kenyane, guide certifiée depuis 12 ans. Spécialiste de la faune africaine et des treks dans les parcs nationaux. Militante pour la conservation.', 'FO', ARRAY['FR', 'EN', 'Swahili'], '< 4h'),
    ('Carlos Mendoza', 'Expert Andes & Patagonie', ARRAY['Alpinisme', 'Trek', 'Escalade', 'Patagonie'], ARRAY['Patagonie', 'Andes', 'Pérou', 'Bolivie', 'Équateur'], 4.93, 256, 980, 85, 'disponible', ARRAY['IFMGA', 'Guide Patagonie', 'Secouriste montagne'], 'Argentin, guide de montagne depuis 18 ans. Spécialiste de la Patagonie et des Andes. A guidé des ascensions des plus hauts sommets d''Amérique du Sud.', 'CM', ARRAY['FR', 'EN', 'ES', 'PT'], '< 5h'),
    ('Nadia Volkov', 'Experte trail & ultra-endurance', ARRAY['Trail', 'Ultra-trail', 'Nutrition sportive', 'Préparation mentale'], ARRAY['Alpes', 'Pyrénées', 'Dolomites', 'Scandinavie'], 4.89, 445, 1680, 60, 'disponible', ARRAY['BEES Athlétisme', 'Nutritionniste sportive', 'Coach mental'], 'Française d''origine russe, finisher UTMB 3 fois. Coach spécialisée en ultra-trail et nutrition sportive. Accompagne des athlètes de tous niveaux.', 'NV', ARRAY['FR', 'EN', 'RU'], '< 2h'),
    ('Takeshi Yamamoto', 'Expert randonnée japonaise & bushcraft', ARRAY['Randonnée', 'Bushcraft', 'Survie', 'Culture japonaise'], ARRAY['Japon', 'Corée', 'Taiwan', 'Philippines'], 4.87, 178, 720, 65, 'disponible', ARRAY['Guide officiel Japon', 'Bushcraft Instructor', 'Wilderness First Aid'], 'Japonais, guide certifié depuis 10 ans. Expert des sentiers japonais et des techniques de bushcraft. Propose des expériences immersives dans la nature japonaise.', 'TY', ARRAY['FR', 'EN', 'JP'], '< 6h'),
    ('Isabelle Mer', 'Experte kayak de mer & navigation', ARRAY['Kayak de mer', 'Navigation côtière', 'Météo marine', 'Sécurité en mer'], ARRAY['Bretagne', 'Écosse', 'Norvège', 'Grèce', 'Croatie'], 4.92, 223, 890, 75, 'disponible', ARRAY['BEES Kayak', 'Moniteur fédéral', 'VHF maritime', 'Secourisme aquatique'], 'Bretonne, monitrice de kayak de mer depuis 15 ans. Spécialiste de la navigation côtière et des expéditions en mer. A traversé la Manche en kayak.', 'IM', ARRAY['FR', 'EN'], '< 3h'),
    ('Ahmed Bensalem', 'Expert vélo & bikepacking', ARRAY['Bikepacking', 'Cyclotourisme', 'Mécanique vélo', 'Nutrition cycliste'], ARRAY['Europe', 'Maroc', 'Afrique du Nord', 'Asie centrale'], 4.85, 312, 1240, 55, 'disponible', ARRAY['BEES Cyclisme', 'Moniteur fédéral', 'Mécanique vélo'], 'Tunisien, cycliste et guide depuis 12 ans. A traversé l''Afrique à vélo et guidé des groupes sur les routes les plus belles d''Europe.', 'AB2', ARRAY['FR', 'EN', 'AR'], '< 4h'),
    ('Chloé Deschamps', 'Experte escalade & via ferrata', ARRAY['Escalade', 'Via ferrata', 'Bloc', 'Escalade en salle'], ARRAY['Dolomites', 'Verdon', 'Kalymnos', 'Fontainebleau'], 4.90, 389, 1560, 65, 'disponible', ARRAY['BEES Escalade', 'Moniteur fédéral', 'Secouriste montagne'], 'Française, grimpeuse professionnelle et guide depuis 10 ans. Spécialiste de l''escalade en grande voie et de la via ferrata. Championne de France de bloc 2019.', 'CD', ARRAY['FR', 'EN', 'IT'], '< 2h'),
    ('Marco Rossi', 'Expert ski & freeride', ARRAY['Ski freeride', 'Ski de randonnée', 'Snowboard', 'Sécurité avalanche'], ARRAY['Alpes italiennes', 'Alpes françaises', 'Suisse', 'Autriche'], 4.88, 267, 1050, 80, 'disponible', ARRAY['IFMGA', 'Guide ski Italie', 'Avalanche Pro', 'Secouriste montagne'], 'Italien, guide de ski et de montagne depuis 15 ans. Spécialiste du freeride et du ski de randonnée dans les Alpes. A filmé pour plusieurs productions de ski extrême.', 'MR', ARRAY['FR', 'EN', 'IT', 'DE'], '< 3h')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 5. CARNETS SUPPLÉMENTAIRES
  -- ============================================================
  IF u13 IS NOT NULL THEN
    INSERT INTO public.carnets (id, author_id, title, destination, description, cover_image, cover_image_alt, start_date, end_date, weather, route_rating, visibility, tags, map_points, is_collaborative, likes_count, comments_count, favorites_count, views_count, verified, created_at) VALUES
      (c9, u13, 'Traversée des Alpes à pied : GR5 intégral', 'Alpes, France/Suisse', 'La traversée complète du GR5 de Lac Léman à Nice en 45 jours. Un voyage initiatique à travers les plus beaux paysages alpins. 600km, 35 000m de dénivelé cumulé, 45 refuges et bivouacs.', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'Randonneur sur sentier alpin avec vue panoramique sur les sommets enneigés et vallées verdoyantes', '2025-06-15', '2025-07-30', 'Beau temps dominant, quelques orages en altitude', 4.9, 'public', ARRAY['gr5','alpes','traversée','longue-distance','bivouac'], '[]'::jsonb, false, 245, 67, 178, 5420, true, now() - interval '55 days'),
      (c10, u14, 'Expédition Patagonie : Torres del Paine W Trek', 'Patagonie, Chili', 'Le trek W dans le parc national Torres del Paine. 5 jours de marche dans un des paysages les plus spectaculaires de la planète. Vents violents, glaciers, lacs turquoise et les Torres au lever du soleil.', 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800', 'Torres del Paine au lever du soleil avec reflet dans le lac et randonneur au premier plan', '2025-11-10', '2025-11-15', 'Vent violent (80 km/h), soleil et nuages alternés', 5.0, 'public', ARRAY['patagonie','torres-del-paine','trek','chili','vent'], '[]'::jsonb, false, 312, 89, 234, 7890, true, now() - interval '48 days'),
      (c11, u15, 'Randonnée en Islande : Fimmvörðuháls', 'Islande', 'Le sentier Fimmvörðuháls entre Skógar et Þórsmörk. 25km de randonnée entre deux volcans actifs, cascades spectaculaires et paysages lunaires. Une journée inoubliable en autonomie complète.', 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=800', 'Randonneur sur sentier volcanique islandais avec cascade et vapeurs géothermiques en arrière-plan', '2025-07-20', '2025-07-20', 'Brouillard matinal, éclaircies l''après-midi, vent fort', 4.7, 'public', ARRAY['islande','fimmvörðuháls','volcans','cascades','journée'], '[]'::jsonb, false, 134, 38, 98, 2870, false, now() - interval '40 days'),
      (c12, u16, 'GR20 Corse : 15 jours de bonheur et de souffrance', 'Corse, France', 'Le GR20 intégral du nord au sud en 15 jours. Le sentier le plus difficile d''Europe. Granit, maquis, lacs de montagne et couchers de soleil inoubliables. Mon premier grand trek et déjà le plus beau.', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'Randonneur sur crête rocheuse du GR20 avec vue sur la mer Méditerranée et les montagnes corses', '2025-06-01', '2025-06-15', 'Beau temps, quelques orages le soir, chaleur intense', 4.8, 'public', ARRAY['gr20','corse','randonnée','montagne','multi-jours'], '[]'::jsonb, false, 189, 52, 143, 4230, true, now() - interval '35 days'),
      (c13, u17, 'Vanlife Europe : 6 mois sur les routes', 'Europe', 'Six mois de vie en van à travers 12 pays européens. Du Portugal à la Norvège, en passant par les Balkans et la Turquie. 28 000km, 180 spots de camping, des rencontres inoubliables.', 'https://images.unsplash.com/photo-1675912739409-84ab21c16004?w=800', 'Van aménagé garé devant fjord norvégien au coucher du soleil avec équipement de camping visible', '2025-01-15', '2025-07-15', 'Toutes conditions : soleil, pluie, neige, chaleur', 4.6, 'public', ARRAY['vanlife','europe','roadtrip','nomade','liberté'], '[]'::jsonb, true, 278, 74, 201, 6340, false, now() - interval '28 days'),
      (c14, u18, 'Escalade à Kalymnos : 10 jours de grimpe', 'Kalymnos, Grèce', 'L''île grecque de Kalymnos, paradis de l''escalade. 10 jours à grimper sur les falaises calcaires avec vue sur la mer Égée. Plus de 3000 voies, du 4a au 9a. Un rêve de grimpeur.', 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0?w=800', 'Grimpeur sur falaise calcaire à Kalymnos avec vue sur mer Égée bleue et îles en arrière-plan', '2025-09-15', '2025-09-25', 'Beau temps, 28°C, vent de mer agréable', 4.9, 'public', ARRAY['escalade','kalymnos','grèce','falaise','méditerranée'], '[]'::jsonb, false, 156, 43, 112, 3450, false, now() - interval '22 days'),
      (c15, u19, 'Ultra-trail des Dolomites : mon premier 80km', 'Dolomites, Italie', 'Mon premier ultra-trail de 80km dans les Dolomites. 4500m de dénivelé, 18h de course, des paysages à couper le souffle. La préparation, la course et l''après. Un récit honnête sur les joies et les galères.', 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800', 'Coureur de trail dans les Dolomites avec vue sur les pics rocheux au coucher du soleil', '2025-07-05', '2025-07-06', 'Beau temps, 25°C en vallée, 10°C en altitude', 4.7, 'public', ARRAY['trail','dolomites','ultra','italie','endurance'], '[]'::jsonb, false, 98, 31, 72, 2180, false, now() - interval '18 days'),
      (c16, u20, 'Plongée aux Maldives : 7 jours de paradis', 'Maldives', 'Une semaine de plongée aux Maldives. Requins baleines, raies manta, tortues et coraux multicolores. La plongée la plus belle de ma vie dans les eaux les plus claires du monde.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800', 'Plongeur sous-marin aux Maldives avec raie manta et coraux colorés dans eau cristalline', '2025-12-01', '2025-12-07', 'Soleil, 30°C, mer calme, visibilité 30m', 5.0, 'public', ARRAY['plongée','maldives','requins','raies','paradis'], '[]'::jsonb, false, 223, 58, 167, 5670, false, now() - interval '12 days'),
      (c17, u13, 'Ski de randonnée dans les Écrins', 'Massif des Écrins, France', 'Une semaine de ski de randonnée dans le massif des Écrins. Ascension de la Barre des Écrins (4102m), traversée du glacier Blanc et bivouac au refuge des Écrins. Conditions hivernales parfaites.', 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800', 'Skieur de randonnée en montée sur glacier avec la Barre des Écrins en arrière-plan sous ciel bleu', '2025-03-10', '2025-03-17', 'Grand beau, -15°C au sommet, neige poudreuse', 4.8, 'public', ARRAY['ski','écrins','randonnée','glacier','alpinisme'], '[]'::jsonb, false, 167, 45, 123, 3890, true, now() - interval '8 days'),
      (c18, u14, 'Trek au Kirghizistan : Tian Shan sauvage', 'Kirghizistan', 'Deux semaines de trek en autonomie dans les montagnes du Tian Shan au Kirghizistan. Yourtes, chevaux, lacs d''altitude et hospitalité nomade. Un pays encore préservé du tourisme de masse.', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800', 'Randonneur avec cheval de bât dans les montagnes du Tian Shan avec lac d''altitude turquoise', '2025-08-01', '2025-08-15', 'Beau temps, orages l''après-midi, nuits fraîches', 4.9, 'public', ARRAY['kirghizistan','tian-shan','nomade','autonomie','asie-centrale'], '[]'::jsonb, false, 289, 76, 212, 6780, true, now() - interval '3 days')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ============================================================
  -- 6. CLUBS SUPPLÉMENTAIRES
  -- ============================================================
  INSERT INTO public.clubs (id, slug, name, type, emoji, description, cover_color, category, rules, privacy, members_count, active_this_month, is_verified, created_by, created_at) VALUES
    (cl6, 'alpinistes-france', 'Alpinistes de France', 'activité', '⛰️', 'Club des alpinistes français. Courses en rocher, glace et mixte. Partage d''expériences, conseils techniques et organisation de cordées.', 'from-slate-600 to-gray-700', 'Alpinisme', 'Sécurité avant tout. Partagez vos expériences avec honnêteté. Aidez les débutants avec bienveillance.', 'open', 634, 198, true, u13, now() - interval '180 days'),
    (cl7, 'ski-rando-alpes', 'Ski de Randonnée Alpes', 'activité', '⛷️', 'Communauté des skieurs de randonnée alpins. Conditions d''enneigement, itinéraires, sécurité avalanche et sorties collectives.', 'from-sky-500 to-blue-600', 'Ski', 'Sécurité avalanche obligatoire. Partagez les bulletins de risque. Entraide et prudence.', 'open', 489, 234, true, u14, now() - interval '160 days'),
    (cl8, 'trail-runners-paris', 'Trail Runners Paris', 'activité', '🏃', 'Le club des coureurs de trail de la région parisienne. Sorties hebdomadaires, préparation aux courses et entraide entre passionnés.', 'from-red-500 to-orange-600', 'Course à pied', 'Tous niveaux bienvenus. Encouragements obligatoires. Pas de compétition entre membres.', 'open', 1247, 456, true, u15, now() - interval '200 days'),
    (cl9, 'voyageurs-asie', 'Voyageurs d''Asie', 'pays', '🌏', 'Communauté des voyageurs passionnés par l''Asie. Randonnées, treks, culture et conseils pratiques pour explorer le continent asiatique.', 'from-rose-500 to-pink-600', 'Voyage', 'Respect des cultures locales. Partage de conseils responsables et durables.', 'open', 892, 312, false, u16, now() - interval '140 days'),
    (cl10, 'escalade-bloc', 'Escalade & Bloc', 'activité', '🧗', 'Club des grimpeurs en salle et en falaise. Techniques d''escalade, spots secrets, progression et sorties en falaise.', 'from-purple-600 to-violet-700', 'Escalade', 'Respect des sites naturels. Nettoyez vos prises. Aidez les débutants à progresser.', 'open', 723, 289, false, u18, now() - interval '120 days'),
    (cl11, 'plongeurs-mediterranee', 'Plongeurs Méditerranée', 'activité', '🤿', 'Club des plongeurs de la Méditerranée. Spots de plongée, conditions, faune marine et organisation de sorties.', 'from-teal-500 to-cyan-600', 'Plongée', 'Respect de la faune et de la flore marines. Pas de chasse sous-marine dans les zones protégées.', 'open', 345, 123, false, u20, now() - interval '90 days'),
    (cl12, 'vanlifers-france', 'Vanlifers France', 'activité', '🚐', 'La communauté française des vanlifers. Aménagement, spots de camping, conseils techniques et rencontres entre nomades.', 'from-amber-500 to-yellow-600', 'Vanlife', 'Respect des lieux de camping. Laissez les spots plus propres que vous les avez trouvés.', 'open', 1567, 678, true, u17, now() - interval '250 days')
  ON CONFLICT (id) DO NOTHING;

  -- Membres nouveaux clubs
  IF u13 IS NOT NULL THEN
    INSERT INTO public.club_members (club_id, user_id, role, status, joined_at) VALUES
      (cl6, u13, 'admin', 'active', now() - interval '180 days'),
      (cl6, u14, 'moderator', 'active', now() - interval '170 days'),
      (cl6, u4_id, 'member', 'active', now() - interval '150 days'),
      (cl6, u1_id, 'member', 'active', now() - interval '130 days'),
      (cl7, u14, 'admin', 'active', now() - interval '160 days'),
      (cl7, u13, 'member', 'active', now() - interval '155 days'),
      (cl7, u4_id, 'member', 'active', now() - interval '140 days'),
      (cl8, u15, 'admin', 'active', now() - interval '200 days'),
      (cl8, u19, 'moderator', 'active', now() - interval '38 days'),
      (cl8, u3_id, 'member', 'active', now() - interval '180 days'),
      (cl8, u1_id, 'member', 'active', now() - interval '160 days'),
      (cl9, u16, 'admin', 'active', now() - interval '140 days'),
      (cl9, u14, 'member', 'active', now() - interval '130 days'),
      (cl10, u18, 'admin', 'active', now() - interval '120 days'),
      (cl10, u15, 'member', 'active', now() - interval '110 days'),
      (cl11, u20, 'admin', 'active', now() - interval '90 days'),
      (cl11, u5_id, 'member', 'active', now() - interval '80 days'),
      (cl12, u17, 'admin', 'active', now() - interval '250 days'),
      (cl12, u13, 'member', 'active', now() - interval '200 days'),
      (cl12, u1_id, 'member', 'active', now() - interval '180 days')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Topics nouveaux clubs
  IF u13 IS NOT NULL THEN
    INSERT INTO public.club_topics (id, club_id, author_id, title, content, is_pinned, is_announcement, is_approved, likes_count, replies_count, created_at) VALUES
      (t7, cl6, u13, '📌 Bienvenue dans le club Alpinistes de France !', 'Bienvenue à tous les alpinistes ! Ce club est votre espace pour partager vos courses, poser vos questions techniques et trouver des compagnons de cordée. Présentez-vous en réponse !', true, true, true, 67, 89, now() - interval '178 days'),
      (t8, cl6, u14, 'Conditions Écrins — Été 2026 : votre retour ?', 'Je prépare une semaine dans les Écrins fin juillet. Quelqu''un a des retours récents sur les conditions ? Enneigement des glaciers, état des voies normales sur la Barre ?', false, false, true, 34, 28, now() - interval '20 days'),
      (t9, cl7, u14, '⛷️ Bulletin neige et conditions — Mise à jour hebdomadaire', 'Thread dédié aux conditions d''enneigement et de risque avalanche. Partagez vos observations de terrain chaque semaine. Dernière mise à jour : risque 3/5 sur les Alpes du Nord.', true, true, true, 89, 156, now() - interval '158 days'),
      (t10, cl8, u15, 'Résultats UTMB 2025 — Vos performances !', 'Partagez vos résultats et vos récits de l''UTMB 2025 ! Que vous ayez terminé en 20h ou 46h, chaque finisher mérite d''être célébré. Bravo à tous !', false, false, true, 123, 87, now() - interval '6 days'),
      (t11, cl9, u16, 'Kirghizistan 2026 : qui est partant pour un trek collectif ?', 'Je prépare un trek de 3 semaines au Kirghizistan pour août 2026. Recherche 4-6 personnes pour partager les frais et l''aventure. Niveau intermédiaire requis. Intéressés ?', false, false, true, 45, 34, now() - interval '15 days'),
      (t12, cl10, u18, 'Spot de bloc à Fontainebleau : vos circuits préférés ?', 'Fontainebleau est à 1h de Paris et c''est un des meilleurs spots de bloc au monde. Quels sont vos circuits préférés selon les niveaux ? Je compile une liste pour les nouveaux membres.', false, false, true, 56, 42, now() - interval '25 days'),
      (t13, cl12, u17, '🚐 Carte des meilleurs spots vanlife en France', 'Je compile une carte collaborative des meilleurs spots de camping sauvage en France. Partagez vos spots préférés (sans les griller bien sûr !). Règle : 1 spot partagé = 1 spot reçu.', true, false, true, 234, 178, now() - interval '240 days'),
      (t14, cl11, u20, 'Plongée à Port-Cros : conditions et réglementation', 'Le parc national de Port-Cros est un des meilleurs spots de plongée en Méditerranée. Voici tout ce qu''il faut savoir sur les réglementations, les zones autorisées et les espèces à observer.', false, false, true, 67, 45, now() - interval '30 days'),
      (t15, cl6, u4_id, 'Recherche compagnon de cordée — Écrins juillet 2026', 'Je cherche un ou deux compagnons de cordée pour une semaine dans les Écrins en juillet 2026. Niveau : courses PD à AD. Objectifs : Barre des Écrins, Ailefroide, Pic Coolidge. Qui est partant ?', false, false, true, 28, 19, now() - interval '10 days')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Événements nouveaux clubs
  IF u13 IS NOT NULL THEN
    INSERT INTO public.club_events (id, club_id, organizer_id, title, description, event_date, location, max_participants, participants_count, created_at) VALUES
      (ev4, cl6, u13, 'Sortie escalade — Gorges du Verdon', 'Week-end escalade dans les Gorges du Verdon. Grandes voies de 3 à 6 longueurs. Niveau 5a minimum requis. Hébergement en camping. Inscription obligatoire.', now() + interval '35 days', 'La Palud-sur-Verdon, Alpes-de-Haute-Provence', 10, 7, now() - interval '15 days'),
      (ev5, cl7, u14, 'Sortie ski de rando — Belledonne', 'Journée ski de rando dans le massif de Belledonne. Départ 7h, retour 17h. Kit DVA/sonde/pelle obligatoire. Niveau intermédiaire. Covoiturage depuis Grenoble.', now() + interval '20 days', 'Chamrousse, Isère', 8, 6, now() - interval '8 days'),
      (ev6, cl8, u15, 'Trail nocturne — Forêt de Rambouillet', 'Trail nocturne de 30km dans la forêt de Rambouillet. Départ 21h, arrivée estimée 3h. Frontales obligatoires. Ravitaillement au km 15. Tous niveaux bienvenus.', now() + interval '12 days', 'Rambouillet, Yvelines', 30, 22, now() - interval '5 days'),
      (ev7, cl12, u17, 'Rassemblement vanlifers — Lac de Sainte-Croix', 'Week-end rassemblement vanlifers au lac de Sainte-Croix. Barbecue collectif, échanges de bons plans, baignade. Venez avec votre van et votre bonne humeur !', now() + interval '25 days', 'Lac de Sainte-Croix, Var', 50, 34, now() - interval '12 days'),
      (ev8, cl10, u18, 'Session bloc — Fontainebleau débutants', 'Session bloc à Fontainebleau pour les débutants. Initiation aux techniques de base, circuits faciles, ambiance détendue. Chaussons fournis pour les débutants.', now() + interval '8 days', 'Fontainebleau, Seine-et-Marne', 15, 12, now() - interval '3 days')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Défis nouveaux clubs
  IF u13 IS NOT NULL THEN
    INSERT INTO public.club_challenges (id, club_id, title, description, xp, deadline, active, created_at) VALUES
      (ch4, cl6, 'Défi 4000m — Ascension d''un 4000m alpin', 'Réalisez l''ascension d''un sommet de plus de 4000m dans les Alpes. Partagez votre trace GPS et vos photos pour valider.', 1000, now() + interval '120 days', true, now() - interval '30 days'),
      (ch5, cl8, 'Challenge 100km de trail en 30 jours', 'Courez 100km de trail en 30 jours. Partagez vos sorties sur Strava ou Garmin Connect pour valider votre progression.', 500, now() + interval '30 days', true, now() - interval '5 days'),
      (ch6, cl12, 'Défi 30 spots en 30 jours', 'Dormez dans 30 spots différents en 30 jours. Partagez vos photos et localisations (approximatives) pour valider.', 750, now() + interval '60 days', true, now() - interval '20 days'),
      (ch7, cl7, 'Défi Haute Route Chamonix-Zermatt à ski', 'Réalisez la Haute Route Chamonix-Zermatt à ski de randonnée. La plus belle traversée alpine. Partagez votre récit complet.', 2000, now() + interval '90 days', true, now() - interval '15 days')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ============================================================
  -- 7. POSTS COMMUNAUTÉ SUPPLÉMENTAIRES
  -- ============================================================
  IF u13 IS NOT NULL THEN
    INSERT INTO public.community_posts (id, author_id, content, image_url, image_alt, post_type, likes_count, comments_count, shares_count, is_trending, created_at) VALUES
      (p11, u13, 'GR5 terminé ! 45 jours, 600km, 35 000m D+. De Lac Léman à Nice à pied. Une vie en accéléré. Les Alpes sont d''une beauté à couper le souffle. Mon carnet complet arrive cette semaine 🏔️', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600', 'Randonneur au sommet d''un col alpin avec vue panoramique sur les vallées', 'share', 245, 67, 45, true, now() - interval '53 days'),
      (p12, u14, 'Torres del Paine au lever du soleil. Après 3 jours de vent violent, le ciel s''est dégagé à 6h du matin. Ce moment vaut tous les sacrifices. La Patagonie, c''est une autre planète 🌅', 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600', 'Torres del Paine au lever du soleil avec reflet dans le lac et ciel rose et orange', 'post', 312, 89, 67, true, now() - interval '46 days'),
      (p13, u15, 'Conseil Islande 🌋 Le sentier Fimmvörðuháls entre Skógar et Þórsmörk est probablement le plus beau de l''île. 25km entre deux volcans actifs, des cascades à chaque virage. Mais attention : la météo peut changer en 10 minutes !', null, null, 'tip', 134, 38, 28, false, now() - interval '38 days'),
      (p14, u16, 'GR20 terminé ! 15 jours, 180km, 12 000m D+. Le sentier le plus difficile d''Europe. Mes pieds ne me parlent plus mais mon âme est en paix. La Corse, c''est magique ❤️', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600', 'Randonneur au sommet du GR20 avec vue sur la mer Méditerranée et les montagnes corses', 'share', 189, 52, 34, true, now() - interval '33 days'),
      (p15, u17, 'Question vanlife 🚐 Vous gérez comment l''eau en van ? Je cherche un système de filtration compact pour éviter d''acheter des bouteilles en plastique. Des recommandations ?', null, null, 'question', 78, 45, 12, false, now() - interval '26 days'),
      (p16, u18, 'Kalymnos, le paradis des grimpeurs. 10 jours sur les falaises calcaires avec vue sur la mer Égée. Plus de 50 voies grimpées, du 5c au 7b. La Grèce, c''est aussi ça 🧗', 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0?w=600', 'Grimpeur sur falaise calcaire à Kalymnos avec mer Égée bleue en arrière-plan', 'post', 156, 43, 23, false, now() - interval '20 days'),
      (p17, u19, 'Mon premier ultra-trail de 80km dans les Dolomites. 18h de course, 4500m D+. Je suis arrivée en larmes mais debout. La prochaine étape : l''UTMB 2027 🏃‍♀️', 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600', 'Coureuse de trail dans les Dolomites avec vue sur les pics rocheux au coucher du soleil', 'share', 98, 31, 19, false, now() - interval '16 days'),
      (p18, u20, 'Maldives sous-marines. Requins baleines, raies manta, tortues. La plongée la plus belle de ma vie dans les eaux les plus claires du monde. Certains endroits méritent d''être protégés à tout prix 🐠', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600', 'Plongeur sous-marin aux Maldives avec raie manta géante et coraux colorés', 'post', 223, 58, 41, true, now() - interval '10 days'),
      (p19, u13, 'Astuce ski de rando ⛷️ Pour les peaux de phoque, appliquez du fart de retenue sur les spatules et les talons avant chaque sortie. Ça évite les bottes de neige et améliore la glisse. Petit geste, grand confort !', null, null, 'tip', 89, 24, 15, false, now() - interval '6 days'),
      (p20, u14, 'Kirghizistan, le pays des nomades. 2 semaines de trek en autonomie dans le Tian Shan. Yourtes, chevaux, lacs d''altitude. Un pays encore préservé du tourisme de masse. Foncez avant qu''il soit trop tard 🌄', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600', 'Randonneur avec cheval de bât dans les montagnes du Tian Shan avec lac d''altitude turquoise', 'share', 289, 76, 52, true, now() - interval '2 days'),
      (p21, u1_id, 'Conseil équipement 🎒 Après 10 ans de randonnée, ma règle d''or : si tu n''as pas utilisé un équipement lors de tes 3 dernières sorties, laisse-le à la maison. La légèreté, c''est la liberté.', null, null, 'tip', 167, 48, 34, true, now() - interval '50 days'),
      (p22, u2_id, 'Bikepacking Pyrénées : 18 jours, 1200km, 28 cols. La traversée complète d''est en ouest. Les Pyrénées à vélo, c''est une autre dimension. Chaque col est une victoire, chaque descente une récompense 🚵', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600', 'Cycliste avec vélo chargé au sommet d''un col pyrénéen avec vue panoramique', 'share', 198, 54, 38, true, now() - interval '43 days'),
      (p23, u3_id, 'Question nutrition trail 🍌 Après 20h de course, je ne peux plus avaler de sucré. Qu''est-ce que vous mangez sur les ultras pour tenir ? Les bouillons chauds m''ont sauvé à l''UTMB mais j''ai besoin d''autres idées.', null, null, 'question', 134, 89, 23, false, now() - interval '36 days'),
      (p24, u4_id, 'Ski de rando dans les Écrins. La Barre des Écrins (4102m) en conditions hivernales parfaites. -20°C au sommet, neige poudreuse, ciel bleu. Ces moments-là, ça se mérite ❄️', 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600', 'Skieur de randonnée au sommet de la Barre des Écrins avec vue sur les Alpes enneigées', 'post', 145, 39, 27, false, now() - interval '30 days'),
      (p25, u5_id, 'Kayak de mer en Bretagne 🚣 La presqu''île de Crozon en 7 jours. Des grottes marines, des plages sauvages, des dauphins. La Bretagne vue de la mer, c''est une autre Bretagne. Magnifique.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600', 'Kayakiste dans une grotte marine bretonne avec eau turquoise et falaises', 'post', 112, 32, 18, false, now() - interval '24 days'),
      (p26, u6_id, 'Via ferrata dans les Dolomites 🧗 5 itinéraires en 7 jours. La Lipella, la Tomaselli, la Alleghesi... Les Dolomites sont le terrain de jeu ultime pour les amateurs de verticalité. Incontournable !', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600', 'Grimpeur sur via ferrata dans les Dolomites avec vue sur les pics rocheux', 'post', 87, 24, 14, false, now() - interval '18 days'),
      (p27, u7_id, 'Astuce surf 🏄 Pour les débutants : ne cherchez pas les grosses vagues. Les vagues de 0.5 à 1m sont parfaites pour progresser. La technique avant la puissance. Et surtout, amusez-vous !', null, null, 'tip', 67, 19, 11, false, now() - interval '14 days'),
      (p28, u8_id, 'Tente MSR Hubba Hubba NX : 3 saisons de test. 80 nuits en bivouac, de la Bretagne aux Alpes. Résultat : imperméable, légère, facile à monter. Le seul défaut : la condensation par temps froid. Mais globalement, excellent investissement.', null, null, 'tip', 89, 26, 17, false, now() - interval '9 days'),
      (p29, u9_id, 'Question escalade 🧗 Je débute l''escalade en salle et je veux passer en falaise. Par où commencer ? Quel matériel minimum ? Est-ce que je dois prendre des cours ou je peux apprendre avec des amis expérimentés ?', null, null, 'question', 45, 34, 8, false, now() - interval '5 days'),
      (p30, u10_id, 'Première ascension du Mont Blanc ! 4810m, le toit de l''Europe occidentale. 2 jours d''ascension, bivouac au refuge des Grands Mulets, sommet à 7h du matin. Une émotion indescriptible. Merci à mon guide pour sa patience et sa sécurité ⛰️', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600', 'Alpiniste au sommet du Mont Blanc avec vue sur les Alpes et mer de nuages', 'share', 234, 67, 45, true, now() - interval '1 day')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ============================================================
  -- 8. Q&R SUPPLÉMENTAIRES
  -- ============================================================
  IF u13 IS NOT NULL THEN
    INSERT INTO public.qa_questions (id, author_id, title, content, tags, category, votes_count, answers_count, views_count, is_solved, created_at) VALUES
      (q6, u13, 'Quelle veste hardshell pour le ski de randonnée ?', 'Je cherche une veste hardshell pour le ski de randonnée. Budget 400-500€. J''hésite entre Arc''teryx Beta SL, Mammut Nordwand et Patagonia Triolet. Vos retours ?', ARRAY['veste','hardshell','ski','randonnée','gore-tex'], 'équipement', 38, 4, 1120, true, now() - interval '45 days'),
      (q7, u14, 'Comment choisir ses crampons pour l''alpinisme ?', 'Je débute l''alpinisme et je dois choisir mes premiers crampons. Crampons 10 pointes ou 12 pointes ? Fixation automatique ou semi-automatique ? Budget 150-200€.', ARRAY['crampons','alpinisme','débutant','équipement'], 'équipement', 29, 5, 876, true, now() - interval '38 days'),
      (q8, u15, 'Meilleure application de navigation hors ligne pour la randonnée ?', 'Je cherche une application de navigation hors ligne pour la randonnée. J''utilise actuellement Maps.me mais je cherche quelque chose de plus adapté aux sentiers. Komoot, Wikiloc, AllTrails ?', ARRAY['application','navigation','hors-ligne','randonnée','gps'], 'numérique', 45, 6, 1890, false, now() - interval '30 days'),
      (q9, u16, 'Comment préparer physiquement le GR20 ?', 'Je prépare le GR20 pour juin 2026. Je cours 3 fois par semaine (10km) et je fais de la randonnée le week-end. Est-ce suffisant ? Quel programme de préparation recommandez-vous ?', ARRAY['gr20','préparation','physique','randonnée','corse'], 'préparation', 34, 7, 1450, true, now() - interval '25 days'),
      (q10, u17, 'Quel système d''eau pour le vanlife ?', 'Je prépare l''aménagement de mon van. Je cherche un système d''eau potable compact et économique. Jerricane + pompe manuelle ou système sous pression ? Vos recommandations ?', ARRAY['vanlife','eau','aménagement','van','système'], 'vanlife', 22, 4, 678, false, now() - interval '20 days'),
      (q11, u18, 'Progression en escalade : comment passer du 6a au 7a ?', 'Je grimpe régulièrement en salle depuis 2 ans. Je suis à l''aise en 6b/6b+. Comment progresser vers le 7a ? Entraînement spécifique, travail de la force, technique ?', ARRAY['escalade','progression','entraînement','technique','force'], 'escalade', 41, 5, 1230, false, now() - interval '15 days'),
      (q12, u19, 'Nutrition avant et pendant un ultra-trail de 100km ?', 'Je prépare mon premier 100km. Comment gérer la nutrition les jours avant la course ? Et pendant : fréquence, quantité, types d''aliments ? J''ai tendance à avoir des problèmes digestifs.', ARRAY['nutrition','ultra-trail','100km','préparation','digestion'], 'nutrition', 56, 8, 2340, true, now() - interval '10 days'),
      (q13, u20, 'Meilleur spot de plongée en Méditerranée pour débutant ?', 'Je suis certifié PADI Open Water depuis 6 mois. Je cherche un spot de plongée en Méditerranée adapté aux débutants avec une belle faune marine. Budget raisonnable.', ARRAY['plongée','méditerranée','débutant','spot','faune'], 'plongée', 28, 4, 890, false, now() - interval '7 days'),
      (q14, u13, 'Comment gérer le mal des transports en altitude ?', 'J''ai souffert du mal des montagnes lors de mon dernier trek au-dessus de 3500m. Maux de tête, nausées, fatigue. Comment mieux gérer l''acclimatation ? Le Diamox est-il vraiment efficace ?', ARRAY['altitude','acclimatation','mal-des-montagnes','diamox','santé'], 'santé', 47, 6, 1780, true, now() - interval '5 days'),
      (q15, u14, 'Quel sac à dos pour un trek de 3 semaines en autonomie ?', 'Je prépare un trek de 3 semaines en autonomie complète au Kirghizistan. Pas de ravitaillement possible. J''ai besoin de porter 20-22kg. Quel sac à dos recommandez-vous ? Budget 300€ max.', ARRAY['sac-à-dos','autonomie','trek','kirghizistan','charge'], 'équipement', 31, 5, 1120, false, now() - interval '2 days')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.qa_answers (id, question_id, author_id, content, votes_count, is_accepted, created_at) VALUES
      (qa7, q6, u13, 'J''ai la Beta SL depuis 3 ans pour le ski de rando. Légère (315g), imperméable, respirante. Parfaite pour les montées. Le seul bémol : elle n''est pas très chaude. Prévoyez une couche intermédiaire. La Mammut Nordwand est plus robuste mais plus lourde.', 32, true, now() - interval '43 days'),
      (qa8, q7, u4_id, 'Pour débuter l''alpinisme, les crampons 10 pointes en fixation semi-automatique sont parfaits. Les Petzl Vasak ou les Black Diamond Sabretooth sont d''excellents choix. Évitez les crampons automatiques au début, ils nécessitent des chaussures spécifiques.', 28, true, now() - interval '36 days'),
      (qa9, q8, u2_id, 'Komoot est ma recommandation. Interface intuitive, cartes topo détaillées, téléchargement hors ligne facile. La version premium vaut vraiment le coup pour les randonneurs réguliers. AllTrails est bien aussi pour les avis communautaires.', 41, false, now() - interval '28 days'),
      (qa10, q8, u1_id, 'J''utilise Wikiloc depuis 5 ans. La base de données de traces est immense, les cartes IGN sont disponibles en France. L''interface est moins jolie que Komoot mais les fonctionnalités sont excellentes.', 35, false, now() - interval '27 days'),
      (qa11, q9, u3_id, 'Pour le GR20, votre préparation actuelle est un bon début mais insuffisante. Ajoutez des sorties avec dénivelé (minimum 1000m D+ par sortie), portez un sac de 10-12kg, et faites au moins 2 sorties de 2 jours consécutifs avec bivouac. Commencez 6 mois avant.', 45, true, now() - interval '23 days'),
      (qa12, q12, u3_id, 'Pour un 100km : la veille, repas riche en glucides complexes (pâtes, riz). Pendant la course : 60-80g de glucides par heure, alterner sucré et salé. Si problèmes digestifs : évitez les gels, préférez les barres de céréales et les fruits secs. Les bouillons chauds aux ravitaillements sont vos amis.', 67, true, now() - interval '8 days'),
      (qa13, q12, u1_id, 'Ajout important : testez votre nutrition à l''entraînement sur des sorties longues (6h+). Ce qui fonctionne en course courte peut ne pas fonctionner sur 100km. Et hydratez-vous régulièrement, même si vous n''avez pas soif.', 43, false, now() - interval '7 days'),
      (qa14, q14, u1_id, 'Le Diamox (acétazolamide) est efficace mais a des effets secondaires (fourmillements, mictions fréquentes). Consultez un médecin avant. La meilleure prévention reste la montée progressive. Règle d''or : ne montez pas de plus de 300-500m par jour au-dessus de 3000m.', 52, true, now() - interval '4 days'),
      (qa15, q6, u14, 'La Patagonie Triolet est une excellente option aussi. Gore-Tex 3 couches, légère, bonne respirabilité. Moins chère que l''Arc''teryx pour des performances similaires. Je l''utilise depuis 2 saisons sans problème.', 19, false, now() - interval '42 days'),
      (qa16, q11, u18, 'Pour progresser du 6a au 7a : 1) Travaillez la force des doigts (poutre, campus board). 2) Grimpez des voies de votre niveau en tête régulièrement. 3) Travaillez la technique (pieds, équilibre). 4) Grimpez avec des gens meilleurs que vous. 5) Soyez patient, ça prend du temps.', 38, false, now() - interval '13 days'),
      (qa17, q15, u2_id, 'Pour 20-22kg sur 3 semaines, le Gregory Baltoro 75 ou le Osprey Aether 70 sont excellents. Ils sont conçus pour les charges lourdes avec un système de suspension qui répartit bien le poids. Prévoyez aussi une ceinture ventrale bien réglée.', 24, false, now() - interval '1 day'),
      (qa18, q13, u5_id, 'Pour débuter en Méditerranée : Port-Cros (Var) est magnifique et protégé. Les Calanques (Marseille) sont accessibles. En Corse, les Îles Lavezzi sont exceptionnelles. Pour la faune : mérous, murènes, poulpes, posidonie. Évitez juillet-août pour la visibilité.', 31, false, now() - interval '5 days')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ============================================================
  -- 9. SESSIONS AMA SUPPLÉMENTAIRES
  -- ============================================================
  IF u13 IS NOT NULL THEN
    INSERT INTO public.ama_sessions (id, expert_id, title, description, scheduled_at, duration_minutes, status, participants_count, questions_count, created_at) VALUES
      (ama3, u13, 'AMA : Traverser les Alpes à pied — Le GR5 de A à Z', 'Clara Fontaine, randonneuse et auteure, répond à toutes vos questions sur la traversée des Alpes à pied. Préparation, équipement, refuges, budget, et les moments inoubliables.', now() - interval '10 days', 90, 'ended', 312, 67, now() - interval '15 days'),
      (ama4, u14, 'AMA : Patagonie — Préparer son expédition', 'Hugo Renard, explorateur et photographe, partage son expérience de la Patagonie et répond à vos questions sur la préparation, la logistique et les incontournables.', now() + interval '5 days', 120, 'upcoming', 245, 45, now() - interval '5 days'),
      (ama5, u17, 'AMA : Vivre en van — 6 mois d''expérience', 'Alice Perrin, vanlifer depuis 2 ans, répond à toutes vos questions sur la vie en van : aménagement, budget, spots, vie sociale et les galères du quotidien.', now() - interval '5 days', 90, 'ended', 189, 52, now() - interval '8 days'),
      (ama6, u3_id, 'AMA : Courir l''UTMB — Préparation et récit', 'Sophie Bernard, finisher UTMB 2025 en 38h12, répond à vos questions sur la préparation physique, la nutrition, la gestion mentale et les secrets de l''UTMB.', now() + interval '15 days', 120, 'upcoming', 423, 89, now() - interval '2 days')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.ama_questions (id, session_id, author_id, content, votes_count, is_answered, answer, answered_at, created_at) VALUES
      (amaq5, ama3, u16, 'Combien de temps faut-il pour préparer la traversée complète du GR5 ?', 45, true, 'Pour le GR5 complet (45 jours), comptez 6 mois de préparation minimum. Commencez par des randonnées de 2-3 jours avec dénivelé, puis augmentez progressivement. L''important est d''habituer vos pieds et vos épaules au portage. Faites au moins 3 sorties de 5 jours consécutifs avant le départ.', now() - interval '10 days', now() - interval '12 days'),
      (amaq6, ama3, u4_id, 'Quel budget prévoir pour le GR5 complet ?', 38, true, 'Budget GR5 complet : refuges 25-40€/nuit, repas en refuge 15-25€, nourriture en bivouac 8-12€/jour. Total hébergement + nourriture : 1500-2500€ pour 45 jours. Ajoutez le transport (500-800€) et le matériel si vous n''avez pas tout. Budget total : 3000-5000€.', now() - interval '10 days', now() - interval '11 days'),
      (amaq7, ama5, u15, 'Quel budget mensuel pour vivre en van en Europe ?', 52, true, 'Budget mensuel van en Europe : carburant 300-500€, camping/spots 100-200€, nourriture 300-400€, entretien van 100-200€, activités 100-200€. Total : 900-1500€/mois selon votre style de vie. C''est moins cher qu''un appartement à Paris !', now() - interval '5 days', now() - interval '6 days'),
      (amaq8, ama5, u20, 'Comment gérer la solitude en van solo ?', 41, true, 'La solitude en van solo est réelle mais gérable. Mes conseils : rejoignez des communautés vanlife locales, utilisez les applications de rencontre entre vanlifers (iOverlander, Park4Night), participez aux rassemblements. Et parfois, la solitude est une chance de se retrouver soi-même.', now() - interval '5 days', now() - interval '5 days'),
      (amaq9, ama4, u1_id, 'Quelle est la meilleure période pour aller en Patagonie ?', 34, false, '', null, now() - interval '3 days'),
      (amaq10, ama4, u13, 'Comment gérer les vents violents en Patagonie ?', 28, false, '', null, now() - interval '2 days'),
      (amaq11, ama6, u19, 'Comment gérer les hallucinations nocturnes sur un ultra de 100km+ ?', 67, false, '', null, now() - interval '1 day'),
      (amaq12, ama6, u16, 'Quel plan d''entraînement pour passer du 50km à l''UTMB en 2 ans ?', 54, false, '', null, now() - interval '12 hours')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ============================================================
  -- 10. OCCASION / ENCHÈRES / LOCATION SUPPLÉMENTAIRES
  -- ============================================================
  IF u13 IS NOT NULL THEN
    INSERT INTO public.occasion_items (id, seller_id, title, price, original_price, condition, location, image, alt, negotiable, shipping, status, created_at) VALUES
      (oc6, u13, 'Sac à dos Gregory Baltoro 75L — Très bon état', 185, 320, 'tres_bon', 'Grenoble, 38', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', 'Sac à dos d''expédition Gregory vert 75 litres posé sur rocher en montagne', true, true, 'active', now() - interval '20 days'),
      (oc7, u14, 'Tente Hilleberg Nallo 2 GT — Comme neuf', 580, 749, 'comme_neuf', 'Lyon, 69', 'https://images.unsplash.com/photo-1571364588707-8638d6c49fea?w=400', 'Tente Hilleberg rouge montée dans paysage arctique enneigé', false, true, 'active', now() - interval '18 days'),
      (oc8, u15, 'Veste Arc''teryx Beta AR — Taille S', 290, 550, 'bon', 'Paris, 75', 'https://images.unsplash.com/photo-1618143928355-3d9afff6ec23?w=400', 'Veste imperméable Arc''teryx rouge portée par randonneur sur crête rocheuse', true, true, 'active', now() - interval '15 days'),
      (oc9, u16, 'Chaussures La Sportiva TX5 GTX — Taille 42', 95, 195, 'bon', 'Marseille, 13', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', 'Chaussures de randonnée La Sportiva jaunes et noires sur terrain rocheux', false, false, 'active', now() - interval '12 days'),
      (oc10, u17, 'Réchaud Jetboil Flash + 3 cartouches gaz', 55, 89, 'excellent', 'Bordeaux, 33', 'https://images.unsplash.com/photo-1729872416347-38d7dfbef04e?w=400', 'Réchaud Jetboil orange avec casserole et cartouches de gaz sur table de camping', false, true, 'active', now() - interval '10 days'),
      (oc11, u18, 'Baudrier Black Diamond Momentum + dégaines (6)', 75, 130, 'bon', 'Toulouse, 31', 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0?w=400', 'Baudrier d''escalade Black Diamond rouge avec dégaines sur fond blanc', true, true, 'active', now() - interval '8 days'),
      (oc12, u19, 'Montre Garmin Fenix 6 Pro — Très bon état', 280, 550, 'tres_bon', 'Nantes, 44', 'https://img.rocket.new/generatedImages/rocket_gen_img_1b4042735-1772899176488.png', 'Montre GPS Garmin Fenix 6 Pro noire avec bracelet sport sur fond blanc', true, true, 'active', now() - interval '6 days'),
      (oc13, u20, 'Combinaison de plongée 5mm — Taille M', 120, 280, 'bon', 'Nice, 06', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400', 'Combinaison de plongée noire 5mm suspendue sur cintre avec palmes et masque', false, false, 'active', now() - interval '4 days'),
      (oc14, u13, 'Sac de couchage Cumulus Panyam 450 — Excellent', 195, 299, 'excellent', 'Grenoble, 38', 'https://images.unsplash.com/photo-1663707333537-9808bb2a84a0?w=400', 'Sac de couchage Cumulus vert compressé dans son sac de transport sur fond blanc', false, true, 'active', now() - interval '2 days'),
      (oc15, u14, 'Skis de rando Dynafit Blacklight 88 + fixations', 420, 850, 'bon', 'Chamonix, 74', 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400', 'Skis de randonnée Dynafit avec fixations sur neige fraîche en montagne', true, false, 'active', now() - interval '1 day')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.auction_items (id, seller_id, title, start_price, current_bid, buy_now_price, condition, ends_at, bids_count, watchers_count, image, alt, status, created_at) VALUES
      (au4, u15, 'Sac à dos Hyperlite 3400 SW — Ultralight', 220, 285, 380, 'excellent', now() + interval '4 days', 7, 28, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', 'Sac à dos ultralight blanc Hyperlite avec structure minimaliste sur fond blanc', 'active', now() - interval '3 days'),
      (au5, u16, 'Tente MSR Hubba Hubba NX 2P — Excellent état', 280, 340, 450, 'excellent', now() + interval '6 days', 9, 31, 'https://images.unsplash.com/photo-1571364588707-8638d6c49fea?w=400', 'Tente MSR orange montée sur terrain rocheux avec vue sur montagne', 'active', now() - interval '2 days'),
      (au6, u17, 'Vélo bikepacking Salsa Cutthroat — Taille M', 1200, 1450, 1800, 'bon', now() + interval '8 days', 12, 45, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', 'Vélo de bikepacking gris avec sacoches chargées sur route de montagne', 'active', now() - interval '5 days'),
      (au7, u18, 'Corde d''escalade Beal Booster 9.7mm 60m', 85, 110, 160, 'bon', now() + interval '3 days', 6, 19, 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0?w=400', 'Corde d''escalade Beal orange enroulée sur fond blanc', 'active', now() - interval '1 day'),
      (au8, u19, 'Montre Suunto Vertical Titanium Solar', 450, 520, 699, 'excellent', now() + interval '10 days', 15, 52, 'https://img.rocket.new/generatedImages/rocket_gen_img_1b4042735-1772899176488.png', 'Montre GPS Suunto Vertical en titane avec cadran cartographique sur fond blanc', 'active', now() - interval '4 days')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.rental_items (id, owner_id, title, price_per_day, price_per_week, deposit, condition, location, distance_km, available, rating, reviews_count, image, alt, created_at) VALUES
      (re5, u13, 'Kit ski de randonnée complet (skis + chaussures + peaux)', 45, 250, 400, 'excellent', 'Grenoble, 38', 4.2, true, 4.8, 19, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400', 'Kit ski de randonnée complet avec skis, chaussures et peaux de phoque sur neige', now() - interval '90 days'),
      (re6, u14, 'Appareil photo Sony A7III + objectifs', 55, 320, 500, 'excellent', 'Lyon, 69', 3.1, true, 4.9, 27, 'https://images.unsplash.com/photo-1734902204925-4544ef4eb744?w=400', 'Appareil photo Sony A7III avec objectifs sur table de photographe', now() - interval '75 days'),
      (re7, u15, 'Tente Hilleberg Nallo 2 GT — 4 saisons', 30, 170, 300, 'excellent', 'Paris, 75', 8.5, true, 4.7, 14, 'https://images.unsplash.com/photo-1571364588707-8638d6c49fea?w=400', 'Tente Hilleberg rouge montée dans paysage arctique enneigé', now() - interval '60 days'),
      (re8, u16, 'Kit escalade complet (baudrier + corde + dégaines)', 25, 140, 200, 'bon', 'Marseille, 13', 2.8, true, 4.6, 11, 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0?w=400', 'Kit d''escalade complet avec baudrier, corde et dégaines sur fond blanc', now() - interval '45 days'),
      (re9, u17, 'Van aménagé 2 personnes — Week-end ou semaine', 80, 450, 600, 'excellent', 'Bordeaux, 33', 6.3, true, 4.9, 34, 'https://images.unsplash.com/photo-1675912739409-84ab21c16004?w=400', 'Van aménagé garé devant paysage montagneux au coucher du soleil', now() - interval '120 days'),
      (re10, u18, 'Kit via ferrata complet (baudrier + longe + casque)', 20, 110, 150, 'bon', 'Toulouse, 31', 5.7, true, 4.5, 8, 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0?w=400', 'Kit de via ferrata complet avec baudrier, longe Y et casque sur fond blanc', now() - interval '30 days')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ============================================================
  -- 11. AMBASSADEURS SUPPLÉMENTAIRES
  -- ============================================================
  INSERT INTO public.ambassadors (name, handle, tier, followers, commission_pct, earnings, clicks, conversions, promo_code, avatar, status)
  VALUES
    ('Hugo Aventure', '@hugoaventure', 'Legend', '312K', 15, 6840, 18900, 456, 'HUGO15', 'HA', 'active'),
    ('Clara Outdoor', '@claraoutdoor', 'Trailblazer', '124K', 12, 3240, 9800, 245, 'CLARA12', 'CO', 'active'),
    ('Maxime Trail', '@maximetrail', 'Trailblazer', '78K', 12, 1890, 5600, 142, 'MAXIME12', 'MT', 'active'),
    ('Sophie Rando', '@sophierando', 'Explorer', '42K', 8, 1120, 3400, 87, 'SOPHIE8', 'SR', 'active'),
    ('Lucas Alpin', '@lucasalpin', 'Explorer', '28K', 8, 780, 2300, 58, 'LUCAS8', 'LA', 'active'),
    ('Emma Vanlife', '@emmavanlife', 'Trailblazer', '95K', 12, 2560, 7800, 198, 'EMMA12', 'EV', 'active'),
    ('Pierre Kayak', '@pierrekayak', 'Explorer', '19K', 8, 450, 1400, 36, 'PIERRE8', 'PK', 'active'),
    ('Julie Escalade', '@julieescalade', 'Explorer', '35K', 8, 890, 2700, 68, 'JULIE8', 'JE2', 'active'),
    ('Antoine Ski', '@antoineski', 'Trailblazer', '67K', 12, 1670, 5100, 128, 'ANTOINE12', 'AS', 'active'),
    ('Camille Trek', '@camilletrek', 'Legend', '189K', 15, 4120, 12400, 312, 'CAMILLE15', 'CT', 'active'),
    ('Nicolas Photo', '@nicolasphoto', 'Explorer', '23K', 8, 560, 1700, 43, 'NICOLAS8', 'NP', 'active'),
    ('Léa Surf', '@leasurf', 'Explorer', '31K', 8, 720, 2200, 55, 'LEASURF8', 'LS2', 'active')
  ON CONFLICT (promo_code) DO NOTHING;

  -- Codes promo supplémentaires
  INSERT INTO public.promo_codes (code, uses, revenue, status) VALUES
    ('HUGO15', 456, 113688, 'active'),
    ('CLARA12', 245, 61250, 'active'),
    ('MAXIME12', 142, 35500, 'active'),
    ('SOPHIE8', 87, 17400, 'active'),
    ('LUCAS8', 58, 11600, 'active'),
    ('EMMA12', 198, 49500, 'active'),
    ('PIERRE8', 36, 7200, 'active'),
    ('JULIE8', 68, 13600, 'active'),
    ('ANTOINE12', 128, 32000, 'active'),
    ('CAMILLE15', 312, 77688, 'active'),
    ('NICOLAS8', 43, 8600, 'active'),
    ('LEASURF8', 55, 11000, 'active'),
    ('WINTER25', 2341, 234100, 'expired'),
    ('PROMO20', 1567, 156700, 'expired'),
    ('NEWMEMBER', 4892, 244600, 'expired'),
    ('FLASH48H', 892, 89200, 'expired')
  ON CONFLICT (code) DO NOTHING;

  -- ============================================================
  -- 12. AVIS SUPPLÉMENTAIRES
  -- ============================================================
  INSERT INTO public.reviews (type, target_name, rating, title, comment, verified, helpful_count, created_at)
  VALUES
    ('produit', 'Hoka Speedgoat 5', 5, 'La chaussure de trail parfaite', 'Après 3 paires de Speedgoat, je ne changerai jamais. L''amorti est exceptionnel sur les longues distances, l''accroche Vibram est parfaite sur tous les terrains. J''ai couru l''UTMB avec et mes pieds étaient encore en bon état à l''arrivée.', true, 45, now() - interval '80 days'),
    ('produit', 'Garmin Fenix 8 Solar', 5, 'La montre GPS ultime pour l''aventure', 'Après 6 mois d''utilisation intensive (trail, ski, randonnée), cette montre est parfaite. Autonomie incroyable avec le solaire, cartographie topo précise, altimètre barométrique fiable. L''investissement le plus utile de mon équipement.', true, 38, now() - interval '65 days'),
    ('produit', 'Hilleberg Nallo 2 GT', 5, 'La tente des conditions extrêmes', 'Testée en Islande par vent de 100 km/h et en Patagonie par vent de 120 km/h. Aucun problème. La qualité suédoise, ça se ressent. Oui, c''est cher. Mais c''est pour la vie.', true, 52, now() - interval '55 days'),
    ('produit', 'Osprey Exos 58', 4, 'Excellent sac, attention au poids max', 'Sac fantastique pour les randonnées légères. Le système de suspension est révolutionnaire. Attention : ne pas dépasser 15kg, le sac n''est pas conçu pour les charges lourdes. Pour les treks ultralight, c''est parfait.', true, 29, now() - interval '48 days'),
    ('expert', 'Pierre Chamonix', 5, 'Guide exceptionnel, sécurité maximale', 'J''ai fait l''ascension du Mont Blanc avec Pierre. Sa connaissance du terrain est impressionnante, sa gestion de la sécurité irréprochable. Il adapte le rythme à chaque membre du groupe. Je le recommande sans hésitation pour tout projet en haute montagne.', true, 34, now() - interval '40 days'),
    ('produit', 'MSR PocketRocket 2', 5, 'Le réchaud parfait pour le bivouac', 'Léger, compact, fiable. J''ai utilisé ce réchaud dans des conditions extrêmes (-20°C en altitude, vent fort) et il n''a jamais failli. L''ébullition est rapide et la consommation de gaz raisonnable. Indispensable dans tout kit de bivouac.', true, 27, now() - interval '35 days'),
    ('produit', 'Therm-a-Rest NeoAir XLite', 5, 'Le meilleur matelas gonflable du marché', 'Après avoir essayé 5 matelas différents, le NeoAir XLite est de loin le meilleur. Léger (354g), chaud (R-value 4.2), confortable. Le bruit est un peu gênant mais on s''y habitue. Parfait pour les bivouacs en altitude.', true, 41, now() - interval '28 days'),
    ('kit', 'Kit Islande Trek & Volcans', 5, 'Kit parfaitement adapté à l''Islande', 'J''ai utilisé ce kit pour le Laugavegur Trail. Chaque pièce était parfaitement adaptée aux conditions islandaises. La veste hardshell a résisté à des pluies torrentielles, les chaussures ont tenu sur les terrains volcaniques. Excellent travail de sélection.', true, 23, now() - interval '22 days'),
    ('produit', 'Petzl Actik Core', 4, 'Bonne lampe frontale rechargeable', 'La lampe frontale rechargeable idéale pour la randonnée. 450 lumens suffisent pour la plupart des situations. La batterie rechargeable est pratique. Seul bémol : l''autonomie diminue rapidement en mode haute puissance. Mais pour un usage normal, c''est parfait.', true, 18, now() - interval '18 days'),
    ('expert', 'Nadia Volkov', 5, 'Coach trail exceptionnelle', 'J''ai suivi un programme de préparation avec Nadia pour mon premier 100km. Ses conseils sur la nutrition et la gestion mentale ont été déterminants. J''ai terminé la course en 22h, bien au-delà de mes espérances. Merci Nadia !', true, 31, now() - interval '12 days'),
    ('produit', 'Katadyn BeFree 1L', 5, 'Le filtre à eau le plus pratique', 'Léger, rapide, efficace. Le BeFree est devenu indispensable dans mon kit. Je l''utilise sur toutes mes randonnées en montagne. Le débit est excellent et la poche souple est très pratique. Beaucoup mieux que les filtres à pompe.', true, 22, now() - interval '8 days'),
    ('produit', 'Black Diamond Spot 400', 4, 'Lampe frontale fiable et polyvalente', 'La lampe frontale de référence pour la randonnée et le camping. 400 lumens, mode rouge, résistante à l''eau. La batterie dure longtemps. Le seul bémol : le bouton est parfois difficile à actionner avec des gants. Mais globalement, excellent produit.', true, 15, now() - interval '4 days'),
    ('produit', 'Patagonia Nano Puff', 5, 'La doudoune légère parfaite', 'La Nano Puff est ma doudoune de voyage depuis 3 ans. Légère, compressible, chaude pour son poids. L''isolation PrimaLoft reste efficace même humide, contrairement au duvet. Parfaite comme couche intermédiaire ou pour les soirées fraîches.', true, 19, now() - interval '2 days'),
    ('produit', 'Garmin inReach Mini 2', 5, 'Sécurité indispensable en zone isolée', 'La balise de secours qui peut vous sauver la vie. J''ai dû l''utiliser une fois lors d''une chute en montagne. Les secours sont arrivés en 45 minutes. L''abonnement mensuel vaut largement le prix pour la tranquillité d''esprit.', true, 67, now() - interval '1 day'),
    ('kit', 'Kit GR20 Corse Intégrale', 4, 'Kit bien pensé, quelques ajustements', 'Le kit GR20 est très bien conçu pour ce trek exigeant. J''ai juste remplacé la tente par une version plus légère et ajouté des chaussettes supplémentaires. La liste de poids est précise et les conseils sont pertinents. Je recommande.', true, 16, now() - interval '6 hours')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 13. BADGES SUPPLÉMENTAIRES
  -- ============================================================
  INSERT INTO public.badges (name, description, icon, rarity, holders_count)
  VALUES
    ('Traverseur des Alpes', 'Traversée complète des Alpes (GR5 ou équivalent)', '🏔️', 'Épique', 45),
    ('Roi du Désert', 'Traversée d''un désert en autonomie (>100km)', '🏜️', 'Légendaire', 23),
    ('Finisher Ultra', 'Terminer un ultra-trail de plus de 80km', '🏃', 'Épique', 156),
    ('Skieur des Sommets', 'Ski de randonnée sur un 4000m alpin', '⛷️', 'Rare', 234),
    ('Grimpeur Confirmé', 'Escalader une voie de niveau 7a ou plus', '🧗', 'Rare', 312),
    ('Kayakiste des Mers', 'Traversée maritime de plus de 100km en kayak', '🚣', 'Épique', 67),
    ('Vanlifer Confirmé', '6 mois de vie en van en continu', '🚐', 'Rare', 456),
    ('Plongeur des Abysses', 'Plongée à plus de 40m de profondeur', '🤿', 'Rare', 189),
    ('Photographe Nature', '100 photos partagées sur la communauté', '📸', 'Commun', 1234),
    ('Mentor Communauté', '100 réponses utiles dans le forum', '🎓', 'Épique', 89),
    ('Collectionneur de Pays', 'Visiter 20 pays différents', '🌍', 'Rare', 567),
    ('Ambassadeur Elite', 'Générer 10 000€ de ventes via son code promo', '⭐', 'Légendaire', 34)
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 14. DÉFIS GLOBAUX SUPPLÉMENTAIRES
  -- ============================================================
  INSERT INTO public.challenges (title, description, xp, category, difficulty, total, deadline, active)
  VALUES
    ('Photographe Aventurier', 'Partagez 10 photos de vos aventures sur la communauté', 400, 'Social', 'Facile', 10, '', true),
    ('Mentor de la Communauté', 'Répondez à 20 questions dans le forum avec une réponse acceptée', 1500, 'Social', 'Difficile', 20, '', true),
    ('Collectionneur de Kits', 'Configurez 5 kits différents avec le configurateur IA', 600, 'Équipement', 'Moyen', 5, '', true),
    ('Explorateur de Pays', 'Consultez les fiches de 25 destinations différentes', 800, 'Découverte', 'Moyen', 25, '', true),
    ('Vendeur de Confiance', 'Réalisez 5 ventes sur la marketplace avec 5 étoiles', 1000, 'Marketplace', 'Difficile', 5, '', true),
    ('Carnet d''Or', 'Publiez 5 carnets d''expédition avec plus de 50 likes chacun', 2000, 'Contenu', 'Difficile', 5, '31 déc. 2026', true),
    ('Défi Ultralight', 'Configurez un kit de moins de 7kg pour un trek de 7 jours', 700, 'Équipement', 'Difficile', 1, '', true),
    ('Ambassadeur Actif', 'Générer 50 clics via votre code promo en 30 jours', 500, 'Ambassadeur', 'Moyen', 50, '', true)
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 15. GUIDES SUPPLÉMENTAIRES (si la table existe)
  -- ============================================================
  INSERT INTO public.guides (slug, title, category, destination, read_time, difficulty, image, alt, excerpt, tags, featured, created_at)
  VALUES
    ('guide-gr20-complet', 'Guide complet du GR20 : tout ce qu''il faut savoir', 'Destination', 'Corse', 25, 'Expert', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4', 'Randonneur sur crête rocheuse du GR20 avec vue sur la mer Méditerranée', 'Le GR20 est considéré comme le sentier de grande randonnée le plus difficile d''Europe. Ce guide complet vous prépare à cette aventure exceptionnelle : itinéraire, refuges, équipement, budget et conseils pratiques.', ARRAY['gr20','corse','randonnée','guide','expert'], true, now() - interval '90 days'),
    ('checklist-trek-nepal', 'Checklist complète pour un trek au Népal', 'Checklist', 'Népal', 15, 'Intermédiaire', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa', 'Randonneur avec sac à dos sur sentier himalayan avec vue sur les sommets enneigés', 'Tout ce qu''il faut emporter pour un trek au Népal : équipement, documents, médicaments, argent. Une checklist exhaustive validée par des guides professionnels.', ARRAY['népal','checklist','trek','himalaya','préparation'], true, now() - interval '75 days'),
    ('guide-achat-tente-randonnee', 'Comment choisir sa tente de randonnée en 2026', 'Guide d''achat', 'Universel', 12, 'Débutant', 'https://images.unsplash.com/photo-1571364588707-8638d6c49fea', 'Plusieurs tentes de randonnée de différentes marques installées dans un paysage alpin', 'Tente 3 saisons ou 4 saisons ? Autoportante ou non ? Légère ou robuste ? Ce guide d''achat vous aide à choisir la tente parfaite selon votre usage et votre budget.', ARRAY['tente','guide-achat','randonnée','équipement','comparatif'], false, now() - interval '60 days'),
    ('guide-nutrition-trail', 'Nutrition pour le trail et l''ultra-trail', 'Guide pratique', 'Universel', 18, 'Intermédiaire', 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571', 'Coureur de trail avec ceinture de ravitaillement sur sentier de montagne', 'Comment gérer la nutrition avant, pendant et après un trail ou un ultra-trail. Glucides, protéines, hydratation, gels, barres... Tout ce que vous devez savoir pour performer et récupérer.', ARRAY['nutrition','trail','ultra','performance','récupération'], false, now() - interval '50 days'),
    ('comparatif-gps-randonnee-2026', 'Comparatif GPS randonnée 2026 : Garmin vs Suunto vs Coros', 'Comparatif', 'Universel', 20, 'Intermédiaire', 'https://img.rocket.new/generatedImages/rocket_gen_img_1b4042735-1772899176488.png', 'Trois montres GPS de randonnée côte à côte sur fond blanc', 'Garmin Fenix 8, Suunto Vertical ou Coros Vertix 3 ? Ce comparatif détaillé analyse les performances, l''autonomie, la cartographie et le rapport qualité/prix de chaque montre GPS.', ARRAY['gps','comparatif','garmin','suunto','coros'], true, now() - interval '40 days'),
    ('guide-securite-avalanche', 'Sécurité avalanche : le guide essentiel', 'Guide pratique', 'Alpes', 22, 'Expert', 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256', 'Skieurs de randonnée avec kit DVA/sonde/pelle dans paysage alpin enneigé', 'Tout ce qu''il faut savoir sur la sécurité avalanche : lecture du bulletin de risque, utilisation du DVA, techniques de recherche, premiers secours. Un guide qui peut vous sauver la vie.', ARRAY['avalanche','sécurité','ski','dvA','montagne'], false, now() - interval '30 days'),
    ('guide-vanlife-debutant', 'Débuter le vanlife : le guide complet', 'Guide pratique', 'Europe', 30, 'Débutant', 'https://images.unsplash.com/photo-1675912739409-84ab21c16004', 'Van aménagé garé devant paysage montagneux avec équipement de camping visible', 'Vous rêvez de vivre en van ? Ce guide complet vous explique tout : choisir son van, l''aménager, gérer l''eau et l''électricité, trouver des spots, gérer le budget et les aspects légaux.', ARRAY['vanlife','débutant','aménagement','budget','liberté'], true, now() - interval '20 days'),
    ('checklist-escalade-grande-voie', 'Checklist escalade grande voie : matériel et sécurité', 'Checklist', 'Universel', 10, 'Expert', 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0', 'Grimpeur en grande voie avec équipement complet visible sur paroi rocheuse', 'La checklist complète pour l''escalade en grande voie : matériel obligatoire, vérifications de sécurité, gestion des longueurs et des rappels. Ne partez jamais sans avoir tout vérifié.', ARRAY['escalade','grande-voie','checklist','sécurité','matériel'], false, now() - interval '15 days'),
    ('guide-patagonie-torres-del-paine', 'Torres del Paine : le guide ultime du trek W', 'Destination', 'Patagonie', 28, 'Intermédiaire', 'https://images.unsplash.com/photo-1501854140801-50d01698950b', 'Torres del Paine au lever du soleil avec reflet dans le lac et randonneur au premier plan', 'Le trek W dans le parc national Torres del Paine est l''un des plus beaux au monde. Ce guide détaille l''itinéraire, les refuges, la logistique, le budget et les meilleures périodes pour y aller.', ARRAY['patagonie','torres-del-paine','trek','chili','guide'], true, now() - interval '10 days'),
    ('guide-ultralight-hiking', 'Ultralight hiking : réduire son sac à moins de 7kg', 'Guide pratique', 'Universel', 25, 'Intermédiaire', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62', 'Randonneur avec sac à dos ultralight sur sentier de montagne avec vue panoramique', 'Comment réduire son sac à moins de 7kg pour un trek de plusieurs jours ? Ce guide pratique vous explique les principes de l''ultralight hiking, les équipements à privilégier et les compromis à faire.', ARRAY['ultralight','sac','randonnée','légèreté','équipement'], false, now() - interval '5 days')
  ON CONFLICT (slug) DO NOTHING;

  RAISE NOTICE 'Massive content expansion completed successfully!';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Content expansion error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;
