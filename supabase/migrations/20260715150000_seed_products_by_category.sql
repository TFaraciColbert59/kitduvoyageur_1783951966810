-- ============================================================
-- Seed: 5 products per category (neuf, occasion, enchères, location)
-- ============================================================

-- ─── 1. NEUF — 5 produits dans la table products ────────────────────────────
DO $$
BEGIN
  INSERT INTO public.products (id, slug, name, brand, category, weight_g, price_eur, stock, image, image_alt, badge, description, featured)
  VALUES
    (gen_random_uuid(), 'osprey-atmos-ag-65', 'Osprey Atmos AG 65', 'Osprey', 'Sacs', 2180, 349.00, 8,
     'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600',
     'Sac à dos Osprey Atmos AG 65 vert forêt avec système Anti-Gravity, vue de face',
     'Bestseller', 'Sac à dos 65 L avec système Anti-Gravity pour un confort exceptionnel en randonnée multi-jours.', true),

    (gen_random_uuid(), 'msr-hubba-hubba-nx-2', 'MSR Hubba Hubba NX 2', 'MSR', 'Tentes', 1540, 549.00, 5,
     'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600',
     'Tente légère MSR Hubba Hubba NX 2 places orange montée en bivouac montagne',
     'Léger', 'Tente 2 places ultra-légère (1 540 g) avec double paroi et vestibule spacieux.', true),

    (gen_random_uuid(), 'sea-to-summit-reactor-extreme', 'Sea to Summit Reactor Extreme', 'Sea to Summit', 'Sommeil', 390, 189.00, 12,
     'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
     'Sac de couchage liner Sea to Summit Reactor Extreme bleu compact dans sa pochette',
     'Nouveau', 'Liner thermique en Thermolite qui ajoute jusqu''à 15°C de confort à votre sac de couchage.', false),

    (gen_random_uuid(), 'black-diamond-spot-400', 'Black Diamond Spot 400', 'Black Diamond', 'Éclairage', 91, 49.00, 20,
     'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600',
     'Lampe frontale Black Diamond Spot 400 lumens rouge sur fond sombre',
     'Promo', 'Frontale 400 lumens avec mode rouge, imperméable IPX8 et batterie rechargeable.', false),

    (gen_random_uuid(), 'sawyer-squeeze-filtre', 'Sawyer Squeeze Filter', 'Sawyer', 'Eau', 85, 39.00, 15,
     'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=600',
     'Filtre à eau Sawyer Squeeze bleu avec poches souples et adaptateur',
     null, 'Filtre à eau 0,1 micron, filtre jusqu''à 378 000 litres. Idéal randonnée et trekking.', false)
  ON CONFLICT (slug) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion products: %', SQLERRM;
END $$;


-- ─── 2. OCCASION — 5 articles dans occasion_items ───────────────────────────
DO $$
DECLARE
  v_seller_id UUID;
BEGIN
  SELECT id INTO v_seller_id FROM public.user_profiles LIMIT 1;

  INSERT INTO public.occasion_items (id, seller_id, title, description, price, original_price, condition, location, image, alt, negotiable, shipping, status)
  VALUES
    (gen_random_uuid(), v_seller_id,
     'Tente Vaude Taurus 2P — Très bon état',
     'Tente 2 places utilisée 5 sorties. Aucun défaut, toutes les sardines présentes. Idéale randonnée 3 saisons.',
     180, 320, 'tres_bon', 'Lyon (69)', 
     'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600',
     'Tente Vaude Taurus 2 places verte montée dans un pré, très bon état',
     true, true, 'active'),

    (gen_random_uuid(), v_seller_id,
     'Sac à dos Gregory Baltoro 65 — Bon état',
     'Sac 65 L porté 3 semaines sur le GR20. Quelques marques d''usure sur le fond, fonctionnel à 100%.',
     210, 380, 'bon', 'Grenoble (38)',
     'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600',
     'Sac à dos Gregory Baltoro 65 litres gris avec bretelles ergonomiques, bon état',
     true, false, 'active'),

    (gen_random_uuid(), v_seller_id,
     'Réchaud MSR PocketRocket 2 — Comme neuf',
     'Réchaud ultraléger utilisé 2 fois. Vendu avec son étui d''origine et un adaptateur gaz.',
     45, 65, 'comme_neuf', 'Paris (75)',
     'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600',
     'Réchaud MSR PocketRocket 2 argenté posé sur une roche avec cartouche gaz',
     false, true, 'active'),

    (gen_random_uuid(), v_seller_id,
     'Chaussures Salomon X Ultra 4 GTX — Taille 43',
     'Chaussures de randonnée Gore-Tex portées 2 saisons. Semelle encore en bon état. Pointure 43.',
     95, 160, 'bon', 'Bordeaux (33)',
     'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
     'Chaussures de randonnée Salomon X Ultra 4 GTX grises et bleues, taille 43',
     true, true, 'active'),

    (gen_random_uuid(), v_seller_id,
     'Sac de couchage Cumulus Panyam 450 — Comme neuf',
     'Sac de couchage duvet 450 g, confort -5°C. Utilisé 3 nuits en bivouac. Propre, sans odeur.',
     220, 310, 'comme_neuf', 'Toulouse (31)',
     'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
     'Sac de couchage duvet Cumulus Panyam 450 bleu compact dans sa pochette de rangement',
     false, true, 'active')
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion occasion_items: %', SQLERRM;
END $$;


