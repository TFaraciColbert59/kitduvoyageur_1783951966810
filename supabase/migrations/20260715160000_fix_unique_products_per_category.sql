-- ============================================================
-- Fix: Unique products per category — no duplicate images/titles
-- Each category (neuf, occasion, enchères, location) gets
-- completely distinct products with unique images.
-- ============================================================

-- Step 1: Clear existing seeded data (keep order for FK safety)
DELETE FROM public.auction_bids;
DELETE FROM public.auction_auto_bids;
DELETE FROM public.product_reviews;
DELETE FROM public.kit_items;
DELETE FROM public.listings;
DELETE FROM public.occasion_items;
DELETE FROM public.auction_items;
DELETE FROM public.rental_items;
DELETE FROM public.kits;
DELETE FROM public.products;

-- ─── 1. NEUF — 5 produits neufs dans la table products ──────────────────────
DO $$
BEGIN
  INSERT INTO public.products (id, slug, name, brand, category, weight_g, price_eur, stock, image, image_alt, badge, description, featured)
  VALUES
    (gen_random_uuid(), 'osprey-atmos-ag-65-neuf', 'Osprey Atmos AG 65', 'Osprey', 'Sacs', 2180, 349.00, 8,
     'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600',
     'Sac à dos Osprey Atmos AG 65 vert forêt avec système Anti-Gravity, vue de face sur fond blanc',
     'Bestseller',
     'Sac à dos 65 L avec système Anti-Gravity pour un confort exceptionnel en randonnée multi-jours.',
     true),

    (gen_random_uuid(), 'msr-hubba-hubba-nx-2-neuf', 'MSR Hubba Hubba NX 2', 'MSR', 'Tentes', 1540, 549.00, 5,
     'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600',
     'Tente légère MSR Hubba Hubba NX 2 places orange montée en bivouac montagne au coucher du soleil',
     'Léger',
     'Tente 2 places ultra-légère (1 540 g) avec double paroi et vestibule spacieux.',
     true),

    (gen_random_uuid(), 'sea-to-summit-reactor-extreme-neuf', 'Sea to Summit Reactor Extreme', 'Sea to Summit', 'Sommeil', 390, 189.00, 12,
     'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
     'Sac de couchage liner Sea to Summit Reactor Extreme bleu compact dans sa pochette de transport',
     'Nouveau',
     'Liner thermique en Thermolite qui ajoute jusqu''à 15°C de confort à votre sac de couchage.',
     false),

    (gen_random_uuid(), 'black-diamond-spot-400-neuf', 'Black Diamond Spot 400', 'Black Diamond', 'Éclairage', 91, 49.00, 20,
     'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600',
     'Lampe frontale Black Diamond Spot 400 lumens rouge posée sur fond sombre avec faisceau visible',
     'Promo',
     'Frontale 400 lumens avec mode rouge, imperméable IPX8 et batterie rechargeable.',
     false),

    (gen_random_uuid(), 'sawyer-squeeze-filtre-neuf', 'Sawyer Squeeze Filter', 'Sawyer', 'Eau', 85, 39.00, 15,
     'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=600',
     'Filtre à eau Sawyer Squeeze bleu avec poches souples et adaptateur sur fond naturel',
     null,
     'Filtre à eau 0,1 micron, filtre jusqu''à 378 000 litres. Idéal randonnée et trekking.',
     false)
  ON CONFLICT (slug) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion products: %', SQLERRM;
END $$;


-- ─── 2. OCCASION — 5 articles d''occasion avec images uniques ────────────────
DO $$
DECLARE
  v_seller_id UUID;
