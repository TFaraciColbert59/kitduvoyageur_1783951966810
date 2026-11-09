-- ═══════════════════════════════════════════════════════════════════════════
-- M04 — crm_requests  (03_MODELE_DE_DONNEES.md § 2 ; 02_ARCHITECTURE.md § 6)
-- Demandes à deux personnes, empreinte des paramètres, validation, refus,
-- expiration 72 h, notification au membre.
--
-- Règles portées ici :
--   * une commande `needs_validation` crée TOUJOURS une demande, y compris en
--     mode solo (le super admin valide lui-même, en deux temps — EX-ROLE-07) ;
--   * l'approbateur ne peut pas être l'auteur, sauf mode solo ;
--   * l'empreinte SHA-256 des paramètres doit être inchangée à l'approbation ;
--   * un agent ne valide jamais ;
--   * une demande expirée (> 72 h) ne s'approuve plus.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists admin.requests (
  id            uuid primary key default gen_random_uuid(),
  command       text not null,
  params        jsonb not null default '{}'::jsonb,
  fingerprint   text not null,
  status        text not null default 'pending',
  target_type   text,
  target_id     text,
  actor_id      uuid not null,
  actor_role    text not null,
  actor_kind    text not null default 'human',
  solo          boolean not null default false,
  reason_code   text,
  reason_text   text,
  approver_id   uuid,
  approved_at   timestamptz,
  executed_at   timestamptz,
  expires_at    timestamptz not null default (now() + interval '72 hours'),
  result        jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint requests_status_check check (
    status in ('pending','approved','rejected','expired','executing','executed','failed')
  ),
  constraint requests_actor_kind_check check (actor_kind in ('human','agent','system')),
  constraint requests_fingerprint_check check (fingerprint ~ '^[0-9a-f]{64}$')
);

create index if not exists requests_status_idx on admin.requests (status, created_at desc);
create index if not exists requests_actor_idx on admin.requests (actor_id, created_at desc);
create index if not exists requests_command_idx on admin.requests (command, created_at desc);

alter table admin.requests enable row level security;
revoke all on admin.requests from public, anon, authenticated;
grant select on admin.requests to authenticated;
grant select, insert, update on admin.requests to service_role;

-- Lecture : l'auteur voit sa demande ; l'équipe voit tout (le détail de
-- validation est servi par admin.request_detail, qui contrôle plus finement).
drop policy if exists requests_read_staff on admin.requests;
create policy requests_read_staff on admin.requests
  for select to authenticated
  using (admin.is_staff() and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2');

-- ───────────────────────────────────────────────────────────────────────────
-- Empreinte
-- ───────────────────────────────────────────────────────────────────────────
-- sha256() est natif (pas de dépendance pgcrypto). jsonb::text trie les clés :
-- l'empreinte est stable pour des paramètres équivalents.
create or replace function admin.request_fingerprint(p_command text, p_params jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    sha256(convert_to(coalesce(p_command, '') || '|' || coalesce(p_params, '{}'::jsonb)::text, 'utf8')),
    'hex'
  );
$$;

revoke all on function admin.request_fingerprint(text, jsonb) from public, anon;
grant execute on function admin.request_fingerprint(text, jsonb) to authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Notification au membre
-- ───────────────────────────────────────────────────────────────────────────
-- Toujours via cette fonction : la table notifications n'a aucune policy
-- d'INSERT, donc seul le propriétaire (cette fonction DEFINER) écrit.
create or replace function admin.notify_member(
  p_user         uuid,
  p_type         text,
  p_title        text,
  p_message      text,
  p_link         text default null,
  p_related_type text default null,
  p_related_id   uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if p_user is null then
    return null;
  end if;
  insert into public.notifications (user_id, type, title, message, link, related_type, related_id, "group")
  values (p_user, p_type, p_title, p_message, p_link, p_related_type, p_related_id, 'system')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function admin.notify_member(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function admin.notify_member(uuid, text, text, text, text, text, uuid) to service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Création d'une demande (appelée par le moteur M13)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.request_create(
  p_command     text,
  p_params      jsonb,
  p_actor       uuid,
  p_actor_role  text,
  p_actor_kind  text,
  p_target_type text default null,
  p_target_id   text default null,
  p_reason_code text default null,
  p_reason_text text default null,
  p_solo        boolean default false)
returns admin.requests
language plpgsql
security definer
set search_path = ''
as $$
declare v_row admin.requests;
begin
  insert into admin.requests (
    command, params, fingerprint, status, target_type, target_id,
    actor_id, actor_role, actor_kind, solo, reason_code, reason_text
  ) values (
    p_command, coalesce(p_params, '{}'::jsonb), admin.request_fingerprint(p_command, p_params),
    'pending', p_target_type, p_target_id,
    p_actor, coalesce(p_actor_role, 'agent'), coalesce(p_actor_kind, 'human'),
    coalesce(p_solo, false), p_reason_code, p_reason_text
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function admin.request_create(text, jsonb, uuid, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function admin.request_create(text, jsonb, uuid, text, text, text, text, text, text, boolean)
  to service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Lecture : file des demandes + détail
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.requests_pending()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_solo boolean; v_role text;
begin
  if not admin.is_staff() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;

  v_solo := admin.solo_mode();
  v_role := admin.my_role();

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'command', r.command,
               'label', c.label,
               'pole', c.pole_code,
               'needsValidation', c.needs_validation,
               'params', r.params,
               'fingerprint', r.fingerprint,
               'confirmation', left(r.fingerprint, 8),
               'targetType', r.target_type,
               'targetId', r.target_id,
               'actorId', r.actor_id,
               'actorRole', r.actor_role,
               'actorKind', r.actor_kind,
               'reasonCode', r.reason_code,
               'reasonText', r.reason_text,
               'solo', r.solo,
               'createdAt', r.created_at,
               'expiresAt', r.expires_at,
               'overdue', r.expires_at < now(),
               -- qui peut valider : un autre humain du même pôle (ou n'importe
               -- quel humain autorisé sur la commande), jamais l'auteur hors solo,
               -- jamais un agent.
               'canApprove', (
                 r.status = 'pending' and r.expires_at > now()
                 and not exists (select 1 from admin.agents a where a.auth_user_id = v_me)
                 and (r.actor_id <> v_me or (r.solo and v_solo))
                 and admin.can(v_me, r.command)
               )
             ) order by
                 case when r.expires_at < now() then 0 else 1 end,
                 r.created_at)
        from admin.requests r
        left join admin.commands c on c.command = r.command
       where r.status = 'pending'
    ), '[]'::jsonb),
    'solo', v_solo,
    'role', v_role,
    'count', (select count(*) from admin.requests where status = 'pending')
  );
