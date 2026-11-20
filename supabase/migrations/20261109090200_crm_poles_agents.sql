-- ═══════════════════════════════════════════════════════════════════════════
-- M02 — crm_poles_agents  (03_MODELE_DE_DONNEES.md § 2 ; 02_ARCHITECTURE.md § 5)
-- Pôles, appartenances, agents, élévations, mode solo, règle d'autorisation
-- unique (admin.can / admin.assert_actor), réécriture de public.is_admin()
-- et public.is_moderateur().
--
-- Relevé 2026-11-09 : public.admin_roles contient 6 lignes, toutes
-- `super_admin` ; public.user_profiles.role vaut 'admin' pour ces 6 comptes et
-- 'user' pour les 170 autres. Il n'y a donc AUCUN rôle `admin`/`moderateur` à
-- migrer en appartenance de pôle (la migration est écrite pour être rejouable
-- si cela change). Les 6 comptes gardent tous leurs droits : public.is_admin()
-- continue de lire admin_roles(super_admin) ET user_profiles.role='admin'
-- (colonne dérivée conservée jusqu'à M15).
--
-- Note : la table admin.commands est créée ici (structure vide) parce que
-- admin.can() et admin.assert_actor() en dépendent ; M03 l'amorce avec les
-- 144 lignes du catalogue.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Pôles
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.poles (
  code        text primary key,
  label       text not null,
  description text not null default '',
  sort        smallint not null default 100,
  created_at  timestamptz not null default now()
);

alter table admin.poles drop constraint if exists poles_code_check;
alter table admin.poles add constraint poles_code_check
  check (code in ('CONF','MEMB','COMM','CONT','PRIA','CROI','TECH'));

insert into admin.poles (code, label, description, sort) values
  ('CONF','Confiance','Publications, stories, carnets, clubs, groupes et messagerie, avis, voyages et sécurité, recours.',10),
  ('MEMB','Membres','Comptes, support et notifications.',20),
  ('COMM','Commerce','Marketplace, catalogue, commandes et paiements, lignées de kits.',30),
  ('CONT','Contenus','Lieux et terrain, contenus et pays.',40),
  ('PRIA','Produit et IA','IA et coûts, réglages.',50),
  ('CROI','Croissance','Récompenses et progression, affiliation, campagnes.',60),
  ('TECH','Technique','Système, tâches, erreurs, intégrations.',70)
on conflict (code) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- Appartenances
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.staff_memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  pole_code  text not null references admin.poles (code),
  role       text not null default 'membre',
  created_at timestamptz not null default now(),
  created_by uuid,
  revoked_at timestamptz,
  constraint staff_memberships_role_check check (role in ('responsable','membre')),
  constraint staff_memberships_unique unique (user_id, pole_code)
);

create index if not exists staff_memberships_user_idx on admin.staff_memberships (user_id) where revoked_at is null;
create index if not exists staff_memberships_pole_idx on admin.staff_memberships (pole_code) where revoked_at is null;

-- Migration des rôles hérités (aucun aujourd'hui). Un rôle `admin` devient
-- super_admin ; un rôle `moderateur` deviendrait responsable du pôle Confiance
-- (le plus proche de son périmètre historique). Idempotent.
insert into public.admin_roles (user_id, role, created_by)
select ar.user_id, 'super_admin'::public.admin_role, null
  from public.admin_roles ar
 where ar.role = 'admin'
on conflict (user_id) do update set role = 'super_admin'::public.admin_role;

insert into admin.staff_memberships (user_id, pole_code, role)
select ar.user_id, 'CONF', 'responsable'
  from public.admin_roles ar
 where ar.role = 'moderateur'
on conflict (user_id, pole_code) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- Agents
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.agents (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  pole_code     text not null references admin.poles (code),
  name          text not null,
  objective     text not null default '',
  tools         text[] not null default '{}',
  hourly_cap    integer not null default 60,
  status        text not null default 'active',
  owner_id      uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint agents_status_check check (status in ('active','paused','stopped')),
  constraint agents_hourly_cap_check check (hourly_cap between 0 and 100000),
  constraint agents_name_check check (length(name) between 2 and 80)
);

create index if not exists agents_pole_idx on admin.agents (pole_code);
create index if not exists agents_auth_user_idx on admin.agents (auth_user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Élévations temporaires (T-03 : droit hors de son pôle, 1 h, motif)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.elevations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  command    text not null,
  reason     text not null,
  granted_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  revoked_at timestamptz,
  constraint elevations_reason_check check (length(btrim(reason)) between 3 and 500),
  constraint elevations_window_check check (expires_at > created_at)
);

create index if not exists elevations_user_idx on admin.elevations (user_id) where revoked_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- Propositions d'agents (écrites par M13/M14, affichées dans la file)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.agent_proposals (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid references admin.agents (id) on delete set null,
  command     text not null,
  params      jsonb not null default '{}'::jsonb,
  target_type text,
  target_id   text,
  rationale   text,
  status      text not null default 'pending',
  decided_by  uuid,
  decided_at  timestamptz,
  decision    text,
  created_at  timestamptz not null default now(),
  constraint agent_proposals_status_check check (status in ('pending','accepted','rejected'))
);

