-- ==============================================================================
-- CHANTIER 2 — ÉTAPES DESTINATIONS CURÉES POUR LE WIZARD (SEED 5 PAYS)
-- Migration: 20260905090000_destination_steps.sql
-- ==============================================================================

-- Garantir la présence de la France dans countries_geo pour la FK
INSERT INTO public.countries_geo (
  iso_a2, iso_a3, name, name_en, continent, subregion, capital, currency, currency_code, currency_name, area_km2, languages, neighbours, is_sovereign, timezone
) VALUES (
  'FR', 'FRA', 'France', 'France', 'Europe', 'Europe de l’Ouest', 'Paris', 'Euro (EUR)', 'EUR', 'Euro', 643801, ARRAY['Français'], ARRAY['ES','AD','MC','IT','CH','DE','LU','BE'], true, 'UTC+1'
) ON CONFLICT (iso_a2) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.destination_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  natural_key TEXT UNIQUE NOT NULL,
  country_code TEXT NOT NULL REFERENCES public.countries_geo(iso_a2) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location_name TEXT NOT NULL,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  description TEXT,
  distance_km NUMERIC(6,2),
  elevation_gain_m INT,
  elevation_loss_m INT,
  difficulty TEXT NOT NULL DEFAULT 'moderate' CHECK (difficulty IN ('easy', 'moderate', 'hard', 'expert')),
  activity_type TEXT NOT NULL DEFAULT 'trekking',
  order_hint INT NOT NULL DEFAULT 0,
  is_demanding BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'import',
  provenance TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour recherche rapide par pays et pertinence
CREATE INDEX IF NOT EXISTS idx_destination_steps_country ON public.destination_steps(country_code);
CREATE INDEX IF NOT EXISTS idx_destination_steps_order ON public.destination_steps(country_code, order_hint);

-- RLS
ALTER TABLE public.destination_steps ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les étapes candidates (catalogue public de référence)
CREATE POLICY "destination_steps_select_public"
  ON public.destination_steps
  FOR SELECT
  TO public
  USING (true);

-- Seul le service role / admins peuvent modifier le catalogue
CREATE POLICY "destination_steps_modify_service"
  ON public.destination_steps
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
