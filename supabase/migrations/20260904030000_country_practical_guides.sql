-- ═══════════════════════════════════════════════════════════════════════════
-- Guides pratiques pays générés par IA (Chantier Guides Pays)
-- Idempotent : CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
-- ═══════════════════════════════════════════════════════════════════════════

-- Permettre aux jobs système/cron de journaliser sans utilisateur authentifié
ALTER TABLE public.ai_jobs ALTER COLUMN user_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.country_practical_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL REFERENCES public.countries_geo(iso_a2) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN ('formalites','transport','budget','sante','securite','meilleure_saison')),
  content_md text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_used text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  stale_after timestamptz NOT NULL,
  degraded boolean NOT NULL DEFAULT false,
  UNIQUE(country_code, section)
);

CREATE INDEX IF NOT EXISTS idx_country_practical_guides_country_code
  ON public.country_practical_guides(country_code);

CREATE INDEX IF NOT EXISTS idx_country_practical_guides_stale
  ON public.country_practical_guides(stale_after);

ALTER TABLE public.country_practical_guides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "country_practical_guides_public_read" ON public.country_practical_guides;
CREATE POLICY "country_practical_guides_public_read" ON public.country_practical_guides
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "country_practical_guides_service_write" ON public.country_practical_guides;
CREATE POLICY "country_practical_guides_service_write" ON public.country_practical_guides
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.country_practical_guides TO anon, authenticated;
GRANT ALL ON public.country_practical_guides TO service_role;
