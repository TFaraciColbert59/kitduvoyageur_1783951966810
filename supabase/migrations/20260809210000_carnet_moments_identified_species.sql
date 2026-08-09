-- Prompt #9 — Reconnaissance d'espèces dans le carnet
-- Ajoute la colonne identified_species à carnet_moments

ALTER TABLE public.carnet_moments
  ADD COLUMN IF NOT EXISTS identified_species jsonb;

-- Index pour recherche dans les espèces identifiées
CREATE INDEX IF NOT EXISTS idx_carnet_moments_identified_species
  ON public.carnet_moments USING gin(identified_species);

-- Commentaire
COMMENT ON COLUMN public.carnet_moments.identified_species IS
  'Array of {name, common_name, confidence, description} from AI species identification';
