-- Rollback Lot A : fonctions d'accès canoniques pour Carnet v2
drop index if exists public.idx_hike_sessions_carnet_id;
drop index if exists public.idx_carnet_collaborators_lookup;
drop function if exists public.can_view_carnet(uuid);
drop function if exists public.is_carnet_participant(uuid);