create index if not exists agent_proposals_pending_idx
  on admin.agent_proposals (created_at) where status = 'pending';

alter table admin.agent_proposals enable row level security;
revoke all on admin.agent_proposals from public, anon, authenticated;
grant select on admin.agent_proposals to authenticated;
grant select, insert, update on admin.agent_proposals to service_role;

drop policy if exists agent_proposals_read_staff on admin.agent_proposals;
create policy agent_proposals_read_staff on admin.agent_proposals
  for select to authenticated using (admin.is_staff());

-- ───────────────────────────────────────────────────────────────────────────
-- Registre des commandes (structure ; amorçage en M03)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.commands (
  id               text primary key,
  command          text not null unique,
  label            text not null,
  domain           text not null,
  pole_code        text not null references admin.poles (code),
  role_min         text not null default 'membre',
  needs_validation boolean not null default false,
  reason_required  boolean not null default false,
  undoable         boolean not null default false,
  agent_allowed    text not null default 'never',
  realtime         text not null default 'P3',
  enabled          boolean not null default true,
  sort             smallint not null default 100,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint commands_role_min_check check (role_min in ('membre','responsable','super_admin')),
  constraint commands_agent_check check (agent_allowed in ('propose','read','never')),
  constraint commands_realtime_check check (realtime in ('P1','P2','P3')),
  constraint commands_id_check check (id ~ '^ACT-[0-9]{3}$'),
  constraint commands_command_check check (command ~ '^[a-z][a-z0-9_]{2,60}$')
);

create index if not exists commands_pole_idx on admin.commands (pole_code);
create index if not exists commands_sort_idx on admin.commands (sort, id);

alter table admin.agent_proposals    enable row level security;
alter table admin.poles              enable row level security;
alter table admin.staff_memberships  enable row level security;
alter table admin.agents             enable row level security;
alter table admin.elevations         enable row level security;
alter table admin.commands           enable row level security;

revoke all on admin.poles, admin.staff_memberships, admin.agents, admin.elevations, admin.commands, admin.agent_proposals
  from public, anon, authenticated;
grant select on admin.poles, admin.staff_memberships, admin.agents, admin.elevations, admin.commands, admin.agent_proposals
  to authenticated;
grant select, insert, update, delete on admin.poles, admin.staff_memberships, admin.agents, admin.elevations, admin.commands, admin.agent_proposals
  to service_role;

drop policy if exists poles_read_staff on admin.poles;
create policy poles_read_staff on admin.poles for select to authenticated using (admin.is_staff());

drop policy if exists staff_memberships_read_staff on admin.staff_memberships;
create policy staff_memberships_read_staff on admin.staff_memberships
  for select to authenticated using (admin.is_staff());

drop policy if exists agents_read_staff on admin.agents;
create policy agents_read_staff on admin.agents for select to authenticated using (admin.is_staff());

drop policy if exists elevations_read_own on admin.elevations;
create policy elevations_read_own on admin.elevations
  for select to authenticated using ((select auth.uid()) = user_id or admin.is_staff());

