-- ============================================================
-- FIX PROFILES: Public read policy + seed data
-- ============================================================

-- 1. Add public read policy so unauthenticated users can see profiles
DROP POLICY IF EXISTS "users_read_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "public_read_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_manage_own_profiles" ON public.user_profiles;

CREATE POLICY "public_read_profiles" ON public.user_profiles
FOR SELECT TO public USING (true);

CREATE POLICY "users_manage_own_profiles" ON public.user_profiles
FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 2. Seed auth.users + user_profiles with 12 adventurer profiles
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
BEGIN

  -- Insert into auth.users first (FK parent)
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
     'marie.dupont@email.fr', crypt('Voyage2024!', gen_salt('bf', 10)), now() - interval '180 days', now() - interval '180 days', now(),
     jsonb_build_object('full_name', 'Marie Dupont'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u2,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'thomas.martin@email.fr', crypt('Rando2024!', gen_salt('bf', 10)), now() - interval '150 days', now() - interval '150 days', now(),
     jsonb_build_object('full_name', 'Thomas Martin'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u3,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sophie.bernard@email.fr', crypt('Trek2024!', gen_salt('bf', 10)), now() - interval '120 days', now() - interval '120 days', now(),
     jsonb_build_object('full_name', 'Sophie Bernard'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u4,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'lucas.petit@email.fr', crypt('Alpin2024!', gen_salt('bf', 10)), now() - interval '90 days', now() - interval '90 days', now(),
     jsonb_build_object('full_name', 'Lucas Petit'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u5,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'camille.leroy@email.fr', crypt('Kayak2024!', gen_salt('bf', 10)), now() - interval '75 days', now() - interval '75 days', now(),
     jsonb_build_object('full_name', 'Camille Leroy'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u6,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'antoine.moreau@email.fr', crypt('Velo2024!', gen_salt('bf', 10)), now() - interval '60 days', now() - interval '60 days', now(),
     jsonb_build_object('full_name', 'Antoine Moreau'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u7,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'julie.simon@email.fr', crypt('Surf2024!', gen_salt('bf', 10)), now() - interval '45 days', now() - interval '45 days', now(),
     jsonb_build_object('full_name', 'Julie Simon'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u8,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'maxime.garcia@email.fr', crypt('Ski2024!', gen_salt('bf', 10)), now() - interval '30 days', now() - interval '30 days', now(),
     jsonb_build_object('full_name', 'Maxime Garcia'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u9,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'lea.roux@email.fr', crypt('Moto2024!', gen_salt('bf', 10)), now() - interval '20 days', now() - interval '20 days', now(),
     jsonb_build_object('full_name', 'Lea Roux'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u10, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'nicolas.blanc@email.fr', crypt('Grimpe2024!', gen_salt('bf', 10)), now() - interval '15 days', now() - interval '15 days', now(),
     jsonb_build_object('full_name', 'Nicolas Blanc'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u11, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'emma.fontaine@email.fr', crypt('Plongee2024!', gen_salt('bf', 10)), now() - interval '10 days', now() - interval '10 days', now(),
     jsonb_build_object('full_name', 'Emma Fontaine'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (u12, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'pierre.lambert@email.fr', crypt('Parapente2024!', gen_salt('bf', 10)), now() - interval '5 days', now() - interval '5 days', now(),
     jsonb_build_object('full_name', 'Pierre Lambert'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
  ON CONFLICT (id) DO NOTHING;

  -- Insert into user_profiles (child table)
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, trust_score, loyalty_points, loyalty_level, created_at)
  VALUES
    (u1,  'marie.dupont@email.fr',    'Marie Dupont',    'https://i.pravatar.cc/150?img=1',  920, 4600, 'Ambassadeur', now() - interval '180 days'),
    (u2,  'thomas.martin@email.fr',   'Thomas Martin',   'https://i.pravatar.cc/150?img=2',  780, 3900, 'Expert',      now() - interval '150 days'),
    (u3,  'sophie.bernard@email.fr',  'Sophie Bernard',  'https://i.pravatar.cc/150?img=3',  650, 3250, 'Expert',      now() - interval '120 days'),
    (u4,  'lucas.petit@email.fr',     'Lucas Petit',     'https://i.pravatar.cc/150?img=4',  540, 2700, 'Aventurier',  now() - interval '90 days'),
    (u5,  'camille.leroy@email.fr',   'Camille Leroy',   'https://i.pravatar.cc/150?img=5',  480, 2400, 'Aventurier',  now() - interval '75 days'),
    (u6,  'antoine.moreau@email.fr',  'Antoine Moreau',  'https://i.pravatar.cc/150?img=6',  410, 2050, 'Aventurier',  now() - interval '60 days'),
    (u7,  'julie.simon@email.fr',     'Julie Simon',     'https://i.pravatar.cc/150?img=7',  320, 1600, 'Aventurier',  now() - interval '45 days'),
    (u8,  'maxime.garcia@email.fr',   'Maxime Garcia',   'https://i.pravatar.cc/150?img=8',  240, 1200, 'Explorateur', now() - interval '30 days'),
    (u9,  'lea.roux@email.fr',        'Lea Roux',        'https://i.pravatar.cc/150?img=9',  180, 900,  'Explorateur', now() - interval '20 days'),
    (u10, 'nicolas.blanc@email.fr',   'Nicolas Blanc',   'https://i.pravatar.cc/150?img=10', 130, 650,  'Explorateur', now() - interval '15 days'),
    (u11, 'emma.fontaine@email.fr',   'Emma Fontaine',   'https://i.pravatar.cc/150?img=11', 90,  450,  'Explorateur', now() - interval '10 days'),
    (u12, 'pierre.lambert@email.fr',  'Pierre Lambert',  'https://i.pravatar.cc/150?img=12', 50,  250,  'Explorateur', now() - interval '5 days')
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data error: %', SQLERRM;
END $$;
