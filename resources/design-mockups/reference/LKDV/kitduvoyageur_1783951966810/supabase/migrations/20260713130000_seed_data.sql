-- ============================================================
-- SEED DATA — Kit du Voyageur
-- Données réalistes pour simuler une plateforme active
-- ============================================================

DO $$
DECLARE
  -- UUIDs utilisateurs
  u1 UUID := gen_random_uuid();
  u2 UUID := gen_random_uuid();
  u3 UUID := gen_random_uuid();
  u4 UUID := gen_random_uuid();
  u5 UUID := gen_random_uuid();
  u6 UUID := gen_random_uuid();
  u7 UUID := gen_random_uuid();
  u8 UUID := gen_random_uuid();
  u9 UUID := gen_random_uuid();
  u10 UUID := gen_random_uuid();
  u11 UUID := gen_random_uuid();
  u12 UUID := gen_random_uuid();

  -- UUIDs carnets
  c1 UUID := gen_random_uuid();
  c2 UUID := gen_random_uuid();
  c3 UUID := gen_random_uuid();
  c4 UUID := gen_random_uuid();
  c5 UUID := gen_random_uuid();
  c6 UUID := gen_random_uuid();
  c7 UUID := gen_random_uuid();
  c8 UUID := gen_random_uuid();

  -- UUIDs clubs
  cl1 UUID := gen_random_uuid();
  cl2 UUID := gen_random_uuid();
  cl3 UUID := gen_random_uuid();
  cl4 UUID := gen_random_uuid();
  cl5 UUID := gen_random_uuid();

  -- UUIDs topics clubs
  t1 UUID := gen_random_uuid();
  t2 UUID := gen_random_uuid();
  t3 UUID := gen_random_uuid();
  t4 UUID := gen_random_uuid();
  t5 UUID := gen_random_uuid();
  t6 UUID := gen_random_uuid();

  -- UUIDs challenges clubs
  ch1 UUID := gen_random_uuid();
  ch2 UUID := gen_random_uuid();
  ch3 UUID := gen_random_uuid();

  -- UUIDs events clubs
  ev1 UUID := gen_random_uuid();
  ev2 UUID := gen_random_uuid();
  ev3 UUID := gen_random_uuid();

  -- UUIDs posts communauté
  p1 UUID := gen_random_uuid();
  p2 UUID := gen_random_uuid();
  p3 UUID := gen_random_uuid();
  p4 UUID := gen_random_uuid();
  p5 UUID := gen_random_uuid();
  p6 UUID := gen_random_uuid();
  p7 UUID := gen_random_uuid();
  p8 UUID := gen_random_uuid();
  p9 UUID := gen_random_uuid();
  p10 UUID := gen_random_uuid();

  -- UUIDs Q&R
  q1 UUID := gen_random_uuid();
  q2 UUID := gen_random_uuid();
  q3 UUID := gen_random_uuid();
  q4 UUID := gen_random_uuid();
  q5 UUID := gen_random_uuid();
  qa1 UUID := gen_random_uuid();
  qa2 UUID := gen_random_uuid();
  qa3 UUID := gen_random_uuid();
  qa4 UUID := gen_random_uuid();
  qa5 UUID := gen_random_uuid();
  qa6 UUID := gen_random_uuid();

  -- UUIDs AMA
  ama1 UUID := gen_random_uuid();
  ama2 UUID := gen_random_uuid();
  amaq1 UUID := gen_random_uuid();
  amaq2 UUID := gen_random_uuid();
  amaq3 UUID := gen_random_uuid();
  amaq4 UUID := gen_random_uuid();

  -- UUIDs occasion / enchères / location
  oc1 UUID := gen_random_uuid();
  oc2 UUID := gen_random_uuid();
  oc3 UUID := gen_random_uuid();
  oc4 UUID := gen_random_uuid();
  oc5 UUID := gen_random_uuid();
  au1 UUID := gen_random_uuid();
  au2 UUID := gen_random_uuid();
  au3 UUID := gen_random_uuid();
  re1 UUID := gen_random_uuid();
  re2 UUID := gen_random_uuid();
  re3 UUID := gen_random_uuid();
  re4 UUID := gen_random_uuid();

  -- UUIDs badges
  b1 UUID;
  b2 UUID;
  b3 UUID;

  -- UUIDs kits existants
  kit1 UUID;
  kit2 UUID;