drop policy if exists agent_proposals_read_staff on admin.agent_proposals;
create policy agent_proposals_read_staff on admin.agent_proposals
  for select to authenticated using (admin.is_staff());

drop policy if exists commands_read_staff on admin.commands;
create policy commands_read_staff on admin.commands for select to authenticated using (admin.is_staff());

-- ───────────────────────────────────────────────────────────────────────────
-- Prédicats d'appartenance
-- ───────────────────────────────────────────────────────────────────────────
-- Équipe humaine : agents EXCLUS (ils n'ont ni canal ni journal humains).
create or replace function admin.is_team_member(p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with u as (select coalesce(p_user, (select auth.uid())) as id)
  select exists (
      select 1 from public.admin_roles ar, u where ar.user_id = u.id and u.id is not null
    )
    or exists (
      select 1 from admin.staff_memberships sm, u
       where sm.user_id = u.id and u.id is not null and sm.revoked_at is null
    );
$$;

create or replace function admin.is_super_admin_for(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_roles ar
     where ar.user_id = p_user and ar.role in ('super_admin','admin')
  );
$$;

create or replace function admin.is_responsable(p_pole text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from admin.staff_memberships sm
     where sm.user_id = (select auth.uid())
       and sm.revoked_at is null
       and sm.role = 'responsable'
       and (p_pole is null or sm.pole_code = p_pole)
  );
$$;

create or replace function admin.poles_of(p_user uuid default null)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(sm.pole_code order by sm.pole_code), '{}')
    from admin.staff_memberships sm
   where sm.user_id = coalesce(p_user, (select auth.uid()))
     and sm.revoked_at is null;
$$;

-- Rôle effectif : super_admin > responsable > membre > null.
create or replace function admin.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when admin.is_super_admin_for((select auth.uid())) then 'super_admin'
           when exists (select 1 from admin.staff_memberships sm
                         where sm.user_id = (select auth.uid()) and sm.revoked_at is null
                           and sm.role = 'responsable') then 'responsable'
           when exists (select 1 from admin.staff_memberships sm
                         where sm.user_id = (select auth.uid()) and sm.revoked_at is null) then 'membre'
           else null
         end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Mode solo
-- ───────────────────────────────────────────────────────────────────────────
-- Nombre de comptes humains d'équipe actifs : super admins + appartenances,
-- comptes Auth non bannis et vus (ou créés) depuis moins de 90 jours.
-- Solo = au plus 1. Un compte inactif depuis 90 jours ne compte plus : sans
-- cela, six comptes dormants bloqueraient toute validation.
create or replace function admin.solo_mode()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  select count(distinct u.id) into v_n
    from auth.users u
   where u.id in (
           select ar.user_id from public.admin_roles ar
            union
           select sm.user_id from admin.staff_memberships sm where sm.revoked_at is null
         )
     and (u.banned_until is null or u.banned_until < now())
     and (u.deleted_at is null)
     and coalesce(u.last_sign_in_at, u.created_at) > now() - interval '90 days';

  return coalesce(v_n, 0) <= 1;
exception when others then
  -- auth.users illisible (rôle inattendu) : on ne prend pas le risque d'ouvrir
  -- l'auto-validation.
  return false;
end;
$$;

create or replace function admin.is_solo_mode()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select admin.solo_mode();
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Règle d'autorisation unique
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.command_row(p_command text)
returns admin.commands
language sql
stable
security definer
set search_path = ''
as $$
  select * from admin.commands c where c.command = p_command;
$$;

-- human_role_of : rôle d'équipe d'une personne (sans MFA), pour les vues.
create or replace function admin.human_role_of(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when admin.is_super_admin_for(p_user) then 'super_admin'
           when exists (select 1 from admin.staff_memberships sm
                         where sm.user_id = p_user and sm.revoked_at is null and sm.role = 'responsable')
             then 'responsable'
           when exists (select 1 from admin.staff_memberships sm
                         where sm.user_id = p_user and sm.revoked_at is null)
             then 'membre'
           else null
         end;
$$;

-- Peut lancer la commande ? (humains et agents ; aucune exception levée)
create or replace function admin.can(p_actor uuid, p_command text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cmd   admin.commands;
  v_role  text;
  v_poles text[];
  v_agent admin.agents;
begin
  if p_actor is null or p_command is null then
    return false;
  end if;

  select * into v_cmd from admin.commands c where c.command = p_command;
  if not found or not v_cmd.enabled then
    return false;
  end if;

  -- Agent ?
  select * into v_agent from admin.agents a where a.auth_user_id = p_actor;
  if found then
    return v_agent.status = 'active'
       and v_cmd.agent_allowed <> 'never'
       and p_command = any (v_agent.tools);
  end if;

  v_role := admin.human_role_of(p_actor);
  if v_role is null then
    return false;
  end if;
  if v_role = 'super_admin' then
    return true;
  end if;

  v_poles := admin.poles_of(p_actor);
  if not (v_cmd.pole_code = any (v_poles)) then
    -- élévation temporaire valable ?
    return exists (
      select 1 from admin.elevations e
       where e.user_id = p_actor and e.command = p_command
         and e.revoked_at is null and e.expires_at > now()
    );
  end if;

  if v_role = 'responsable' then
    return true;
  end if;

  return v_cmd.role_min = 'membre'
      or exists (
        select 1 from admin.elevations e
         where e.user_id = p_actor and e.command = p_command
           and e.revoked_at is null and e.expires_at > now()
      );
end;
$$;

-- Contrôle complet de l'acteur pour une commande : session, MFA (humains),
-- agent (statut + allowlist), registre, pôle, rôle minimal, élévation.
create or replace function admin.assert_actor(p_command text)
returns table (
  user_id      uuid,
  actor_role   text,
  actor_kind   text,
  pole_code    text,
  min_role     text,
  is_agent     boolean,
  agent_id     uuid,
  display_name text,
  solo         boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_aal   text := coalesce((select auth.jwt()) ->> 'aal', 'aal1');
  v_cmd   admin.commands;
  v_agent admin.agents;
  v_role  text;
  v_poles text[];
  v_name  text;
begin
  if v_uid is null then
    raise exception 'CRM : session absente.' using errcode = '42501', hint = 'not_allowed';
  end if;

  select * into v_cmd from admin.commands c where c.command = p_command;
  if not found then
    raise exception 'CRM : commande inconnue (%).', p_command using errcode = '0A000', hint = 'unknown_command';
  end if;
  if not v_cmd.enabled then
    raise exception 'CRM : commande désactivée (%).', p_command using errcode = '42501', hint = 'command_disabled';
  end if;

  select * into v_agent from admin.agents a where a.auth_user_id = v_uid;

  if found then
    -- Agents : pas de MFA possible, mais statut vérifié à chaque appel et
    -- allowlist d'outils stricte. Un agent ne valide jamais (M04).
    if v_agent.status = 'stopped' then
      raise exception 'CRM : agent arrêté.' using errcode = '53400', hint = 'agent_stopped';
    end if;
    if v_agent.status = 'paused' then
      raise exception 'CRM : agent en pause.' using errcode = '53400', hint = 'agent_paused';
    end if;
    if v_cmd.agent_allowed = 'never' or not (p_command = any (v_agent.tools)) then
      raise exception 'CRM : outil hors de la liste de l''agent.' using errcode = '42501', hint = 'agent_not_allowed';
    end if;
    return query select v_uid, 'agent'::text, 'agent'::text, v_agent.pole_code, v_cmd.role_min,
                        true, v_agent.id, v_agent.name, admin.solo_mode();
    return;
  end if;

  if v_aal <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;

  v_role := admin.human_role_of(v_uid);
  if v_role is null then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  if v_role <> 'super_admin' then
    v_poles := admin.poles_of(v_uid);
    if not (v_cmd.pole_code = any (v_poles))
       and not exists (select 1 from admin.elevations e
                        where e.user_id = v_uid and e.command = p_command
                          and e.revoked_at is null and e.expires_at > now()) then
      raise exception 'CRM : commande hors de votre pôle (%).', v_cmd.pole_code
        using errcode = '42501', hint = 'not_allowed';
    end if;
    if v_cmd.role_min = 'responsable' and v_role <> 'responsable' then
      raise exception 'CRM : rôle responsable requis.' using errcode = '42501', hint = 'role_too_low';
    end if;
    if v_cmd.role_min = 'super_admin' then
      raise exception 'CRM : super admin requis.' using errcode = '42501', hint = 'role_too_low';
    end if;
  end if;

  select coalesce(nullif(btrim(up.full_name), ''), 'Équipe')
    into v_name
    from public.user_profiles up
   where up.id = v_uid;

  return query select v_uid, v_role, 'human'::text, v_cmd.pole_code, v_cmd.role_min,
                      false, null::uuid, coalesce(v_name, 'Équipe'), admin.solo_mode();
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Compatibilité LKDV
-- ───────────────────────────────────────────────────────────────────────────
-- is_admin : super admin (nouvelle source) OU colonne dérivée historique
-- user_profiles.role='admin' (conservée jusqu'à M15). Les 6 comptes actuels
-- restent administrateurs par les deux voies.
--
-- DÉCISION (moindre privilège) : les responsables de pôle ne sont PAS
-- administrateurs LKDV. public.is_admin() ouvre des lectures larges dans les
-- policies existantes (user_profiles, notifications) ; un responsable de pôle
-- passe par admin.is_team_member() et par les commandes de son pôle. Élargir
-- is_admin() exposerait e-mail et téléphone de tous les membres à 7 pôles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select admin.is_super_admin_for((select auth.uid()))
      or exists (
           select 1 from public.user_profiles up
            where up.id = (select auth.uid()) and up.role = 'admin'
         );
$$;

-- is_moderateur : tout membre d'équipe (héritage admin_roles + appartenances),
-- agents exclus. Élargissement voulu par le chantier (un membre de pôle modère).
create or replace function public.is_moderateur()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select admin.is_team_member();
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Droits
-- ───────────────────────────────────────────────────────────────────────────
revoke all on function admin.is_team_member(uuid) from public, anon;
revoke all on function admin.is_super_admin_for(uuid) from public, anon;
revoke all on function admin.is_responsable(text) from public, anon;
revoke all on function admin.poles_of(uuid) from public, anon;
revoke all on function admin.solo_mode() from public, anon;
revoke all on function admin.is_solo_mode() from public, anon;
revoke all on function admin.command_row(text) from public, anon;
revoke all on function admin.human_role_of(uuid) from public, anon;
revoke all on function admin.can(uuid, text) from public, anon;
revoke all on function admin.assert_actor(text) from public, anon;

grant execute on function admin.is_team_member(uuid) to authenticated, service_role;
grant execute on function admin.is_super_admin_for(uuid) to authenticated, service_role;
grant execute on function admin.is_responsable(text) to authenticated, service_role;
grant execute on function admin.poles_of(uuid) to authenticated, service_role;
grant execute on function admin.solo_mode() to authenticated, service_role;
grant execute on function admin.is_solo_mode() to authenticated, service_role;
grant execute on function admin.command_row(text) to authenticated, service_role;
grant execute on function admin.human_role_of(uuid) to authenticated, service_role;
grant execute on function admin.can(uuid, text) to authenticated, service_role;
grant execute on function admin.assert_actor(text) to authenticated, service_role;

comment on function admin.assert_actor(text) is
  'LKDV Control : garde unique des commandes. Vérifie session, aal2, statut et allowlist d''agent, registre, pôle, rôle minimal, élévation. Marqueurs : not_allowed, mfa_required, role_too_low, agent_stopped, agent_paused, agent_not_allowed, unknown_command, command_disabled.';
comment on function admin.can(uuid, text) is
  'LKDV Control : même règle que assert_actor, sans exception (booléen) — utilisé par l''UI et les tests de matrice.';
comment on function admin.solo_mode() is
  'LKDV Control : vrai si au plus un compte humain d''équipe est actif (vu ou créé depuis 90 jours, non banni).';

-- Revue LKDV (plan 2.4) : EXECUTE retiré à PUBLIC, puis accordé explicitement.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
revoke all on function public.is_moderateur() from public, anon;
grant execute on function public.is_moderateur() to authenticated, service_role;
revoke all on function admin.my_role() from public, anon;
grant execute on function admin.my_role() to authenticated, service_role;
