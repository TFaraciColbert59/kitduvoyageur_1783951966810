-- Migration: Affiliate Programs

CREATE TABLE public.affiliate_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
    program_identifier TEXT NOT NULL,
    network TEXT,
    commission_type TEXT,
    commission_value NUMERIC,
    cookie_duration INTEGER, -- in days
    status TEXT,
    api_available BOOLEAN DEFAULT false,
    tracking_template TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_programs_partner ON public.affiliate_programs (partner_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_programs_status ON public.affiliate_programs (status);

-- Row Level Security
ALTER TABLE public.affiliate_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "affiliate_programs_public_read" ON public.affiliate_programs;
DROP POLICY IF EXISTS "affiliate_programs_service_write" ON public.affiliate_programs;

CREATE POLICY "affiliate_programs_public_read" ON public.affiliate_programs
    USING (true);

CREATE POLICY "affiliate_programs_service_write" ON public.affiliate_programs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.affiliate_programs TO anon, authenticated;
GRANT ALL ON public.affiliate_programs TO service_role;
