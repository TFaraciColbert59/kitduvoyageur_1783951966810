-- G01 / S6.12 — Préférences de visibilité du profil sportif par utilisateur.
-- Fail-closed : NULL signifie privé par défaut (`defaultSportProfilePreferences`).

ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS sport_profile_prefs jsonb DEFAULT NULL;

ALTER TABLE IF EXISTS public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_sport_profile_prefs_object;

ALTER TABLE IF EXISTS public.user_profiles
  ADD CONSTRAINT user_profiles_sport_profile_prefs_object
  CHECK (
    sport_profile_prefs IS NULL
    OR jsonb_typeof(sport_profile_prefs) = 'object'
  );

COMMENT ON COLUMN public.user_profiles.sport_profile_prefs IS
  'G01/S6.12 — Choix explicite d''audience et de sports affichés sur le profil sportif. NULL = privé.';

-- Expose `sport_profile_prefs` et `profile_visibility` en fin de vue `public_profiles`
-- sans modifier les colonnes existantes ni assouplir les filtres de visibilité.
CREATE OR REPLACE VIEW public.public_profiles WITH (security_invoker = false) AS
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
  created_at,
  handle,
  cover_url,
  links,
  sport_profile_prefs,
  profile_visibility
FROM public.user_profiles
WHERE (is_demo = false OR (is_demo = true AND (email LIKE '%@voyageurs.lkdv.app' OR email LIKE '%@kitduvoyageur.fr')))
  AND (
    profile_visibility = 'public'
    OR id = auth.uid()
    OR (
      profile_visibility = 'prive'
      AND EXISTS (
        SELECT 1 FROM public.profile_invitations i
        WHERE i.owner_id = user_profiles.id
          AND i.status = 'accepted'
          AND i.invitee_id = auth.uid()
          AND (i.expires_at IS NULL OR i.expires_at > now())
      )
    )
  );
