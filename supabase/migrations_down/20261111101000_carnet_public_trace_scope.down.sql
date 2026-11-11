-- Rollback de 20261111101000_carnet_public_trace_scope :
-- retire la vue simplifiée et rétablit le droit SELECT direct du rôle anon sur
-- public.hike_sessions (état constaté le 2026-11-11). Aucune policy n'a été
-- modifiée par la migration ; rien d'autre à restaurer.

drop view if exists public.hike_sessions_public;

grant select on public.hike_sessions to anon;
