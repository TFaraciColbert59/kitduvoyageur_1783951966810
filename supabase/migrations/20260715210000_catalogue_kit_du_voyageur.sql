-- ============================================================
-- Migration: Catalogue Le Kit du Voyageur
-- Source: Création_du_catalogue_Le_Kit_du_Voyageur (Excel)
-- Timestamp: 20260715210000
-- Description: Peuple la table shop_products avec le catalogue
--              complet des équipements de voyage et d'aventure.
-- ============================================================

-- Vider les données existantes pour repartir du catalogue propre
TRUNCATE TABLE public.shop_products RESTART IDENTITY CASCADE;

-- ─── CATALOGUE COMPLET ─────────────────────────────────────────────────────
DO $$
BEGIN

-- ── 1. SACS À DOS ──────────────────────────────────────────────────────────
INSERT INTO public.shop_products (slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, savings)
VALUES
  ('osprey-farpoint-40-achat',        'Osprey Farpoint 40',           'Osprey',        'Sacs à dos',  1420, 179.00, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Sac à dos Osprey Farpoint 40 gris anthracite vue de face',                  4.8, 312, true, 'achat',    0),
  ('osprey-atmos-ag-65-achat',        'Osprey Atmos AG 65',           'Osprey',        'Sacs à dos',  2180, 349.00, 'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600&q=80', 'Sac à dos Osprey Atmos AG 65 vert forêt système Anti-Gravity',             4.9, 198, true, 'achat',    0),
  ('deuter-aircontact-lite-65-achat', 'Deuter Aircontact Lite 65+10', 'Deuter',        'Sacs à dos',  2100, 279.00, 'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600&q=80', 'Sac à dos Deuter Aircontact Lite 65+10 litres bleu randonnée',             4.7, 145, true, 'achat',    0),
  ('gregory-baltoro-65-achat',        'Gregory Baltoro 65',           'Gregory',       'Sacs à dos',  2270, 320.00, 'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600&q=80', 'Sac à dos Gregory Baltoro 65 litres gris avec bretelles ergonomiques',    4.8, 167, true, 'achat',    0),
  ('osprey-exos-58-achat',            'Osprey Exos 58',               'Osprey',        'Sacs à dos',  1080, 289.00, 'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600&q=80', 'Sac à dos ultraléger Osprey Exos 58 orange dos suspendu',                  4.8, 234, true, 'achat',    0),
  ('osprey-farpoint-40-location',     'Osprey Farpoint 40',           'Osprey',        'Sacs à dos',  1420,   9.00, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Sac à dos Osprey Farpoint 40 disponible à la location',                   4.7,  89, true, 'location', 0),
  ('osprey-atmos-ag-65-occasion',     'Osprey Atmos AG 65',           'Osprey',        'Sacs à dos',  2180, 195.00, 'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600&q=80', 'Sac à dos Osprey Atmos AG 65 occasion très bon état',                     4.6,  42, true, 'occasion', 154)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. TENTES ──────────────────────────────────────────────────────────────
INSERT INTO public.shop_products (slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, savings)
VALUES
  ('msr-hubba-hubba-nx-2-achat',      'MSR Hubba Hubba NX 2P',        'MSR',           'Tentes',      1720, 549.00, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 'Tente MSR Hubba Hubba NX 2 places orange montée en montagne',              4.9, 198, true, 'achat',    0),
  ('big-agnes-copper-spur-hv-ul2',    'Big Agnes Copper Spur HV UL2', 'Big Agnes',     'Tentes',      1130, 599.00, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 'Tente ultraléger Big Agnes Copper Spur HV UL2 jaune bivouac',              4.8, 156, true, 'achat',    0),
  ('vaude-taurus-2p-achat',           'Vaude Taurus 2P',              'Vaude',         'Tentes',      2100, 249.00, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 'Tente Vaude Taurus 2 places verte montée dans un pré',                    4.6, 112, true, 'achat',    0),
  ('nordisk-telemark-2-achat',        'Nordisk Telemark 2 LW',        'Nordisk',       'Tentes',      1480, 479.00, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 'Tente Nordisk Telemark 2 LW légère beige montée en forêt',                4.7,  89, true, 'achat',    0),
  ('msr-hubba-hubba-nx-2-location',   'MSR Hubba Hubba NX 2P',        'MSR',           'Tentes',      1720,  18.00, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 'Tente MSR Hubba Hubba NX 2 places disponible à la location',              4.8,  67, true, 'location', 0),
  ('msr-hubba-hubba-nx-2-occasion',   'MSR Hubba Hubba NX 2P',        'MSR',           'Tentes',      1720, 320.00, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 'Tente MSR Hubba Hubba NX 2 places occasion bon état',                     4.7,  23, true, 'occasion', 229)
ON CONFLICT (slug) DO NOTHING;

-- ── 3. COUCHAGE ─────────────────────────────────────────────────────────────
INSERT INTO public.shop_products (slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, savings)
VALUES
  ('sea-to-summit-spark-sp1-achat',   'Sea to Summit Spark SP1',      'Sea to Summit', 'Couchage',     490, 299.00, 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80', 'Sac de couchage Sea to Summit Spark SP1 ultra léger bleu compact',        4.7, 156, true, 'achat',    0),
  ('cumulus-panyam-450-achat',        'Cumulus Panyam 450',           'Cumulus',       'Couchage',     700, 289.00, 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80', 'Sac de couchage duvet Cumulus Panyam 450 bleu compact pochette',          4.8, 134, true, 'achat',    0),
  ('nemo-disco-15-achat',             'NEMO Disco 15',                'NEMO',          'Couchage',     1020, 349.00, 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80', 'Sac de couchage NEMO Disco 15 coupe momie large orange',                  4.6,  98, true, 'achat',    0),
  ('nemo-tensor-insulated-achat',     'NEMO Tensor Insulated',        'NEMO',          'Couchage',     510, 189.00, 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80', 'Matelas gonflable NEMO Tensor Insulated orange déplié',                   4.8, 201, true, 'achat',    0),
  ('thermarest-neoair-xlite-achat',   'Therm-a-Rest NeoAir XLite',    'Therm-a-Rest',  'Couchage',     340, 219.00, 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80', 'Matelas gonflable Therm-a-Rest NeoAir XLite argent ultra compact',        4.9, 312, true, 'achat',    0),
  ('sea-to-summit-spark-sp1-location','Sea to Summit Spark SP1',      'Sea to Summit', 'Couchage',     490,  12.00, 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80', 'Sac de couchage Sea to Summit Spark SP1 disponible à la location',       4.6,  34, true, 'location', 0),
  ('cumulus-panyam-450-occasion',     'Cumulus Panyam 450',           'Cumulus',       'Couchage',     700, 165.00, 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80', 'Sac de couchage Cumulus Panyam 450 occasion comme neuf',                  4.7,  18, true, 'occasion', 124)
ON CONFLICT (slug) DO NOTHING;

-- ── 4. ÉCLAIRAGE ────────────────────────────────────────────────────────────
INSERT INTO public.shop_products (slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, savings)
VALUES
  ('petzl-actik-core-achat',          'Petzl Actik Core',             'Petzl',         'Éclairage',     85,  49.00, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', 'Lampe frontale Petzl Actik Core rouge rechargeable sur fond blanc',       4.6, 423, true, 'achat',    0),
  ('black-diamond-spot-400-achat',    'Black Diamond Spot 400',       'Black Diamond', 'Éclairage',     91,  39.00, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', 'Lampe frontale Black Diamond Spot 400 lumens noire imperméable',          4.5, 287, true, 'achat',    0),
  ('petzl-swift-rl-achat',            'Petzl Swift RL',               'Petzl',         'Éclairage',     95,  89.00, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', 'Lampe frontale Petzl Swift RL 900 lumens rechargeable noire',             4.8, 178, true, 'achat',    0),
  ('ledlenser-mh10-achat',            'Ledlenser MH10',               'Ledlenser',     'Éclairage',    100,  69.00, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', 'Lampe frontale Ledlenser MH10 600 lumens bleue rechargeable',             4.6, 134, true, 'achat',    0),
  ('petzl-actik-core-occasion',       'Petzl Actik Core',             'Petzl',         'Éclairage',     85,  28.00, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', 'Lampe frontale Petzl Actik Core occasion très bon état',                  4.4,  18, true, 'occasion',  21)
ON CONFLICT (slug) DO NOTHING;

-- ── 5. EAU & FILTRATION ─────────────────────────────────────────────────────
INSERT INTO public.shop_products (slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, savings)
VALUES
  ('katadyn-befree-1l-achat',         'Katadyn BeFree 1L',            'Katadyn',       'Eau',           56,  44.00, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', 'Filtre à eau Katadyn BeFree 1 litre bleu transparent souple',             4.7, 334, true, 'achat',    0),
  ('sawyer-squeeze-achat',            'Sawyer Squeeze Filter',        'Sawyer',        'Eau',           85,  39.00, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', 'Filtre à eau Sawyer Squeeze bleu avec poches souples et adaptateur',     4.8, 456, true, 'achat',    0),
  ('lifestraw-peak-series-achat',     'LifeStraw Peak Series',        'LifeStraw',     'Eau',           45,  49.00, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', 'Filtre à eau LifeStraw Peak Series orange avec sac de filtration',       4.6, 212, true, 'achat',    0),
  ('msr-trailshot-achat',             'MSR TrailShot',                'MSR',           'Eau',          142,  49.00, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', 'Filtre à eau MSR TrailShot pompe manuelle rouge compact',                 4.5, 167, true, 'achat',    0),
  ('platypus-gravityworks-4l-achat',  'Platypus GravityWorks 4L',     'Platypus',      'Eau',          178,  79.00, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', 'Système filtration gravité Platypus GravityWorks 4 litres vert',         4.7, 145, true, 'achat',    0)
ON CONFLICT (slug) DO NOTHING;

-- ── 6. NAVIGATION ───────────────────────────────────────────────────────────
INSERT INTO public.shop_products (slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, savings)
VALUES
  ('garmin-inreach-mini-2-achat',     'Garmin inReach Mini 2',        'Garmin',        'Navigation',   100, 349.00, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', 'Communicateur satellite Garmin inReach Mini 2 orange avec antenne',      4.9, 178, true, 'achat',    0),
  ('garmin-gpsmap-66i-achat',         'Garmin GPSMAP 66i',            'Garmin',        'Navigation',   230, 599.00, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', 'GPS satellite Garmin GPSMAP 66i avec messagerie inReach jaune',          4.8, 134, true, 'achat',    0),
  ('suunto-core-all-black-achat',     'Suunto Core All Black',        'Suunto',        'Navigation',    80,  89.00, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', 'Montre boussole altimètre Suunto Core All Black noire sport',             4.6, 267, true, 'achat',    0),
  ('silva-ranger-compass-achat',      'Silva Ranger 2.0',             'Silva',         'Navigation',    65,  39.00, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', 'Boussole Silva Ranger 2.0 transparente avec miroir de visée',            4.7, 312, true, 'achat',    0),
  ('garmin-inreach-mini-2-location',  'Garmin inReach Mini 2',        'Garmin',        'Navigation',   100,  15.00, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', 'Communicateur satellite Garmin inReach Mini 2 disponible à la location', 4.8,  42, true, 'location', 0)
ON CONFLICT (slug) DO NOTHING;

-- ── 7. VÊTEMENTS ────────────────────────────────────────────────────────────
INSERT INTO public.shop_products (slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, savings)
VALUES
  ('arcteryx-beta-ar-achat',          'Arc''teryx Beta AR',           'Arc''teryx',    'Vêtements',    485, 699.00, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', 'Veste imperméable Arc''teryx Beta AR rouge Gore-Tex randonnée',           4.9,  89, true, 'achat',    0),
  ('patagonia-torrentshell-achat',    'Patagonia Torrentshell 3L',    'Patagonia',     'Vêtements',    397, 229.00, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', 'Veste imperméable Patagonia Torrentshell 3L bleue légère',               4.7, 234, true, 'achat',    0),
  ('rab-microlight-alpine-achat',     'Rab Microlight Alpine',        'Rab',           'Vêtements',    340, 249.00, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', 'Doudoune Rab Microlight Alpine noire ultra compressible duvet',          4.8, 178, true, 'achat',    0),
  ('salomon-xa-pro-3d-achat',         'Salomon XA Pro 3D v8',         'Salomon',       'Vêtements',    340, 139.00, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80', 'Chaussures trail Salomon XA Pro 3D v8 grises et bleues imperméables',   4.7, 456, true, 'achat',    0),
  ('arcteryx-beta-ar-occasion',       'Arc''teryx Beta AR',           'Arc''teryx',    'Vêtements',    485, 380.00, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', 'Veste Arc''teryx Beta AR occasion très bon état légère usure',           4.7,  31, true, 'occasion', 319),
  ('patagonia-torrentshell-occasion', 'Patagonia Torrentshell 3L',    'Patagonia',     'Vêtements',    397, 120.00, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', 'Veste Patagonia Torrentshell 3L occasion bon état',                      4.5,  22, true, 'occasion', 109)
ON CONFLICT (slug) DO NOTHING;

-- ── 8. CUISINE & RÉCHAUDS ───────────────────────────────────────────────────
INSERT INTO public.shop_products (slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, savings)
VALUES
  ('msr-pocketrocket-2-achat',        'MSR PocketRocket 2',           'MSR',           'Cuisine',       74,  49.00, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', 'Réchaud ultraléger MSR PocketRocket 2 argenté avec cartouche gaz',      4.8, 534, true, 'achat',    0),
  ('jetboil-flash-achat',             'Jetboil Flash',                'Jetboil',       'Cuisine',      371, 109.00, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', 'Système cuisson intégré Jetboil Flash orange 1 litre',                   4.7, 312, true, 'achat',    0),
  ('primus-lite-plus-achat',          'Primus Lite+ Stove',           'Primus',        'Cuisine',      100,  79.00, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', 'Réchaud Primus Lite+ avec régulateur de pression argent compact',        4.6, 189, true, 'achat',    0),
  ('snow-peak-titanium-mug-achat',    'Snow Peak Titanium Mug 450',   'Snow Peak',     'Cuisine',       80,  39.00, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', 'Mug titanium Snow Peak 450ml léger avec couvercle argent',               4.8, 267, true, 'achat',    0),
  ('sea-to-summit-x-pot-achat',       'Sea to Summit X-Pot 1.4L',     'Sea to Summit', 'Cuisine',     155,  59.00, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', 'Casserole pliable Sea to Summit X-Pot 1.4 litres rouge silicone',        4.5, 145, true, 'achat',    0),
  ('msr-pocketrocket-2-occasion',     'MSR PocketRocket 2',           'MSR',           'Cuisine',       74,  28.00, 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', 'Réchaud MSR PocketRocket 2 occasion comme neuf avec étui',               4.7,  34, true, 'occasion',  21)
ON CONFLICT (slug) DO NOTHING;

-- ── 9. SÉCURITÉ & PREMIERS SECOURS ─────────────────────────────────────────
INSERT INTO public.shop_products (slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, savings)
VALUES
  ('adventure-medical-kits-achat',    'Adventure Medical Kits 2.0',   'Adventure Med', 'Sécurité',     567,  79.00, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80', 'Trousse premiers secours Adventure Medical Kits 2.0 rouge complète',    4.7, 234, true, 'achat',    0),
  ('lifesystems-mountain-achat',      'Lifesystems Mountain First Aid','Lifesystems',  'Sécurité',     450,  59.00, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80', 'Trousse premiers secours Lifesystems Mountain rouge montagne',           4.6, 178, true, 'achat',    0),
  ('petzl-grigri-achat',              'Petzl GriGri+',                'Petzl',         'Sécurité',     175,  99.00, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80', 'Assureur Petzl GriGri+ rouge avec anti-panique escalade',               4.9, 312, true, 'achat',    0),
  ('black-diamond-momentum-achat',    'Black Diamond Momentum',       'Black Diamond', 'Sécurité',     280,  69.00, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80', 'Baudrier escalade Black Diamond Momentum rouge réglable',               4.7, 189, true, 'achat',    0),
  ('mammut-crag-sender-achat',        'Mammut Crag Sender',           'Mammut',        'Sécurité',     240,  79.00, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80', 'Baudrier escalade Mammut Crag Sender bleu léger sport',                 4.6, 145, true, 'achat',    0)
ON CONFLICT (slug) DO NOTHING;

-- ── 10. ÉLECTRONIQUE & ÉNERGIE ──────────────────────────────────────────────
INSERT INTO public.shop_products (slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, savings)
VALUES
  ('goal-zero-venture-35-achat',      'Goal Zero Venture 35',         'Goal Zero',     'Électronique', 298,  59.00, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80', 'Batterie solaire Goal Zero Venture 35 noire imperméable 35000 mAh',     4.6, 234, true, 'achat',    0),
  ('anker-powercore-20100-achat',     'Anker PowerCore 20100',        'Anker',         'Électronique', 356,  45.00, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80', 'Batterie externe Anker PowerCore 20100 mAh noire compacte',             4.8, 567, true, 'achat',    0),
  ('bigblue-28w-solar-achat',         'BigBlue 28W Solar Charger',    'BigBlue',       'Électronique', 520,  79.00, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80', 'Chargeur solaire BigBlue 28W pliable vert avec 3 panneaux',             4.5, 145, true, 'achat',    0),
  ('garmin-fenix-7-achat',            'Garmin Fenix 7',               'Garmin',        'Électronique', 79,  699.00, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80', 'Montre GPS multisport Garmin Fenix 7 noire avec bracelet silicone',    4.9, 312, true, 'achat',    0),
  ('garmin-fenix-7-location',         'Garmin Fenix 7',               'Garmin',        'Électronique', 79,   25.00, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80', 'Montre GPS Garmin Fenix 7 disponible à la location par semaine',       4.8,  28, true, 'location', 0)
ON CONFLICT (slug) DO NOTHING;

-- ── 11. ACCESSOIRES & DIVERS ────────────────────────────────────────────────
INSERT INTO public.shop_products (slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, savings)
VALUES
  ('sea-to-summit-ultra-sil-achat',   'Sea to Summit Ultra-Sil 20L',  'Sea to Summit', 'Accessoires',   68,  39.00, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Sac étanche Sea to Summit Ultra-Sil 20 litres bleu pliable',            4.7, 289, true, 'achat',    0),
  ('exped-fold-drybag-achat',         'Exped Fold Drybag 20L',        'Exped',         'Accessoires',   90,  29.00, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Sac étanche Exped Fold Drybag 20 litres orange rouleau',                4.6, 178, true, 'achat',    0),
  ('leatherman-wave-plus-achat',      'Leatherman Wave+',             'Leatherman',    'Accessoires',  247,  99.00, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Pince multifonction Leatherman Wave+ acier inoxydable 18 outils',       4.9, 456, true, 'achat',    0),
  ('gerber-suspension-nxt-achat',     'Gerber Suspension NXT',        'Gerber',        'Accessoires',  163,  49.00, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Pince multifonction Gerber Suspension NXT noire 15 outils',             4.6, 234, true, 'achat',    0),
  ('black-diamond-trekking-poles',    'Black Diamond Trail Ergo Cork', 'Black Diamond','Accessoires',  520, 119.00, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Bâtons de randonnée Black Diamond Trail Ergo Cork aluminium paire',    4.7, 189, true, 'achat',    0),
  ('leatherman-wave-plus-occasion',   'Leatherman Wave+',             'Leatherman',    'Accessoires',  247,  65.00, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Pince multifonction Leatherman Wave+ occasion très bon état',           4.8,  45, true, 'occasion',  34)
ON CONFLICT (slug) DO NOTHING;

-- ── 12. ENCHÈRES ────────────────────────────────────────────────────────────
INSERT INTO public.shop_products (slug, name, brand, category, weight_g, price_eur, image, image_alt, rating, review_count, available, transaction_type, starting_bid, ends_at, savings)
VALUES
  ('arcteryx-beta-ar-enchere',        'Arc''teryx Beta AR',           'Arc''teryx',    'Vêtements',    485, 290.00, 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80', 'Veste Arc''teryx Beta AR enchère en cours occasion',                     4.6,   8, true, 'enchere',  290.00, NOW() + INTERVAL '3 days',  409),
  ('osprey-atmos-ag-65-enchere',      'Osprey Atmos AG 65',           'Osprey',        'Sacs à dos',  2180, 150.00, 'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600&q=80', 'Sac à dos Osprey Atmos AG 65 enchère en cours',                          4.5,   5, true, 'enchere',  150.00, NOW() + INTERVAL '2 days',  199),
  ('msr-hubba-hubba-enchere',         'MSR Hubba Hubba NX 2P',        'MSR',           'Tentes',      1720, 280.00, 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 'Tente MSR Hubba Hubba NX 2P enchère édition limitée',                    4.7,   4, true, 'enchere',  280.00, NOW() + INTERVAL '5 days',  269),
  ('garmin-fenix-7-enchere',          'Garmin Fenix 7',               'Garmin',        'Électronique', 79, 450.00, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80', 'Montre GPS Garmin Fenix 7 enchère occasion très bon état',               4.8,  11, true, 'enchere',  450.00, NOW() + INTERVAL '4 days',  249),
  ('leatherman-wave-enchere',         'Leatherman Wave+',             'Leatherman',    'Accessoires',  247,  55.00, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80', 'Pince multifonction Leatherman Wave+ enchère occasion',                  4.7,   7, true, 'enchere',   55.00, NOW() + INTERVAL '1 day',    44)
ON CONFLICT (slug) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur insertion catalogue: %', SQLERRM;
END $$;
