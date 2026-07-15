-- ============================================================
-- KIT DU VOYAGEUR — Occasion Listings Extended Fields
-- ============================================================

-- 1. Statut occasion enum (5 états)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'occasion_statut') THEN
    CREATE TYPE public.occasion_statut AS ENUM (
      'en_attente_moderation',
      'active',
      'vendue',
      'retiree',
      'litige'
    );
  END IF;
END $$;

-- 2. Extend listings table with occasion fields
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS faire_offre_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS occasion_statut TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS historique_produit JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS photos_defauts JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vendeur_trust_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendeur_nb_ventes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendeur_delai_reponse_heures INTEGER,
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
  ADD COLUMN IF NOT EXISTS moderation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Note: photos_defauts column may already exist from unified_listings migration
-- The ADD COLUMN IF NOT EXISTS handles this safely

-- 3. Moderation queue table
CREATE TABLE IF NOT EXISTS public.moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'occasion_listing',
  statut TEXT NOT NULL DEFAULT 'en_attente',
  soumis_par UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  soumis_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  traite_par UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  traite_at TIMESTAMPTZ,
  notes TEXT,
  ai_coherence_score INTEGER,
  ai_flags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_listings_occasion_statut ON public.listings(occasion_statut);
CREATE INDEX IF NOT EXISTS idx_listings_faire_offre ON public.listings(faire_offre_active) WHERE faire_offre_active = true;
CREATE INDEX IF NOT EXISTS idx_moderation_queue_statut ON public.moderation_queue(statut);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_listing ON public.moderation_queue(listing_id);

-- 5. RLS on moderation_queue
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moderation_queue_admin_read" ON public.moderation_queue;
CREATE POLICY "moderation_queue_admin_read" ON public.moderation_queue
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderateur')
    )
  );

DROP POLICY IF EXISTS "moderation_queue_vendor_insert" ON public.moderation_queue;
CREATE POLICY "moderation_queue_vendor_insert" ON public.moderation_queue
  FOR INSERT TO authenticated
  WITH CHECK (soumis_par = auth.uid());

-- 6. Update listings RLS to expose occasion_statut
DROP POLICY IF EXISTS "listings_public_read" ON public.listings;
CREATE POLICY "listings_public_read" ON public.listings
  FOR SELECT TO public
  USING (
    statut = 'actif'
    AND (
      listing_type != 'occasion'::public.listing_type
      OR occasion_statut = 'active'
    )
  );

-- Allow vendors to see their own listings regardless of statut
DROP POLICY IF EXISTS "listings_vendor_own_read" ON public.listings;
CREATE POLICY "listings_vendor_own_read" ON public.listings
  FOR SELECT TO authenticated
  USING (vendeur_id = auth.uid());
