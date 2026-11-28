-- ═══════════════════════════════════════════════════════════════════════════
-- M01 — crm_admin_socle  (03_MODELE_DE_DONNEES.md § 2, brouillon sql/001_socle_admin.sql)
-- Schéma admin, rôles, contrôle d'accès, journal d'audit en ajout seul,
-- motifs, texte de notification au membre.
-- Idempotent : create schema if not exists / create or replace / drop … if exists.
-- Aucune donnée métier lue ni modifiée.
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists admin;

revoke all on schema admin from public;
revoke all on schema admin from anon;
grant usage on schema admin to authenticated, service_role;

comment on schema admin is
  'LKDV Control : schéma du plan de contrôle (rôles, registre de commandes, demandes, journal). Aucune table n''est lisible sans passer par une fonction qui contrôle l''acteur.';

-- ───────────────────────────────────────────────────────────────────────────
-- Rangs
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.role_rank(r public.admin_role)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case r
    when 'super_admin' then 3
    when 'admin'       then 2
    when 'moderateur'  then 1
    else 0
  end;
$$;

revoke all on function admin.role_rank(public.admin_role) from public, anon;
grant execute on function admin.role_rank(public.admin_role) to authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Identité de l'appelant
-- ───────────────────────────────────────────────────────────────────────────
-- Rôle d'équipe sans exigence de MFA : sert à l'écran de connexion et au
-- middleware, qui doivent distinguer « pas d'équipe » de « MFA manquante ».
-- M02 remplace ce corps pour ajouter les appartenances de pôle.
create or replace function admin.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ar.role::text
    from public.admin_roles ar
   where ar.user_id = (select auth.uid());
$$;

create or replace function admin.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_roles ar where ar.user_id = (select auth.uid())
  );
$$;

create or replace function admin.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_roles ar
     where ar.user_id = (select auth.uid())
       and ar.role = 'super_admin'
  );
$$;

-- Contrôle d'accès minimal (M02 ajoute pôles, agents et élévations via
-- admin.assert_actor). aal2 obligatoire : une session mot de passe seul ne
-- suffit jamais à lire ou écrire dans le plan de contrôle.
create or replace function admin.assert_staff(p_min_role public.admin_role default 'moderateur')
returns public.admin_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.admin_role;
  v_aal  text;
begin
  if auth.uid() is null then
    raise exception 'CRM : session absente.' using errcode = '42501', hint = 'not_allowed';
  end if;

  v_aal := coalesce((select auth.jwt()) ->> 'aal', 'aal1');
  if v_aal <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;

  select ar.role into v_role
    from public.admin_roles ar
   where ar.user_id = auth.uid();

  if v_role is null then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  if admin.role_rank(v_role) < admin.role_rank(p_min_role) then
    raise exception 'CRM : rôle % requis.', p_min_role using errcode = '42501', hint = 'role_too_low';
  end if;

  return v_role;
end;
$$;

-- Contexte « tâche serveur » : aucune personne connectée. Vrai pour
-- service_role (PostgREST) comme pour une connexion psql/pg_cron sans JWT.
-- À utiliser à la place de current_user : dans une fonction SECURITY DEFINER,
-- current_user vaut le propriétaire, pas l'appelant.
create or replace function admin.is_service_context()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) is null
     and coalesce((select auth.jwt()) ->> 'role', 'service_role') = 'service_role';
$$;

revoke all on function admin.is_service_context() from public, anon;
grant execute on function admin.is_service_context() to authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Journal d'audit — ajout seul
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.audit_log (
  id                 bigint generated always as identity primary key,
  at                 timestamptz not null default now(),
  actor_id           uuid not null,
  actor_kind         text not null check (actor_kind in ('human','agent','system')),
  actor_role         text not null,
  action             text not null check (length(action) between 3 and 80),
  target_type        text not null check (length(target_type) between 2 and 60),
  target_id          text not null,
  reason_code        text,
  reason_text        text check (reason_text is null or length(reason_text) <= 2000),
  before             jsonb,
  after              jsonb,
  request_id         uuid,
  second_approver_id uuid,
  solo               boolean not null default false,
  undo_of            bigint,
  sensitive_read     boolean not null default false,
  request_fingerprint text,
  client_info        jsonb
);

