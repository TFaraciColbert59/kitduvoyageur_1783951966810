-- Migration: Affiliate Clicks

CREATE TABLE public.affiliate_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- optional, reference to auth.users if available
    session_id UUID,
    partner_id UUID REFERENCES public.affiliate_partners(id) ON DELETE SET NULL,
    program_id UUID REFERENCES public.affiliate_programs(id) ON DELETE SET NULL,
    offer_id UUID REFERENCES public.affiliate_offers(id) ON DELETE SET NULL,
    page TEXT, -- e.g. 'country_page', 'configurator'
    placement TEXT, -- UI placement identifier
    destination TEXT,
    category TEXT,
    device TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_user ON public.affiliate_clicks (user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_partner ON public.affiliate_clicks (partner_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_offer ON public.affiliate_clicks (offer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_page ON public.affiliate_clicks (page);

-- Row Level Security
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "affiliate_clicks_public_read" ON public.affiliate_clicks;
DROP POLICY IF EXISTS "affiliate_clicks_service_write" ON public.affiliate_clicks;

CREATE POLICY "affiliate_clicks_public_read" ON public.affiliate_clicks
    USING (true);

CREATE POLICY "affiliate_clicks_service_write" ON public.affiliate_clicks
    FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.affiliate_clicks TO anon, authenticated;
GRANT ALL ON public.affiliate_clicks TO service_role;