end;
$$;

create or replace function admin.request_detail(p_request uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_r admin.requests; v_c admin.commands; v_me uuid := auth.uid();
begin
  if not admin.is_staff() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;

  select * into v_r from admin.requests r where r.id = p_request;
  if not found then
    raise exception 'CRM : demande introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;
  select * into v_c from admin.commands c where c.command = v_r.command;

  return jsonb_build_object(
    'id', v_r.id,
    'command', v_r.command,
    'label', v_c.label,
    'pole', v_c.pole_code,
    'params', v_r.params,
    'fingerprint', v_r.fingerprint,
    'confirmation', left(v_r.fingerprint, 8),
    'status', v_r.status,
    'targetType', v_r.target_type,
    'targetId', v_r.target_id,
    'actorId', v_r.actor_id,
    'actorRole', v_r.actor_role,
    'actorKind', v_r.actor_kind,
    'reasonCode', v_r.reason_code,
    'reasonText', v_r.reason_text,
    'solo', v_r.solo,
    'approverId', v_r.approver_id,
    'approvedAt', v_r.approved_at,
    'executedAt', v_r.executed_at,
    'createdAt', v_r.created_at,
    'expiresAt', v_r.expires_at,
    'result', v_r.result,
    'error', v_r.error,
    'canApprove', (
      v_r.status = 'pending' and v_r.expires_at > now()
      and not exists (select 1 from admin.agents a where a.auth_user_id = v_me)
      and (v_r.actor_id <> v_me or (v_r.solo and admin.solo_mode()))
      and admin.can(v_me, v_r.command)
    )
  );
end;
$$;

revoke all on function admin.requests_pending() from public, anon;
revoke all on function admin.request_detail(uuid) from public, anon;
grant execute on function admin.requests_pending() to authenticated, service_role;
grant execute on function admin.request_detail(uuid) to authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Validation / refus
-- ───────────────────────────────────────────────────────────────────────────
-- Le corps de admin.approve_request est remplacé en M13 (moteur) : c'est lui
-- qui sait appliquer l'effet. Ici : contrôle, empreinte, statut, verrouillage.
create or replace function admin.request_guard_approval(p_request uuid, p_confirmation text)
returns admin.requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r admin.requests;
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'CRM : session absente.' using errcode = '42501', hint = 'not_allowed';
  end if;

  select * into v_r from admin.requests r where r.id = p_request for update;
  if not found then
    raise exception 'CRM : demande introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;

  if exists (select 1 from admin.agents a where a.auth_user_id = v_me) then
    raise exception 'CRM : un agent ne valide jamais une demande.' using errcode = '42501', hint = 'agent_cannot_validate';
  end if;

  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;

  if v_r.status = 'expired' or v_r.expires_at <= now() then
    update admin.requests set status = 'expired', updated_at = now() where id = v_r.id and status = 'pending';
    raise exception 'CRM : demande expirée.' using errcode = 'P0001', hint = 'request_expired';
  end if;

  if v_r.status <> 'pending' then
    raise exception 'CRM : demande déjà traitée (%).', v_r.status using errcode = 'P0001', hint = 'not_pending';
  end if;

  if v_r.actor_id = v_me and not (v_r.solo and admin.solo_mode()) then
    raise exception 'CRM : la même personne ne peut pas valider sa propre demande.' using errcode = '42501', hint = 'self_approval';
  end if;

  if not admin.can(v_me, v_r.command) then
    raise exception 'CRM : vous ne pouvez pas valider cette commande.' using errcode = '42501', hint = 'not_allowed';
  end if;

  if admin.request_fingerprint(v_r.command, v_r.params) <> v_r.fingerprint
     or (p_confirmation is not null and left(v_r.fingerprint, 8) <> lower(btrim(p_confirmation))) then
    raise exception 'CRM : les paramètres ont changé depuis la demande ; recommencez.' using errcode = 'P0001', hint = 'fingerprint_mismatch';
  end if;

  return v_r;
end;
$$;

revoke all on function admin.request_guard_approval(uuid, text) from public, anon, authenticated;
grant execute on function admin.request_guard_approval(uuid, text) to service_role;

create or replace function admin.reject_request(p_request uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_r admin.requests; v_me uuid := auth.uid();
begin
  if not admin.is_staff() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;
  if exists (select 1 from admin.agents a where a.auth_user_id = v_me) then
    raise exception 'CRM : un agent ne valide jamais une demande.' using errcode = '42501', hint = 'agent_cannot_validate';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'CRM : un motif est requis pour refuser.' using errcode = '22023', hint = 'reason_required';
  end if;

  select * into v_r from admin.requests r where r.id = p_request for update;
  if not found then
    raise exception 'CRM : demande introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if v_r.status <> 'pending' then
    raise exception 'CRM : demande déjà traitée (%).', v_r.status using errcode = 'P0001', hint = 'not_pending';
  end if;

  update admin.requests
     set status = 'rejected', approver_id = v_me, approved_at = now(),
         reason_text = coalesce(reason_text, '') || ' | refus : ' || btrim(p_reason),
         updated_at = now()
   where id = v_r.id;

  perform admin.log(rtrim('request_reject:' || v_r.command, ':'), 'request', v_r.id::text,
                    v_r.reason_code, btrim(p_reason),
                    jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'rejected'),
                    v_r.id, v_me, v_r.solo);

  return jsonb_build_object('ok', true, 'status', 'rejected', 'message', 'Demande refusée.');
end;
$$;

revoke all on function admin.reject_request(uuid, text) from public, anon;
grant execute on function admin.reject_request(uuid, text) to authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Fin d'exécution (commandes à effet externe : Stripe, Resend, Auth)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.complete_request(
  p_request uuid,
  p_result  jsonb default null,
  p_error   text  default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r      admin.requests;
  v_failed boolean := p_error is not null or coalesce((p_result ->> 'ok')::boolean, true) = false;
  v_err    text := coalesce(p_error, case when coalesce((p_result ->> 'ok')::boolean, true) = false
                                          then coalesce(p_result ->> 'error', 'echec_externe') end);
  v_audit  bigint;
begin
  -- Appelée par la route serveur avec le jeton de la personne (aal2) ou par
  -- une tâche planifiée (service_role).
  if (select auth.uid()) is not null then
    if not admin.is_team_member((select auth.uid()))
       or coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
      raise exception 'CRM : accès réservé à l''équipe (MFA requise).' using errcode = '42501', hint = 'not_allowed';
    end if;
  elsif not admin.is_service_context() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  select * into v_r from admin.requests r where r.id = p_request for update;
  if not found then
    raise exception 'CRM : demande introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;

  update admin.requests
     set status = case when v_failed then 'failed' else 'executed' end,
         executed_at = now(),
         result = p_result,
         error = v_err,
         updated_at = now()
   where id = v_r.id;

  v_audit := admin.log(v_r.command, coalesce(v_r.target_type, 'request'),
                       coalesce(v_r.target_id, v_r.id::text),
                       v_r.reason_code, v_r.reason_text,
                       jsonb_build_object('status', v_r.status),
                       jsonb_build_object('status', case when v_failed then 'failed' else 'executed' end),
                       v_r.id, v_r.approver_id, v_r.solo,
                       null, false, null, v_r.actor_id);

  return jsonb_build_object(
    'ok', not v_failed,
    'status', case when v_failed then 'failed' else 'executed' end,
    'request_id', v_r.id,
    'audit_id', v_audit,
    'message', case when v_failed
                    then 'Effet externe en échec : la demande est marquée failed, aucune double exécution possible.'
                    else 'Demande clôturée.' end
  );
end;
$$;

revoke all on function admin.complete_request(uuid, jsonb, text) from public, anon;
grant execute on function admin.complete_request(uuid, jsonb, text) to authenticated, service_role;

comment on table admin.requests is
  'LKDV Control : demandes à deux personnes. Empreinte SHA-256 des paramètres, expiration 72 h, approbateur distinct de l''auteur (sauf mode solo), agent jamais approbateur.';
-- NB : admin.approve_request(uuid, text) est créée par M13 (moteur commun) ;
-- son commentaire est posé là-bas, pas ici (la fonction n'existe pas encore).