create index if not exists audit_log_target_idx on admin.audit_log (target_type, target_id, at desc);
create index if not exists audit_log_actor_idx  on admin.audit_log (actor_id, at desc);
create index if not exists audit_log_at_idx     on admin.audit_log (at desc);

alter table admin.audit_log enable row level security;
revoke all on admin.audit_log from public, anon, authenticated;
grant select on admin.audit_log to authenticated;
grant select, insert on admin.audit_log to service_role;

drop policy if exists audit_log_read_staff on admin.audit_log;
create policy audit_log_read_staff on admin.audit_log
  for select to authenticated
  using (
    admin.is_staff()
    and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
  );

create or replace function admin.audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'admin.audit_log est en ajout seul : % refusé.', tg_op
    using errcode = '42501', hint = 'not_allowed';
end;
$$;

drop trigger if exists audit_log_no_update on admin.audit_log;
create trigger audit_log_no_update
  before update on admin.audit_log
  for each row execute function admin.audit_log_immutable();

drop trigger if exists audit_log_no_delete on admin.audit_log;
create trigger audit_log_no_delete
  before delete on admin.audit_log
  for each row execute function admin.audit_log_immutable();

drop trigger if exists audit_log_no_truncate on admin.audit_log;
create trigger audit_log_no_truncate
  before truncate on admin.audit_log
  for each statement execute function admin.audit_log_immutable();

