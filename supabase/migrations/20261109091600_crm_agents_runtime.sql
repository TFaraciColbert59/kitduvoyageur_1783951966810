-- ═══════════════════════════════════════════════════════════════════════════
-- M14 — crm_agents_runtime  (02_ARCHITECTURE.md § 8 ; 03_MODELE_DE_DONNEES.md § 2)
-- File d'exécution des agents, plafond horaire, autorisation d'outil,
-- propositions, arrêt immédiat.
--
-- Les comptes de service (auth.users) des 6 agents sont créés par un script
-- côté serveur (Auth admin API) : cette migration ne crée aucun compte et ne
-- contient aucun secret. Elle crée les 6 lignes admin.agents, inactives
-- (status = 'paused', auth_user_id nul) jusqu'au rattachement du compte.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- File
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.agent_jobs (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references admin.agents (id) on delete cascade,
  job             text not null,
  idempotency_key text,
  status          text not null default 'queued',
  payload         jsonb not null default '{}'::jsonb,
  result          jsonb,
  error           text,
  attempts        integer not null default 0,
  scheduled_for   timestamptz not null default now(),
  locked_until    timestamptz,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  constraint agent_jobs_status_check check (status in ('queued','running','ok','error','cancelled')),
  constraint agent_jobs_job_check check (length(job) between 2 and 80)
);

create unique index if not exists agent_jobs_idem_idx
  on admin.agent_jobs (agent_id, job, idempotency_key) where idempotency_key is not null;
create index if not exists agent_jobs_queue_idx
  on admin.agent_jobs (status, scheduled_for) where status in ('queued','running');

alter table admin.agent_jobs enable row level security;
revoke all on admin.agent_jobs from public, anon, authenticated;
grant select on admin.agent_jobs to authenticated;
grant select, insert, update on admin.agent_jobs to service_role;

drop policy if exists agent_jobs_read_staff on admin.agent_jobs;
create policy agent_jobs_read_staff on admin.agent_jobs
  for select to authenticated using (admin.is_staff());

-- ───────────────────────────────────────────────────────────────────────────
-- Plafond horaire
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.agent_rate (
  agent_id uuid not null references admin.agents (id) on delete cascade,
  hour     timestamptz not null,
  count    integer not null default 0,
  primary key (agent_id, hour),
  constraint agent_rate_count_check check (count >= 0)
);

alter table admin.agent_rate enable row level security;
revoke all on admin.agent_rate from public, anon, authenticated;
grant select on admin.agent_rate to authenticated;
grant select, insert, update on admin.agent_rate to service_role;

drop policy if exists agent_rate_read_staff on admin.agent_rate;
create policy agent_rate_read_staff on admin.agent_rate
  for select to authenticated using (admin.is_staff());

create or replace function admin.agent_rate_consume(p_agent uuid, p_cost integer default 1)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap   integer;
  v_status text;
  v_count integer;
  v_hour  timestamptz := date_trunc('hour', now());
  v_cost  integer := greatest(1, coalesce(p_cost, 1));
begin
  select a.hourly_cap, a.status into v_cap, v_status from admin.agents a where a.id = p_agent;
  if v_cap is null then
    raise exception 'CRM : agent inconnu.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if v_status = 'stopped' then
    raise exception 'CRM : agent arrêté.' using errcode = '53400', hint = 'agent_stopped';
  end if;
  if v_status = 'paused' then
    raise exception 'CRM : agent en pause.' using errcode = '53400', hint = 'agent_paused';
  end if;

  insert into admin.agent_rate (agent_id, hour, count)
  values (p_agent, v_hour, v_cost)
  on conflict (agent_id, hour) do update set count = admin.agent_rate.count + v_cost
  returning count into v_count;

  if v_count > v_cap then
    -- On repasse l'agent en pause : il ne « continue pas quand même ».
    update admin.agents set status = 'paused', updated_at = now()
     where id = p_agent and status = 'active';
    raise exception 'CRM : plafond horaire atteint (%).', v_cap using errcode = '53400', hint = 'rate_limited';
  end if;

  return v_count;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Autorisation d'outil (serveur MCP)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.agent_authorize(p_command text, p_auth_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agent admin.agents;
  v_me    uuid := coalesce(p_auth_user_id, (select auth.uid()));
  v_used  integer;