BEGIN
  SELECT id INTO v_seller_id FROM public.user_profiles LIMIT 1;

  INSERT INTO public.occasion_items (id, seller_id, title, description, price, original_price, condition, location, image, alt, negotiable, shipping, status)
  VALUES
    (gen_random_uuid(), v_seller_id,
     'Réchaud MSR PocketRocket 2 — Comme neuf',
     'Réchaud ultraléger utilisé 2 fois. Vendu avec son étui d''origine et un adaptateur gaz. Parfait état.',
     45, 65, 'comme_neuf', 'Paris (75)',
     'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600',
     'Réchaud MSR PocketRocket 2 argenté posé sur une roche avec cartouche gaz en forêt',
     false, true, 'active'),

    (gen_random_uuid(), v_seller_id,
     'Chaussures Salomon X Ultra 4 GTX — Taille 43',
     'Chaussures de randonnée Gore-Tex portées 2 saisons. Semelle encore en bon état. Pointure 43.',
     95, 160, 'bon', 'Bordeaux (33)',
     'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
     'Chaussures de randonnée Salomon X Ultra 4 GTX grises et bleues taille 43 sur fond blanc',
     true, true, 'active'),

    (gen_random_uuid(), v_seller_id,
     'Bâtons Black Diamond Trail Ergo — Paire',
     'Paire de bâtons télescopiques aluminium. Poignées ergonomiques en liège. Utilisés 1 saison.',
     55, 90, 'tres_bon', 'Nantes (44)',
     'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600',
     'Paire de bâtons de randonnée Black Diamond Trail Ergo en aluminium avec poignées liège',
     true, false, 'active'),

    (gen_random_uuid(), v_seller_id,
     'Veste imperméable Arc''teryx Beta AR — Taille M',
     'Veste Gore-Tex Pro portée 1 saison. Imperméabilité intacte, coutures soudées parfaites. Taille M.',
     280, 550, 'tres_bon', 'Lyon (69)',
     'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=600',
     'Veste imperméable Arc''teryx Beta AR rouge taille M suspendue sur cintre fond blanc',
     false, true, 'active'),

    (gen_random_uuid(), v_seller_id,
     'Matelas gonflable Therm-a-Rest NeoAir XLite',
     'Matelas ultraléger 350 g, R-value 4.2. Utilisé 10 nuits. Aucune fuite, valve en parfait état.',
     120, 200, 'comme_neuf', 'Toulouse (31)',
     'https://images.unsplash.com/photo-1520209759809-a9bcb6cb3241?w=600',
     'Matelas gonflable Therm-a-Rest NeoAir XLite argenté déroulé sur herbe verte en camping',
     false, true, 'active')
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion occasion_items: %', SQLERRM;
END $$;


-- ─── 3. ENCHÈRES — 5 articles avec images uniques ───────────────────────────
DO $$
DECLARE
  v_seller_id UUID;
BEGIN
  SELECT id INTO v_seller_id FROM public.user_profiles LIMIT 1;

  INSERT INTO public.auction_items (id, seller_id, title, description, start_price, current_bid, buy_now_price, condition, ends_at, bids_count, watchers_count, image, alt, status)
  VALUES
    (gen_random_uuid(), v_seller_id,
     'Appareil photo Sony RX100 VII — Randonnée',
     'Compact expert pour la montagne. Boîtier avec 2 batteries, chargeur et étui waterproof.',
     600, 680, 950, 'bon',
     NOW() + INTERVAL '2 days 12 hours', 9, 42,
     'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600',
     'Appareil photo compact Sony RX100 VII noir avec étui waterproof et accessoires photo',
     'active'),

    (gen_random_uuid(), v_seller_id,
     'Crampons Petzl Vasak — Alpinisme 12 pointes',
     'Crampons 12 pointes acier pour alpinisme technique. Utilisés 2 saisons. Pointes encore longues.',
     80, 95, 160, 'bon',
     NOW() + INTERVAL '4 days', 2, 11,
     'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
     'Crampons Petzl Vasak 12 pointes acier pour alpinisme posés sur neige en haute montagne',
     'active'),

    (gen_random_uuid(), v_seller_id,
     'GPS Garmin inReach Mini 2 — Satellite',
     'Communicateur satellite avec abonnement 3 mois inclus. Idéal expéditions isolées.',
     250, 290, 420, 'comme_neuf',
     NOW() + INTERVAL '1 day 6 hours', 7, 28,
     'https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=600',
     'GPS Garmin inReach Mini 2 orange posé sur carte topographique avec mousqueton',
     'active'),

    (gen_random_uuid(), v_seller_id,
     'Corde à double Beal Opera 8.5mm — 60m',
     'Corde à double 60 m, 8.5 mm. Utilisée 2 saisons escalade. Gaine en excellent état.',
     120, 145, 220, 'tres_bon',
     NOW() + INTERVAL '3 days', 4, 19,
     'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600',
     'Corde à double Beal Opera 8.5mm 60m rouge et blanche enroulée sur fond rocher',
     'active'),

    (gen_random_uuid(), v_seller_id,
     'Vélo de montagne Scott Spark 950 — Taille L',
     'VTT full suspension carbone, taille L. Fourche Fox 32, amortisseur Fox Float. Excellent état.',
     1200, 1380, 2100, 'tres_bon',
     NOW() + INTERVAL '5 days', 3, 35,
     'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
     'Vélo de montagne Scott Spark 950 full suspension carbone taille L sur sentier forestier',
     'active')
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion auction_items: %', SQLERRM;
END $$;


