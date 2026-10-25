-- ============================================================================
-- Baseline — Intégration auth (objets NON capturés par un dump `-s public`).
-- Le trigger `on_auth_user_created` vit sur `auth.users` : il est créé par les
-- migrations pré-cutoff (20260713210000) mais absent d'un dump du schéma public.
-- Ce fichier restaure ce contrat d'intégration après application de la baseline.
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    trust_score,
    loyalty_points,
    loyalty_level,
    bio,
    location,
    xp,
    level
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    50,
    0,
    'Explorateur',
    '',
    '',
    0,
    1
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN public.user_profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.user_profiles.full_name END,
    updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
