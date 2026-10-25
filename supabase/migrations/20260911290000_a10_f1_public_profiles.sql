-- ============================================================================
-- A10 — Fermeture F1 : projection publique minimale des profils utilisateurs.
-- ----------------------------------------------------------------------------
-- Constat (audit 31bdb279, F1) : la policy legacy « public_read_user_profiles »
-- (20260713210000) ouvrait la table public.user_profiles EN ENTIER à anon et
-- authenticated (email, téléphone, rôle, signature_visibility, préférences…).
--
-- Correctif : la lecture publique passe désormais par cette vue qui ne projette
-- QUE les colonnes strictement publiques (id, full_name, avatar_url,
-- trust_score). La policy legacy est supprimée ; les lectures privilégiées
-- (administrateur, soi-même) restent sur la table via les policies dédiées.
--
-- Vue volontairement SECURITY DEFINER (comportement par défaut d'une vue
-- PostgreSQL) : la table user_profiles a RLS activé mais PAS FORCE, donc le
-- propriétaire de la vue (postgres) contourne la RLS ; les appelants anon /
-- authenticated lisent la projection via les GRANT ci-dessous, sans jamais
-- accéder aux colonnes sensibles. Même patron que terrain_reports_public.
-- ============================================================================

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  full_name,
  avatar_url,
  bio,
  location,
  website,
  trust_score,
  loyalty_points,
  loyalty_level,
  xp,
  level,
  created_at
FROM public.user_profiles;

COMMENT ON VIEW public.public_profiles IS
  'Vue SECURITY DEFINER volontaire : projection publique des profils (identité affichable, bio/localisation/site déclarés, gamification) — sans email, téléphone, rôle, signature_visibility ni préférences. La RLS de user_profiles (sans FORCE) est contournée par le propriétaire de la vue ; l''accès public est borné par les GRANT à anon/authenticated.';

GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT SELECT ON public.public_profiles TO service_role;

-- Fermeture F1 : suppression des policies de lecture publique totale.
-- Vérification lecture seule de la production (icxyvwzfjbflcbqukpfz, 2026-09-11) :
-- trois policies SELECT larges y sont actives —
--   • public_read_user_profiles  (dépôt, public USING true)
--   • anon_read_profiles_basic   (dépôt, anon USING true, jamais supprimée)
--   • "Public read user_profiles" (DÉRIVE prod hors dépôt, public USING true)
-- Les trois sont supprimées ci-dessous (IF EXISTS = no-op en replay base vide).
-- Les policies bornées restent : users_read_own_profile, users_manage_own_profiles,
-- users_update_own_profile, profile_read_own_visibility,
-- profile_update_own_visibility, profile_select_public_subset (anon/false), et
-- « Users insert own profile » (public INSERT avec WITH CHECK auth.uid() = id).
DROP POLICY IF EXISTS "public_read_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "anon_read_profiles_basic" ON public.user_profiles;
DROP POLICY IF EXISTS "Public read user_profiles" ON public.user_profiles;

-- Lecture administrateur (écrans /admin : comptage, profils + emails) : la
-- policy legacy couvrait implicitement ce besoin ; il devient explicite et
-- borné par is_admin().
DROP POLICY IF EXISTS "user_profiles_select_admin" ON public.user_profiles;
CREATE POLICY "user_profiles_select_admin"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());
