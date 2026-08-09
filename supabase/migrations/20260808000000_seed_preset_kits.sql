-- Migration: Seed Preset Kits
-- Description: Populate 3 preset kits using existing shop products

DO $$
DECLARE
  kit1_id UUID := gen_random_uuid();
  kit2_id UUID := gen_random_uuid();
  kit3_id UUID := gen_random_uuid();
BEGIN

-- 1. Kit Minimaliste
INSERT INTO public.kits (id, slug, nom, description, destination, saison, poids_total_g, prix_cents, nb_articles, difficulte, activite, image, alt, tags, featured)
VALUES
(
  kit1_id,
  'kit-minimaliste',
  'Kit Minimaliste Weekend',
  'Le kit parfait pour partir 2 jours avec le strict minimum.',
  'Europe',
  'Printemps / Été',
  3500,
  71700,
  4,
  'Débutant',
  'Randonnée',
  'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
  'Sac à dos Osprey',
  ARRAY['Minimaliste', 'Weekend', 'Léger'],
  true
);

INSERT INTO public.kit_items (kit_id, nom, categorie, poids_g, prix_cents, quantite, essentiel, slug, image, alt, sort_order)
VALUES
(kit1_id, 'Osprey Exos 58', 'Sacs à dos', 1080, 28900, 1, true, 'osprey-exos-58-achat', 'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600&q=80', 'Sac à dos', 1),
(kit1_id, 'MSR Hubba Hubba NX 2P', 'Tentes', 1720, 54900, 1, true, 'msr-hubba-hubba-nx-2-achat', 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 'Tente', 2),
(kit1_id, 'Sea to Summit Spark SP1', 'Couchage', 490, 29900, 1, true, 'sea-to-summit-spark-sp1-achat', 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80', 'Sac de couchage', 3),
(kit1_id, 'Therm-a-Rest NeoAir XLite', 'Couchage', 340, 21900, 1, false, 'thermarest-neoair-xlite-achat', 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80', 'Matelas', 4);

-- 2. Kit Trek Complet
INSERT INTO public.kits (id, slug, nom, description, destination, saison, poids_total_g, prix_cents, nb_articles, difficulte, activite, image, alt, tags, featured)
VALUES
(
  kit2_id,
  'kit-trek-complet',
  'Kit Trek Confort',
  'Un kit complet pour les randonnées de plus de 5 jours.',
  'Monde',
  '3 Saisons',
  4600,
  118600,
  4,
  'Intermédiaire',
  'Trek',
  'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600&q=80',
  'Sac à dos Osprey',
  ARRAY['Confort', 'Longue durée'],
  true
);

INSERT INTO public.kit_items (kit_id, nom, categorie, poids_g, prix_cents, quantite, essentiel, slug, image, alt, sort_order)
VALUES
(kit2_id, 'Osprey Atmos AG 65', 'Sacs à dos', 2180, 34900, 1, true, 'osprey-atmos-ag-65-achat', 'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600&q=80', 'Sac à dos', 1),
(kit2_id, 'Big Agnes Copper Spur HV UL2', 'Tentes', 1130, 59900, 1, true, 'big-agnes-copper-spur-hv-ul2', 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 'Tente', 2),
(kit2_id, 'Cumulus Panyam 450', 'Couchage', 700, 28900, 1, true, 'cumulus-panyam-450-achat', 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80', 'Sac de couchage', 3),
(kit2_id, 'NEMO Tensor Insulated', 'Couchage', 510, 18900, 1, false, 'nemo-tensor-insulated-achat', 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80', 'Matelas', 4);

-- 3. Kit Bivouac Éco
INSERT INTO public.kits (id, slug, nom, description, destination, saison, poids_total_g, prix_cents, nb_articles, difficulte, activite, image, alt, tags, featured)
VALUES
(
  kit3_id,
  'kit-bivouac-eco',
  'Kit Bivouac Éco (Occasion)',
  'L''équipement essentiel pour un petit budget avec du matériel d''occasion.',
  'Europe',
  'ÉtÉ',
  4600,
  68000,
  3,
  'Débutant',
  'Bivouac',
  'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80',
  'Tente montée',
  ARRAY['Occasion', 'Budget'],
  false
);

INSERT INTO public.kit_items (kit_id, nom, categorie, poids_g, prix_cents, quantite, essentiel, slug, image, alt, sort_order)
VALUES
(kit3_id, 'Osprey Atmos AG 65 (Occasion)', 'Sacs à dos', 2180, 19500, 1, true, 'osprey-atmos-ag-65-occasion', 'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=600&q=80', 'Sac à dos', 1),
(kit3_id, 'MSR Hubba Hubba NX 2P (Occasion)', 'Tentes', 1720, 32000, 1, true, 'msr-hubba-hubba-nx-2-occasion', 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80', 'Tente', 2),
(kit3_id, 'Cumulus Panyam 450 (Occasion)', 'Couchage', 700, 16500, 1, true, 'cumulus-panyam-450-occasion', 'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=600&q=80', 'Sac de couchage', 3);

END $$;
