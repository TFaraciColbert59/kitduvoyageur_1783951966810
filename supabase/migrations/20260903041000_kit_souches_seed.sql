-- ============================================================================
-- 20260903041000_kit_souches_seed.sql
-- Chantier « Lignées de kits » — Lot 4.4 : souches fondatrices (démarrage à froid).
--
-- Décision GATE 0 : le compte propriétaire des souches est un COMPTE SYSTÈME LKDV
-- dédié (uuid réservé, email lkdv-studio@). Les kits éditoriaux de la table
-- `kits` (catalogue) sont convertis en `materiel_kits` de souche :
--   is_souche = true, origin = 'souche_editoriale', is_public = true.
-- Les articles (kit_items) sont copiés avec un lien `product_id` vers
-- shop_products quand le slug correspond EXACTEMENT (sinon product_id = NULL).
--
-- Idempotent : tout est gardé par EXISTS / ON CONFLICT DO NOTHING.
-- item_key est GENERATED ALWAYS (jamais fourni à l'insert).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Compte système LKDV (propriétaire des souches)
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  '00000000-0000-4000-8000-0000000000a1',
  'authenticated',
  'authenticated',
  'lkdv-studio@lekitduvoyageur.com',
  '!',
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email)
VALUES (
  '00000000-0000-4000-8000-0000000000a1',
  'Le Studio LKDV',
  'lkdv-studio@lekitduvoyageur.com'
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2) Souches depuis le catalogue éditorial (kits → materiel_kits)
-- ----------------------------------------------------------------------------
INSERT INTO public.materiel_kits
  (user_id, name, description, season, total_weight_g, is_public,
   is_souche, origin, tags, created_at, updated_at)
SELECT
  '00000000-0000-4000-8000-0000000000a1',
  k.nom,
  k.description,
  NULL,                                   -- saison non renseignée au catalogue
  COALESCE(k.poids_total_g, 0),
  true,
  true,
  'souche_editoriale',
  COALESCE(k.tags, '{}'),
  now(), now()
FROM public.kits k
WHERE NOT EXISTS (
  SELECT 1 FROM public.materiel_kits m
  WHERE m.origin = 'souche_editoriale' AND m.name = k.nom
);

-- ----------------------------------------------------------------------------
-- 3) Articles des souches (kit_items → materiel_kit_items), lien catalogue si
--    slug EXACT (shop_products.slug), sinon NULL. item_key généré par la DB.
-- ----------------------------------------------------------------------------
INSERT INTO public.materiel_kit_items
  (kit_id, user_id, name, category, weight_g, quantity, is_checked, product_id)
SELECT
  m.id,
  '00000000-0000-4000-8000-0000000000a1',
  ki.nom,
  ki.categorie,
  COALESCE(ki.poids_g, 0),
  COALESCE(ki.quantite, 1),
  false,
  sp.id
FROM public.kits k
JOIN public.kit_items ki ON ki.kit_id = k.id
JOIN public.materiel_kits m
  ON m.origin = 'souche_editoriale' AND m.name = k.nom
LEFT JOIN public.shop_products sp
  ON sp.slug = ki.slug AND sp.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.materiel_kit_items mi
  WHERE mi.kit_id = m.id AND mi.name = ki.nom
);

-- ----------------------------------------------------------------------------
-- 4) Rapport (NOTICE)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_souches bigint;
  v_items   bigint;
  v_linked  bigint;
BEGIN
  SELECT count(*) INTO v_souches FROM public.materiel_kits
  WHERE is_souche = true AND origin = 'souche_editoriale';
  SELECT count(*) INTO v_items FROM public.materiel_kit_items mi
  JOIN public.materiel_kits m ON m.id = mi.kit_id
  WHERE m.is_souche = true AND m.origin = 'souche_editoriale';
  SELECT count(*) INTO v_linked FROM public.materiel_kit_items mi
  JOIN public.materiel_kits m ON m.id = mi.kit_id
  WHERE m.is_souche = true AND m.origin = 'souche_editoriale'
    AND mi.product_id IS NOT NULL;
  RAISE NOTICE '[souches] % kit(s) souche, % article(s), % lié(s) au catalogue',
    v_souches, v_items, v_linked;
END $$;