-- Migration: Affiliate Conversions

CREATE TABLE public.affiliate_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.affiliate_partners(id) ON DELETE SET NULL,
    offer_id UUID REFERENCES public.affiliate_offers(id) ON DELETE SET NULL,
    click_id UUID REFERENCES public.affiliate_clicks(id) ON DELETE SET NULL,
    external_reference TEXT, -- optional reference provided by partner
    commission NUMERIC,
    currency TEXT,
    status TEXT, -- e.g. 'pending', 'paid', 'rejected'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_partner ON public.affiliate_conversions (partner_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_offer ON public.affiliate_conversions (offer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_status ON public.affiliate_conversions (status);

-- Row Level Security
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "affiliate_conversions_public_read" ON public.affiliate_conversions;
DROP POLICY IF EXISTS "affiliate_conversions_service_write" ON public.affiliate_conversions;

CREATE POLICY "affiliate_conversions_public_read" ON public.affiliate_conversions
    USING (true);

CREATE POLICY "affiliate_conversions_service_write" ON public.affiliate_conversions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.affiliate_conversions TO anon, authenticated;
GRANT ALL ON public.affiliate_conversions TO service_role;
