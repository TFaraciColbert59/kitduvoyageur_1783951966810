-- Rollback de 20261112090000_carnet_v2_friends_read.sql
drop policy if exists hike_sessions_select_shared_carnet on public.hike_sessions;
drop policy if exists carnets_select_can_view on public.carnets;
