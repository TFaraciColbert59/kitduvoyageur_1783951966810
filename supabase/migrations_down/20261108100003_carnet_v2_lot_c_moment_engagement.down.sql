-- Rollback Lot C : engagement par moment pour Carnet v2
drop table if exists public.carnet_moment_saves cascade;
drop table if exists public.carnet_moment_comments cascade;
drop table if exists public.carnet_moment_likes cascade;
drop function if exists public.can_view_carnet_moment(uuid);
