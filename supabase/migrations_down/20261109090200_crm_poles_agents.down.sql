-- M02 — rollback. Restaure les définitions d'origine de public.is_admin() et
-- public.is_moderateur() (relevées en production le 2026-11-09).
drop function if exists admin.assert_actor(text);
drop function if exists admin.can(uuid, text);
drop function if exists admin.human_role_of(uuid);
drop function if exists admin.command_row(text);
drop function if exists admin.is_solo_mode();
drop function if exists admin.solo_mode();
drop function if exists admin.poles_of(uuid);
drop function if exists admin.is_responsable(text);
drop function if exists admin.is_super_admin_for(uuid);
drop function if exists admin.is_team_member(uuid);

drop policy if exists commands_read_staff on admin.commands;
drop policy if exists elevations_read_own on admin.elevations;
drop policy if exists agents_read_staff on admin.agents;
drop policy if exists staff_memberships_read_staff on admin.staff_memberships;
drop policy if exists poles_read_staff on admin.poles;

drop table if exists admin.elevations;
drop table if exists admin.agents;
drop table if exists admin.commands;
drop table if exists admin.staff_memberships;
drop table if exists admin.poles;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

create or replace function public.is_moderateur()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
SELECT EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid()
)
$$;
