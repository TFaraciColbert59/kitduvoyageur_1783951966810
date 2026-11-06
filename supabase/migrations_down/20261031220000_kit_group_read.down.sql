-- Down Migration: 20261031220000_kit_group_read.down.sql
-- Description: Annulation complète des policies de lecture groupe et du drapeau is_shared_with_group (Lot L7-2).

drop policy if exists "kit_placed_badges_select_group" on public.kit_placed_badges;
drop policy if exists "materiel_kit_items_select_group" on public.materiel_kit_items;
drop policy if exists "materiel_kits_select_group" on public.materiel_kits;
drop function if exists public.can_read_member_kit(uuid, uuid);
drop index if exists public.idx_materiel_kits_shared_group;

alter table public.materiel_kits
  drop column if exists is_shared_with_group;
