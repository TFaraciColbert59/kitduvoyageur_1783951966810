-- BROUILLON — migration M01 « crm_admin_socle » (03_MODELE_DE_DONNEES.md)
-- Rédigé le 8/11/2026 à partir de l'état réel de la base. NON APPLIQUÉ.
-- À faire avant usage : relire l'état de la base, répéter sur Postgres éphémère avec
-- les tests pgTAP de M01, écrire le .down.sql, puis appliquer avec sauvegarde.

create schema if not exists admin;
revoke all on schema admin from public;
revoke all on schema admin from anon;
grant usage on schema admin to authenticated, service_role;

create or replace function admin.role_rank(r public.admin_role)
returns integer language sql immutable set search_path = '' as $$
  select case r when 'super_admin' then 3 when 'admin' then 2 when 'moderateur' then 1 else 0 end;
$$;

-- Rôle de la personne connectée, sans exiger la MFA (sert à l'écran de connexion).
create or replace function admin.my_role()
returns text language sql stable security definer set search_path = '' as $$
  select ar.role::text from public.admin_roles ar where ar.user_id = auth.uid();
$$;

-- Contrôle d'accès minimal (M02 ajoute pôles et agents via admin.assert_actor).
create or replace function admin.assert_staff(min_role public.admin_role default 'moderateur')
returns public.admin_role language plpgsql stable security definer set search_path = '' as $$
declare r public.admin_role;
begin
  if auth.uid() is null then
    raise exception 'CRM : session absente' using errcode = '42501';
  end if;
  select ar.role into r from public.admin_roles ar where ar.user_id = auth.uid();
  if r is null then
    raise exception 'CRM : accès réservé à l''équipe' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise' using errcode = '42501', hint = 'mfa_required';
  end if;
  if admin.role_rank(r) < admin.role_rank(min_role) then
    raise exception 'CRM : rôle % requis', min_role using errcode = '42501';
  end if;
  return r;
end; $$;

-- Journal d'audit en ajout seul.
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
  undo_of            bigint references admin.audit_log (id),
  sensitive_read     boolean not null default false
);
create index if not exists audit_log_target_idx on admin.audit_log (target_type, target_id, at desc);
create index if not exists audit_log_actor_idx  on admin.audit_log (actor_id, at desc);

alter table admin.audit_log enable row level security;
revoke all on admin.audit_log from public, anon, authenticated;
grant select on admin.audit_log to authenticated;
drop policy if exists audit_log_read_staff on admin.audit_log;
create policy audit_log_read_staff on admin.audit_log for select to authenticated
  using (
    exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid()))
    and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
  );

create or replace function admin.audit_log_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'admin.audit_log est en ajout seul (% refusé)', tg_op using errcode = '42501';
end; $$;

drop trigger if exists audit_log_no_update_delete on admin.audit_log;
create trigger audit_log_no_update_delete before update or delete on admin.audit_log
  for each row execute function admin.audit_log_immutable();
drop trigger if exists audit_log_no_truncate on admin.audit_log;
create trigger audit_log_no_truncate before truncate on admin.audit_log
  for each statement execute function admin.audit_log_immutable();
-- Écriture interne du journal, appelée par chaque admin.cmd_* dans sa transaction.
-- Pas d'EXECUTE pour authenticated : seules les fonctions admin (propriétaire) l'appellent.
create or replace function admin.log(
  p_action text, p_target_type text, p_target_id text,
  p_reason_code text default null, p_reason_text text default null,
  p_before jsonb default null, p_after jsonb default null,
  p_request_id uuid default null, p_second_approver uuid default null,
  p_solo boolean default false, p_undo_of bigint default null, p_sensitive_read boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_role text; v_kind text;
begin
  select ar.role::text into v_role from public.admin_roles ar where ar.user_id = auth.uid();
  -- M02 remplace ce calcul par admin.assert_actor (pôle, agent) ; 'system' pour les tâches planifiées.
  v_kind := case when auth.uid() is null then 'system' else 'human' end;
  insert into admin.audit_log (actor_id, actor_kind, actor_role, action, target_type, target_id,
    reason_code, reason_text, before, after, request_id, second_approver_id, solo, undo_of, sensitive_read)
  values (coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), v_kind, coalesce(v_role, 'system'),
    p_action, p_target_type, p_target_id, p_reason_code, p_reason_text, p_before, p_after,
    p_request_id, p_second_approver, p_solo, p_undo_of, p_sensitive_read)
  returning id into v_id;
  return v_id;
end; $$;

-- NB : la purge réglementaire (M11) passe par une fonction propriétaire dédiée
-- qui désactive ce déclencheur dans sa transaction uniquement, et se journalise elle-même.

-- Motifs de modération (texte au membre conforme DSA art. 17).
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
drop policy if exists reason_codes_read_staff on admin.reason_codes;
create policy reason_codes_read_staff on admin.reason_codes for select to authenticated
  using (exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid())));

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
  ('autre','Autre (préciser)','Ce contenu a été modéré par l''équipe. Le motif précis vous est indiqué ci-dessous.',1,false,999)
on conflict (code) do nothing;

create or replace function admin.member_notice(p_reason_code text, p_reason_text text, p_automated boolean default false)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(rc.member_text, 'Ce contenu a été modéré par l''équipe.')
    || case when nullif(btrim(p_reason_text), '') is not null then ' Précision : ' || btrim(p_reason_text) else '' end
    || case when p_automated then ' Un outil automatique a contribué à repérer ce contenu ; la décision a été prise par une personne.' else '' end
    || ' Vous pouvez contester cette décision pendant 6 mois depuis la notification, gratuitement ; une autre personne de l''équipe réexaminera votre demande.'
  from (select 1) s left join admin.reason_codes rc on rc.code = p_reason_code;
$$;

-- Realtime : canaux privés admin:* réservés à l'équipe humaine.
drop policy if exists "crm_staff_receive_admin_topics" on realtime.messages;
create policy "crm_staff_receive_admin_topics" on realtime.messages for select to authenticated
  using (
    realtime.topic() like 'admin:%'
    and exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid()))
  );

revoke execute on all functions in schema admin from public, anon;
revoke execute on function admin.audit_log_immutable() from authenticated;
revoke execute on function admin.log(text, text, text, text, text, jsonb, jsonb, uuid, uuid, boolean, bigint, boolean) from authenticated;
grant execute on function admin.my_role() to authenticated;
grant execute on function admin.assert_staff(public.admin_role) to authenticated;
grant execute on function admin.role_rank(public.admin_role) to authenticated;
grant execute on function admin.member_notice(text, text, boolean) to authenticated;