begin
  if p_auth_user_id is not null then
    if not admin.is_service_context() then
      raise exception 'CRM : changement d''acteur interdit.' using errcode = '42501', hint = 'not_allowed';
    end if;
  elsif v_me is null then
    raise exception 'CRM : session absente.' using errcode = '42501', hint = 'not_allowed';
  end if;

  select * into v_agent from admin.agents a where a.auth_user_id = v_me;
  if not found then
    raise exception 'CRM : compte de service agent inconnu.' using errcode = '42501', hint = 'staff_only';
  end if;

  if not exists (select 1 from admin.commands c where c.command = p_command) then
    raise exception 'CRM : commande inconnue (%).', p_command using errcode = '0A000', hint = 'unknown_command';
  end if;

  v_used := admin.agent_rate_consume(v_agent.id, 1);

  if not (p_command = any (v_agent.tools)) then
    raise exception 'CRM : outil hors de la liste de l''agent.' using errcode = '42501', hint = 'agent_not_allowed';
  end if;

  return jsonb_build_object(
    'ok', true, 'agent_id', v_agent.id, 'agent_name', v_agent.name,
    'pole', v_agent.pole_code, 'status', v_agent.status,
    'used', v_used, 'cap', v_agent.hourly_cap
  );
end;
$$;

create or replace function admin.agents_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not admin.is_staff() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  return jsonb_build_object(
    'agents', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'name', a.name, 'pole', a.pole_code,
               'pole_label', (select p.label from admin.poles p where p.code = a.pole_code),
               'objective', a.objective, 'status', a.status,
               'tools', to_jsonb(a.tools), 'tools_count', coalesce(array_length(a.tools, 1), 0),
               'hourly_cap', a.hourly_cap,
               'used_last_hour', coalesce((select r.count from admin.agent_rate r
                                            where r.agent_id = a.id
                                              and r.hour = date_trunc('hour', now())), 0),
               'last_run_at', (select max(j.started_at) from admin.agent_jobs j where j.agent_id = a.id),
               'jobs_queued', (select count(*) from admin.agent_jobs j
                                where j.agent_id = a.id and j.status = 'queued'),
               'jobs_error_24h', (select count(*) from admin.agent_jobs j
                                   where j.agent_id = a.id and j.status = 'error'
                                     and j.created_at > now() - interval '24 hours'),
               'linked', a.auth_user_id is not null
             ) order by a.name)
        from admin.agents a
    ), '[]'::jsonb),
    'solo', admin.solo_mode(),
    'bricks', coalesce((select jsonb_object_agg(s.key, s.value) from admin.app_settings s where s.key like 'brick.%'), '{}'::jsonb),
    'all_stopped', (select count(*) from admin.agents where status <> 'stopped') = 0
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- File : réservation atomique et clôture
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.agent_jobs_claim(p_agent uuid, p_limit integer default 5)
returns setof admin.agent_jobs
language sql
security definer
set search_path = ''
as $$
  update admin.agent_jobs j
     set status = 'running', started_at = now(), attempts = j.attempts + 1,
         locked_until = now() + interval '10 minutes'
   where j.id in (
     select c.id from admin.agent_jobs c
      where c.agent_id = p_agent
        and c.status = 'queued'
        and c.scheduled_for <= now()
        and not exists (select 1 from admin.agents a where a.id = p_agent and a.status <> 'active')
      order by c.scheduled_for
      limit greatest(1, least(coalesce(p_limit, 5), 50))
      for update skip locked
   )
  returning j.*;
$$;

