-- ============================================================
-- FIX SEED DATA — Kit du Voyageur
-- Insère les utilisateurs dans auth.users avec UUIDs fixes
-- puis toutes les données dépendantes
-- ============================================================

DO $$
DECLARE
  u1  UUID := 'a1000000-0000-0000-0000-000000000001';
  u2  UUID := 'a1000000-0000-0000-0000-000000000002';
  u3  UUID := 'a1000000-0000-0000-0000-000000000003';
  u4  UUID := 'a1000000-0000-0000-0000-000000000004';
  u5  UUID := 'a1000000-0000-0000-0000-000000000005';
  u6  UUID := 'a1000000-0000-0000-0000-000000000006';
  u7  UUID := 'a1000000-0000-0000-0000-000000000007';
  u8  UUID := 'a1000000-0000-0000-0000-000000000008';
  u9  UUID := 'a1000000-0000-0000-0000-000000000009';
  u10 UUID := 'a1000000-0000-0000-0000-000000000010';
  u11 UUID := 'a1000000-0000-0000-0000-000000000011';
  u12 UUID := 'a1000000-0000-0000-0000-000000000012';

  c1  UUID := 'b2000000-0000-0000-0000-000000000001';
  c2  UUID := 'b2000000-0000-0000-0000-000000000002';
  c3  UUID := 'b2000000-0000-0000-0000-000000000003';
  c4  UUID := 'b2000000-0000-0000-0000-000000000004';
  c5  UUID := 'b2000000-0000-0000-0000-000000000005';
  c6  UUID := 'b2000000-0000-0000-0000-000000000006';
  c7  UUID := 'b2000000-0000-0000-0000-000000000007';
  c8  UUID := 'b2000000-0000-0000-0000-000000000008';

  cl1 UUID := 'c3000000-0000-0000-0000-000000000001';
  cl2 UUID := 'c3000000-0000-0000-0000-000000000002';
  cl3 UUID := 'c3000000-0000-0000-0000-000000000003';
  cl4 UUID := 'c3000000-0000-0000-0000-000000000004';
  cl5 UUID := 'c3000000-0000-0000-0000-000000000005';

  t1  UUID := 'd4000000-0000-0000-0000-000000000001';
  t2  UUID := 'd4000000-0000-0000-0000-000000000002';
  t3  UUID := 'd4000000-0000-0000-0000-000000000003';
  t4  UUID := 'd4000000-0000-0000-0000-000000000004';
  t5  UUID := 'd4000000-0000-0000-0000-000000000005';
  t6  UUID := 'd4000000-0000-0000-0000-000000000006';

  ch1 UUID := 'e5000000-0000-0000-0000-000000000001';
  ch2 UUID := 'e5000000-0000-0000-0000-000000000002';
  ch3 UUID := 'e5000000-0000-0000-0000-000000000003';

  ev1 UUID := 'f6000000-0000-0000-0000-000000000001';
  ev2 UUID := 'f6000000-0000-0000-0000-000000000002';
  ev3 UUID := 'f6000000-0000-0000-0000-000000000003';

  p1  UUID := 'a7000000-0000-0000-0000-000000000001';
  p2  UUID := 'a7000000-0000-0000-0000-000000000002';
  p3  UUID := 'a7000000-0000-0000-0000-000000000003';
  p4  UUID := 'a7000000-0000-0000-0000-000000000004';
  p5  UUID := 'a7000000-0000-0000-0000-000000000005';
  p6  UUID := 'a7000000-0000-0000-0000-000000000006';
  p7  UUID := 'a7000000-0000-0000-0000-000000000007';
  p8  UUID := 'a7000000-0000-0000-0000-000000000008';
  p9  UUID := 'a7000000-0000-0000-0000-000000000009';
  p10 UUID := 'a7000000-0000-0000-0000-000000000010';

  q1  UUID := 'b8000000-0000-0000-0000-000000000001';
  q2  UUID := 'b8000000-0000-0000-0000-000000000002';
  q3  UUID := 'b8000000-0000-0000-0000-000000000003';
  q4  UUID := 'b8000000-0000-0000-0000-000000000004';
  q5  UUID := 'b8000000-0000-0000-0000-000000000005';
  qa1 UUID := 'c9000000-0000-0000-0000-000000000001';
  qa2 UUID := 'c9000000-0000-0000-0000-000000000002';
  qa3 UUID := 'c9000000-0000-0000-0000-000000000003';
  qa4 UUID := 'c9000000-0000-0000-0000-000000000004';
  qa5 UUID := 'c9000000-0000-0000-0000-000000000005';
  qa6 UUID := 'c9000000-0000-0000-0000-000000000006';

  ama1  UUID := 'd0000000-0000-0000-0000-000000000001';
  ama2  UUID := 'd0000000-0000-0000-0000-000000000002';
  amaq1 UUID := 'e1000000-0000-0000-0000-000000000001';
  amaq2 UUID := 'e1000000-0000-0000-0000-000000000002';
  amaq3 UUID := 'e1000000-0000-0000-0000-000000000003';
  amaq4 UUID := 'e1000000-0000-0000-0000-000000000004';

  oc1 UUID := 'f2000000-0000-0000-0000-000000000001';
  oc2 UUID := 'f2000000-0000-0000-0000-000000000002';
  oc3 UUID := 'f2000000-0000-0000-0000-000000000003';
  oc4 UUID := 'f2000000-0000-0000-0000-000000000004';
  oc5 UUID := 'f2000000-0000-0000-0000-000000000005';
  au1 UUID := 'a3000000-0000-0000-0000-000000000001';
  au2 UUID := 'a3000000-0000-0000-0000-000000000002';
  au3 UUID := 'a3000000-0000-0000-0000-000000000003';
  re1 UUID := 'b4000000-0000-0000-0000-000000000001';
  re2 UUID := 'b4000000-0000-0000-0000-000000000002';
  re3 UUID := 'b4000000-0000-0000-0000-000000000003';
  re4 UUID := 'b4000000-0000-0000-0000-000000000004';

  b1  UUID;
  b2  UUID;
  b3  UUID;
  kit1 UUID;
  kit2 UUID;

