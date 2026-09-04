-- ============================================================================
-- Chantier « Orientation & Empreinte » (ADR-010)
-- Lot B — user_orientation : ORIENTATION PRIVÉE, paramètre du configurateur.
-- ----------------------------------------------------------------------------
--  Facultatif de bout en bout (tous les champs NULLABLE).
--  RLS STRICTE : lecture ET écriture uniquement par le propriétaire.
--  AUCUNE policy de lecture publique, jamais. L'orientation n'est JAMAIS rendue
--  dans un composant public.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_orientation (
  user_id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  terrain   text CHECK (terrain IN ('sentier','montagne','hors_sentier','itinerance','urbain_transit')),
  autonomy  text CHECK (autonomy IN ('journee','bivouac_1_2','itinerance_longue')),
  priority  text CHECK (priority IN ('legerete','confort','budget','securite')),
  experience text CHECK (experience IN ('debut','regulier','aguerri')),
  source    text NOT NULL DEFAULT 'declared' CHECK (source IN ('declared','inferred')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_orientation ENABLE ROW LEVEL SECURITY;

-- Lecture : soi-même uniquement.
DROP POLICY IF EXISTS "orientation_select_own" ON public.user_orientation;
CREATE POLICY "orientation_select_own"
  ON public.user_orientation
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Écriture (insert/update) : soi-même uniquement.
DROP POLICY IF EXISTS "orientation_insert_own" ON public.user_orientation;
CREATE POLICY "orientation_insert_own"
  ON public.user_orientation
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "orientation_update_own" ON public.user_orientation;
CREATE POLICY "orientation_update_own"
  ON public.user_orientation
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Aucune policy SELECT publique. L'orientation ne traverse jamais un partage,
-- un kit public, une fiche de membre, ni aucun agrégat. (Anti-dérive, ADR-010.)
-- Aucun DELETE nécessaire : la ligne suit auth.users (ON DELETE CASCADE) et un
-- utilisateur ne peut supprimer que sa propre ligne de toute façon. On le laisse
-- possible (self) pour le « réinitialiser ma pratique » :
DROP POLICY IF EXISTS "orientation_delete_own" ON public.user_orientation;
CREATE POLICY "orientation_delete_own"
  ON public.user_orientation
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS user_orientation_user_id_idx
  ON public.user_orientation (user_id);

-- Exposition Data API : la carte d'orientation est lue/écrite côté client par
-- l'utilisateur authentifié (RLS ci-dessus = garde-fou de lignes, GRANT = accès
-- à la table). Aucun accès anon : l'orientation reste 100 % privée.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_orientation TO authenticated;
REVOKE ALL ON public.user_orientation FROM anon;