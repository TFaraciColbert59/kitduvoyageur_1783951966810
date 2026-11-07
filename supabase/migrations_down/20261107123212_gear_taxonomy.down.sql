-- Rollback de 20261107123212_gear_taxonomy
-- Ordre : view → index → colonnes ajoutées → fonction de classement → table de référence.
-- (Les policies de gear_functions tombent avec la table.)

-- 5) Vue de revue
drop view if exists public.gear_function_review;

-- 4) Index ajoutés
drop index if exists public.product_ownership_function_idx;
drop index if exists public.materiel_kit_items_function_idx;

-- 3) Colonnes ajoutées (les contraintes FK / CHECK tombent avec la colonne)
alter table public.product_ownership
  drop column if exists dims_mm,
  drop column if exists volume_ml,
  drop column if exists function_source,
  drop column if exists function_id;

alter table public.materiel_kit_items
  drop column if exists carry_mode,
  drop column if exists load_order,
  drop column if exists slot,
  drop column if exists zone,
  drop column if exists function_id;

-- 2) Fonction de classement
drop function if exists public.lkdv_classify_gear(text);

-- 1) Référentiel des fonctions
drop table if exists public.gear_functions;
