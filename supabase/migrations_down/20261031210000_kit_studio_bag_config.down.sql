-- Down Migration: 20261031210000_kit_studio_bag_config.down.sql
-- Description: Annulation complète et propre de la configuration 3D de kit (Lot L1).

-- 1. Suppression du trigger et de la fonction de synchronisation d'alias
drop trigger if exists trg_materiel_kits_aliases_sync on public.materiel_kits;
drop function if exists public.trg_sync_materiel_kits_aliases();

-- 2. Suppression des colonnes ajoutées à materiel_kit_items
alter table public.materiel_kit_items
  drop column if exists slot_id,
  drop column if exists slot_order;

-- 3. Suppression des colonnes ajoutées à materiel_kits
alter table public.materiel_kits
  drop column if exists bag_model,
  drop column if exists bag_model_id,
  drop column if exists custom_parts,
  drop column if exists bag_parts,
  drop column if exists studio_revision;
