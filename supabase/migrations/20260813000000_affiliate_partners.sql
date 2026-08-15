-- Migration: Affiliate Partners

CREATE TABLE public.affiliate_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    category TEXT,
    network TEXT,
    logo TEXT,
    site TEXT,
    country TEXT,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_slug ON public.affiliate_partners (slug);
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_active ON public.affiliate_partners (is_active);

-- Row Level Security
ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "affiliate_partners_public_read" ON public.affiliate_partners;
DROP POLICY IF EXISTS "affiliate_partners_service_write" ON public.affiliate_partners;

CREATE POLICY "affiliate_partners_public_read" ON public.affiliate_partners
    USING (true);

CREATE POLICY "affiliate_partners_service_write" ON public.affiliate_partners
    FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.affiliate_partners TO anon, authenticated;
GRANT ALL ON public.affiliate_partners TO service_role;