BEGIN

  -- ============================================================
  -- 1. UTILISATEURS (auth.users → déclenche user_profiles)
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
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'marie.dupont@email.fr', crypt('Voyage2024!', gen_salt('bf', 10)), now() - interval '180 days', now() - interval '180 days', now(),
     jsonb_build_object('full_name', 'Marie Dupont', 'avatar_url', 'https://i.pravatar.cc/150?img=1'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'thomas.martin@email.fr', crypt('Rando2024!', gen_salt('bf', 10)), now() - interval '150 days', now() - interval '150 days', now(),
     jsonb_build_object('full_name', 'Thomas Martin', 'avatar_url', 'https://i.pravatar.cc/150?img=2'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sophie.bernard@email.fr', crypt('Trek2024!', gen_salt('bf', 10)), now() - interval '120 days', now() - interval '120 days', now(),
     jsonb_build_object('full_name', 'Sophie Bernard', 'avatar_url', 'https://i.pravatar.cc/150?img=3'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'lucas.petit@email.fr', crypt('Alpin2024!', gen_salt('bf', 10)), now() - interval '90 days', now() - interval '90 days', now(),
     jsonb_build_object('full_name', 'Lucas Petit', 'avatar_url', 'https://i.pravatar.cc/150?img=4'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'camille.leroy@email.fr', crypt('Kayak2024!', gen_salt('bf', 10)), now() - interval '75 days', now() - interval '75 days', now(),
     jsonb_build_object('full_name', 'Camille Leroy', 'avatar_url', 'https://i.pravatar.cc/150?img=5'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u6, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'antoine.moreau@email.fr', crypt('Velo2024!', gen_salt('bf', 10)), now() - interval '60 days', now() - interval '60 days', now(),
     jsonb_build_object('full_name', 'Antoine Moreau', 'avatar_url', 'https://i.pravatar.cc/150?img=6'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u7, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'julie.simon@email.fr', crypt('Surf2024!', gen_salt('bf', 10)), now() - interval '45 days', now() - interval '45 days', now(),
     jsonb_build_object('full_name', 'Julie Simon', 'avatar_url', 'https://i.pravatar.cc/150?img=7'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u8, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'maxime.garcia@email.fr', crypt('Ski2024!', gen_salt('bf', 10)), now() - interval '30 days', now() - interval '30 days', now(),
     jsonb_build_object('full_name', 'Maxime Garcia', 'avatar_url', 'https://i.pravatar.cc/150?img=8'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u9, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'lea.roux@email.fr', crypt('Moto2024!', gen_salt('bf', 10)), now() - interval '20 days', now() - interval '20 days', now(),
     jsonb_build_object('full_name', 'Léa Roux', 'avatar_url', 'https://i.pravatar.cc/150?img=9'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u10, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'nicolas.blanc@email.fr', crypt('Escalade2024!', gen_salt('bf', 10)), now() - interval '15 days', now() - interval '15 days', now(),
     jsonb_build_object('full_name', 'Nicolas Blanc', 'avatar_url', 'https://i.pravatar.cc/150?img=10'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u11, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'emma.henry@email.fr', crypt('Yoga2024!', gen_salt('bf', 10)), now() - interval '10 days', now() - interval '10 days', now(),
     jsonb_build_object('full_name', 'Emma Henry', 'avatar_url', 'https://i.pravatar.cc/150?img=11'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u12, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'pierre.lambert@email.fr', crypt('Peche2024!', gen_salt('bf', 10)), now() - interval '5 days', now() - interval '5 days', now(),
     jsonb_build_object('full_name', 'Pierre Lambert', 'avatar_url', 'https://i.pravatar.cc/150?img=12'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
  ON CONFLICT (id) DO NOTHING;

  -- Mise à jour des profils avec points de fidélité et scores
  UPDATE public.user_profiles SET
    trust_score = 92, loyalty_points = 3450, loyalty_level = 'Explorateur Elite',
    created_at = now() - interval '180 days'
  WHERE id = u1;
  UPDATE public.user_profiles SET
    trust_score = 88, loyalty_points = 2800, loyalty_level = 'Aventurier',
    created_at = now() - interval '150 days'
  WHERE id = u2;
  UPDATE public.user_profiles SET
    trust_score = 85, loyalty_points = 2200, loyalty_level = 'Aventurier',
    created_at = now() - interval '120 days'
  WHERE id = u3;
  UPDATE public.user_profiles SET
    trust_score = 79, loyalty_points = 1650, loyalty_level = 'Explorateur',
    created_at = now() - interval '90 days'
  WHERE id = u4;
  UPDATE public.user_profiles SET
    trust_score = 74, loyalty_points = 1200, loyalty_level = 'Explorateur',
    created_at = now() - interval '75 days'
  WHERE id = u5;
  UPDATE public.user_profiles SET
    trust_score = 68, loyalty_points = 890, loyalty_level = 'Explorateur',
    created_at = now() - interval '60 days'
  WHERE id = u6;
  UPDATE public.user_profiles SET
    trust_score = 65, loyalty_points = 720, loyalty_level = 'Découvreur',
    created_at = now() - interval '45 days'
  WHERE id = u7;
  UPDATE public.user_profiles SET
    trust_score = 61, loyalty_points = 540, loyalty_level = 'Découvreur',
    created_at = now() - interval '30 days'
  WHERE id = u8;
  UPDATE public.user_profiles SET
    trust_score = 58, loyalty_points = 380, loyalty_level = 'Découvreur',
    created_at = now() - interval '20 days'
  WHERE id = u9;
  UPDATE public.user_profiles SET
    trust_score = 55, loyalty_points = 210, loyalty_level = 'Novice',
    created_at = now() - interval '15 days'
  WHERE id = u10;
  UPDATE public.user_profiles SET
    trust_score = 52, loyalty_points = 120, loyalty_level = 'Novice',
    created_at = now() - interval '10 days'
  WHERE id = u11;
  UPDATE public.user_profiles SET
    trust_score = 50, loyalty_points = 60, loyalty_level = 'Novice',
    created_at = now() - interval '5 days'
  WHERE id = u12;

  -- ============================================================
  -- 2. FOLLOWS
  -- ============================================================
  INSERT INTO public.user_follows (follower_id, following_id, created_at) VALUES
    (u2, u1, now() - interval '140 days'),
    (u3, u1, now() - interval '110 days'),
    (u4, u1, now() - interval '80 days'),
    (u5, u1, now() - interval '60 days'),
    (u6, u1, now() - interval '50 days'),
    (u1, u2, now() - interval '130 days'),
    (u3, u2, now() - interval '100 days'),
    (u4, u2, now() - interval '70 days'),
    (u1, u3, now() - interval '115 days'),
    (u2, u3, now() - interval '95 days'),
    (u5, u3, now() - interval '55 days'),
    (u1, u4, now() - interval '85 days'),
    (u2, u4, now() - interval '65 days'),
    (u6, u5, now() - interval '40 days'),
    (u7, u5, now() - interval '30 days'),
    (u8, u6, now() - interval '25 days'),
    (u9, u7, now() - interval '15 days'),
    (u10, u8, now() - interval '10 days')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 3. CARNETS D'EXPÉDITION
  -- ============================================================
  INSERT INTO public.carnets (id, author_id, title, destination, description, cover_image, cover_image_alt, start_date, end_date, weather, route_rating, visibility, tags, map_points, is_collaborative, likes_count, comments_count, favorites_count, views_count, verified, created_at) VALUES
    (c1, u1, 'Trek au Népal : Tour des Annapurnas', 'Népal', 'Un périple inoubliable de 21 jours autour du massif des Annapurnas. Cols à plus de 5000m, villages sherpa authentiques, et rencontres humaines bouleversantes. Le kit ultraléger a fait toute la différence sur ce parcours exigeant.', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800', 'Vue panoramique sur les sommets enneigés des Annapurnas au lever du soleil', '2025-10-01', '2025-10-21', 'Ensoleillé avec quelques chutes de neige au col Thorong La', 4.8, 'public', ARRAY['népal','trek','haute altitude','annapurnas','ultraléger'], '[]'::jsonb, false, 127, 34, 89, 2840, true, now() - interval '60 days'),
    (c2, u2, 'Traversée des Pyrénées en VTT', 'Pyrénées, France/Espagne', 'La traversée complète des Pyrénées à vélo tout-terrain en 18 jours. Des cols mythiques, des descentes vertigineuses et des bivouacs sous les étoiles. Un défi physique et mental hors du commun.', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', 'Cycliste sur un sentier de montagne dans les Pyrénées avec vue sur la vallée', '2025-07-15', '2025-08-02', 'Beau temps dominant, orage le jour 12', 4.6, 'public', ARRAY['vélo','pyrénées','bikepacking','cols','bivouac'], '[]'::jsonb, false, 98, 28, 67, 1920, true, now() - interval '45 days'),
    (c3, u3, 'Randonnée en Islande : Laugavegur Trail', 'Islande', 'Le sentier Laugavegur, 55km de paysages lunaires entre volcans, geysers et champs de lave. Une aventure en autonomie complète avec portage de 5 jours de nourriture. Expérience unique au monde.', 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=800', 'Paysage volcanique islandais avec vapeurs géothermiques et montagnes colorées', '2025-08-10', '2025-08-15', 'Vent fort, pluie intermittente, températures entre 5 et 15°C', 4.9, 'public', ARRAY['islande','randonnée','autonomie','volcans','laugavegur'], '[]'::jsonb, true, 156, 42, 112, 3210, true, now() - interval '35 days'),
    (c4, u4, 'Ski de randonnée dans les Alpes', 'Alpes françaises', 'Semaine de ski de rando dans le massif du Mont-Blanc. Ascension du Mont Blanc du Tacul, traversée de la Vallée Blanche et bivouac au refuge des Cosmiques. Conditions hivernales extrêmes.', 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800', 'Skieur de randonnée sur une pente enneigée avec le Mont Blanc en arrière-plan', '2025-02-20', '2025-02-27', 'Grand froid (-20°C au sommet), beau temps', 4.7, 'public', ARRAY['ski','alpes','mont-blanc','randonnée','hiver'], '[]'::jsonb, false, 84, 19, 58, 1650, false, now() - interval '25 days'),
    (c5, u5, 'Kayak de mer en Bretagne', 'Bretagne, France', 'Tour de la presqu''île de Crozon en kayak de mer sur 7 jours. Grottes marines, plages sauvages et couchers de soleil sur l''Atlantique. Navigation côtière avec camping sur des plages isolées.', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800', 'Kayakiste pagayant dans une crique bretonne avec falaises et eau turquoise', '2025-06-01', '2025-06-07', 'Mer belle à peu agitée, vent de nord-ouest modéré', 4.5, 'public', ARRAY['kayak','bretagne','mer','côte','camping'], '[]'::jsonb, false, 73, 22, 45, 1380, false, now() - interval '20 days'),
    (c6, u1, 'Traversée du Sahara à pied', 'Maroc/Algérie', 'Expédition de 14 jours à travers les dunes de l''Erg Chebbi et les plateaux rocheux du Sahara. Portage de 15L d''eau, navigation à la boussole et nuits sous un ciel étoilé exceptionnel.', 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800', 'Randonneur solitaire marchant sur une dune de sable au coucher du soleil dans le Sahara', '2025-03-05', '2025-03-19', 'Chaleur extrême (45°C le jour), froid la nuit (5°C)', 4.9, 'public', ARRAY['sahara','désert','maroc','expédition','autonomie'], '[]'::jsonb, false, 203, 56, 145, 4120, true, now() - interval '15 days'),
    (c7, u6, 'Via Ferrata dans les Dolomites', 'Dolomites, Italie', 'Semaine de via ferrata dans les Dolomites italiennes. Cinq itinéraires classés D/TD avec nuits en refuge. Paysages à couper le souffle et adrénaline garantie sur les parois verticales.', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'Grimpeur sur une via ferrata avec vue sur les pics rocheux des Dolomites', '2025-09-08', '2025-09-14', 'Beau temps, quelques nuages l''après-midi', 4.4, 'public', ARRAY['via-ferrata','dolomites','escalade','italie','refuge'], '[]'::jsonb, false, 61, 15, 38, 1120, false, now() - interval '10 days'),
    (c8, u3, 'Ultratrail du Mont-Blanc : Préparation et récit', 'Chamonix, France', 'Mon aventure à l''UTMB 2025 : 171km et 10 000m de dénivelé positif. De la préparation physique sur 8 mois au récit heure par heure de la course. Gestion de l''effort, nutrition et équipement détaillés.', 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800', 'Coureur de trail sur un sentier de montagne au-dessus des nuages près de Chamonix', '2025-08-25', '2025-08-30', 'Variable : soleil, pluie, neige selon l''altitude', 5.0, 'public', ARRAY['utmb','trail','chamonix','ultra','endurance'], '[]'::jsonb, true, 312, 78, 198, 6540, true, now() - interval '5 days')
  ON CONFLICT (id) DO NOTHING;

  -- Likes carnets
  INSERT INTO public.carnet_likes (carnet_id, user_id, reaction, created_at) VALUES
    (c1, u2, 'heart', now() - interval '58 days'),
    (c1, u3, 'fire', now() - interval '55 days'),
    (c1, u4, 'bag', now() - interval '50 days'),
    (c1, u5, 'useful', now() - interval '48 days'),
    (c1, u6, 'heart', now() - interval '45 days'),
    (c3, u1, 'fire', now() - interval '33 days'),
    (c3, u2, 'heart', now() - interval '30 days'),
    (c3, u4, 'useful', now() - interval '28 days'),
    (c6, u2, 'fire', now() - interval '13 days'),
    (c6, u3, 'heart', now() - interval '12 days'),
    (c6, u4, 'bag', now() - interval '11 days'),
    (c8, u1, 'fire', now() - interval '4 days'),
    (c8, u2, 'heart', now() - interval '4 days'),
    (c8, u4, 'useful', now() - interval '3 days'),
    (c8, u5, 'fire', now() - interval '3 days')
  ON CONFLICT DO NOTHING;

  -- Commentaires carnets
  INSERT INTO public.carnet_comments (carnet_id, author_id, content, likes_count, created_at) VALUES
    (c1, u2, 'Incroyable récit ! J''ai fait ce trek il y a 3 ans et tu as parfaitement capturé l''essence de cette aventure. Le col Thorong La reste un des moments les plus intenses de ma vie.', 12, now() - interval '57 days'),
    (c1, u3, 'Quel kit as-tu utilisé pour les nuits en altitude ? Je prépare le même trek pour l''automne prochain.', 5, now() - interval '55 days'),
    (c1, u4, 'Photos magnifiques ! La description du village de Manang est tellement juste. Merci pour ce partage.', 8, now() - interval '52 days'),
    (c3, u1, 'Le Laugavegur est sur ma liste depuis des années. Ton récit me donne encore plus envie ! Combien de kg portais-tu ?', 9, now() - interval '32 days'),
    (c3, u4, 'J''ai fait ce sentier en 2023. Attention aux rivières à traverser si tu y vas en juillet, elles peuvent être très hautes !', 15, now() - interval '30 days'),
    (c6, u2, 'Traversée du Sahara... tu es fou ! Mais quel courage. Comment tu as géré la chaleur les premiers jours ?', 18, now() - interval '14 days'),
    (c6, u5, 'Expédition de rêve. J''ai lu ton récit trois fois. La partie sur la navigation à la boussole est fascinante.', 11, now() - interval '12 days'),
    (c8, u2, 'UTMB 2025 ! Bravo pour cette performance. Le récit heure par heure est captivant. Tu as géré comment les hallucinations nocturnes ?', 24, now() - interval '4 days'),
    (c8, u4, 'Merci pour les détails sur la nutrition. Je prépare mon premier 100km et tes conseils sont précieux.', 16, now() - interval '3 days'),
    (c8, u5, 'Quelle inspiration ! La section sur la montée du Grand Col Ferret à 3h du matin m''a donné des frissons.', 19, now() - interval '2 days')
  ON CONFLICT DO NOTHING;

  -- Favoris carnets
  INSERT INTO public.carnet_favorites (carnet_id, user_id, created_at) VALUES
    (c1, u2, now() - interval '58 days'),
    (c1, u3, now() - interval '55 days'),
    (c1, u4, now() - interval '50 days'),
    (c3, u1, now() - interval '33 days'),
    (c3, u2, now() - interval '31 days'),
    (c6, u2, now() - interval '14 days'),
    (c6, u3, now() - interval '13 days'),
    (c8, u1, now() - interval '4 days'),
    (c8, u2, now() - interval '4 days'),
    (c8, u4, now() - interval '3 days')
  ON CONFLICT DO NOTHING;

  -- Collaborateurs carnets
  INSERT INTO public.carnet_collaborators (carnet_id, user_id, role, created_at) VALUES
    (c3, u4, 'contributor', now() - interval '34 days'),
    (c8, u2, 'contributor', now() - interval '6 days')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 4. CLUBS
  -- ============================================================
  INSERT INTO public.clubs (id, slug, name, type, emoji, description, cover_color, category, rules, privacy, members_count, active_this_month, is_verified, created_by, created_at) VALUES
    (cl1, 'trekkeurs-alpes', 'Trekkeurs des Alpes', 'activité', '🏔️', 'Club dédié aux passionnés de randonnée et trekking dans les Alpes françaises et suisses. Partage d''itinéraires, conseils d''équipement et organisation de sorties collectives.', 'from-blue-600 to-indigo-700', 'Randonnée', 'Respectez les autres membres. Partagez vos expériences avec bienveillance. Pas de publicité non sollicitée.', 'open', 847, 234, true, u1, now() - interval '150 days'),
    (cl2, 'bikepacking-france', 'Bikepacking France', 'activité', '🚵', 'La communauté française du bikepacking. Voyages à vélo en autonomie, itinéraires, matériel et récits d''aventures sur deux roues.', 'from-green-600 to-emerald-700', 'Cyclisme', 'Bienveillance obligatoire. Partagez vos routes et vos galères avec humour. Entraide avant tout.', 'open', 523, 178, true, u2, now() - interval '120 days'),
    (cl3, 'kayak-mer-atlantique', 'Kayak Mer Atlantique', 'activité', '🚣', 'Club des kayakistes de mer sur la façade atlantique. Navigation côtière, expéditions et techniques de sécurité en mer.', 'from-cyan-600 to-blue-700', 'Kayak', 'Sécurité en mer avant tout. Partagez les conditions météo et les bons plans de mise à l''eau.', 'open', 312, 89, false, u5, now() - interval '90 days'),
    (cl4, 'ultra-trail-runners', 'Ultra Trail Runners', 'activité', '🏃', 'Pour les coureurs de trail et d''ultra-trail. Préparation, nutrition, récits de courses et soutien mutuel pour repousser ses limites.', 'from-orange-600 to-red-700', 'Course à pied', 'Respect des niveaux de chacun. Encouragements obligatoires. Partage des plans d''entraînement bienvenu.', 'open', 689, 312, true, u3, now() - interval '100 days'),
    (cl5, 'voyageurs-maroc', 'Voyageurs du Maroc', 'pays', '🇲🇦', 'Communauté des voyageurs passionnés par le Maroc. Randonnées dans l''Atlas, traversées du Sahara, culture berbère et conseils pratiques.', 'from-amber-600 to-orange-700', 'Voyage', 'Respect de la culture locale. Partage de bons plans responsables et durables.', 'open', 428, 156, false, u1, now() - interval '80 days')
  ON CONFLICT (id) DO NOTHING;

  -- Membres clubs
  INSERT INTO public.club_members (club_id, user_id, role, status, joined_at) VALUES
    (cl1, u1, 'admin', 'active', now() - interval '150 days'),
    (cl1, u2, 'moderator', 'active', now() - interval '140 days'),
    (cl1, u3, 'member', 'active', now() - interval '110 days'),
    (cl1, u4, 'member', 'active', now() - interval '85 days'),
    (cl1, u5, 'member', 'active', now() - interval '70 days'),
    (cl1, u6, 'member', 'active', now() - interval '55 days'),
    (cl1, u7, 'member', 'active', now() - interval '40 days'),
    (cl1, u8, 'member', 'active', now() - interval '25 days'),
    (cl2, u2, 'admin', 'active', now() - interval '120 days'),
    (cl2, u1, 'member', 'active', now() - interval '115 days'),
    (cl2, u4, 'moderator', 'active', now() - interval '90 days'),
    (cl2, u6, 'member', 'active', now() - interval '60 days'),
    (cl2, u9, 'member', 'active', now() - interval '18 days'),
    (cl3, u5, 'admin', 'active', now() - interval '90 days'),
    (cl3, u7, 'member', 'active', now() - interval '35 days'),
    (cl3, u10, 'member', 'active', now() - interval '12 days'),
    (cl4, u3, 'admin', 'active', now() - interval '100 days'),
    (cl4, u1, 'moderator', 'active', now() - interval '95 days'),
    (cl4, u2, 'member', 'active', now() - interval '80 days'),
    (cl4, u8, 'member', 'active', now() - interval '28 days'),
    (cl4, u11, 'member', 'active', now() - interval '8 days'),
    (cl5, u1, 'admin', 'active', now() - interval '80 days'),
    (cl5, u3, 'member', 'active', now() - interval '75 days'),
    (cl5, u6, 'member', 'active', now() - interval '50 days'),
    (cl5, u12, 'member', 'active', now() - interval '4 days')
  ON CONFLICT DO NOTHING;

  -- Topics clubs
  INSERT INTO public.club_topics (id, club_id, author_id, title, content, is_pinned, is_announcement, is_approved, likes_count, replies_count, created_at) VALUES
    (t1, cl1, u1, '📌 Bienvenue dans le club Trekkeurs des Alpes !', 'Bonjour à tous ! Ce club est l''endroit idéal pour partager vos aventures alpines, poser vos questions et organiser des sorties ensemble. N''hésitez pas à vous présenter en réponse à ce post.', true, true, true, 45, 67, now() - interval '148 days'),
    (t2, cl1, u2, 'Itinéraire GR5 : conseils pour la section Lac Léman - Nice', 'Je prépare la traversée complète du GR5 pour l''été prochain. Quelqu''un a des retours sur les refuges à réserver en priorité ? Et quelle est la meilleure période pour éviter la foule sur la section Mercantour ?', false, false, true, 23, 18, now() - interval '30 days'),
    (t3, cl1, u3, 'Comparatif chaussures de randonnée 2025 : vos retours ?', 'Je cherche à renouveler mes chaussures après 3 ans de bons et loyaux services. Entre les Salomon X Ultra 4 et les Hoka Anacapa, vous conseillez quoi pour du terrain mixte rocher/sentier ?', false, false, true, 31, 24, now() - interval '15 days'),
    (t4, cl2, u2, '🚵 Sortie bikepacking Pyrénées - Juillet 2026', 'On organise une traversée des Pyrénées en groupe de 6-8 personnes du 10 au 28 juillet. Départ Hendaye, arrivée Banyuls. Niveau intermédiaire requis. Qui est partant ? Répondez ici pour vous inscrire !', true, true, true, 38, 29, now() - interval '45 days'),
    (t5, cl4, u3, 'Retour UTMB 2025 - Analyse et conseils', 'Je viens de terminer l''UTMB en 38h12. Je partage ici mon analyse complète : préparation, nutrition, gestion de l''effort et les erreurs à ne pas reproduire. N''hésitez pas à poser vos questions.', false, false, true, 67, 45, now() - interval '5 days'),
    (t6, cl5, u1, 'Traversée du Sahara : guide complet et conseils sécurité', 'Suite à mon expédition de mars, je compile ici tous les conseils pratiques pour une traversée en sécurité : eau, navigation, contacts locaux, kit d''urgence. Un document de référence pour le club.', true, false, true, 52, 31, now() - interval '12 days')
  ON CONFLICT (id) DO NOTHING;

  -- Réponses topics
  INSERT INTO public.club_topic_replies (topic_id, author_id, content, is_approved, likes_count, created_at) VALUES
    (t1, u2, 'Bonjour ! Thomas ici, passionné de randonnée depuis 15 ans. J''ai fait le Tour du Mont-Blanc 4 fois et je suis toujours partant pour de nouvelles aventures !', true, 8, now() - interval '147 days'),
    (t1, u3, 'Sophie, randonneuse et coureuse de trail. J''adore les bivouacs en altitude et les levers de soleil sur les sommets. Ravie de rejoindre cette communauté !', true, 6, now() - interval '145 days'),
    (t1, u4, 'Lucas, alpiniste amateur. Je cherche des compagnons de cordée pour des projets dans les Écrins cet été. Quelqu''un d''intéressé ?', true, 9, now() - interval '140 days'),
    (t2, u4, 'J''ai fait le GR5 complet en 2023. Pour les refuges, réserve absolument le Refuge de la Vanoise et le Refuge des Merveilles au moins 3 mois à l''avance. Juillet-août c''est blindé.', true, 15, now() - interval '28 days'),
    (t2, u1, 'La section Mercantour est magnifique mais effectivement très fréquentée en août. Préfère la fin juin ou septembre. Les bouquetins sont plus visibles aussi !', true, 12, now() - interval '27 days'),
    (t3, u1, 'J''ai les Salomon X Ultra 4 depuis 2 ans, environ 800km dessus. Excellentes sur terrain mixte, très bon maintien de cheville. Je les recommande sans hésiter.', true, 18, now() - interval '14 days'),
    (t3, u2, 'Les Hoka sont plus confortables sur les longues distances mais moins précises sur rocher. Tout dépend de ton usage principal.', true, 11, now() - interval '13 days'),
    (t4, u1, 'Je suis partant ! J''ai déjà fait la moitié côté espagnol, ce serait parfait pour compléter. Je peux apporter mon expérience de la section basque.', true, 7, now() - interval '43 days'),
    (t4, u4, 'Intéressé aussi ! Quel niveau de forme physique minimum ? Je fais du vélo 3 fois par semaine mais jamais fait de bikepacking.', true, 4, now() - interval '40 days'),
    (t5, u2, 'Bravo pour cette performance ! La gestion de la nuit sur la montée du Grand Col Ferret, comment tu as géré le sommeil ?', true, 22, now() - interval '4 days'),
    (t5, u4, 'Merci pour ce retour détaillé. La section nutrition est particulièrement utile. Tu as utilisé quoi comme gels ?', true, 16, now() - interval '3 days'),
    (t6, u3, 'Document exceptionnel ! J''ai tout sauvegardé. La partie sur les contacts locaux est vraiment précieuse pour la sécurité.', true, 19, now() - interval '11 days')
  ON CONFLICT DO NOTHING;

  -- Défis clubs
  INSERT INTO public.club_challenges (id, club_id, title, description, xp, deadline, active, created_at) VALUES
    (ch1, cl1, 'Défi 3 Cols en 3 Jours', 'Réalisez 3 cols alpins de plus de 2500m en 3 jours consécutifs. Partagez vos photos et votre trace GPS pour valider.', 500, now() + interval '60 days', true, now() - interval '20 days'),
    (ch2, cl4, 'Challenge 1000km de trail en 2026', 'Courez 1000km de trail cumulés avant le 31 décembre 2026. Partagez vos sorties hebdomadaires pour suivre votre progression.', 1000, now() + interval '170 days', true, now() - interval '10 days'),
    (ch3, cl2, 'Bikepacking Solo 500km', 'Réalisez un voyage bikepacking en solo d''au moins 500km en une semaine. Documentez votre aventure avec photos et récit.', 750, now() + interval '90 days', true, now() - interval '15 days')
  ON CONFLICT (id) DO NOTHING;

  -- Entrées défis
  INSERT INTO public.club_challenge_entries (challenge_id, user_id, proof_text, score, validated, created_at) VALUES
    (ch1, u2, 'Col du Galibier (2642m), Col de l''Iseran (2770m), Col de la Croix de Fer (2067m) en 3 jours. Trace GPS disponible.', 500, true, now() - interval '5 days'),
    (ch1, u3, 'Col du Tourmalet (2115m), Col d''Aubisque (1709m), Col du Soulor (1474m). Conditions parfaites !', 500, true, now() - interval '3 days'),
    (ch2, u1, 'Semaine 1 : 45km. Semaine 2 : 52km. Semaine 3 : 38km. Total : 135km sur 3 semaines.', 135, false, now() - interval '2 days'),
    (ch3, u4, 'Traversée Bordeaux-Biarritz en 6 jours, 520km. Récit complet sur mon carnet d''expédition.', 750, true, now() - interval '1 day')
  ON CONFLICT DO NOTHING;

  -- Événements clubs
  INSERT INTO public.club_events (id, club_id, organizer_id, title, description, event_date, location, max_participants, participants_count, created_at) VALUES
    (ev1, cl1, u1, 'Sortie collective Tour du Beaufortain', 'Randonnée de 3 jours autour du massif du Beaufortain. Niveau intermédiaire. Hébergement en refuge. Inscription obligatoire.', now() + interval '45 days', 'Beaufort, Savoie', 12, 8, now() - interval '20 days'),
    (ev2, cl4, u3, 'Entraînement trail nocturne - Forêt de Fontainebleau', 'Sortie trail nocturne de 25km dans la forêt de Fontainebleau. Frontales obligatoires. Niveau intermédiaire à avancé.', now() + interval '15 days', 'Fontainebleau, Seine-et-Marne', 20, 14, now() - interval '10 days'),
    (ev3, cl2, u2, 'Atelier bikepacking débutants - Paris', 'Journée d''initiation au bikepacking : chargement du vélo, choix du matériel, planification d''itinéraire. Gratuit pour les membres du club.', now() + interval '30 days', 'Paris, 11ème arrondissement', 15, 11, now() - interval '8 days')
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 5. POSTS COMMUNAUTÉ
  -- ============================================================
  INSERT INTO public.community_posts (id, author_id, content, image_url, image_alt, post_type, linked_carnet_id, likes_count, comments_count, shares_count, is_trending, created_at) VALUES
    (p1, u1, 'Retour de 3 semaines au Népal ! Le Tour des Annapurnas reste l''expérience la plus intense de ma vie. 21 jours, 160km, 7000m de dénivelé. Mon kit ultraléger de 8kg a été parfait. Je partage mon carnet complet en lien 🎒', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600', 'Panorama sur les Annapurnas avec randonneur au premier plan', 'share', c1, 127, 34, 23, true, now() - interval '58 days'),
    (p2, u2, 'Conseil du jour 🚵 Pour votre premier bikepacking, commencez par un week-end de 2 jours max. Chargez votre vélo à 80% de ce que vous pensez avoir besoin. Vous verrez, c''est encore trop ! La légèreté, c''est la liberté.', null, null, 'tip', null, 98, 28, 15, true, now() - interval '45 days'),
    (p3, u3, 'Question pour les ultra-traileurs : comment gérez-vous la nutrition sur les courses de plus de 24h ? J''ai tendance à ne plus pouvoir avaler de sucré après 15h de course. Des solutions ?', null, null, 'question', null, 45, 67, 8, false, now() - interval '30 days'),
    (p4, u4, 'Magnifique semaine de ski de rando dans le massif du Mont-Blanc. La Vallée Blanche en conditions hivernales, c''est une autre dimension. Merci à mes compagnons de cordée pour cette aventure inoubliable ❄️', 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600', 'Groupe de skieurs de randonnée sur glacier avec le Mont Blanc en arrière-plan', 'post', c4, 84, 19, 12, false, now() - interval '23 days'),
    (p5, u5, 'Astuce kayak 🚣 Pour les sorties en mer, toujours vérifier les coefficients de marée ET la météo marine 48h à l''avance. Une mer belle peut devenir dangereuse en quelques heures. La sécurité avant l''aventure !', null, null, 'tip', null, 73, 22, 19, false, now() - interval '18 days'),
    (p6, u1, 'Traversée du Sahara terminée ! 14 jours, 380km à pied dans les dunes et les regs. Une expérience qui change une vie. Le silence du désert la nuit, les étoiles... impossible à décrire. Mon carnet complet arrive bientôt 🌟', 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600', 'Randonneur au sommet d''une dune au coucher du soleil dans le Sahara marocain', 'share', c6, 203, 56, 41, true, now() - interval '13 days'),
    (p7, u6, 'Via ferrata dans les Dolomites : 5 itinéraires en 7 jours. Les Dolomites sont vraiment le terrain de jeu ultime pour les amateurs de verticalité. Quelqu''un a des recommandations pour la via ferrata Lipella ?', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600', 'Vue depuis une via ferrata sur les pics rocheux des Dolomites italiens', 'question', c7, 61, 15, 9, false, now() - interval '9 days'),
    (p8, u3, 'UTMB 2025 : 38h12 de bonheur et de souffrance. 171km, 10 000m D+, 2 nuits sans dormir. Je publie mon récit complet demain avec tous les détails sur la préparation, la nutrition et la gestion de l''effort. Stay tuned ! 🏃‍♀️🔥', 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600', 'Coureuse de trail franchissant la ligne d''arrivée de l''UTMB à Chamonix', 'share', c8, 312, 78, 67, true, now() - interval '4 days'),
    (p9, u7, 'Première sortie surf de la saison à Hossegor ! Les vagues étaient parfaites ce matin, 1.5m bien formées. Si vous cherchez un spot pour débuter, la plage centrale est idéale en dehors des heures de pointe 🏄', 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=600', 'Surfeur sur une vague à Hossegor avec plage de sable en arrière-plan', 'post', null, 48, 11, 7, false, now() - interval '2 days'),
    (p10, u8, 'Conseil équipement : j''ai testé la tente MSR Hubba Hubba NX pendant 3 semaines en Écosse. Résultat : imperméable même sous des pluies torrentielles, montage en 3 minutes, 1.7kg. Un investissement qui vaut vraiment le coup pour les bivouacs.', null, null, 'tip', null, 56, 18, 14, false, now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;

  -- Likes posts
  INSERT INTO public.post_likes (post_id, user_id, created_at) VALUES
    (p1, u2, now() - interval '57 days'),
    (p1, u3, now() - interval '56 days'),
    (p1, u4, now() - interval '55 days'),
    (p3, u1, now() - interval '29 days'),
    (p3, u4, now() - interval '28 days'),
    (p6, u2, now() - interval '12 days'),
    (p6, u3, now() - interval '12 days'),
    (p6, u5, now() - interval '11 days'),
    (p8, u1, now() - interval '3 days'),
    (p8, u2, now() - interval '3 days'),
    (p8, u4, now() - interval '3 days'),
    (p8, u5, now() - interval '2 days')
  ON CONFLICT DO NOTHING;

  -- Commentaires posts
  INSERT INTO public.post_comments (post_id, author_id, content, likes_count, created_at) VALUES
    (p1, u2, 'Félicitations pour cette aventure ! Le Tour des Annapurnas est sur ma liste depuis longtemps. Tu as utilisé quel sac à dos ?', 8, now() - interval '57 days'),
    (p1, u3, 'Incroyable ! 8kg de kit pour 21 jours, c''est impressionnant. Tu peux partager ta liste de matériel ?', 12, now() - interval '56 days'),
    (p3, u1, 'Pour la nutrition après 15h : passer au salé ! Chips, fromage, charcuterie. Ton corps rejette le sucré mais accepte encore le salé. Ça m''a sauvé à l''UTMB.', 24, now() - interval '29 days'),
    (p3, u2, 'Les bouillons chauds sont aussi une excellente option. Réconfortants et faciles à digérer. Et les soupes de nouilles instantanées aux ravitaillements !', 18, now() - interval '28 days'),
    (p6, u2, 'Traversée du Sahara... tu es une légende ! J''attends le carnet complet avec impatience.', 15, now() - interval '12 days'),
    (p6, u4, 'Comment tu as géré l''eau ? C''est la partie qui me fait le plus peur dans ce type d''expédition.', 11, now() - interval '11 days'),
    (p8, u2, 'BRAVO ! 38h12 c''est une performance exceptionnelle. Tu as dormi pendant la course ?', 28, now() - interval '3 days'),
    (p8, u4, 'Récit attendu avec impatience ! Tes posts pendant la course étaient déjà captivants.', 19, now() - interval '3 days'),
    (p8, u5, 'Quelle inspiration ! Je prépare mon premier 50km et ton parcours me motive énormément.', 14, now() - interval '2 days')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 6. Q&R
  -- ============================================================
  INSERT INTO public.qa_questions (id, author_id, title, content, tags, category, votes_count, answers_count, views_count, is_solved, created_at) VALUES
    (q1, u4, 'Quelle tente pour le trek en haute altitude (>4000m) ?', 'Je prépare un trek au Népal avec des nuits à plus de 4000m. Ma tente actuelle (MSR Hubba Hubba) est-elle suffisante ou dois-je investir dans quelque chose de plus robuste ? Budget max 600€.', ARRAY['tente','haute-altitude','népal','équipement'], 'équipement', 34, 5, 892, true, now() - interval '40 days'),
    (q2, u7, 'Comment prévenir les ampoules en randonnée longue distance ?', 'Je pars sur le Chemin de Compostelle (800km) dans 2 mois. Lors de mes dernières randonnées, j''ai souffert d''ampoules dès le 3ème jour. Quelles sont vos meilleures techniques de prévention ?', ARRAY['ampoules','chaussures','prévention','compostelle'], 'santé', 28, 7, 1240, true, now() - interval '25 days'),
    (q3, u9, 'Meilleur GPS pour le trail et la randonnée en 2025 ?', 'Je cherche un GPS montre pour le trail et la randonnée. Hésitation entre Garmin Fenix 8, Suunto Vertical et Coros Vertix 3. Vos retours d''expérience ?', ARRAY['gps','montre','garmin','suunto','coros'], 'équipement', 41, 6, 1580, false, now() - interval '15 days'),
    (q4, u10, 'Comment gérer la nourriture sur un trek de 10 jours en autonomie ?', 'Je prépare un trek de 10 jours sans ravitaillement possible. Comment calculer les rations ? Quels aliments privilégier pour le rapport poids/calories ? Et comment conserver la nourriture ?', ARRAY['nutrition','autonomie','trek','lyophilisé'], 'nutrition', 22, 4, 756, false, now() - interval '8 days'),
    (q5, u11, 'Sac à dos 40L ou 60L pour un trek de 2 semaines ?', 'Je pars 2 semaines en Norvège (Jotunheimen). J''hésite entre un sac 40L (plus léger) et un 60L (plus de place). Je vise le ultralight mais c''est mon premier trek long. Conseils ?', ARRAY['sac-à-dos','ultralight','norvège','trek'], 'équipement', 18, 3, 534, false, now() - interval '3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.qa_answers (id, question_id, author_id, content, votes_count, is_accepted, created_at) VALUES
    (qa1, q1, u1, 'Pour les nuits à 4000m+, la MSR Hubba Hubba peut suffire en conditions normales mais elle n''est pas prévue pour les vents violents des cols himalayens. Je recommande la MSR Remote 2 ou la Hilleberg Akto pour plus de robustesse. Si budget limité, la Naturehike Cloud-Up 2 est un excellent compromis à 200€.', 28, true, now() - interval '38 days'),
    (qa2, q1, u2, 'J''ai utilisé la Hubba Hubba jusqu''à 5000m au Népal sans problème. L''essentiel est de bien choisir son emplacement (abri naturel du vent) et d''utiliser les sardines supplémentaires. Mais si tu peux investir, la Remote 2 est nettement supérieure.', 15, false, now() - interval '37 days'),
    (qa3, q2, u1, 'Mes 5 règles anti-ampoules : 1) Chaussures rodées 200km minimum avant le départ. 2) Chaussettes Darn Tough ou Smartwool en laine mérinos. 3) Talc dans les chaussures chaque matin. 4) Compeed dès les premiers signes de frottement. 5) Sécher les pieds complètement à chaque pause.', 45, true, now() - interval '23 days'),
    (qa4, q2, u3, 'Ajoute à ça les guêtres légères pour éviter les gravillons. Et si tu as les pieds larges, essaie les chaussures Altra ou Hoka qui ont un toe box plus large. Ça change tout !', 22, false, now() - interval '22 days'),
    (qa5, q3, u2, 'J''ai le Garmin Fenix 8 depuis 6 mois. Autonomie exceptionnelle (28 jours en mode montre), cartographie topo intégrée, altimètre barométrique très précis. Le prix est élevé mais c''est l''investissement d''une vie. Le Coros Vertix 3 est une excellente alternative moins chère.', 31, false, now() - interval '13 days'),
    (qa6, q4, u1, 'Pour 10 jours en autonomie : compte 600-700g de nourriture sèche par jour (2500-3000 kcal). Privilégie lyophilisés (légers, bons), barres énergétiques, fruits secs, noix, fromage à pâte dure. Évite les conserves (trop lourdes). Mes marques préférées : Expedition Foods, Real Turmat, Trek''n Eat.', 19, false, now() - interval '6 days')
  ON CONFLICT (id) DO NOTHING;

  -- Votes Q&R
  INSERT INTO public.qa_votes (user_id, target_type, target_id, vote, created_at) VALUES
    (u2, 'answer', qa1, 1, now() - interval '37 days'),
    (u3, 'answer', qa1, 1, now() - interval '36 days'),
    (u4, 'answer', qa3, 1, now() - interval '22 days'),
    (u5, 'answer', qa3, 1, now() - interval '21 days'),
    (u1, 'question', q3, 1, now() - interval '14 days'),
    (u2, 'question', q3, 1, now() - interval '13 days')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 7. SESSIONS AMA
  -- ============================================================
  INSERT INTO public.ama_sessions (id, expert_id, title, description, scheduled_at, duration_minutes, status, participants_count, questions_count, created_at) VALUES
    (ama1, u1, 'AMA : Trekking en haute altitude - Tout ce que vous voulez savoir', 'Marie Dupont, guide de haute montagne et exploratrice, répond à toutes vos questions sur le trekking en altitude, la préparation physique, le matériel et la sécurité.', now() - interval '20 days', 90, 'ended', 234, 45, now() - interval '25 days'),
    (ama2, u3, 'AMA : Courir un ultra-trail - De 0 à l''UTMB', 'Sophie Bernard, finisher UTMB 2025, partage son expérience et répond à vos questions sur la préparation, la nutrition et la gestion mentale des ultra-trails.', now() + interval '10 days', 120, 'upcoming', 189, 28, now() - interval '3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ama_questions (id, session_id, author_id, content, votes_count, is_answered, answer, answered_at, created_at) VALUES
    (amaq1, ama1, u4, 'Comment préparer son acclimatation avant un trek à plus de 5000m ? Combien de jours faut-il prévoir ?', 34, true, 'L''acclimatation est cruciale. Règle d''or : ne montez pas de plus de 300-500m par jour au-dessus de 3000m. Prévoyez au minimum 2 jours à Katmandou (1400m), puis montée progressive. Symptômes du mal des montagnes : maux de tête, nausées, fatigue. Si ça empire, descendez immédiatement. Le Diamox peut aider mais consultez un médecin avant.', now() - interval '20 days', now() - interval '21 days'),
    (amaq2, ama1, u7, 'Quel est le budget réaliste pour un trek de 3 semaines au Népal tout compris ?', 28, true, 'Budget réaliste pour 3 semaines au Népal : Vol A/R 600-900€, visa 30€, permis TIMS + ACAP 50€, hébergement en teahouse 5-15€/nuit, repas 3-8€, guide 25-35€/jour (recommandé), porteur optionnel 15-20€/jour. Total : 1500-2500€ selon votre confort. Évitez les agences qui proposent moins de 1000€, c''est souvent du dumping social.', now() - interval '20 days', now() - interval '21 days'),
    (amaq3, ama2, u2, 'Comment gérer le sommeil pendant un ultra de plus de 24h ? Vaut-il mieux faire de courtes siestes ou tenir jusqu''à l''arrivée ?', 41, false, '', null, now() - interval '2 days'),
    (amaq4, ama2, u8, 'Quel plan d''entraînement pour passer du marathon à un 100km en 18 mois ?', 35, false, '', null, now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 8. OCCASION / ENCHÈRES / LOCATION
  -- ============================================================
  INSERT INTO public.occasion_items (id, seller_id, title, price, original_price, condition, location, image, alt, negotiable, shipping, status, created_at) VALUES
    (oc1, u1, 'Tente MSR Remote 2 - Excellent état', 320, 550, 'excellent', 'Lyon, 69', 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', 'Tente MSR Remote 2 orange montée dans un paysage alpin', true, true, 'active', now() - interval '15 days'),
    (oc2, u2, 'Sac à dos Osprey Atmos 65L - Très bon état', 145, 280, 'bon', 'Paris, 75', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', 'Sac à dos de randonnée Osprey bleu posé sur un rocher en montagne', true, true, 'active', now() - interval '10 days'),
    (oc3, u4, 'Chaussures Salomon X Ultra 4 GTX - Taille 43', 85, 160, 'bon', 'Grenoble, 38', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', 'Chaussures de randonnée Salomon grises et vertes sur fond blanc', false, false, 'active', now() - interval '7 days'),
    (oc4, u5, 'Kayak de mer Prijon Seayak - Complet avec pagaie', 890, 1800, 'bon', 'Brest, 29', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400', 'Kayak de mer jaune sur une plage bretonne avec équipement complet', true, false, 'active', now() - interval '5 days'),
    (oc5, u3, 'Réchaud MSR Windburner + casserole 1L', 65, 120, 'excellent', 'Bordeaux, 33', 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', 'Réchaud de camping MSR avec casserole sur une table de pique-nique', false, true, 'active', now() - interval '3 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.auction_items (id, seller_id, title, start_price, current_bid, buy_now_price, condition, ends_at, bids_count, watchers_count, image, alt, status, created_at) VALUES
    (au1, u6, 'Veste Gore-Tex Arc''teryx Beta AR - Taille M', 180, 245, 420, 'bon', now() + interval '3 days', 8, 23, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400', 'Veste imperméable Arc''teryx rouge portée par un randonneur en montagne', 'active', now() - interval '4 days'),
    (au2, u7, 'Sac de couchage Cumulus Panyam 450 - Duvet', 120, 165, 280, 'excellent', now() + interval '5 days', 5, 17, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', 'Sac de couchage en duvet bleu déplié sur un matelas de camping', 'active', now() - interval '2 days'),
    (au3, u8, 'Montre Garmin Fenix 7 Sapphire Solar', 350, 412, 650, 'bon', now() + interval '7 days', 11, 34, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', 'Montre GPS Garmin Fenix 7 noire avec bracelet sport sur fond blanc', 'active', now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rental_items (id, owner_id, title, price_per_day, price_per_week, deposit, condition, location, distance_km, available, rating, reviews_count, image, alt, created_at) VALUES
    (re1, u1, 'Kit complet trekking haute montagne (tente + sac + réchaud)', 25, 140, 200, 'excellent', 'Lyon, 69', 2.5, true, 4.9, 23, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', 'Kit de camping complet avec tente, sac à dos et réchaud sur fond de montagne', now() - interval '60 days'),
    (re2, u2, 'Vélo de bikepacking Salsa Cutthroat - Taille M', 35, 200, 300, 'bon', 'Paris, 75', 5.0, true, 4.7, 15, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', 'Vélo de bikepacking gris avec sacoches chargées sur une route de campagne', now() - interval '45 days'),
    (re3, u5, 'Kayak de mer double + pagaies + gilets', 45, 250, 400, 'bon', 'Brest, 29', 1.2, true, 4.8, 18, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400', 'Kayak de mer double rouge avec deux pagaies et gilets de sauvetage sur une plage', now() - interval '30 days'),
    (re4, u4, 'Skis de randonnée Dynafit + chaussures + peaux', 40, 220, 350, 'excellent', 'Grenoble, 38', 3.8, true, 4.6, 12, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400', 'Skis de randonnée Dynafit avec chaussures et peaux de phoque sur la neige', now() - interval '20 days')
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- 9. AVIS / REVIEWS
  -- ============================================================
  INSERT INTO public.reviews (user_id, type, target_name, target_id, rating, title, comment, verified, helpful_count, created_at) VALUES
    (u2, 'produit', 'Tente MSR Hubba Hubba NX 2', '', 5, 'La référence du bivouac ultraléger', 'Après 3 saisons et plus de 80 nuits en bivouac, cette tente reste ma préférée. Légère (1.7kg), rapide à monter, imperméable même sous des pluies diluviennes. Le seul bémol : la condensation par temps froid. Mais pour le rapport poids/performance, rien ne la bat.', true, 34, now() - interval '90 days'),
    (u3, 'produit', 'Sac à dos Osprey Exos 58', '', 5, 'Confort exceptionnel pour les longues distances', 'J''ai porté ce sac pendant 800km sur le Chemin de Compostelle. Aucune douleur aux épaules ni au dos. Le système de suspension est vraiment innovant. Léger, bien organisé, durable. Un investissement qui vaut chaque centime.', true, 28, now() - interval '70 days'),
    (u1, 'produit', 'Chaussures Salomon X Ultra 4 GTX', '', 4, 'Excellentes mais attention à la pointure', 'Très bonnes chaussures pour terrain mixte. Accroche parfaite sur rocher, imperméabilité au top. Attention : prendre une demi-pointure au-dessus de votre taille habituelle, elles taillent petit. Après 600km, elles sont encore en bon état.', true, 19, now() - interval '50 days'),
    (u4, 'expert', 'Marie Dupont', '', 5, 'Consultation qui a changé ma préparation', 'J''ai consulté Marie avant mon trek au Népal. Ses conseils sur l''acclimatation et le choix du matériel ont été précieux. Elle connaît parfaitement les conditions locales et adapte ses recommandations à votre niveau. Je recommande vivement.', true, 22, now() - interval '30 days'),
    (u5, 'produit', 'Réchaud MSR Windburner', '', 5, 'Parfait pour les conditions venteuses', 'Testé par vent fort en Bretagne et en altitude dans les Alpes. Aucun problème d''extinction, ébullition ultra-rapide. Le système intégré casserole/réchaud est très pratique. Consommation de gaz raisonnable. Un must-have pour les bivouacs.', true, 15, now() - interval '20 days')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 10. BADGES UTILISATEURS
  -- ============================================================
  SELECT id INTO b1 FROM public.badges WHERE name = 'Premier Trek' LIMIT 1;
  SELECT id INTO b2 FROM public.badges WHERE name = 'Explorateur Confirmé' LIMIT 1;
  SELECT id INTO b3 FROM public.badges WHERE name = 'Ultra-Traileur' LIMIT 1;

  IF b1 IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id, earned_at) VALUES
      (u1, b1, now() - interval '170 days'),
      (u2, b1, now() - interval '140 days'),
      (u3, b1, now() - interval '115 days'),
      (u4, b1, now() - interval '85 days'),
      (u5, b1, now() - interval '70 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF b2 IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id, earned_at) VALUES
      (u1, b2, now() - interval '100 days'),
      (u2, b2, now() - interval '80 days'),
      (u3, b2, now() - interval '60 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF b3 IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id, earned_at) VALUES
      (u3, b3, now() - interval '4 days')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ============================================================
  -- 11. DÉFIS UTILISATEURS (challenges globaux)
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

  INSERT INTO public.user_challenges (user_id, challenge_id, progress, completed)
  SELECT u4, id, FLOOR(total * 0.4)::int, false
  FROM public.challenges WHERE active = true LIMIT 1
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 12. KITS RECOMMANDÉS PAR LES CLUBS
  -- ============================================================
  SELECT id INTO kit1 FROM public.kits LIMIT 1;
  SELECT id INTO kit2 FROM public.kits OFFSET 1 LIMIT 1;

  IF kit1 IS NOT NULL THEN
    INSERT INTO public.club_recommended_kits (club_id, kit_id, recommended_by, note, created_at) VALUES
      (cl1, kit1, u1, 'Kit validé par notre communauté pour les treks alpins de 5 jours et plus. Rapport poids/performance excellent.', now() - interval '30 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF kit2 IS NOT NULL THEN
    INSERT INTO public.club_recommended_kits (club_id, kit_id, recommended_by, note, created_at) VALUES
      (cl4, kit2, u3, 'Kit recommandé pour les coureurs préparant leur premier ultra. Léger et complet.', now() - interval '15 days')
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Seed data inserted successfully!';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data error: %', SQLERRM;
END $$;