-- ─── 3. ENCHÈRES — 5 articles dans auction_items ────────────────────────────
DO $$
DECLARE
  v_seller_id UUID;
BEGIN
  SELECT id INTO v_seller_id FROM public.user_profiles LIMIT 1;

  INSERT INTO public.auction_items (id, seller_id, title, description, start_price, current_bid, buy_now_price, condition, ends_at, bids_count, watchers_count, image, alt, status)
  VALUES
    (gen_random_uuid(), v_seller_id,
     'Tente MSR Hubba Hubba NX — Édition limitée',
     'Tente 2 places édition limitée couleur forêt. Utilisée 1 saison, parfait état. Rare sur le marché.',
     280, 310, 520,
     'comme_neuf', NOW() + INTERVAL '3 days', 4, 18,
     'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600',
     'Tente MSR Hubba Hubba NX édition limitée couleur forêt montée en bivouac',
     'active'),

    (gen_random_uuid(), v_seller_id,
     'Sac à dos Osprey Exos 58 — Ultralight',
     'Sac ultraléger 58 L, dos suspendu. Porté 2 semaines sur le PCT. Excellent état général.',
     150, 185, 320,
     'tres_bon', NOW() + INTERVAL '1 day 6 hours', 7, 24,
     'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600',
     'Sac à dos Osprey Exos 58 litres orange ultraléger avec dos suspendu',
     'active'),

    (gen_random_uuid(), v_seller_id,
     'Kit bivouac complet — Tente + sac + matelas',
     'Ensemble complet : tente 1 place, sac de couchage -10°C, matelas gonflable. Tout en excellent état.',
     350, 420, 750,
     'tres_bon', NOW() + INTERVAL '5 days', 3, 31,
     'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=600',
     'Kit bivouac complet avec tente orange, sac de couchage et matelas gonflable posés sur herbe',
     'active'),

    (gen_random_uuid(), v_seller_id,
     'Appareil photo Sony RX100 VII — Randonnée',
     'Compact expert pour la montagne. Boîtier avec 2 batteries, chargeur et étui waterproof.',
     600, 680, 950,
     'bon', NOW() + INTERVAL '2 days 12 hours', 9, 42,
     'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600',
     'Appareil photo compact Sony RX100 VII noir avec étui waterproof et accessoires',
     'active'),

    (gen_random_uuid(), v_seller_id,
     'Crampons Petzl Vasak — Alpinisme',
     'Crampons 12 pointes acier pour alpinisme technique. Utilisés 2 saisons. Pointes encore longues.',
     80, 95, 160,
     'bon', NOW() + INTERVAL '4 days', 2, 11,
     'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600',
     'Crampons Petzl Vasak 12 pointes acier pour alpinisme posés sur neige',
     'active')
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion auction_items: %', SQLERRM;
END $$;


-- ─── 4. LOCATION — 5 articles dans rental_items ─────────────────────────────
DO $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT id INTO v_owner_id FROM public.user_profiles LIMIT 1;

  INSERT INTO public.rental_items (id, owner_id, title, description, price_per_day, price_per_week, deposit, condition, location, image, alt, available, rating, reviews_count, status)
  VALUES
    (gen_random_uuid(), v_owner_id,
     'Tente 4 saisons The North Face VE 25',
     'Tente expédition 2 places, résiste aux vents violents et à la neige. Parfaite pour haute montagne.',
     18, 95, 200,
     'excellent', 'Chamonix (74)',
     'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600',
     'Tente 4 saisons The North Face VE 25 jaune montée sur neige en haute montagne',
     true, 4.8, 12, 'available'),

    (gen_random_uuid(), v_owner_id,
     'Kit via ferrata Petzl complet',
     'Baudrier, longe Y absorbeur, casque et mousquetons. Taille M/L. Désinfecté après chaque location.',
     12, 60, 80,
     'excellent', 'Grenoble (38)',
     'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600',
     'Kit via ferrata Petzl complet avec baudrier rouge, longe absorbeur et casque blanc',
     true, 4.9, 27, 'available'),

    (gen_random_uuid(), v_owner_id,
     'Kayak de mer Prijon Seayak 520',
     'Kayak monoplace 520 cm, stable et rapide. Livré avec pagaie, jupe et gilet. Idéal côtes bretonnes.',
     45, 220, 300,
     'bon', 'Brest (29)',
     'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=600',
     'Kayak de mer Prijon Seayak 520 bleu sur plage bretonne avec pagaie et équipements',
     true, 4.6, 8, 'available'),

    (gen_random_uuid(), v_owner_id,
     'Vélo de randonnée Ortler Arktis',
     'Vélo de voyage 27 vitesses avec porte-bagages avant et arrière, garde-boue. Prêt pour bikepacking.',
     22, 110, 150,
     'excellent', 'Nantes (44)',
     'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
     'Vélo de randonnée Ortler Arktis gris avec porte-bagages et sacoches de voyage',
     true, 4.7, 15, 'available'),

    (gen_random_uuid(), v_owner_id,
     'Raquettes à neige TSL 305 Escape',
     'Raquettes aluminium taille universelle (jusqu''à 100 kg). Bâtons télescopiques inclus.',
     10, 50, 60,
     'bon', 'Annecy (74)',
     'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600',
     'Raquettes à neige TSL 305 Escape aluminium avec bâtons télescopiques sur neige',
     true, 4.5, 19, 'available')
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion rental_items: %', SQLERRM;
END $$;
