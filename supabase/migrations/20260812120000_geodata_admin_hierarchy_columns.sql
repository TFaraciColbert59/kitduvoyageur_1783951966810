-- ============================================================
-- GEODATA — Colonnes de hiérarchie admin (Phase 4 : pipeline d'import)
-- Ajoute les codes admin (1-4) sur places_geo et le lien admin1
-- sur admin_regions_geo (niveau 2), nécessaires à la hiérarchie
-- Pays → région → subdivision → ville.
-- ============================================================

-- Liens entre niveaux admin (ex: XX.01 → parent du XX.01.02)
ALTER TABLE public.admin_regions_geo
  ADD COLUMN IF NOT EXISTS admin1_code_full text;

CREATE INDEX IF NOT EXISTS idx_admin_regions_geo_admin1_code_full
  ON public.admin_regions_geo (admin1_code_full);

-- Codes admin des lieux (colonnes 11-14 d'allCountries.txt)
ALTER TABLE public.places_geo
  ADD COLUMN IF NOT EXISTS admin1_code text,
  ADD COLUMN IF NOT EXISTS admin2_code text,
  ADD COLUMN IF NOT EXISTS admin3_code text,
  ADD COLUMN IF NOT EXISTS admin4_code text;

CREATE INDEX IF NOT EXISTS idx_places_geo_admin1_code
  ON public.places_geo (country_iso_a2, admin1_code);
CREATE INDEX IF NOT EXISTS idx_places_geo_admin2_code
  ON public.places_geo (country_iso_a2, admin2_code);

-- Droits PostgREST (colonnes nouvelles héritent des droits de table)
GRANT SELECT ON public.admin_regions_geo TO anon, authenticated;
GRANT SELECT ON public.places_geo TO anon, authenticated;