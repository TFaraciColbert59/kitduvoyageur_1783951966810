-- 2026-10-21 — RLS de la table système PostGIS spatial_ref_sys.
-- Nécessite un rôle owner (supabase_admin) ; le rôle postgres du Management API
-- n'est pas propriétaire de la table. À appliquer depuis le SQL Editor Supabase
-- ou avec un rôle owner. La donnée SRID n'est pas sensible, mais le linter
-- Supabase la signale comme exposée.

alter table public.spatial_ref_sys enable row level security;

drop policy if exists spatial_ref_sys_read on public.spatial_ref_sys;
create policy spatial_ref_sys_read
on public.spatial_ref_sys for select to anon, authenticated
using (true);
