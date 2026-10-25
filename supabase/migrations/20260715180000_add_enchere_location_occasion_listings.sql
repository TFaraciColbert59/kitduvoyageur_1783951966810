-- ============================================================
-- Add enchere, location, and occasion listings for existing products
-- All products currently only have 'neuf' listings.
-- This migration adds the missing listing types so each section
-- (/encheres, /location, /occasion) shows relevant products.
-- ============================================================

-- ─── Add enchere listings (5 products: premium gear suitable for auction) ───

DO $$
DECLARE
  v_id UUID;
BEGIN
  -- Hilleberg Akto (tente 4 saisons premium → enchère)
  SELECT id INTO v_id FROM public.products WHERE slug = 'hilleberg-akto' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_depart_cents, enchere_actuelle_cents,
      increment_min_cents, date_fin_enchere, nombre_encherisseurs,
      etat, statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'enchere'::listing_type,
      39900, 42000, 500,
      (CURRENT_TIMESTAMP + INTERVAL '5 days'), 3,
      'bon_etat'::occasion_etat, 'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Big Agnes Copper Spur HV2 (tente ultra-légère premium → enchère)
  SELECT id INTO v_id FROM public.products WHERE slug = 'big-agnes-copper-spur-hv2' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_depart_cents, enchere_actuelle_cents,
      increment_min_cents, date_fin_enchere, nombre_encherisseurs,
      etat, statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'enchere'::listing_type,
      29900, 31500, 500,
      (CURRENT_TIMESTAMP + INTERVAL '3 days'), 5,
      'comme_neuf'::occasion_etat, 'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Garmin inReach Mini 2 (GPS satellite → enchère)
  SELECT id INTO v_id FROM public.products WHERE slug = 'garmin-inreach-mini-2' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_depart_cents, enchere_actuelle_cents,
      increment_min_cents, date_fin_enchere, nombre_encherisseurs,
      etat, statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'enchere'::listing_type,
      19900, 22000, 500,
      (CURRENT_TIMESTAMP + INTERVAL '7 days'), 8,
      'comme_neuf'::occasion_etat, 'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Arc'teryx Beta SL Jacket (veste premium → enchère)
  SELECT id INTO v_id FROM public.products WHERE slug = 'arcteryx-beta-sl-jacket' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_depart_cents, enchere_actuelle_cents,
      increment_min_cents, date_fin_enchere, nombre_encherisseurs,
      etat, statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'enchere'::listing_type,
      14900, 17500, 500,
      (CURRENT_TIMESTAMP + INTERVAL '4 days'), 6,
      'bon_etat'::occasion_etat, 'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Osprey Atmos AG 65 (sac bestseller → enchère)
  SELECT id INTO v_id FROM public.products WHERE slug = 'osprey-atmos-ag-65' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_depart_cents, enchere_actuelle_cents,
      increment_min_cents, date_fin_enchere, nombre_encherisseurs,
      etat, statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'enchere'::listing_type,
      14900, 16000, 500,
      (CURRENT_TIMESTAMP + INTERVAL '6 days'), 4,
      'bon_etat'::occasion_etat, 'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion enchère listings: %', SQLERRM;
END $$;

-- ─── Add location listings (5 products: gear suitable for rental) ────────────

DO $$
DECLARE
  v_id UUID;
BEGIN
  -- MSR Hubba Hubba NX 2 (tente légère → location)
  SELECT id INTO v_id FROM public.products WHERE slug = 'msr-hubba-hubba-nx-2' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_jour_cents, caution_cents,
      statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'location'::listing_type,
      1500, 15000,
      'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Gregory Baltoro 75 (grand sac → location)
  SELECT id INTO v_id FROM public.products WHERE slug = 'gregory-baltoro-75' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_jour_cents, caution_cents,
      statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'location'::listing_type,
      1200, 10000,
      'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Therm-a-Rest NeoAir XLite (matelas → location)
  SELECT id INTO v_id FROM public.products WHERE slug = 'thermarest-neoair-xlite' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_jour_cents, caution_cents,
      statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'location'::listing_type,
      800, 8000,
      'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Jetboil Flash 1L (réchaud → location)
  SELECT id INTO v_id FROM public.products WHERE slug = 'jetboil-flash-1l' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_jour_cents, caution_cents,
      statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'location'::listing_type,
      600, 5000,
      'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Suunto Traverse Alpha (montre GPS → location)
  SELECT id INTO v_id FROM public.products WHERE slug = 'suunto-traverse-alpha' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_jour_cents, caution_cents,
      statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'location'::listing_type,
      1000, 12000,
      'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion location listings: %', SQLERRM;
END $$;

-- ─── Add occasion listings (5 products: second-hand gear) ────────────────────

DO $$
DECLARE
  v_id UUID;
  v_price NUMERIC;
BEGIN
  -- Deuter Aircontact Lite 45+10 (sac occasion)
  SELECT id, price_eur INTO v_id, v_price FROM public.products WHERE slug = 'deuter-aircontact-lite-45' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_cents, etat,
      faire_offre_active, occasion_statut, statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'occasion'::listing_type,
      (v_price * 0.65 * 100)::integer, 'bon_etat'::occasion_etat,
      true, 'active', 'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- MSR Hubba Hubba NX 2 (tente occasion)
  SELECT id, price_eur INTO v_id, v_price FROM public.products WHERE slug = 'msr-hubba-hubba-nx-2' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_cents, etat,
      faire_offre_active, occasion_statut, statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'occasion'::listing_type,
      (v_price * 0.60 * 100)::integer, 'etat_correct'::occasion_etat,
      false, 'active', 'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Patagonia Nano Puff Jacket (veste occasion)
  SELECT id, price_eur INTO v_id, v_price FROM public.products WHERE slug = 'patagonia-nano-puff-jacket' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_cents, etat,
      faire_offre_active, occasion_statut, statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'occasion'::listing_type,
      (v_price * 0.70 * 100)::integer, 'comme_neuf'::occasion_etat,
      true, 'active', 'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Black Diamond Spot 400 (frontale occasion)
  SELECT id, price_eur INTO v_id, v_price FROM public.products WHERE slug = 'black-diamond-spot-400' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_cents, etat,
      faire_offre_active, occasion_statut, statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'occasion'::listing_type,
      (v_price * 0.55 * 100)::integer, 'bon_etat'::occasion_etat,
      true, 'active', 'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Platypus GravityWorks 4L (filtre eau occasion)
  SELECT id, price_eur INTO v_id, v_price FROM public.products WHERE slug = 'platypus-gravityworks-4l' LIMIT 1;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_cents, etat,
      faire_offre_active, occasion_statut, statut, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id, 'occasion'::listing_type,
      (v_price * 0.60 * 100)::integer, 'bon_etat'::occasion_etat,
      false, 'active', 'actif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT DO NOTHING;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion occasion listings: %', SQLERRM;
END $$;
