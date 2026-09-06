-- ==============================================================================
-- CHANTIER 5 — AFFILIATION TRAVELPAYOUTS & MONÉTISATION ÉTHIQUE
-- Migration: 20260905130000_affiliate_travelpayouts.sql
-- ==============================================================================

-- 1. Enrichissement de public.affiliate_partners
ALTER TABLE public.affiliate_partners
  ADD COLUMN IF NOT EXISTS commission_rate_desc TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT;

-- 2. Création de public.affiliate_links
CREATE TABLE IF NOT EXISTS public.affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'flight', 'hotel', 'activity', 'insurance', 'esim', 'transport', 'gear'
  )),
  country_code TEXT REFERENCES public.countries_geo(iso_a2) ON DELETE SET NULL,
  title TEXT NOT NULL,
  destination_name TEXT,
  target_url TEXT NOT NULL,
  tracking_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_links_country ON public.affiliate_links(country_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_category ON public.affiliate_links(category);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_partner ON public.affiliate_links(partner_id);

-- Activation de la contrainte FK sur trip_items(affiliate_link_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_trip_items_affiliate_link'
  ) THEN
    ALTER TABLE public.trip_items
      ADD CONSTRAINT fk_trip_items_affiliate_link
      FOREIGN KEY (affiliate_link_id)
      REFERENCES public.affiliate_links(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Enrichissement de public.affiliate_clicks (Minimisation RGPD : session_hash au lieu d'IP)
ALTER TABLE public.affiliate_clicks
  ADD COLUMN IF NOT EXISTS link_id UUID REFERENCES public.affiliate_links(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_hash TEXT,
  ADD COLUMN IF NOT EXISTS referrer TEXT;

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_link ON public.affiliate_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_created ON public.affiliate_clicks(created_at);

-- 4. Enrichissement de public.affiliate_conversions
ALTER TABLE public.affiliate_conversions
  ADD COLUMN IF NOT EXISTS external_sub_id TEXT,
  ADD COLUMN IF NOT EXISTS amount_cents INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_sub_id ON public.affiliate_conversions(external_sub_id);

-- RLS
ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliate_partners_select_public" ON public.affiliate_partners;
CREATE POLICY "affiliate_partners_select_public" ON public.affiliate_partners FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "affiliate_partners_all_service" ON public.affiliate_partners;
CREATE POLICY "affiliate_partners_all_service" ON public.affiliate_partners FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "affiliate_links_select_public" ON public.affiliate_links;
CREATE POLICY "affiliate_links_select_public" ON public.affiliate_links FOR SELECT TO public USING (is_active = true);

DROP POLICY IF EXISTS "affiliate_links_all_service" ON public.affiliate_links;
CREATE POLICY "affiliate_links_all_service" ON public.affiliate_links FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "affiliate_clicks_insert_all" ON public.affiliate_clicks;
CREATE POLICY "affiliate_clicks_insert_all" ON public.affiliate_clicks FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "affiliate_clicks_select_service" ON public.affiliate_clicks;
CREATE POLICY "affiliate_clicks_select_service" ON public.affiliate_clicks FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS "affiliate_clicks_all_service" ON public.affiliate_clicks;
CREATE POLICY "affiliate_clicks_all_service" ON public.affiliate_clicks FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "affiliate_conversions_all_service" ON public.affiliate_conversions;
CREATE POLICY "affiliate_conversions_all_service" ON public.affiliate_conversions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed partenaires Travelpayouts
INSERT INTO public.affiliate_partners (slug, name, network, website_url, commission_rate_desc, is_active)
VALUES
  ('booking', 'Booking.com', 'travelpayouts', 'https://www.booking.com', '4% à 6% sur les réservations d’hôtels & lodges', true),
  ('aviasales', 'Aviasales / WayAway', 'travelpayouts', 'https://www.aviasales.com', '1.2% à 2% sur les billets d’avion', true),
  ('getyourguide', 'GetYourGuide', 'travelpayouts', 'https://www.getyourguide.com', '8% sur les visites et activités guidées', true),
  ('airalo', 'Airalo eSIM', 'travelpayouts', 'https://www.airalo.com', '10% sur les forfaits data locaux', true),
  ('chapka', 'Chapka Assurances', 'travelpayouts', 'https://www.chapkassurances.com', '5% sur les assurances voyage et trek', true)
ON CONFLICT (slug) DO UPDATE
SET 
  name = EXCLUDED.name,
  commission_rate_desc = EXCLUDED.commission_rate_desc,
  is_active = EXCLUDED.is_active;
