-- ============================================================
-- KIT DU VOYAGEUR — Unified Listings Table (Shop Refonte)
-- ============================================================

-- 1. ENUM TYPES
DROP TYPE IF EXISTS public.listing_type CASCADE;
CREATE TYPE public.listing_type AS ENUM ('neuf', 'kit', 'occasion', 'enchere', 'location');

DROP TYPE IF EXISTS public.occasion_etat CASCADE;
CREATE TYPE public.occasion_etat AS ENUM ('comme_neuf', 'bon_etat', 'etat_correct');

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS vendeur_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS produit_id UUID REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS prix_cents INTEGER DEFAULT 0;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS prix_depart_cents INTEGER DEFAULT 0;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS enchere_actuelle_cents INTEGER DEFAULT 0;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS increment_min_cents INTEGER DEFAULT 100;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS date_fin_enchere TIMESTAMPTZ;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS nombre_encherisseurs INTEGER DEFAULT 0;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS prix_jour_cents INTEGER DEFAULT 0;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS caution_cents INTEGER DEFAULT 0;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS etat TEXT DEFAULT 'bon_etat';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'actif';

-- 2. LISTINGS TABLE (unified)
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  listing_type public.listing_type NOT NULL DEFAULT 'neuf'::public.listing_type,
  vendeur_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  -- Prix standard (neuf / kit / occasion)
  prix_cents INTEGER DEFAULT 0,

  -- Champs enchère
  prix_depart_cents INTEGER DEFAULT 0,
  enchere_actuelle_cents INTEGER DEFAULT 0,
  increment_min_cents INTEGER DEFAULT 100,
  date_fin_enchere TIMESTAMPTZ,
  nombre_encherisseurs INTEGER DEFAULT 0,

  -- Champs location
  prix_jour_cents INTEGER DEFAULT 0,
  caution_cents INTEGER DEFAULT 0,
  calendrier_disponibilite JSONB DEFAULT '{}'::jsonb,

  -- Champs occasion
  etat public.occasion_etat DEFAULT 'bon_etat'::public.occasion_etat,
  historique JSONB DEFAULT '[]'::jsonb,
  certificat_authenticite JSONB DEFAULT '{}'::jsonb,
  photos_defauts JSONB DEFAULT '[]'::jsonb,

  -- Champs kit
  composition JSONB DEFAULT '[]'::jsonb,

  -- Commun
  statut TEXT DEFAULT 'actif',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_listings_produit_id ON public.listings(produit_id);
CREATE INDEX IF NOT EXISTS idx_listings_type ON public.listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_listings_vendeur_id ON public.listings(vendeur_id);
CREATE INDEX IF NOT EXISTS idx_listings_statut ON public.listings(statut);
CREATE INDEX IF NOT EXISTS idx_listings_date_fin_enchere ON public.listings(date_fin_enchere);

-- 4. RLS
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listings_public_read" ON public.listings;
CREATE POLICY "listings_public_read" ON public.listings
  FOR SELECT TO public USING (statut = 'actif');

DROP POLICY IF EXISTS "listings_vendor_manage" ON public.listings;
CREATE POLICY "listings_vendor_manage" ON public.listings
  FOR ALL TO authenticated
  USING (vendeur_id = auth.uid())
  WITH CHECK (vendeur_id = auth.uid());

-- 5. SEED DATA — quelques listings de démonstration
DO $$
DECLARE
  existing_product_id UUID;
  existing_user_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    SELECT id INTO existing_product_id FROM public.products LIMIT 1;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;
  END IF;

  IF existing_product_id IS NOT NULL THEN
    INSERT INTO public.listings (id, produit_id, listing_type, prix_cents, statut)
    VALUES (gen_random_uuid(), existing_product_id, 'neuf'::public.listing_type, 34900, 'actif')
    ON CONFLICT (id) DO NOTHING;

    IF existing_user_id IS NOT NULL THEN
      INSERT INTO public.listings (
        id, produit_id, listing_type, vendeur_id, prix_cents,
        etat, statut
      ) VALUES (
        gen_random_uuid(), existing_product_id, 'occasion'::public.listing_type,
        existing_user_id, 18000, 'bon_etat'::public.occasion_etat, 'actif'
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.listings (
        id, produit_id, listing_type, vendeur_id,
        prix_depart_cents, enchere_actuelle_cents, increment_min_cents,
        date_fin_enchere, statut
      ) VALUES (
        gen_random_uuid(), existing_product_id, 'enchere'::public.listing_type,
        existing_user_id, 10000, 10000, 500,
        NOW() + INTERVAL '7 days', 'actif'
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.listings (
        id, produit_id, listing_type, vendeur_id,
        prix_jour_cents, caution_cents, statut
      ) VALUES (
        gen_random_uuid(), existing_product_id, 'location'::public.listing_type,
        existing_user_id, 1500, 10000, 'actif'
      ) ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Listings seed failed: %', SQLERRM;
END $$;