create or replace function admin.agent_jobs_enqueue(
  p_agent uuid, p_job text, p_payload jsonb default '{}'::jsonb,
  p_key text default null, p_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not exists (select 1 from admin.agents a where a.id = p_agent) then
    raise exception 'CRM : agent inconnu.' using errcode = 'P0002', hint = 'not_found';
  end if;

  if p_key is not null then
    select j.id into v_id from admin.agent_jobs j
     where j.agent_id = p_agent and j.job = p_job and j.idempotency_key = p_key;
    if v_id is not null then
      return v_id;  -- déjà en file : idempotent
    end if;
  end if;

  insert into admin.agent_jobs (agent_id, job, payload, idempotency_key, scheduled_for)
  values (p_agent, p_job, coalesce(p_payload, '{}'::jsonb), p_key, coalesce(p_at, now()))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function admin.agent_jobs_finish(
  p_job uuid, p_status text, p_result jsonb default null, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('ok','error','cancelled') then
    raise exception 'CRM : statut invalide (%).', p_status using errcode = '22023', hint = 'invalid_params';
  end if;
  update admin.agent_jobs
     set status = p_status, result = p_result, error = p_error,
         finished_at = now(), locked_until = null
   where id = p_job;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Proposition d'agent (jamais exécutée seule)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.agent_propose(
  p_agent uuid, p_command text, p_params jsonb default '{}'::jsonb, p_rationale text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_agent admin.agents; v_id uuid;
begin
  select * into v_agent from admin.agents a where a.id = p_agent;
  if not found then
    raise exception 'CRM : agent inconnu.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if v_agent.status <> 'active' then
    raise exception 'CRM : agent inactif.' using errcode = '53400',
      hint = case v_agent.status when 'stopped' then 'agent_stopped' else 'agent_paused' end;
  end if;
  if not (p_command = any (v_agent.tools)) then
    raise exception 'CRM : outil hors de la liste de l''agent.' using errcode = '42501', hint = 'agent_not_allowed';
  end if;

  insert into admin.agent_proposals (agent_id, command, params, target_type, target_id, rationale)
  values (p_agent, p_command, coalesce(p_params, '{}'::jsonb),
          coalesce(p_params ->> 'target_type', split_part(p_command, '_', 1)),
          p_params ->> 'target_id', left(p_rationale, 2000))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'proposal_id', v_id,
    'message', 'Proposition enregistrée : un humain doit la valider. Un agent ne décide jamais.');
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Arrêt (T-08) : un responsable arrête son agent, un super admin tous
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.agent_stop(p_agent uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_agent admin.agents;
begin
  if v_me is null or not admin.is_team_member(v_me) then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  select * into v_agent from admin.agents a where a.id = p_agent for update;
  if not found then
    raise exception 'CRM : agent inconnu.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if not (admin.is_super_admin_for(v_me) or admin.is_responsable(v_agent.pole_code)) then
    raise exception 'CRM : seul le responsable du pôle ou un super admin arrête cet agent.' using errcode = '42501', hint = 'role_too_low';
  end if;

  update admin.agents set status = 'stopped', updated_at = now() where id = p_agent;
  update admin.agent_jobs set status = 'cancelled', finished_at = now(), locked_until = null
   where agent_id = p_agent and status in ('queued','running');

  perform admin.log('agent_stop', 'agent', p_agent::text, null, p_reason,
                    jsonb_build_object('status', v_agent.status), jsonb_build_object('status', 'stopped'));

  return jsonb_build_object('ok', true, 'status', 'stopped');
end;
$$;

create or replace function admin.agent_stop_all(p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_me uuid := (select auth.uid()); v_n integer;
begin
  if v_me is null or not admin.is_super_admin_for(v_me) then
    raise exception 'CRM : arrêt général réservé au super admin.' using errcode = '42501', hint = 'not_allowed';
  end if;

  with done as (
    update admin.agents set status = 'stopped', updated_at = now()
     where status <> 'stopped'
    returning 1
  ) select count(*) into v_n from done;

  update admin.agent_jobs set status = 'cancelled', finished_at = now(), locked_until = null
   where status in ('queued','running');

  perform admin.log('agent_stop_all', 'system', 'agents', null, p_reason,
                    null, jsonb_build_object('stopped', v_n));

  return jsonb_build_object('ok', true, 'stopped', v_n);
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Nom unique : la contrainte précède l'amorçage (ON CONFLICT (name)).
alter table admin.agents drop constraint if exists agents_name_unique;
alter table admin.agents add constraint agents_name_unique unique (name);

-- ───────────────────────────────────────────────────────────────────────────
-- Les 6 agents (sans compte Auth : rattachement par script serveur)
-- ───────────────────────────────────────────────────────────────────────────
insert into admin.agents (name, pole_code, objective, tools, hourly_cap, status) values
  ('confiance', 'CONF', 'Signaler, regrouper et préparer les décisions de modération ; ne décide jamais.',
   array['post_report_resolve','comment_report_resolve','story_report_resolve','club_report_resolve',
         'group_report_resolve','place_report_resolve','marketplace_report_resolve','terrain_report_decide',
         'post_hide','comment_hide','story_moderate'], 60, 'paused'),
  ('membres', 'MEMB', 'Préparer les réponses de support et les fiches membres.',
   array['member_view_360','member_view_blocks','ticket_reply','ticket_set_status','delivery_failures_view'], 60, 'paused'),
  ('commerce', 'COMM', 'Surveiller les annonces, les litiges et les commandes ; proposer, jamais rembourser.',
   array['listing_approve','listing_reject','marketplace_report_resolve','order_confirm',
         'order_ship','stock_move','affiliate_conversion_validate'], 60, 'paused'),
  ('contenus', 'CONT', 'Relire les contributions, les lieux et les fiches pays.',
   array['contribution_decide','place_report_resolve','terrain_report_decide','country_content_review',
         'map_point_verify','place_set_verified'], 60, 'paused'),
  ('produit-ia', 'PRIA', 'Surveiller la consommation IA et les coûts ; proposer des réglages.',
   array['ai_usage_view','ai_quota_raise','errors_view'], 30, 'paused'),
  ('technique', 'TECH', 'Surveiller les erreurs, les tâches et les files ; proposer des relances.',
   array['errors_view','alert_resolve','cron_run_now','hike_session_reprocess','adventure_event_retry',
         'audit_log_view','daily_report_view'], 30, 'paused')
on conflict (name) do nothing;

revoke all on function admin.agent_rate_consume(uuid, integer) from public, anon, authenticated;
revoke all on function admin.agent_authorize(text, uuid) from public, anon;
revoke all on function admin.agents_overview() from public, anon;
revoke all on function admin.agent_jobs_claim(uuid, integer) from public, anon, authenticated;
revoke all on function admin.agent_jobs_enqueue(uuid, text, jsonb, text, timestamptz) from public, anon, authenticated;
revoke all on function admin.agent_jobs_finish(uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function admin.agent_propose(uuid, text, jsonb, text) from public, anon;
revoke all on function admin.agent_stop(uuid, text) from public, anon;
revoke all on function admin.agent_stop_all(text) from public, anon;

grant execute on function admin.agent_rate_consume(uuid, integer) to service_role;
grant execute on function admin.agent_authorize(text, uuid) to authenticated, service_role;
grant execute on function admin.agents_overview() to authenticated, service_role;
grant execute on function admin.agent_jobs_claim(uuid, integer) to service_role;
grant execute on function admin.agent_jobs_enqueue(uuid, text, jsonb, text, timestamptz) to service_role;
grant execute on function admin.agent_jobs_finish(uuid, text, jsonb, text) to service_role;
grant execute on function admin.agent_propose(uuid, text, jsonb, text) to service_role;
grant execute on function admin.agent_stop(uuid, text) to authenticated;
grant execute on function admin.agent_stop_all(text) to authenticated;

comment on table admin.agent_jobs is
  'M14 LKDV Control : file des agents. Réservation atomique (for update skip locked), idempotence par (agent, job, clé), verrou de 10 min.';
comment on function admin.agent_rate_consume(uuid, integer) is
  'M14 LKDV Control : consomme 1..n unités du plafond horaire. Au-delà, l''agent passe en pause et lève rate_limited.';
