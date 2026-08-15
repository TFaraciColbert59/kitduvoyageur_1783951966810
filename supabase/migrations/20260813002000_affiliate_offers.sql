-- Migration: Affiliate Offers

CREATE TABLE public.affiliate_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES public.affiliate_programs(id) ON DELETE CASCADE,
    destination TEXT,
    country TEXT,
    city TEXT,
    category TEXT,
    title TEXT NOT NULL,
    description TEXT,
    image TEXT,
    price NUMERIC,
    currency TEXT,
    rating NUMERIC,
    affiliate_url TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    availability BOOLEAN DEFAULT true,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_program ON public.affiliate_offers (program_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_country ON public.affiliate_offers (country);
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_category ON public.affiliate_offers (category);
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_priority ON public.affiliate_offers (priority);

-- Row Level Security
ALTER TABLE public.affiliate_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "affiliate_offers_public_read" ON public.affiliate_offers;
DROP POLICY IF EXISTS "affiliate_offers_service_write" ON public.affiliate_offers;

CREATE POLICY "affiliate_offers_public_read" ON public.affiliate_offers
    USING (true);

CREATE POLICY "affiliate_offers_service_write" ON public.affiliate_offers
    FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.affiliate_offers TO anon, authenticated;
GRANT ALL ON public.affiliate_offers TO service_role;
