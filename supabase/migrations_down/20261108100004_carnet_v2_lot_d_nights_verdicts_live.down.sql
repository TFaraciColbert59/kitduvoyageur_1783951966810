-- Rollback Lot D : nuits, verdicts du kit et position en direct pour Carnet v2
drop function if exists public.carnet_public_position(uuid);
drop table if exists public.carnet_live_positions cascade;
alter table public.carnets drop column if exists live_sharing;
drop policy if exists carnet_moments_participant_manage on public.carnet_moments;
drop policy if exists carnet_kit_items_participant_manage on public.carnet_kit_items;
alter table public.carnet_kit_items drop column if exists jours_utilises;
alter table public.carnet_kit_items drop column if exists verdict_note;
alter table public.carnet_kit_items drop column if exists verdict;
drop table if exists public.carnet_nights cascade;
