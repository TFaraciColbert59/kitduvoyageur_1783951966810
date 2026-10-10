-- ============================================================================
-- Compas, lot P (PLAN-100 4.1) — user_traveller : PROFIL VOYAGEUR PRIVÉ.
-- ----------------------------------------------------------------------------
--  Nationalité, pays de résidence, devise, langue, fuseau, domicile (ville).
--  Facultatif de bout en bout : chaque champ peut rester NULL (= inconnu ; le
--  Compas n'affirme alors rien qui en dépende). Une ligne toute vide veut dire
--  « Passer » : la question n'est plus reposée.
--  RLS STRICTE, patron de user_orientation (ADR-010) : lecture ET écriture par
--  la personne seule ; AUCUNE policy publique ; aucun droit pour anon. Un essai
--  sans compte (session anonyme, rôle authenticated) n'écrit rien :
--  public.is_anonymous_session() (migration 20261008165901).
--  Domicile rangé à 0,01° près (~1 km) : numeric(4,2) / numeric(5,2), la base
--  arrondit elle-même ce qu'on lui donne, même écrit sans passer par l'application.
--  Additive et rejouable : IF NOT EXISTS, DROP POLICY IF EXISTS ; aucune donnée
--  existante n'est touchée. Application en production : par le contrôleur, après
--  revue (MCP apply_migration), sonde : scripts/verify/user_traveller_rls_probe.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_traveller (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nationality       text CHECK (nationality ~ '^[A-Z]{2}$'),
  residence_country text CHECK (residence_country ~ '^[A-Z]{2}$'),
  currency          text CHECK (currency ~ '^[A-Z]{3}$'),
  language          text CHECK (char_length(language) <= 35 AND language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  time_zone         text CHECK (char_length(time_zone) <= 64 AND time_zone ~ '^[A-Za-z][A-Za-z0-9_+/-]*$'),
  home_name         text CHECK (char_length(btrim(home_name)) BETWEEN 1 AND 80),
  home_lat          numeric(4,2) CHECK (home_lat BETWEEN -90 AND 90),
  home_lon          numeric(5,2) CHECK (home_lon BETWEEN -180 AND 180),
  home_country      text CHECK (home_country ~ '^[A-Z]{2}$'),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_traveller_home_complete CHECK (
    (home_name IS NULL AND home_lat IS NULL AND home_lon IS NULL AND home_country IS NULL)
    OR (home_name IS NOT NULL AND home_lat IS NOT NULL AND home_lon IS NOT NULL)
  )
);

COMMENT ON TABLE public.user_traveller IS
  'Profil voyageur privé (PLAN-100 4.1) : lu et écrit par la personne seule (RLS), jamais public.';

ALTER TABLE public.user_traveller ENABLE ROW LEVEL SECURITY;

-- Lecture : soi-même uniquement.
DROP POLICY IF EXISTS "traveller_select_own" ON public.user_traveller;
CREATE POLICY "traveller_select_own"
  ON public.user_traveller
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Écriture (insert/update) : soi-même uniquement.
DROP POLICY IF EXISTS "traveller_insert_own" ON public.user_traveller;
CREATE POLICY "traveller_insert_own"
  ON public.user_traveller
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "traveller_update_own" ON public.user_traveller;
CREATE POLICY "traveller_update_own"
  ON public.user_traveller
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Effacer son profil : soi-même uniquement (la ligne suit aussi auth.users en cascade).
DROP POLICY IF EXISTS "traveller_delete_own" ON public.user_traveller;
CREATE POLICY "traveller_delete_own"
  ON public.user_traveller
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Essai sans compte : jamais de profil voyageur (tout reste inconnu).
DROP POLICY IF EXISTS "traveller_essai_sans_ecriture" ON public.user_traveller;
CREATE POLICY "traveller_essai_sans_ecriture"
  ON public.user_traveller
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (NOT public.is_anonymous_session());

-- Data API : la personne connectée seule (RLS ci-dessus = garde de lignes,
-- GRANT = accès à la table). Aucun accès anon : sans ce REVOKE, une table
-- nouvelle de public hérite des droits par défaut de Supabase.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_traveller TO authenticated;
REVOKE ALL ON public.user_traveller FROM anon;