-- ─── 4. LOCATION — 5 articles avec images uniques ───────────────────────────
DO $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT id INTO v_owner_id FROM public.user_profiles LIMIT 1;

  INSERT INTO public.rental_items (id, owner_id, title, description, price_per_day, price_per_week, deposit, condition, location, image, alt, available, rating, reviews_count, status)
  VALUES
    (gen_random_uuid(), v_owner_id,
     'Kayak de mer Prijon Seayak 520',
     'Kayak monoplace 520 cm, stable et rapide. Livré avec pagaie, jupe et gilet. Idéal côtes bretonnes.',
     45, 220, 300, 'bon', 'Brest (29)',
     'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600',
     'Kayak de mer Prijon Seayak 520 bleu sur plage bretonne avec pagaie et équipements de sécurité',
     true, 4.6, 8, 'available'),

    (gen_random_uuid(), v_owner_id,
     'Vélo de randonnée Ortler Arktis — Bikepacking',
     'Vélo de voyage 27 vitesses avec porte-bagages avant et arrière, garde-boue. Prêt pour bikepacking.',
     22, 110, 150, 'excellent', 'Nantes (44)',
     'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=600',
     'Vélo de randonnée Ortler Arktis gris avec porte-bagages et sacoches de voyage sur route',
     true, 4.7, 15, 'available'),

    (gen_random_uuid(), v_owner_id,
     'Raquettes à neige TSL 305 Escape',
     'Raquettes aluminium taille universelle (jusqu''à 100 kg). Bâtons télescopiques inclus.',
     10, 50, 60, 'bon', 'Annecy (74)',
     'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600',
     'Raquettes à neige TSL 305 Escape aluminium avec bâtons télescopiques posées sur neige fraîche',
     true, 4.5, 19, 'available'),

    (gen_random_uuid(), v_owner_id,
     'Kit via ferrata Petzl complet — Taille M/L',
     'Baudrier, longe Y absorbeur, casque et mousquetons. Taille M/L. Désinfecté après chaque location.',
     12, 60, 80, 'excellent', 'Grenoble (38)',
     'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600',
     'Kit via ferrata Petzl complet avec baudrier rouge longe absorbeur et casque blanc sur paroi',
     true, 4.9, 27, 'available'),

    (gen_random_uuid(), v_owner_id,
     'Planche de surf longboard 9''2 — Débutant',
     'Longboard 9''2 idéal apprentissage. Livré avec leash et housse de transport. Vagues douces.',
     25, 130, 120, 'bon', 'Biarritz (64)',
     'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=600',
     'Planche de surf longboard 9 pieds 2 pouces bleue sur plage de Biarritz avec vagues',
     true, 4.4, 11, 'available')
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion rental_items: %', SQLERRM;
END $$;
