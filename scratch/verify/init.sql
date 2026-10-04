-- Harnais scratch : stubs à sémantique prod pour valider les migrations admin.
-- Ne JAMAIS appliquer sur un projet réel.
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY,
  role text NOT NULL DEFAULT 'user'
);
GRANT SELECT ON public.user_profiles TO authenticated;

-- is_admin() : sémantique prod (20260911551000) — après user_profiles.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM
    ('create','update','delete','login','export','config','moderation','reward','grant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id uuid NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action public.audit_action NOT NULL,
  cible_type text NOT NULL,
  cible_id text NOT NULL,
  avant jsonb,
  apres jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text NOT NULL DEFAULT 'admin',
  action text NOT NULL,
  target_table text NOT NULL DEFAULT 'shop_products',
  target_id text NOT NULL,
  target_name text DEFAULT '',
  old_data jsonb DEFAULT NULL,
  new_data jsonb DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

-- Données : A = admin legacy (les deux sources), B = modérateur (via trigger),
-- C = utilisateur simple sans aucun rôle.
INSERT INTO auth.users (id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333');
INSERT INTO public.user_profiles (id, role) VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin'),
  ('22222222-2222-4222-8222-222222222222', 'user'),
  ('33333333-3333-4333-8333-333333333333', 'user');
INSERT INTO public.admin_roles (user_id, role) VALUES
  ('11111111-1111-4111-8111-111111111111', 'super_admin');
INSERT INTO public.admin_audit_log (admin_id, action, cible_type, cible_id, avant, apres) VALUES
  ('11111111-1111-4111-8111-111111111111', 'moderation', 'community_posts', 'post-1', '{"a":1}'::jsonb, '{"a":2}'::jsonb);
INSERT INTO public.admin_audit_logs (admin_email, action, target_table, target_id, target_name) VALUES
  ('admin@x.fr', 'products.update', 'shop_products', 'prod-9', 'Sac Test');
