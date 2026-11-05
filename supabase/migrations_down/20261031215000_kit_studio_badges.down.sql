-- Down Migration: 20261031215000_kit_studio_badges.down.sql
-- Description: Annulation complète de la table kit_placed_badges et de son trigger (Lot L7-5).

drop trigger if exists trg_kit_placed_badges_ownership on public.kit_placed_badges;
drop function if exists public.trg_enforce_kit_badge_ownership();
drop table if exists public.kit_placed_badges;