-- Écriture interne du journal. Pas d'EXECUTE pour authenticated : seules les
-- fonctions du schéma admin (propriétaire) et service_role l'appellent.
create or replace function admin.log(
  p_action            text,
  p_target_type       text,
  p_target_id         text,
  p_reason_code       text    default null,
  p_reason_text       text    default null,
  p_before            jsonb   default null,
  p_after             jsonb   default null,
  p_request_id        uuid    default null,
  p_second_approver   uuid    default null,
  p_solo              boolean default false,
  p_undo_of           bigint  default null,
  p_sensitive_read    boolean default false,
  p_fingerprint       text    default null,
  p_actor             uuid    default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   bigint;
  v_role text;
  v_kind text;
  v_uid  uuid := coalesce(p_actor, (select auth.uid()));
begin
  -- p_actor permet de journaliser au nom de l'auteur d'une demande validée
  -- (l'approbateur est alors second_approver_id). Sinon : la personne connectée.
  v_role := coalesce(admin.my_role(), 'system');
  v_kind := case
              when v_uid is null then 'system'
              when exists (select 1 from admin.agents a where a.auth_user_id = v_uid) then 'agent'
              else 'human'
            end;

  insert into admin.audit_log (
    actor_id, actor_kind, actor_role, action, target_type, target_id,
    reason_code, reason_text, before, after, request_id, second_approver_id,
    solo, undo_of, sensitive_read, request_fingerprint
  ) values (
    coalesce(v_uid, '00000000-0000-0000-0000-000000000000'::uuid),
    v_kind, v_role, p_action, p_target_type, coalesce(p_target_id, '-'),
    p_reason_code, p_reason_text, p_before, p_after, p_request_id, p_second_approver,
    p_solo, p_undo_of, p_sensitive_read, p_fingerprint
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function admin.log(text, text, text, text, text, jsonb, jsonb, uuid, uuid, boolean, bigint, boolean, text, uuid)
  from public, anon, authenticated;
grant execute on function admin.log(text, text, text, text, text, jsonb, jsonb, uuid, uuid, boolean, bigint, boolean, text, uuid)
  to service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Motifs (code obligatoire des actions disciplinaires)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.reason_codes (
  code           text primary key,
  label          text not null,
  member_text    text not null,
  severity       smallint not null check (severity between 1 and 3),
  zero_tolerance boolean not null default false,
  active         boolean not null default true,
  sort           smallint not null default 100
);

alter table admin.reason_codes enable row level security;
revoke all on admin.reason_codes from public, anon, authenticated;
grant select on admin.reason_codes to authenticated;
grant select, insert, update on admin.reason_codes to service_role;

drop policy if exists reason_codes_read_staff on admin.reason_codes;
create policy reason_codes_read_staff on admin.reason_codes
  for select to authenticated
  using (admin.is_staff());

insert into admin.reason_codes (code, label, member_text, severity, zero_tolerance, sort) values
  ('spam','Spam ou publicité','Ce contenu a été retiré car il s''agit de spam ou de publicité non autorisée (règles de la communauté, article « Spam »).',1,false,10),
  ('hors_sujet','Hors sujet','Ce contenu a été masqué car il ne correspond pas à l''objet de l''espace où il a été publié.',1,false,20),
  ('harcelement','Harcèlement ou insulte','Ce contenu a été retiré car il vise une personne de façon insultante ou répétée (règles de la communauté, article « Respect »).',2,false,30),
  ('haine','Discours haineux','Ce contenu a été retiré car il attaque des personnes en raison de leur origine, religion, genre, orientation ou handicap.',3,false,40),
  ('donnees_perso','Données personnelles d''autrui','Ce contenu a été retiré car il expose des informations personnelles d''une autre personne sans son accord.',2,false,50),
  ('lieu_sensible','Lieu sensible ou fragile','Ce contenu a été masqué car il révèle un lieu naturel fragile ou privé.',1,false,60),
  ('arnaque','Arnaque ou fraude','Ce contenu a été retiré car il présente un risque d''arnaque pour les membres.',3,false,70),
  ('contenu_sexuel','Contenu sexuel','Ce contenu a été retiré car il contient du contenu sexuel, interdit sur Le Kit du Voyageur.',3,false,80),
  ('violence','Violence ou danger','Ce contenu a été retiré car il montre ou encourage une violence ou une pratique dangereuse.',3,false,90),
  ('mineurs','Mise en danger de mineurs','Ce contenu a été retiré et le compte fermé pour mise en danger de mineurs. Les autorités compétentes peuvent être informées.',3,true,100),
  ('illegal','Contenu illégal','Ce contenu a été retiré car il est manifestement illicite.',3,false,110),
  ('securite','Sécurité des personnes','Ce contenu a été masqué car il expose des personnes à un danger (localisation précise, itinéraire risqué en cours).',3,true,120),
  ('impersonation','Usurpation d''identité','Ce contenu a été retiré car il se fait passer pour une autre personne ou pour LKDV.',2,false,130),
  ('autre','Autre (préciser)','Ce contenu a été modéré par l''équipe. Le motif précis vous est indiqué ci-dessous.',1,false,999)
on conflict (code) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- Texte au membre (DSA art. 17 : motif clair + voie de recours)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.member_notice(
  p_reason_code text,
  p_reason_text text default null,
  p_automated   boolean default false)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(rc.member_text, 'Ce contenu a été modéré par l''équipe.')
      || case when nullif(btrim(p_reason_text), '') is not null
              then ' Précision : ' || btrim(p_reason_text) else '' end
      || case when p_automated
              then ' Un outil automatique a contribué à repérer ce contenu ; la décision a été prise par une personne.' else '' end
      || ' Vous pouvez contester cette décision pendant 6 mois depuis la notification, gratuitement ; une autre personne de l''équipe réexaminera votre demande.'
    from (select 1) s
    left join admin.reason_codes rc on rc.code = p_reason_code;
$$;

revoke all on function admin.member_notice(text, text, boolean) from public, anon;
grant execute on function admin.member_notice(text, text, boolean) to authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Droits finaux du socle
-- ───────────────────────────────────────────────────────────────────────────
revoke all on function admin.my_role() from public, anon;
revoke all on function admin.is_staff() from public, anon;
revoke all on function admin.is_super_admin() from public, anon;
revoke all on function admin.assert_staff(public.admin_role) from public, anon;

grant execute on function admin.my_role() to authenticated, service_role;
grant execute on function admin.is_staff() to authenticated, service_role;
grant execute on function admin.is_super_admin() to authenticated, service_role;
grant execute on function admin.assert_staff(public.admin_role) to authenticated, service_role;

comment on function admin.my_role() is
  'LKDV Control : rôle d''équipe de la personne connectée (super_admin, responsable, membre) ou null. Aucune exigence de MFA : usage middleware.';
comment on function admin.assert_staff(public.admin_role) is
  'LKDV Control : garde minimale — session + aal2 + rôle d''équipe >= min_role. Lève not_allowed / mfa_required / role_too_low.';
comment on table admin.audit_log is
  'LKDV Control : journal en ajout seul. UPDATE, DELETE et TRUNCATE sont refusés par déclencheur. Chaque ligne est reliée à une action, un acteur et, si applicable, une demande (request_id).';