BEGIN

  -- ============================================================
  -- 1. UTILISATEURS dans auth.users (avec UUIDs fixes)
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
    (u1,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'marie.dupont@email.fr',   crypt('Voyage2024!', gen_salt('bf', 10)), now() - interval '180 days', now() - interval '180 days', now(),
     jsonb_build_object('full_name', 'Marie Dupont',   'avatar_url', 'https://i.pravatar.cc/150?img=1'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u2,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'thomas.martin@email.fr',  crypt('Rando2024!',  gen_salt('bf', 10)), now() - interval '150 days', now() - interval '150 days', now(),
     jsonb_build_object('full_name', 'Thomas Martin',  'avatar_url', 'https://i.pravatar.cc/150?img=2'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u3,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sophie.bernard@email.fr', crypt('Trek2024!',   gen_salt('bf', 10)), now() - interval '120 days', now() - interval '120 days', now(),
     jsonb_build_object('full_name', 'Sophie Bernard', 'avatar_url', 'https://i.pravatar.cc/150?img=3'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u4,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'lucas.petit@email.fr',    crypt('Alpin2024!',  gen_salt('bf', 10)), now() - interval '90 days',  now() - interval '90 days',  now(),
     jsonb_build_object('full_name', 'Lucas Petit',    'avatar_url', 'https://i.pravatar.cc/150?img=4'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u5,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'camille.leroy@email.fr',  crypt('Kayak2024!',  gen_salt('bf', 10)), now() - interval '75 days',  now() - interval '75 days',  now(),
     jsonb_build_object('full_name', 'Camille Leroy',  'avatar_url', 'https://i.pravatar.cc/150?img=5'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u6,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'antoine.moreau@email.fr', crypt('Velo2024!',   gen_salt('bf', 10)), now() - interval '60 days',  now() - interval '60 days',  now(),
     jsonb_build_object('full_name', 'Antoine Moreau', 'avatar_url', 'https://i.pravatar.cc/150?img=6'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u7,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'julie.simon@email.fr',    crypt('Surf2024!',   gen_salt('bf', 10)), now() - interval '45 days',  now() - interval '45 days',  now(),
     jsonb_build_object('full_name', 'Julie Simon',    'avatar_url', 'https://i.pravatar.cc/150?img=7'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u8,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'maxime.garcia@email.fr',  crypt('Ski2024!',    gen_salt('bf', 10)), now() - interval '30 days',  now() - interval '30 days',  now(),
     jsonb_build_object('full_name', 'Maxime Garcia',  'avatar_url', 'https://i.pravatar.cc/150?img=8'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u9,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'lea.roux@email.fr',       crypt('Moto2024!',   gen_salt('bf', 10)), now() - interval '20 days',  now() - interval '20 days',  now(),
     jsonb_build_object('full_name', 'Lea Roux',       'avatar_url', 'https://i.pravatar.cc/150?img=9'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u10, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'nicolas.blanc@email.fr',  crypt('Escalade2024!', gen_salt('bf', 10)), now() - interval '15 days', now() - interval '15 days', now(),
     jsonb_build_object('full_name', 'Nicolas Blanc',  'avatar_url', 'https://i.pravatar.cc/150?img=10'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u11, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'emma.henry@email.fr',     crypt('Yoga2024!',   gen_salt('bf', 10)), now() - interval '10 days',  now() - interval '10 days',  now(),
     jsonb_build_object('full_name', 'Emma Henry',     'avatar_url', 'https://i.pravatar.cc/150?img=11'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u12, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'pierre.lambert@email.fr', crypt('Peche2024!',  gen_salt('bf', 10)), now() - interval '5 days',   now() - interval '5 days',   now(),
     jsonb_build_object('full_name', 'Pierre Lambert', 'avatar_url', 'https://i.pravatar.cc/150?img=12'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 2. MISE À JOUR user_profiles (créés par trigger ou existants)
  --    Upsert pour garantir les données même sans trigger
  -- ============================================================
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, trust_score, loyalty_points, loyalty_level, created_at)
  VALUES
    (u1,  'marie.dupont@email.fr',    'Marie Dupont',    'https://i.pravatar.cc/150?img=1',  92, 3450, 'Explorateur Elite', now() - interval '180 days'),
    (u2,  'thomas.martin@email.fr',   'Thomas Martin',   'https://i.pravatar.cc/150?img=2',  88, 2800, 'Aventurier',        now() - interval '150 days'),
    (u3,  'sophie.bernard@email.fr',  'Sophie Bernard',  'https://i.pravatar.cc/150?img=3',  85, 2200, 'Aventurier',        now() - interval '120 days'),
    (u4,  'lucas.petit@email.fr',     'Lucas Petit',     'https://i.pravatar.cc/150?img=4',  79, 1650, 'Explorateur',       now() - interval '90 days'),
    (u5,  'camille.leroy@email.fr',   'Camille Leroy',   'https://i.pravatar.cc/150?img=5',  74, 1200, 'Explorateur',       now() - interval '75 days'),
    (u6,  'antoine.moreau@email.fr',  'Antoine Moreau',  'https://i.pravatar.cc/150?img=6',  68,  890, 'Explorateur',       now() - interval '60 days'),
    (u7,  'julie.simon@email.fr',     'Julie Simon',     'https://i.pravatar.cc/150?img=7',  65,  720, 'Decouvreur',        now() - interval '45 days'),
    (u8,  'maxime.garcia@email.fr',   'Maxime Garcia',   'https://i.pravatar.cc/150?img=8',  61,  540, 'Decouvreur',        now() - interval '30 days'),
    (u9,  'lea.roux@email.fr',        'Lea Roux',        'https://i.pravatar.cc/150?img=9',  58,  380, 'Decouvreur',        now() - interval '20 days'),
    (u10, 'nicolas.blanc@email.fr',   'Nicolas Blanc',   'https://i.pravatar.cc/150?img=10', 55,  210, 'Novice',            now() - interval '15 days'),
    (u11, 'emma.henry@email.fr',      'Emma Henry',      'https://i.pravatar.cc/150?img=11', 52,  120, 'Novice',            now() - interval '10 days'),
    (u12, 'pierre.lambert@email.fr',  'Pierre Lambert',  'https://i.pravatar.cc/150?img=12', 50,   60, 'Novice',            now() - interval '5 days')
  ON CONFLICT (id) DO UPDATE SET
    full_name      = EXCLUDED.full_name,
    avatar_url     = EXCLUDED.avatar_url,
    trust_score    = EXCLUDED.trust_score,
    loyalty_points = EXCLUDED.loyalty_points,
    loyalty_level  = EXCLUDED.loyalty_level;

  -- ============================================================
  -- 3. FOLLOWS
  -- ============================================================
  INSERT INTO public.user_follows (follower_id, following_id, created_at) VALUES
    (u2, u1, now() - interval '140 days'), (u3, u1, now() - interval '110 days'),
    (u4, u1, now() - interval '80 days'),  (u5, u1, now() - interval '60 days'),
    (u6, u1, now() - interval '50 days'),  (u1, u2, now() - interval '130 days'),
    (u3, u2, now() - interval '100 days'), (u4, u2, now() - interval '70 days'),
    (u1, u3, now() - interval '115 days'), (u2, u3, now() - interval '95 days'),
    (u5, u3, now() - interval '55 days'),  (u1, u4, now() - interval '85 days'),
    (u2, u4, now() - interval '65 days'),  (u6, u5, now() - interval '40 days'),
    (u7, u5, now() - interval '30 days'),  (u8, u6, now() - interval '25 days'),
    (u9, u7, now() - interval '15 days'),  (u10, u8, now() - interval '10 days')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 4. CARNETS D''EXPEDITION
  -- ============================================================
  INSERT INTO public.carnets (id, author_id, title, destination, description, cover_image, cover_image_alt, start_date, end_date, weather, route_rating, visibility, tags, map_points, is_collaborative, likes_count, comments_count, favorites_count, views_count, verified, created_at) VALUES
    (c1, u1, 'Trek au Nepal : Tour des Annapurnas', 'Nepal',
     'Un periple inoubliable de 21 jours autour du massif des Annapurnas. Cols a plus de 5000m, villages sherpa authentiques, et rencontres humaines bouleversantes.',
     'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800', 'Vue panoramique sur les sommets enneiges des Annapurnas au lever du soleil',
     '2025-10-01', '2025-10-21', 'Ensoleille avec quelques chutes de neige au col Thorong La', 4.8, 'public',
     ARRAY['nepal','trek','haute altitude','annapurnas','ultraleger'], '[]'::jsonb, false, 127, 34, 89, 2840, true, now() - interval '60 days'),
    (c2, u2, 'Traversee des Pyrenees en VTT', 'Pyrenees, France/Espagne',
     'La traversee complete des Pyrenees a velo tout-terrain en 18 jours. Des cols mythiques, des descentes vertigineuses et des bivouacs sous les etoiles.',
     'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', 'Cycliste sur un sentier de montagne dans les Pyrenees avec vue sur la vallee',
     '2025-07-15', '2025-08-02', 'Beau temps dominant, orage le jour 12', 4.6, 'public',
     ARRAY['velo','pyrenees','bikepacking','cols','bivouac'], '[]'::jsonb, false, 98, 28, 67, 1920, true, now() - interval '45 days'),
    (c3, u3, 'Randonnee en Islande : Laugavegur Trail', 'Islande',
     'Le sentier Laugavegur, 55km de paysages lunaires entre volcans, geysers et champs de lave. Une aventure en autonomie complete.',
     'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=800', 'Paysage volcanique islandais avec vapeurs geothermiques et montagnes colorees',
     '2025-08-10', '2025-08-15', 'Vent fort, pluie intermittente, temperatures entre 5 et 15C', 4.9, 'public',
     ARRAY['islande','randonnee','autonomie','volcans','laugavegur'], '[]'::jsonb, true, 156, 42, 112, 3210, true, now() - interval '35 days'),
    (c4, u4, 'Ski de randonnee dans les Alpes', 'Alpes francaises',
     'Semaine de ski de rando dans le massif du Mont-Blanc. Ascension du Mont Blanc du Tacul, traversee de la Vallee Blanche.',
     'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800', 'Skieur de randonnee sur une pente enneigee avec le Mont Blanc en arriere-plan',
     '2025-02-20', '2025-02-27', 'Grand froid (-20C au sommet), beau temps', 4.7, 'public',
     ARRAY['ski','alpes','mont-blanc','randonnee','hiver'], '[]'::jsonb, false, 84, 19, 58, 1650, false, now() - interval '25 days'),
    (c5, u5, 'Kayak de mer en Bretagne', 'Bretagne, France',
     'Tour de la presquile de Crozon en kayak de mer sur 7 jours. Grottes marines, plages sauvages et couchers de soleil sur l''Atlantique.',
     'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800', 'Kayakiste pagayant dans une crique bretonne avec falaises et eau turquoise',
     '2025-06-01', '2025-06-07', 'Mer belle a peu agitee, vent de nord-ouest modere', 4.5, 'public',
     ARRAY['kayak','bretagne','mer','cote','camping'], '[]'::jsonb, false, 73, 22, 45, 1380, false, now() - interval '20 days'),
    (c6, u1, 'Traversee du Sahara a pied', 'Maroc/Algerie',
     'Expedition de 14 jours a travers les dunes de l''Erg Chebbi et les plateaux rocheux du Sahara. Portage de 15L d''eau, navigation a la boussole.',
     'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800', 'Randonneur solitaire marchant sur une dune de sable au coucher du soleil dans le Sahara',
     '2025-03-05', '2025-03-19', 'Chaleur extreme (45C le jour), froid la nuit (5C)', 4.9, 'public',
     ARRAY['sahara','desert','maroc','expedition','autonomie'], '[]'::jsonb, false, 203, 56, 145, 4120, true, now() - interval '15 days'),
    (c7, u6, 'Via Ferrata dans les Dolomites', 'Dolomites, Italie',
     'Semaine de via ferrata dans les Dolomites italiennes. Cinq itineraires classes D/TD avec nuits en refuge.',
     'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'Grimpeur sur une via ferrata avec vue sur les pics rocheux des Dolomites',
     '2025-09-08', '2025-09-14', 'Beau temps, quelques nuages l''apres-midi', 4.4, 'public',
     ARRAY['via-ferrata','dolomites','escalade','italie','refuge'], '[]'::jsonb, false, 61, 15, 38, 1120, false, now() - interval '10 days'),
    (c8, u3, 'Ultratrail du Mont-Blanc : Preparation et recit', 'Chamonix, France',
     'Mon aventure a l''UTMB 2025 : 171km et 10 000m de denivele positif. De la preparation physique sur 8 mois au recit heure par heure.',
     'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800', 'Coureur de trail sur un sentier de montagne au-dessus des nuages pres de Chamonix',
     '2025-08-25', '2025-08-30', 'Variable : soleil, pluie, neige selon l''altitude', 5.0, 'public',
     ARRAY['utmb','trail','chamonix','ultra','endurance'], '[]'::jsonb, true, 312, 78, 198, 6540, true, now() - interval '5 days')
  ON CONFLICT (id) DO NOTHING;

  -- Likes carnets
  INSERT INTO public.carnet_likes (carnet_id, user_id, reaction, created_at) VALUES
    (c1, u2, 'heart', now() - interval '58 days'), (c1, u3, 'fire',   now() - interval '55 days'),
    (c1, u4, 'bag',   now() - interval '50 days'), (c1, u5, 'useful', now() - interval '48 days'),
    (c1, u6, 'heart', now() - interval '45 days'), (c3, u1, 'fire',   now() - interval '33 days'),
    (c3, u2, 'heart', now() - interval '30 days'), (c3, u4, 'useful', now() - interval '28 days'),
    (c6, u2, 'fire',  now() - interval '13 days'), (c6, u3, 'heart',  now() - interval '12 days'),
    (c6, u4, 'bag',   now() - interval '11 days'), (c8, u1, 'fire',   now() - interval '4 days'),
    (c8, u2, 'heart', now() - interval '4 days'),  (c8, u4, 'useful', now() - interval '3 days'),
    (c8, u5, 'fire',  now() - interval '3 days')
  ON CONFLICT DO NOTHING;

  -- Commentaires carnets
  INSERT INTO public.carnet_comments (carnet_id, author_id, content, likes_count, created_at) VALUES
    (c1, u2, 'Incroyable recit ! Le col Thorong La reste un des moments les plus intenses de ma vie.', 12, now() - interval '57 days'),
    (c1, u3, 'Quel kit as-tu utilise pour les nuits en altitude ? Je prepare le meme trek pour l''automne.', 5, now() - interval '55 days'),
    (c1, u4, 'Photos magnifiques ! La description du village de Manang est tellement juste.', 8, now() - interval '52 days'),
    (c3, u1, 'Le Laugavegur est sur ma liste depuis des annees. Combien de kg portais-tu ?', 9, now() - interval '32 days'),
    (c3, u4, 'Attention aux rivieres a traverser en juillet, elles peuvent etre tres hautes !', 15, now() - interval '30 days'),
    (c6, u2, 'Traversee du Sahara... quel courage. Comment tu as gere la chaleur les premiers jours ?', 18, now() - interval '14 days'),
    (c6, u5, 'Expedition de reve. La partie sur la navigation a la boussole est fascinante.', 11, now() - interval '12 days'),
    (c8, u2, 'UTMB 2025 ! Bravo pour cette performance. Le recit heure par heure est captivant.', 24, now() - interval '4 days'),
    (c8, u4, 'Merci pour les details sur la nutrition. Je prepare mon premier 100km.', 16, now() - interval '3 days'),
    (c8, u5, 'Quelle inspiration ! La section sur la montee du Grand Col Ferret a 3h du matin.', 19, now() - interval '2 days')
  ON CONFLICT DO NOTHING;

  -- Favoris carnets
  INSERT INTO public.carnet_favorites (carnet_id, user_id, created_at) VALUES
    (c1, u2, now() - interval '58 days'), (c1, u3, now() - interval '55 days'),
    (c1, u4, now() - interval '50 days'), (c3, u1, now() - interval '33 days'),
    (c3, u2, now() - interval '31 days'), (c6, u2, now() - interval '14 days'),
    (c6, u3, now() - interval '13 days'), (c8, u1, now() - interval '4 days'),
    (c8, u2, now() - interval '4 days'),  (c8, u4, now() - interval '3 days')
  ON CONFLICT DO NOTHING;

  -- Collaborateurs carnets
  INSERT INTO public.carnet_collaborators (carnet_id, user_id, role, created_at) VALUES
    (c3, u4, 'contributor', now() - interval '34 days'),
    (c8, u2, 'contributor', now() - interval '6 days')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 5. CLUBS
  -- ============================================================
  INSERT INTO public.clubs (id, slug, name, type, emoji, description, cover_color, category, rules, privacy, members_count, active_this_month, is_verified, created_by, created_at) VALUES
    (cl1, 'trekkeurs-alpes', 'Trekkeurs des Alpes', 'activite', '🏔️',
     'Club dedie aux passionnes de randonnee et trekking dans les Alpes francaises et suisses.',
     'from-blue-600 to-indigo-700', 'Randonnee',
     'Respectez les autres membres. Partagez vos experiences avec bienveillance.',
     'open', 847, 234, true, u1, now() - interval '150 days'),
    (cl2, 'bikepacking-france', 'Bikepacking France', 'activite', '🚵',
     'La communaute francaise du bikepacking. Voyages a velo en autonomie, itineraires et recits.',
     'from-green-600 to-emerald-700', 'Cyclisme',
     'Bienveillance obligatoire. Partagez vos routes et vos galeres avec humour.',
     'open', 523, 178, true, u2, now() - interval '120 days'),
    (cl3, 'kayak-mer-atlantique', 'Kayak Mer Atlantique', 'activite', '🚣',
     'Club des kayakistes de mer sur la facade atlantique. Navigation cotiere et expeditions.',
     'from-cyan-600 to-blue-700', 'Kayak',
     'Securite en mer avant tout. Partagez les conditions meteo.',
     'open', 312, 89, false, u5, now() - interval '90 days'),
    (cl4, 'ultra-trail-runners', 'Ultra Trail Runners', 'activite', '🏃',
     'Pour les coureurs de trail et d''ultra-trail. Preparation, nutrition et recits de courses.',
     'from-orange-600 to-red-700', 'Course a pied',
     'Respect des niveaux de chacun. Encouragements obligatoires.',
     'open', 689, 312, true, u3, now() - interval '100 days'),
    (cl5, 'voyageurs-maroc', 'Voyageurs du Maroc', 'pays', '🇲🇦',
     'Communaute des voyageurs passionnes par le Maroc. Randonnees dans l''Atlas et Sahara.',
     'from-amber-600 to-orange-700', 'Voyage',
     'Respect de la culture locale. Partage de bons plans responsables.',
     'open', 428, 156, false, u1, now() - interval '80 days')
  ON CONFLICT (id) DO NOTHING;

  -- Membres clubs
  INSERT INTO public.club_members (club_id, user_id, role, status, joined_at) VALUES
    (cl1, u1, 'admin',     'active', now() - interval '150 days'),
    (cl1, u2, 'moderator', 'active', now() - interval '140 days'),
    (cl1, u3, 'member',    'active', now() - interval '110 days'),
    (cl1, u4, 'member',    'active', now() - interval '85 days'),
    (cl1, u5, 'member',    'active', now() - interval '70 days'),
    (cl1, u6, 'member',    'active', now() - interval '55 days'),
    (cl1, u7, 'member',    'active', now() - interval '40 days'),
    (cl1, u8, 'member',    'active', now() - interval '25 days'),
    (cl2, u2, 'admin',     'active', now() - interval '120 days'),
    (cl2, u1, 'member',    'active', now() - interval '115 days'),
    (cl2, u4, 'moderator', 'active', now() - interval '90 days'),
    (cl2, u6, 'member',    'active', now() - interval '60 days'),
    (cl2, u9, 'member',    'active', now() - interval '18 days'),
    (cl3, u5, 'admin',     'active', now() - interval '90 days'),
    (cl3, u7, 'member',    'active', now() - interval '35 days'),
    (cl3, u10,'member',    'active', now() - interval '12 days'),
    (cl4, u3, 'admin',     'active', now() - interval '100 days'),
    (cl4, u1, 'moderator', 'active', now() - interval '95 days'),
    (cl4, u2, 'member',    'active', now() - interval '80 days'),
    (cl4, u8, 'member',    'active', now() - interval '28 days'),
    (cl4, u11,'member',    'active', now() - interval '8 days'),
    (cl5, u1, 'admin',     'active', now() - interval '80 days'),
    (cl5, u3, 'member',    'active', now() - interval '75 days'),
    (cl5, u6, 'member',    'active', now() - interval '50 days'),
    (cl5, u12,'member',    'active', now() - interval '4 days')
  ON CONFLICT DO NOTHING;

  -- Topics clubs
  INSERT INTO public.club_topics (id, club_id, author_id, title, content, is_pinned, is_announcement, is_approved, likes_count, replies_count, created_at) VALUES
    (t1, cl1, u1, 'Bienvenue dans le club Trekkeurs des Alpes !',
     'Bonjour a tous ! Ce club est l''endroit ideal pour partager vos aventures alpines et organiser des sorties ensemble.',
     true, true, true, 45, 67, now() - interval '148 days'),
    (t2, cl1, u2, 'Itineraire GR5 : conseils pour la section Lac Leman - Nice',
     'Je prepare la traversee complete du GR5. Quelqu''un a des retours sur les refuges a reserver en priorite ?',
     false, false, true, 23, 18, now() - interval '30 days'),
    (t3, cl1, u3, 'Comparatif chaussures de randonnee 2025 : vos retours ?',
     'Je cherche a renouveler mes chaussures. Entre les Salomon X Ultra 4 et les Hoka Anacapa, vous conseillez quoi ?',
     false, false, true, 31, 24, now() - interval '15 days'),
    (t4, cl2, u2, 'Sortie bikepacking Pyrenees - Juillet 2026',
     'On organise une traversee des Pyrenees en groupe de 6-8 personnes du 10 au 28 juillet. Qui est partant ?',
     true, true, true, 38, 29, now() - interval '45 days'),
    (t5, cl4, u3, 'Retour UTMB 2025 - Analyse et conseils',
     'Je viens de terminer l''UTMB en 38h12. Je partage mon analyse complete : preparation, nutrition, gestion de l''effort.',
     false, false, true, 67, 45, now() - interval '5 days'),
    (t6, cl5, u1, 'Traversee du Sahara : guide complet et conseils securite',
     'Suite a mon expedition de mars, je compile tous les conseils pratiques pour une traversee en securite.',
     true, false, true, 52, 31, now() - interval '12 days')
  ON CONFLICT (id) DO NOTHING;

  -- Reponses topics
  INSERT INTO public.club_topic_replies (topic_id, author_id, content, is_approved, likes_count, created_at) VALUES
    (t1, u2, 'Bonjour ! Thomas ici, passionne de randonnee depuis 15 ans. Ravi de rejoindre cette communaute !', true, 8, now() - interval '147 days'),
    (t1, u3, 'Sophie, randonneuse et coureuse de trail. J''adore les bivouacs en altitude.', true, 6, now() - interval '145 days'),
    (t1, u4, 'Lucas, alpiniste amateur. Je cherche des compagnons de cordee pour les Ecrins cet ete.', true, 9, now() - interval '140 days'),
    (t2, u4, 'J''ai fait le GR5 complet en 2023. Reserve le Refuge de la Vanoise 3 mois a l''avance.', true, 15, now() - interval '28 days'),
    (t2, u1, 'La section Mercantour est magnifique mais tres frequentee en aout. Prefere fin juin.', true, 12, now() - interval '27 days'),
    (t3, u1, 'J''ai les Salomon X Ultra 4 depuis 2 ans, environ 800km. Excellentes sur terrain mixte.', true, 18, now() - interval '14 days'),
    (t3, u2, 'Les Hoka sont plus confortables sur longues distances mais moins precises sur rocher.', true, 11, now() - interval '13 days'),
    (t4, u1, 'Je suis partant ! J''ai deja fait la moitie cote espagnol.', true, 7, now() - interval '43 days'),
    (t4, u4, 'Interesse aussi ! Quel niveau de forme physique minimum ?', true, 4, now() - interval '40 days'),
    (t5, u2, 'Bravo pour cette performance ! Comment tu as gere le sommeil sur la montee du Grand Col Ferret ?', true, 22, now() - interval '4 days'),
    (t5, u4, 'Merci pour ce retour detaille. La section nutrition est particulierement utile.', true, 16, now() - interval '3 days'),
    (t6, u3, 'Document exceptionnel ! La partie sur les contacts locaux est vraiment precieuse.', true, 19, now() - interval '11 days')
  ON CONFLICT DO NOTHING;

  -- Defis clubs
  INSERT INTO public.club_challenges (id, club_id, title, description, xp, deadline, active, created_at) VALUES
    (ch1, cl1, 'Defi 3 Cols en 3 Jours',
     'Realisez 3 cols alpins de plus de 2500m en 3 jours consecutifs. Partagez vos photos et trace GPS.',
     500, now() + interval '60 days', true, now() - interval '20 days'),
    (ch2, cl4, 'Challenge 1000km de trail en 2026',
     'Courez 1000km de trail cumules avant le 31 decembre 2026.',
     1000, now() + interval '170 days', true, now() - interval '10 days'),
    (ch3, cl2, 'Bikepacking Solo 500km',
     'Realisez un voyage bikepacking en solo d''au moins 500km en une semaine.',
     750, now() + interval '90 days', true, now() - interval '15 days')
  ON CONFLICT (id) DO NOTHING;

  -- Entrees defis
  INSERT INTO public.club_challenge_entries (challenge_id, user_id, proof_text, score, validated, created_at) VALUES
    (ch1, u2, 'Col du Galibier, Col de l''Iseran, Col de la Croix de Fer en 3 jours. Trace GPS disponible.', 500, true, now() - interval '5 days'),
    (ch1, u3, 'Col du Tourmalet, Col d''Aubisque, Col du Soulor. Conditions parfaites !', 500, true, now() - interval '3 days'),
    (ch2, u1, 'Semaine 1 : 45km. Semaine 2 : 52km. Semaine 3 : 38km. Total : 135km.', 135, false, now() - interval '2 days'),
    (ch3, u4, 'Traversee Bordeaux-Biarritz en 6 jours, 520km. Recit complet sur mon carnet.', 750, true, now() - interval '1 day')
  ON CONFLICT DO NOTHING;

  -- Evenements clubs
  INSERT INTO public.club_events (id, club_id, organizer_id, title, description, event_date, location, max_participants, participants_count, created_at) VALUES
    (ev1, cl1, u1, 'Sortie collective Tour du Beaufortain',
     'Randonnee de 3 jours autour du massif du Beaufortain. Niveau intermediaire. Hebergement en refuge.',
     now() + interval '45 days', 'Beaufort, Savoie', 12, 8, now() - interval '20 days'),
    (ev2, cl4, u3, 'Entrainement trail nocturne - Foret de Fontainebleau',
     'Sortie trail nocturne de 25km dans la foret de Fontainebleau. Frontales obligatoires.',
     now() + interval '15 days', 'Fontainebleau, Seine-et-Marne', 20, 14, now() - interval '10 days'),
    (ev3, cl2, u2, 'Atelier bikepacking debutants - Paris',
     'Journee d''initiation au bikepacking : chargement du velo, choix du materiel. Gratuit pour les membres.',
     now() + interval '30 days', 'Paris, 11eme arrondissement', 15, 11, now() - interval '8 days')
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 6. POSTS COMMUNAUTE
  -- ============================================================
  INSERT INTO public.community_posts (id, author_id, content, image_url, image_alt, post_type, likes_count, comments_count, shares_count, is_trending, created_at) VALUES
    (p1,  u1, 'Retour de 3 semaines au Nepal ! Le Tour des Annapurnas reste l''experience la plus intense de ma vie. 21 jours, 160km, 7000m de denivele. Mon kit ultraleger de 8kg a ete parfait.',
     'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600', 'Panorama sur les Annapurnas avec randonneur au premier plan', 'share', 127, 34, 23, true, now() - interval '58 days'),
    (p2,  u2, 'Conseil du jour : Pour votre premier bikepacking, commencez par un week-end de 2 jours max. Chargez votre velo a 80% de ce que vous pensez avoir besoin. La legerete, c''est la liberte.',
     null, null, 'tip', 98, 28, 15, true, now() - interval '45 days'),
    (p3,  u3, 'Question pour les ultra-traileurs : comment gerez-vous la nutrition sur les courses de plus de 24h ? J''ai tendance a ne plus pouvoir avaler de sucre apres 15h de course.',
     null, null, 'question', 45, 67, 8, false, now() - interval '30 days'),
    (p4,  u4, 'Magnifique semaine de ski de rando dans le massif du Mont-Blanc. La Vallee Blanche en conditions hivernales, c''est une autre dimension.',
     'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600', 'Groupe de skieurs de randonnee sur glacier avec le Mont Blanc en arriere-plan', 'post', 84, 19, 12, false, now() - interval '23 days'),
    (p5,  u5, 'Astuce kayak : Pour les sorties en mer, toujours verifier les coefficients de maree ET la meteo marine 48h a l''avance. La securite avant l''aventure !',
     null, null, 'tip', 73, 22, 19, false, now() - interval '18 days'),
    (p6,  u1, 'Traversee du Sahara terminee ! 14 jours, 380km a pied dans les dunes et les regs. Une experience qui change une vie.',
     'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600', 'Randonneur au sommet d''une dune au coucher du soleil dans le Sahara marocain', 'share', 203, 56, 41, true, now() - interval '13 days'),
    (p7,  u6, 'Via ferrata dans les Dolomites : 5 itineraires en 7 jours. Les Dolomites sont le terrain de jeu ultime pour les amateurs de verticalite.',
     'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600', 'Vue depuis une via ferrata sur les pics rocheux des Dolomites italiens', 'question', 61, 15, 9, false, now() - interval '9 days'),
    (p8,  u3, 'UTMB 2025 : 38h12 de bonheur et de souffrance. 171km, 10 000m D+, 2 nuits sans dormir. Je publie mon recit complet demain.',
     'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600', 'Coureuse de trail franchissant la ligne d''arrivee de l''UTMB a Chamonix', 'share', 312, 78, 67, true, now() - interval '4 days'),
    (p9,  u7, 'Premiere sortie surf de la saison a Hossegor ! Les vagues etaient parfaites ce matin, 1.5m bien formees.',
     'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=600', 'Surfeur sur une vague a Hossegor avec plage de sable en arriere-plan', 'post', 48, 11, 7, false, now() - interval '2 days'),
    (p10, u8, 'Conseil equipement : j''ai teste la tente MSR Hubba Hubba NX pendant 3 semaines en Ecosse. Imperméable meme sous des pluies torrentielles, montage en 3 minutes, 1.7kg.',
     null, null, 'tip', 56, 18, 14, false, now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;

  -- Likes posts
  INSERT INTO public.post_likes (post_id, user_id, created_at) VALUES
    (p1, u2, now() - interval '57 days'), (p1, u3, now() - interval '56 days'),
    (p1, u4, now() - interval '55 days'), (p3, u1, now() - interval '29 days'),
    (p3, u4, now() - interval '28 days'), (p6, u2, now() - interval '12 days'),
    (p6, u3, now() - interval '12 days'), (p6, u5, now() - interval '11 days'),
    (p8, u1, now() - interval '3 days'),  (p8, u2, now() - interval '3 days'),
    (p8, u4, now() - interval '3 days'),  (p8, u5, now() - interval '2 days')
  ON CONFLICT DO NOTHING;

  -- Commentaires posts
  INSERT INTO public.post_comments (post_id, author_id, content, likes_count, created_at) VALUES
    (p1, u2, 'Felicitations pour cette aventure ! Tu as utilise quel sac a dos ?', 8, now() - interval '57 days'),
    (p1, u3, 'Incroyable ! 8kg de kit pour 21 jours, c''est impressionnant.', 12, now() - interval '56 days'),
    (p3, u1, 'Pour la nutrition apres 15h : passer au sale ! Chips, fromage, charcuterie.', 24, now() - interval '29 days'),
    (p3, u2, 'Les bouillons chauds sont aussi une excellente option. Reconfortants et faciles a digerer.', 18, now() - interval '28 days'),
    (p6, u2, 'Traversee du Sahara... tu es une legende ! J''attends le carnet complet.', 15, now() - interval '12 days'),
    (p6, u4, 'Comment tu as gere l''eau ? C''est la partie qui me fait le plus peur.', 11, now() - interval '11 days'),
    (p8, u2, 'BRAVO ! 38h12 c''est une performance exceptionnelle.', 28, now() - interval '3 days'),
    (p8, u4, 'Recit attendu avec impatience ! Tes posts pendant la course etaient captivants.', 19, now() - interval '3 days'),
    (p8, u5, 'Quelle inspiration ! Je prepare mon premier 50km.', 14, now() - interval '2 days')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 7. Q&R
  -- ============================================================
  INSERT INTO public.qa_questions (id, author_id, title, content, tags, category, votes_count, answers_count, views_count, is_solved, created_at) VALUES
    (q1, u4, 'Quelle tente pour le trek en haute altitude (>4000m) ?',
     'Je prepare un trek au Nepal avec des nuits a plus de 4000m. Ma tente actuelle est-elle suffisante ? Budget max 600 euros.',
     ARRAY['tente','haute-altitude','nepal','equipement'], 'equipement', 34, 5, 892, true, now() - interval '40 days'),
    (q2, u7, 'Comment prevenir les ampoules en randonnee longue distance ?',
     'Je pars sur le Chemin de Compostelle (800km) dans 2 mois. Quelles sont vos meilleures techniques de prevention ?',
     ARRAY['ampoules','chaussures','prevention','compostelle'], 'sante', 28, 7, 1240, true, now() - interval '25 days'),
    (q3, u9, 'Meilleur GPS pour le trail et la randonnee en 2025 ?',
     'Je cherche un GPS montre. Hesitation entre Garmin Fenix 8, Suunto Vertical et Coros Vertix 3.',
     ARRAY['gps','montre','garmin','suunto','coros'], 'equipement', 41, 6, 1580, false, now() - interval '15 days'),
    (q4, u10, 'Comment gerer la nourriture sur un trek de 10 jours en autonomie ?',
     'Je prepare un trek de 10 jours sans ravitaillement. Comment calculer les rations ?',
     ARRAY['nutrition','autonomie','trek','lyophilise'], 'nutrition', 22, 4, 756, false, now() - interval '8 days'),
    (q5, u11, 'Sac a dos 40L ou 60L pour un trek de 2 semaines ?',
     'Je pars 2 semaines en Norvege. J''hesite entre un sac 40L et un 60L. Je vise le ultralight.',
     ARRAY['sac-a-dos','ultralight','norvege','trek'], 'equipement', 18, 3, 534, false, now() - interval '3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.qa_answers (id, question_id, author_id, content, votes_count, is_accepted, created_at) VALUES
    (qa1, q1, u1, 'Pour les nuits a 4000m+, je recommande la MSR Remote 2 ou la Hilleberg Akto pour plus de robustesse. Si budget limite, la Naturehike Cloud-Up 2 est un excellent compromis a 200 euros.', 28, true, now() - interval '38 days'),
    (qa2, q1, u2, 'J''ai utilise la Hubba Hubba jusqu''a 5000m au Nepal sans probleme. L''essentiel est de bien choisir son emplacement.', 15, false, now() - interval '37 days'),
    (qa3, q2, u1, 'Mes 5 regles anti-ampoules : 1) Chaussures rodees 200km minimum. 2) Chaussettes laine merinos. 3) Talc chaque matin. 4) Compeed des les premiers signes. 5) Secher les pieds a chaque pause.', 45, true, now() - interval '23 days'),
    (qa4, q2, u3, 'Ajoute les guetres legeres pour eviter les gravillons. Et si tu as les pieds larges, essaie les chaussures Altra ou Hoka.', 22, false, now() - interval '22 days'),
    (qa5, q3, u2, 'J''ai le Garmin Fenix 8 depuis 6 mois. Autonomie exceptionnelle (28 jours), cartographie topo integree. Le Coros Vertix 3 est une excellente alternative moins chere.', 31, false, now() - interval '13 days'),
    (qa6, q4, u1, 'Pour 10 jours en autonomie : compte 600-700g de nourriture seche par jour. Privilegie lyophilises, barres energetiques, fruits secs, noix.', 19, false, now() - interval '6 days')
  ON CONFLICT (id) DO NOTHING;

  -- Votes Q&R
  INSERT INTO public.qa_votes (user_id, target_type, target_id, vote, created_at) VALUES
    (u2, 'answer',   qa1, 1, now() - interval '37 days'),
    (u3, 'answer',   qa1, 1, now() - interval '36 days'),
    (u4, 'answer',   qa3, 1, now() - interval '22 days'),
    (u5, 'answer',   qa3, 1, now() - interval '21 days'),
    (u1, 'question', q3,  1, now() - interval '14 days'),
    (u2, 'question', q3,  1, now() - interval '13 days')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 8. SESSIONS AMA
  -- ============================================================
  INSERT INTO public.ama_sessions (id, expert_id, title, description, scheduled_at, duration_minutes, status, participants_count, questions_count, created_at) VALUES
    (ama1, u1, 'AMA : Trekking en haute altitude - Tout ce que vous voulez savoir',
     'Marie Dupont, guide de haute montagne, repond a toutes vos questions sur le trekking en altitude.',
     now() - interval '20 days', 90, 'ended', 234, 45, now() - interval '25 days'),
    (ama2, u3, 'AMA : Courir un ultra-trail - De 0 a l''UTMB',
     'Sophie Bernard, finisher UTMB 2025, partage son experience sur la preparation et la gestion mentale.',
     now() + interval '10 days', 120, 'upcoming', 189, 28, now() - interval '3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ama_questions (id, session_id, author_id, content, votes_count, is_answered, answer, answered_at, created_at) VALUES
    (amaq1, ama1, u4, 'Comment preparer son acclimatation avant un trek a plus de 5000m ?',
     34, true,
     'L''acclimatation est cruciale. Ne montez pas de plus de 300-500m par jour au-dessus de 3000m. Prévoyez au minimum 2 jours a Katmandou, puis montee progressive.',
     now() - interval '20 days', now() - interval '21 days'),
    (amaq2, ama1, u7, 'Quel est le budget realiste pour un trek de 3 semaines au Nepal tout compris ?',
     28, true,
     'Budget realiste : Vol A/R 600-900 euros, visa 30 euros, permis 50 euros, hebergement 5-15 euros/nuit, repas 3-8 euros, guide 25-35 euros/jour. Total : 1500-2500 euros.',
     now() - interval '20 days', now() - interval '21 days'),
    (amaq3, ama2, u2, 'Comment gerer le sommeil pendant un ultra de plus de 24h ?',
     41, false, '', null, now() - interval '2 days'),
    (amaq4, ama2, u8, 'Quel plan d''entrainement pour passer du marathon a un 100km en 18 mois ?',
     35, false, '', null, now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 9. OCCASION / ENCHERES / LOCATION
  -- ============================================================
  INSERT INTO public.occasion_items (id, seller_id, title, price, original_price, condition, location, image, alt, negotiable, shipping, status, created_at) VALUES
    (oc1, u1, 'Tente MSR Remote 2 - Excellent etat',         320,  550, 'excellent', 'Lyon, 69',      'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', 'Tente MSR Remote 2 orange montee dans un paysage alpin',                    true,  true,  'active', now() - interval '15 days'),
    (oc2, u2, 'Sac a dos Osprey Atmos 65L - Tres bon etat',  145,  280, 'bon',       'Paris, 75',     'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', 'Sac a dos de randonnee Osprey bleu pose sur un rocher en montagne',         true,  true,  'active', now() - interval '10 days'),
    (oc3, u4, 'Chaussures Salomon X Ultra 4 GTX - Taille 43', 85,  160, 'bon',       'Grenoble, 38',  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', 'Chaussures de randonnee Salomon grises et vertes sur fond blanc',            false, false, 'active', now() - interval '7 days'),
    (oc4, u5, 'Kayak de mer Prijon Seayak - Complet',        890, 1800, 'bon',       'Brest, 29',     'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400', 'Kayak de mer jaune sur une plage bretonne avec equipement complet',          true,  false, 'active', now() - interval '5 days'),
    (oc5, u3, 'Rechaud MSR Windburner + casserole 1L',        65,  120, 'excellent', 'Bordeaux, 33',  'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', 'Rechaud de camping MSR avec casserole sur une table de pique-nique',        false, true,  'active', now() - interval '3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.auction_items (id, seller_id, title, start_price, current_bid, buy_now_price, condition, ends_at, bids_count, watchers_count, image, alt, status, created_at) VALUES
    (au1, u6, 'Veste Gore-Tex Arc''teryx Beta AR - Taille M', 180, 245, 420, 'bon',       now() + interval '3 days', 8,  23, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400', 'Veste impermeable Arc''teryx rouge portee par un randonneur en montagne', 'active', now() - interval '4 days'),
    (au2, u7, 'Sac de couchage Cumulus Panyam 450 - Duvet',   120, 165, 280, 'excellent', now() + interval '5 days', 5,  17, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', 'Sac de couchage en duvet bleu deplie sur un matelas de camping',          'active', now() - interval '2 days'),
    (au3, u8, 'Montre Garmin Fenix 7 Sapphire Solar',         350, 412, 650, 'bon',       now() + interval '7 days', 11, 34, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', 'Montre GPS Garmin Fenix 7 noire avec bracelet sport sur fond blanc',      'active', now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rental_items (id, owner_id, title, price_per_day, price_per_week, deposit, condition, location, distance_km, available, rating, reviews_count, image, alt, created_at) VALUES
    (re1, u1, 'Kit complet trekking haute montagne (tente + sac + rechaud)', 25, 140, 200, 'excellent', 'Lyon, 69',     2.5, true, 4.9, 23, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', 'Kit de camping complet avec tente, sac a dos et rechaud sur fond de montagne', now() - interval '60 days'),
    (re2, u2, 'Velo de bikepacking Salsa Cutthroat - Taille M',             35, 200, 300, 'bon',       'Paris, 75',    5.0, true, 4.7, 15, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', 'Velo de bikepacking gris avec sacoches chargees sur une route de campagne',   now() - interval '45 days'),
    (re3, u5, 'Kayak de mer double + pagaies + gilets',                     45, 250, 400, 'bon',       'Brest, 29',    1.2, true, 4.8, 18, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400', 'Kayak de mer double rouge avec deux pagaies et gilets de sauvetage',          now() - interval '30 days'),
    (re4, u4, 'Skis de randonnee Dynafit + chaussures + peaux',             40, 220, 350, 'excellent', 'Grenoble, 38', 3.8, true, 4.6, 12, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400', 'Skis de randonnee Dynafit avec chaussures et peaux de phoque sur la neige',   now() - interval '20 days')
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 10. BADGES UTILISATEURS
  -- ============================================================
  SELECT id INTO b1 FROM public.badges WHERE name = 'Premier Trek' LIMIT 1;
  SELECT id INTO b2 FROM public.badges WHERE name = 'Explorateur Confirme' LIMIT 1;
  SELECT id INTO b3 FROM public.badges WHERE name = 'Ultra-Traileur' LIMIT 1;

  IF b1 IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id, earned_at) VALUES
      (u1, b1, now() - interval '170 days'), (u2, b1, now() - interval '140 days'),
      (u3, b1, now() - interval '115 days'), (u4, b1, now() - interval '85 days'),
      (u5, b1, now() - interval '70 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF b2 IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id, earned_at) VALUES
      (u1, b2, now() - interval '100 days'), (u2, b2, now() - interval '80 days'),
      (u3, b2, now() - interval '60 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF b3 IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id, earned_at) VALUES
      (u3, b3, now() - interval '4 days')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ============================================================
  -- 11. DEFIS UTILISATEURS (challenges globaux)
  -- ============================================================
  INSERT INTO public.user_challenges (user_id, challenge_id, progress, completed, completed_at)
  SELECT u1, id, total, true, now() - interval '30 days'
  FROM public.challenges WHERE active = true LIMIT 2
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_challenges (user_id, challenge_id, progress, completed, completed_at)
  SELECT u2, id, total, true, now() - interval '20 days'
  FROM public.challenges WHERE active = true LIMIT 1
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_challenges (user_id, challenge_id, progress, completed)
  SELECT u3, id, FLOOR(total * 0.7)::int, false
  FROM public.challenges WHERE active = true LIMIT 2
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 12. KITS RECOMMANDES PAR LES CLUBS
  -- ============================================================
  SELECT id INTO kit1 FROM public.kits LIMIT 1;
  SELECT id INTO kit2 FROM public.kits OFFSET 1 LIMIT 1;

  IF kit1 IS NOT NULL THEN
    INSERT INTO public.club_recommended_kits (club_id, kit_id, recommended_by, note, created_at) VALUES
      (cl1, kit1, u1, 'Kit valide par notre communaute pour les treks alpins de 5 jours et plus.', now() - interval '30 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF kit2 IS NOT NULL THEN
    INSERT INTO public.club_recommended_kits (club_id, kit_id, recommended_by, note, created_at) VALUES
      (cl4, kit2, u3, 'Kit recommande pour les coureurs preparant leur premier ultra.', now() - interval '15 days')
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Fix seed data inserted successfully!';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data error: % - %', SQLSTATE, SQLERRM;
END $$;

-- ============================================================
-- RLS POLICIES — Lecture publique pour toutes les tables
-- ============================================================

-- user_profiles
DROP POLICY IF EXISTS "Public read user_profiles" ON public.user_profiles;
CREATE POLICY "Public read user_profiles" ON public.user_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
CREATE POLICY "Users update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users insert own profile" ON public.user_profiles;
CREATE POLICY "Users insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- carnets
DROP POLICY IF EXISTS "Public read carnets" ON public.carnets;
CREATE POLICY "Public read carnets" ON public.carnets FOR SELECT USING (visibility = 'public' OR auth.uid() = author_id);
DROP POLICY IF EXISTS "Auth insert carnets" ON public.carnets;
CREATE POLICY "Auth insert carnets" ON public.carnets FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Auth update carnets" ON public.carnets;
CREATE POLICY "Auth update carnets" ON public.carnets FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Auth delete carnets" ON public.carnets;
CREATE POLICY "Auth delete carnets" ON public.carnets FOR DELETE USING (auth.uid() = author_id);

-- carnet_likes
DROP POLICY IF EXISTS "Public read carnet_likes" ON public.carnet_likes;
CREATE POLICY "Public read carnet_likes" ON public.carnet_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage carnet_likes" ON public.carnet_likes;
CREATE POLICY "Auth manage carnet_likes" ON public.carnet_likes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- carnet_comments
DROP POLICY IF EXISTS "Public read carnet_comments" ON public.carnet_comments;
CREATE POLICY "Public read carnet_comments" ON public.carnet_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth insert carnet_comments" ON public.carnet_comments;
CREATE POLICY "Auth insert carnet_comments" ON public.carnet_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Auth delete carnet_comments" ON public.carnet_comments;
CREATE POLICY "Auth delete carnet_comments" ON public.carnet_comments FOR DELETE USING (auth.uid() = author_id);

-- carnet_favorites
DROP POLICY IF EXISTS "Public read carnet_favorites" ON public.carnet_favorites;
CREATE POLICY "Public read carnet_favorites" ON public.carnet_favorites FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage carnet_favorites" ON public.carnet_favorites;
CREATE POLICY "Auth manage carnet_favorites" ON public.carnet_favorites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- carnet_collaborators
DROP POLICY IF EXISTS "Public read carnet_collaborators" ON public.carnet_collaborators;
CREATE POLICY "Public read carnet_collaborators" ON public.carnet_collaborators FOR SELECT USING (true);

-- clubs
DROP POLICY IF EXISTS "Public read clubs" ON public.clubs;
CREATE POLICY "Public read clubs" ON public.clubs FOR SELECT USING (privacy != 'secret' OR EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = clubs.id AND cm.user_id = auth.uid() AND cm.status = 'active'));
DROP POLICY IF EXISTS "Auth insert clubs" ON public.clubs;
CREATE POLICY "Auth insert clubs" ON public.clubs FOR INSERT WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Auth update clubs" ON public.clubs;
CREATE POLICY "Auth update clubs" ON public.clubs FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Auth delete clubs" ON public.clubs;
CREATE POLICY "Auth delete clubs" ON public.clubs FOR DELETE USING (auth.uid() = created_by);

-- club_members
DROP POLICY IF EXISTS "Public read club_members" ON public.club_members;
CREATE POLICY "Public read club_members" ON public.club_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage club_members" ON public.club_members;
CREATE POLICY "Auth manage club_members" ON public.club_members FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- club_topics
DROP POLICY IF EXISTS "Public read club_topics" ON public.club_topics;
CREATE POLICY "Public read club_topics" ON public.club_topics FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth insert club_topics" ON public.club_topics;
CREATE POLICY "Auth insert club_topics" ON public.club_topics FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Auth update club_topics" ON public.club_topics;
CREATE POLICY "Auth update club_topics" ON public.club_topics FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Auth delete club_topics" ON public.club_topics;
CREATE POLICY "Auth delete club_topics" ON public.club_topics FOR DELETE USING (auth.uid() = author_id);

-- club_topic_replies
DROP POLICY IF EXISTS "Public read club_topic_replies" ON public.club_topic_replies;
CREATE POLICY "Public read club_topic_replies" ON public.club_topic_replies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth insert club_topic_replies" ON public.club_topic_replies;
CREATE POLICY "Auth insert club_topic_replies" ON public.club_topic_replies FOR INSERT WITH CHECK (auth.uid() = author_id);

-- club_challenges
DROP POLICY IF EXISTS "Public read club_challenges" ON public.club_challenges;
CREATE POLICY "Public read club_challenges" ON public.club_challenges FOR SELECT USING (true);

-- club_challenge_entries
DROP POLICY IF EXISTS "Public read club_challenge_entries" ON public.club_challenge_entries;
CREATE POLICY "Public read club_challenge_entries" ON public.club_challenge_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage club_challenge_entries" ON public.club_challenge_entries;
CREATE POLICY "Auth manage club_challenge_entries" ON public.club_challenge_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- club_events
DROP POLICY IF EXISTS "Public read club_events" ON public.club_events;
CREATE POLICY "Public read club_events" ON public.club_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth insert club_events" ON public.club_events;
CREATE POLICY "Auth insert club_events" ON public.club_events FOR INSERT WITH CHECK (auth.uid() = organizer_id);

-- club_recommended_kits
DROP POLICY IF EXISTS "Public read club_recommended_kits" ON public.club_recommended_kits;
CREATE POLICY "Public read club_recommended_kits" ON public.club_recommended_kits FOR SELECT USING (true);

-- community_posts
DROP POLICY IF EXISTS "Public read community_posts" ON public.community_posts;
CREATE POLICY "Public read community_posts" ON public.community_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth insert community_posts" ON public.community_posts;
CREATE POLICY "Auth insert community_posts" ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Auth update community_posts" ON public.community_posts;
CREATE POLICY "Auth update community_posts" ON public.community_posts FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Auth delete community_posts" ON public.community_posts;
CREATE POLICY "Auth delete community_posts" ON public.community_posts FOR DELETE USING (auth.uid() = author_id);

-- post_likes
DROP POLICY IF EXISTS "Public read post_likes" ON public.post_likes;
CREATE POLICY "Public read post_likes" ON public.post_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage post_likes" ON public.post_likes;
CREATE POLICY "Auth manage post_likes" ON public.post_likes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- post_comments
DROP POLICY IF EXISTS "Public read post_comments" ON public.post_comments;
CREATE POLICY "Public read post_comments" ON public.post_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth insert post_comments" ON public.post_comments;
CREATE POLICY "Auth insert post_comments" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Auth delete post_comments" ON public.post_comments;
CREATE POLICY "Auth delete post_comments" ON public.post_comments FOR DELETE USING (auth.uid() = author_id);

-- user_follows
DROP POLICY IF EXISTS "Public read user_follows" ON public.user_follows;
CREATE POLICY "Public read user_follows" ON public.user_follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage user_follows" ON public.user_follows;
CREATE POLICY "Auth manage user_follows" ON public.user_follows FOR ALL USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

-- qa_questions
DROP POLICY IF EXISTS "Public read qa_questions" ON public.qa_questions;
CREATE POLICY "Public read qa_questions" ON public.qa_questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth insert qa_questions" ON public.qa_questions;
CREATE POLICY "Auth insert qa_questions" ON public.qa_questions FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Auth update qa_questions" ON public.qa_questions;
CREATE POLICY "Auth update qa_questions" ON public.qa_questions FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

-- qa_answers
DROP POLICY IF EXISTS "Public read qa_answers" ON public.qa_answers;
CREATE POLICY "Public read qa_answers" ON public.qa_answers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth insert qa_answers" ON public.qa_answers;
CREATE POLICY "Auth insert qa_answers" ON public.qa_answers FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Auth update qa_answers" ON public.qa_answers;
CREATE POLICY "Auth update qa_answers" ON public.qa_answers FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

-- qa_votes
DROP POLICY IF EXISTS "Public read qa_votes" ON public.qa_votes;
CREATE POLICY "Public read qa_votes" ON public.qa_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage qa_votes" ON public.qa_votes;
CREATE POLICY "Auth manage qa_votes" ON public.qa_votes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ama_sessions
DROP POLICY IF EXISTS "Public read ama_sessions" ON public.ama_sessions;
CREATE POLICY "Public read ama_sessions" ON public.ama_sessions FOR SELECT USING (true);

-- ama_questions
DROP POLICY IF EXISTS "Public read ama_questions" ON public.ama_questions;
CREATE POLICY "Public read ama_questions" ON public.ama_questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth insert ama_questions" ON public.ama_questions;
CREATE POLICY "Auth insert ama_questions" ON public.ama_questions FOR INSERT WITH CHECK (auth.uid() = author_id);

-- occasion_items
DROP POLICY IF EXISTS "Public read occasion_items" ON public.occasion_items;
CREATE POLICY "Public read occasion_items" ON public.occasion_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage occasion_items" ON public.occasion_items;
CREATE POLICY "Auth manage occasion_items" ON public.occasion_items FOR ALL USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

-- auction_items
DROP POLICY IF EXISTS "Public read auction_items" ON public.auction_items;
CREATE POLICY "Public read auction_items" ON public.auction_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage auction_items" ON public.auction_items;
CREATE POLICY "Auth manage auction_items" ON public.auction_items FOR ALL USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

-- rental_items
DROP POLICY IF EXISTS "Public read rental_items" ON public.rental_items;
CREATE POLICY "Public read rental_items" ON public.rental_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage rental_items" ON public.rental_items;
CREATE POLICY "Auth manage rental_items" ON public.rental_items FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- user_badges
DROP POLICY IF EXISTS "Public read user_badges" ON public.user_badges;
CREATE POLICY "Public read user_badges" ON public.user_badges FOR SELECT USING (true);

-- user_challenges
DROP POLICY IF EXISTS "Public read user_challenges" ON public.user_challenges;
CREATE POLICY "Public read user_challenges" ON public.user_challenges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth manage user_challenges" ON public.user_challenges;
CREATE POLICY "Auth manage user_challenges" ON public.user_challenges FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
