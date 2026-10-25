-- ============================================================
-- Fix: Products + Listings seed + RLS public read policies
-- Ensures products display on /shop, /catalogue, and category pages
-- ============================================================

-- ─── 1. Fix RLS: allow public read on products and listings ─────────────────

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_products" ON public.products;
CREATE POLICY "public_read_products"
ON public.products FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_products" ON public.products;
CREATE POLICY "authenticated_manage_products"
ON public.products FOR ALL TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_listings" ON public.listings;
CREATE POLICY "public_read_listings"
ON public.listings FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_listings" ON public.listings;
CREATE POLICY "authenticated_manage_listings"
ON public.listings FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ─── 2. Clear old products and listings to start fresh ──────────────────────

DELETE FROM public.auction_bids;
DELETE FROM public.auction_auto_bids;
DELETE FROM public.product_reviews;
DELETE FROM public.listings;
DELETE FROM public.products;

-- ─── 3. Insert 20 products covering all catalogue categories ────────────────
-- Categories match catalogue slugs: Sacs, Tentes, Sommeil, Cuisine, Eau, Vêtements, Éclairage, Sécurité, Navigation

DO $$
BEGIN
  INSERT INTO public.products (id, slug, name, brand, category, activity, weight_g, price_eur, stock, image, image_alt, badge, description, featured)
  VALUES
    -- SACS (3 produits)
    (gen_random_uuid(), 'osprey-atmos-ag-65', 'Osprey Atmos AG 65', 'Osprey', 'Sacs',
     ARRAY['Randonnée', 'Trekking'], 2180, 349.00, 8,
     'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600',
     'Sac à dos Osprey Atmos AG 65 vert forêt avec système Anti-Gravity, vue de face',
     'Bestseller',
     'Sac à dos 65 L avec système Anti-Gravity pour un confort exceptionnel en randonnée multi-jours.',
     true),

    (gen_random_uuid(), 'deuter-aircontact-lite-45', 'Deuter Aircontact Lite 45+10', 'Deuter', 'Sacs',
     ARRAY['Randonnée', 'Trekking'], 1480, 189.00, 12,
     'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600',
     'Sac à dos de trekking Deuter Aircontact Lite 45+10 bleu avec dos ventilé sur fond blanc',
     null,
     'Sac polyvalent avec dos ventilé Aircontact, idéal pour les treks multi-jours.',
     false),

    (gen_random_uuid(), 'gregory-baltoro-75', 'Gregory Baltoro 75', 'Gregory', 'Sacs',
     ARRAY['Randonnée', 'Alpinisme'], 2100, 299.00, 6,
     'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600',
     'Sac à dos Gregory Baltoro 75 litres gris avec ceinture lombaire renforcée',
     null,
     'Sac 75 L avec suspension Response A3, idéal pour les expéditions longues.',
     false),

    -- TENTES (3 produits)
    (gen_random_uuid(), 'msr-hubba-hubba-nx-2', 'MSR Hubba Hubba NX 2', 'MSR', 'Tentes',
     ARRAY['Randonnée', 'Bivouac'], 1540, 549.00, 5,
     'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600',
     'Tente légère MSR Hubba Hubba NX 2 places orange montée en bivouac montagne',
     'Léger',
     'Tente 2 places ultra-légère (1 540 g) avec double paroi et vestibule spacieux.',
     true),

    (gen_random_uuid(), 'big-agnes-copper-spur-hv2', 'Big Agnes Copper Spur HV2', 'Big Agnes', 'Tentes',
     ARRAY['Randonnée', 'Bivouac'], 1080, 649.00, 4,
     'https://images.unsplash.com/photo-1571364588707-8638d6c49fea?w=600',
     'Tente Big Agnes Copper Spur HV2 jaune installée sur prairie alpine au coucher du soleil',
     'Ultra-léger',
     'Tente 2 places ultra-légère avec double paroi, idéale pour la randonnée légère.',
     false),

    (gen_random_uuid(), 'hilleberg-akto', 'Hilleberg Akto', 'Hilleberg', 'Tentes',
     ARRAY['Alpinisme', 'Bivouac', 'Ski de randonnée'], 1800, 799.00, 3,
     'https://images.unsplash.com/photo-1626326355479-b3a7ddcfe606?w=600',
     'Tente Hilleberg Akto rouge 4 saisons installée sur neige en haute montagne',
     '4 saisons',
     'Tente 1 place 4 saisons, résistante aux conditions extrêmes.',
     false),

    -- SOMMEIL (2 produits)
    (gen_random_uuid(), 'thermarest-neoair-xlite', 'Therm-a-Rest NeoAir XLite', 'Therm-a-Rest', 'Sommeil',
     ARRAY['Randonnée', 'Bivouac'], 354, 199.00, 14,
     'https://images.unsplash.com/photo-1663707333537-9808bb2a84a0?w=600',
     'Matelas gonflable Therm-a-Rest NeoAir XLite argenté déroulé dans tente',
     'Top confort',
     'Matelas gonflable ultra-léger avec isolation ThermaCapture, R-value 4.5.',
     true),

    (gen_random_uuid(), 'sea-to-summit-reactor-extreme', 'Sea to Summit Reactor Extreme', 'Sea to Summit', 'Sommeil',
     ARRAY['Randonnée', 'Trekking'], 390, 189.00, 10,
     'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
     'Sac de couchage liner Sea to Summit Reactor Extreme bleu compact dans sa pochette',
     'Nouveau',
     'Liner thermique en Thermolite qui ajoute jusqu''à 15°C de confort à votre sac de couchage.',
     false),

    -- CUISINE (2 produits)
    (gen_random_uuid(), 'msr-pocket-rocket-2', 'MSR PocketRocket 2', 'MSR', 'Cuisine',
     ARRAY['Randonnée', 'Bivouac', 'Alpinisme'], 73, 48.00, 35,
     'https://images.unsplash.com/photo-1729872416347-38d7dfbef04e?w=600',
     'Réchaud à gaz MSR PocketRocket 2 compact posé sur rocher avec casserole en titane',
     'Ultra-léger',
     'Réchaud à gaz ultra-compact, 73 g, ébullition en 3,5 min pour 1 litre.',
     true),

    (gen_random_uuid(), 'jetboil-flash-1l', 'Jetboil Flash 1L', 'Jetboil', 'Cuisine',
     ARRAY['Randonnée', 'Camping'], 371, 99.00, 18,
     'https://images.unsplash.com/photo-1520963959303-a5cc3bdf9260?w=600',
     'Système de cuisson intégré Jetboil Flash rouge posé sur rocher avec vapeur visible',
     null,
     'Système de cuisson intégré tout-en-un, ébullition en 100 secondes.',
     false),

    -- EAU (2 produits)
    (gen_random_uuid(), 'sawyer-squeeze-filter', 'Sawyer Squeeze Filter', 'Sawyer', 'Eau',
     ARRAY['Randonnée', 'Trekking', 'Survie'], 85, 39.00, 48,
     'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=600',
     'Filtre à eau Sawyer Squeeze bleu avec poches souples et adaptateur sur fond naturel',
     null,
     'Filtre à eau 0,1 micron, filtre jusqu''à 378 000 litres. Idéal randonnée et trekking.',
     false),

    (gen_random_uuid(), 'platypus-gravityworks-4l', 'Platypus GravityWorks 4L', 'Platypus', 'Eau',
     ARRAY['Camping', 'Randonnée'], 170, 72.00, 18,
     'https://images.unsplash.com/photo-1631329426101-b7250cde7fd7?w=600',
     'Système de filtration d''eau par gravité Platypus suspendu à branche avec poches bleues',
     null,
     'Système de filtration par gravité pour le camp, 1,75 L/min.',
     false),

    -- VÊTEMENTS (2 produits)
    (gen_random_uuid(), 'arcteryx-beta-sl-jacket', 'Arc''teryx Beta SL Jacket', 'Arc''teryx', 'Vêtements',
     ARRAY['Alpinisme', 'Randonnée', 'Ski de randonnée'], 315, 375.00, 8,
     'https://images.unsplash.com/photo-1618143928355-3d9afff6ec23?w=600',
     'Veste imperméable Arc''teryx Beta SL rouge portée par randonneur sur crête rocheuse',
     'Premium',
     'Veste imperméable Gore-Tex ultra-légère, coupe-vent, packable.',
     true),

    (gen_random_uuid(), 'patagonia-nano-puff-jacket', 'Patagonia Nano Puff Jacket', 'Patagonia', 'Vêtements',
     ARRAY['Randonnée', 'Camping', 'Alpinisme'], 298, 249.00, 7,
     'https://images.unsplash.com/photo-1698988934092-41ff930addd2?w=600',
     'Veste doudoune légère Patagonia Nano Puff bleue portée en montagne avec vue sur vallée',
     'Éco',
     'Doudoune synthétique recyclée, isolation PrimaLoft, résistante à l''humidité.',
     false),

    -- ÉCLAIRAGE (2 produits)
    (gen_random_uuid(), 'black-diamond-spot-400', 'Black Diamond Spot 400', 'Black Diamond', 'Éclairage',
     ARRAY['Randonnée', 'Alpinisme', 'Camping'], 91, 49.00, 30,
     'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600',
     'Lampe frontale Black Diamond Spot 400 lumens rouge posée sur fond sombre',
     'Promo',
     'Frontale 400 lumens avec mode rouge, imperméable IPX8 et batterie rechargeable.',
     false),

    (gen_random_uuid(), 'petzl-actik-core', 'Petzl Actik Core 450', 'Petzl', 'Éclairage',
     ARRAY['Randonnée', 'Camping', 'Spéléologie'], 87, 44.00, 25,
     'https://images.unsplash.com/photo-1570612117355-e3f8b19b1c08?w=600',
     'Lampe frontale Petzl Actik Core 450 lumens noire avec batterie rechargeable USB',
     null,
     'Frontale rechargeable 450 lumens, légère et polyvalente pour toutes les activités outdoor.',
     false),

    -- SÉCURITÉ (2 produits)
    (gen_random_uuid(), 'petzl-grigri-plus', 'Petzl Grigri+', 'Petzl', 'Sécurité',
     ARRAY['Escalade', 'Alpinisme'], 200, 89.00, 15,
     'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600',
     'Assureur Petzl Grigri+ orange avec système anti-panique sur fond blanc',
     null,
     'Assureur à blocage assisté avec mode anti-panique, compatible cordes 8,5-11 mm.',
     false),

    (gen_random_uuid(), 'garmin-inreach-mini-2', 'Garmin inReach Mini 2', 'Garmin', 'Sécurité',
     ARRAY['Randonnée', 'Alpinisme', 'Expédition'], 100, 399.00, 6,
     'https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=600',
     'Communicateur satellite Garmin inReach Mini 2 orange posé sur carte topographique',
     'Essentiel',
     'Communicateur satellite bidirectionnel avec SOS, météo et suivi GPS.',
     true),

    -- NAVIGATION (2 produits)
    (gen_random_uuid(), 'suunto-traverse-alpha', 'Suunto Traverse Alpha', 'Suunto', 'Navigation',
     ARRAY['Randonnée', 'Chasse', 'Pêche'], 89, 299.00, 9,
     'https://images.unsplash.com/photo-1607194383665-b75c341d03d0?w=600',
     'Montre GPS Suunto Traverse Alpha noire avec altimètre et boussole sur fond blanc',
     null,
     'Montre GPS outdoor avec altimètre, boussole et suivi de route.',
     false),

    (gen_random_uuid(), 'silva-ranger-compass', 'Silva Ranger 2.0', 'Silva', 'Navigation',
     ARRAY['Randonnée', 'Orientation', 'Survie'], 55, 39.00, 40,
     'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
     'Boussole Silva Ranger 2.0 rouge avec miroir de visée et graduation sur carte topographique',
     null,
     'Boussole de précision avec miroir de visée, graduation 1:25000 et 1:50000.',
     false)
  ON CONFLICT (slug) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion products: %', SQLERRM;
END $$;

-- ─── 4. Create listings for all products (listing_type = neuf) ───────────────

DO $$
DECLARE
  v_product RECORD;
BEGIN
  FOR v_product IN SELECT id, price_eur FROM public.products LOOP
    INSERT INTO public.listings (
      id, produit_id, listing_type, prix_cents, statut, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_product.id,
      'neuf'::listing_type,
      (v_product.price_eur * 100)::integer,
      'actif',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion listings: %', SQLERRM;
END $$;
