-- ═══════════════════════════════════════════════════════════════════════════
-- M11 — crm_settings_ops  (03_MODELE_DE_DONNEES.md § 2 ; 02_ARCHITECTURE.md § 9)
-- Réglages du produit (dont indicateurs de briques sans secret), journal
-- d'exécution des tâches (ops.job_runs), purge réglementaire, état technique.
--
-- Aucun secret ici : uniquement des indicateurs « brique active / en attente
-- de secret » et des valeurs métier bornées. Les secrets restent en variables
-- d'environnement (08_GARDE_FOUS.md § 1.12).
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Réglages
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.app_settings (
  key         text primary key,
  value       jsonb not null,
  label       text not null,
  description text not null default '',
  is_public   boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table admin.app_settings enable row level security;
revoke all on admin.app_settings from public, anon, authenticated;
grant select on admin.app_settings to authenticated;
grant select, insert, update on admin.app_settings to service_role;

drop policy if exists app_settings_read_staff on admin.app_settings;
create policy app_settings_read_staff on admin.app_settings
  for select to authenticated using (admin.is_staff());

insert into admin.app_settings (key, value, label, description, is_public) values
  ('tva_rate_bps',            '2000'::jsonb,  'TVA (points de base)', 'Taux appliqué au panier. 2000 = 20 %. Jamais modifié par un agent.', false),
  ('shipping_flat_cents',     '590'::jsonb,   'Frais de port', 'Montant fixe en centimes quand la gratuité n''est pas atteinte.', true),
  ('shipping_free_threshold_cents', '6900'::jsonb, 'Seuil de gratuité', 'Montant du panier (centimes) au-delà duquel le port est offert.', true),
  ('loyalty_points_per_eur',  '10'::jsonb,    'Points de fidélité par euro', 'Barème de crédit des points.', false),
  ('ai_daily_cap',            '2000'::jsonb,  'Plafond IA quotidien', 'Nombre d''appels IA par jour pour tout le site.', false),
  ('ai_heavy_daily_quota',    '120'::jsonb,   'Quota IA lourd par personne', 'Requêtes « heavy » par personne et par jour.', false),
  ('ai_fast_daily_quota',     '400'::jsonb,   'Quota IA rapide par personne', 'Requêtes « fast » par personne et par jour.', false),
  ('creator_share_bps',       '300'::jsonb,   'Part créateur', 'Points de base versés au créateur d''une lignée (300 = 3 %).', false),
  ('brick.stripe',            '{"enabled": false, "reason": "clé absente côté serveur", "env": "STRIPE_SECRET_KEY"}'::jsonb,  'Brique Stripe', 'Désactivée tant que la clé de test n''est pas fournie (P4).', false),
  ('brick.stripe_webhook',    '{"enabled": false, "reason": "secret de webhook absent", "env": "STRIPE_WEBHOOK_SECRET"}'::jsonb, 'Webhook Stripe', 'Désactivé tant que le secret de webhook n''est pas fourni (P5).', false),
  ('brick.nvidia',            '{"enabled": false, "reason": "clé absente côté serveur", "env": "NVIDIA_API_KEY"}'::jsonb, 'Brique IA NVIDIA', 'Désactivée tant que la clé NVIDIA n''est pas fournie (P6).', false),
  ('brick.resend',            '{"enabled": false, "reason": "clé absente côté serveur", "env": "RESEND_API_KEY"}'::jsonb, 'Brique e-mail Resend', 'Désactivée tant que la clé Resend n''est pas fournie (P7).', false),
  ('brick.realtime',          '{"enabled": true}'::jsonb, 'Temps réel', 'Canaux privés admin:* (M12).', false),
  ('brick.agents',            '{"enabled": true}'::jsonb, 'Agents IA', 'Exécution des agents (M14). Plafond : admin.agents.hourly_cap.', false)
on conflict (key) do nothing;

-- Lecture publique bornée (LKDV a besoin du seuil de port et de la TVA).
create or replace function public.app_settings_public()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
    from admin.app_settings s
   where s.is_public;
$$;

comment on function public.app_settings_public() is
  'M11 LKDV Control : réglages non sensibles lisibles par LKDV (port, seuil de gratuité). Aucune clé secrète ici.';

-- ───────────────────────────────────────────────────────────────────────────
-- Webhooks Stripe : ingestion idempotente (aucune décision d'argent ici)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.stripe_events (
  event_id    text primary key,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  status      text not null default 'received',
  order_id    uuid,
  note        text,
  constraint stripe_events_status_check check (status in ('received','applied','ignored','error'))
);

create index if not exists stripe_events_type_idx on admin.stripe_events (type, received_at desc);

alter table admin.stripe_events enable row level security;
revoke all on admin.stripe_events from public, anon, authenticated;
grant select on admin.stripe_events to authenticated;
grant select, insert, update on admin.stripe_events to service_role;

drop policy if exists stripe_events_read_staff on admin.stripe_events;
create policy stripe_events_read_staff on admin.stripe_events
  for select to authenticated using (admin.is_staff());

-- Idempotent sur p_event_id. Ne décide jamais d'un remboursement : il reflète
-- ce que Stripe a déjà fait (montant remboursé, litige) sur la commande
-- concernée, et laisse l'argent aux commandes humaines.
create or replace function admin.stripe_event_ingest(
  p_event_id text, p_type text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obj     jsonb;
  v_order   uuid;
  v_amount  integer;
  v_existing admin.stripe_events;
  v_status  text := 'received';
  v_note    text;
begin
  if not admin.is_service_context() then
    raise exception 'CRM : ingestion Stripe réservée au serveur.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if nullif(btrim(p_event_id), '') is null or nullif(btrim(p_type), '') is null then
    raise exception 'CRM : event_id et type requis.' using errcode = '22023', hint = 'invalid_params';
  end if;

  select * into v_existing from admin.stripe_events e where e.event_id = p_event_id;
  if found then
    return jsonb_build_object('ok', true, 'ingested', false, 'duplicate', true,
                              'status', v_existing.status, 'event_id', p_event_id);
  end if;

  v_obj := coalesce(p_payload -> 'data' -> 'object', '{}'::jsonb);
  begin
    v_order := nullif(v_obj -> 'metadata' ->> 'order_id', '')::uuid;
  exception when others then
    v_order := null;
  end;

  if v_order is not null then
    if p_type = 'charge.refunded' then
      v_amount := nullif(v_obj ->> 'amount_refunded', '')::integer;
      update public.orders o
         set refunded_merchandise_cents = coalesce(v_amount, o.refunded_merchandise_cents),
             updated_at = now()
       where o.id = v_order;
      v_status := 'applied';
      v_note := 'Montant remboursé reflété depuis Stripe.';
    elsif p_type like 'charge.dispute.%' then
      update public.orders o
         set payment_state = 'disputed', updated_at = now()
       where o.id = v_order;
      v_status := 'applied';
      v_note := 'Litige reflété depuis Stripe.';
    else
      v_status := 'ignored';
    end if;
  else
    v_status := 'ignored';
    v_note := 'Aucun order_id dans metadata : événement conservé sans effet.';
  end if;

  insert into admin.stripe_events (event_id, type, payload, status, order_id, note)
  values (p_event_id, p_type, coalesce(p_payload, '{}'::jsonb), v_status, v_order, v_note);

  perform admin.log('stripe_event_ingest', 'stripe_event', p_event_id, null, p_type,
                    null, jsonb_build_object('status', v_status, 'order_id', v_order));

  return jsonb_build_object('ok', true, 'ingested', true, 'status', v_status,
                            'order_id', v_order, 'note', v_note);
end;
$$;

revoke all on function admin.stripe_event_ingest(text, text, jsonb) from public, anon, authenticated;
grant execute on function admin.stripe_event_ingest(text, text, jsonb) to service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Journal d'exécution des tâches
-- ───────────────────────────────────────────────────────────────────────────
create schema if not exists ops;
revoke all on schema ops from public, anon;
grant usage on schema ops to service_role;

create table if not exists ops.job_runs (
  id              bigint generated always as identity primary key,
  job             text not null,
  idempotency_key text,
  version         text,
  status          text not null default 'running',
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  result          jsonb,
  error           text,
  payload         jsonb,
  attempts        integer not null default 1,
  updated_at      timestamptz not null default now(),
  constraint job_runs_status_check check (status in ('running','ok','error','skipped'))
);

create unique index if not exists job_runs_idempotency_idx
  on ops.job_runs (job, idempotency_key) where idempotency_key is not null;
create index if not exists job_runs_job_idx on ops.job_runs (job, started_at desc);
create index if not exists job_runs_status_idx on ops.job_runs (status) where status <> 'ok';

alter table ops.job_runs enable row level security;
revoke all on ops.job_runs from public, anon, authenticated;
grant select, insert, update on ops.job_runs to service_role;

-- Reprenable : si la clé a déjà réussi, on renvoie la ligne existante sans
-- relancer. Sinon on crée une exécution « running ».
create or replace function ops.job_run_start(p_job text, p_key text default null, p_payload jsonb default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_id bigint;
begin
  if nullif(btrim(p_job), '') is null then
    raise exception 'ops : nom de tâche requis.' using errcode = '22023', hint = 'invalid_params';
  end if;

  if p_key is not null then
    select j.id into v_id from ops.job_runs j
     where j.job = p_job and j.idempotency_key = p_key and j.status = 'ok'
     limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into ops.job_runs (job, idempotency_key, payload)
  values (p_job, p_key, p_payload)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function ops.job_run_finish(
  p_id bigint, p_status text, p_result jsonb default null, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('ok','error','skipped') then
    raise exception 'ops : statut invalide (%).', p_status using errcode = '22023', hint = 'invalid_params';
  end if;
  update ops.job_runs
     set status = p_status, finished_at = now(), result = p_result,
         error = p_error, updated_at = now()
   where id = p_id;
end;
$$;

revoke all on function ops.job_run_start(text, text, jsonb) from public, anon, authenticated;
revoke all on function ops.job_run_finish(bigint, text, jsonb, text) from public, anon, authenticated;
grant execute on function ops.job_run_start(text, text, jsonb) to service_role;
grant execute on function ops.job_run_finish(bigint, text, jsonb, text) to service_role;

comment on table ops.job_runs is
  'M11 LKDV Control : chaque tâche planifiée et chaque exécution d''agent. Clé d''idempotence + statut + résultat = reprenable.';

-- ───────────────────────────────────────────────────────────────────────────
-- Purge réglementaire (journaux/technique uniquement)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.purge_logs(p_days integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days     integer := greatest(coalesce(p_days, 90), 30);
  v_tech_cut timestamptz := now() - make_interval(days => v_days);
  v_audit_cut timestamptz := now() - interval '3 years';
  v_jobs     integer := 0;
  v_errors   integer := 0;
  v_props    integer := 0;
  v_audit    integer := 0;
begin
  -- Réservé aux tâches planifiées (service_role).
  if not admin.is_service_context() then
    raise exception 'CRM : purge réservée aux tâches planifiées.' using errcode = '42501', hint = 'not_allowed';
  end if;

  -- 1. Exécutions de tâches terminées.
  delete from ops.job_runs j
   where j.started_at < v_tech_cut
     and j.status in ('ok','error','skipped');
  get diagnostics v_jobs = row_count;

  -- 2. Erreurs applicatives.
  if to_regclass('public.app_errors') is not null then
    -- public.app_errors utilise la colonne « at » (relevé 2026-11-09).
    execute 'delete from public.app_errors where at < $1' using v_tech_cut;
    get diagnostics v_errors = row_count;
  end if;

  -- 3. Propositions d''agents traitées.
  delete from admin.agent_proposals ap
   where ap.created_at < v_tech_cut
     and ap.status in ('accepted','rejected');
  get diagnostics v_props = row_count;

  -- 4. Journal d''audit : rétention légale de 3 ans, jamais pilotée par
  --    l''appelant (une décision de modération ne se purge pas sur paramètre).
  delete from admin.audit_log al where al.at < v_audit_cut;
  get diagnostics v_audit = row_count;

  return jsonb_build_object(
    'ok', true,
    'deleted', jsonb_build_object(
      'job_runs', v_jobs, 'app_errors', v_errors,
      'agent_proposals', v_props, 'audit_log', v_audit),
    'cutoff_technical', v_tech_cut,
    'cutoff_audit', v_audit_cut,
    'note', 'Les tables métier ne sont jamais touchées par cette purge.'
  );
end;
$$;

revoke all on function admin.purge_logs(integer) from public, anon, authenticated;
grant execute on function admin.purge_logs(integer) to service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- État technique (écran /technique)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.technique_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_errors jsonb; v_jobs jsonb; v_bricks jsonb; v_realtime jsonb;
begin
  if not admin.is_staff() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'scope', e.scope, 'count', e.n, 'lastAt', e.last_at) order by e.n desc), '[]'::jsonb)
    into v_errors
    from (select coalesce(scope, 'app') as scope, count(*) as n, max(at) as last_at
            from public.app_errors
           where at > now() - interval '24 hours'
           group by coalesce(scope, 'app')
           order by count(*) desc
           limit 10) e;

  select jsonb_build_object(
           'running', (select count(*) from ops.job_runs where status = 'running'),
           'failed24h', (select count(*) from ops.job_runs
                          where status = 'error' and started_at > now() - interval '24 hours'),
           'ok24h', (select count(*) from ops.job_runs
                      where status = 'ok' and started_at > now() - interval '24 hours'),
           'last', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'job', j.job, 'status', j.status, 'startedAt', j.started_at,
                      'finishedAt', j.finished_at, 'error', left(j.error, 200))
                    order by j.started_at desc)
               from (select * from ops.job_runs order by started_at desc limit 10) j
           ), '[]'::jsonb)
         ) into v_jobs;

  select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb) into v_bricks
    from admin.app_settings s where s.key like 'brick.%';

  select jsonb_build_object(
           'published', coalesce((
             select jsonb_agg(tablename order by tablename)
               from pg_publication_tables where pubname = 'supabase_realtime'
           ), '[]'::jsonb),
           'adminTopicsPolicy', exists (
             select 1 from pg_policies
              where schemaname = 'realtime' and tablename = 'messages'
                and policyname = 'crm_staff_receive_admin_topics'
           ),
           'pendingInbox', (select count(*) from admin._inbox_rows())
         ) into v_realtime;

  return jsonb_build_object(
    'errors', v_errors,
    'jobs', v_jobs,
    'bricks', v_bricks,
    'realtime', v_realtime,
    'solo', admin.solo_mode(),
    'advisors_hint', 'Lancer get_advisors (security + performance) après chaque migration ; aucune erreur attendue.',
    'generatedAt', now()
  );
end;
$$;

revoke all on function admin.technique_status() from public, anon;
grant execute on function admin.technique_status() to authenticated, service_role;

comment on function admin.technique_status() is
  'M11 LKDV Control : erreurs 24 h, tâches, briques (dont celles en attente de secret), état Realtime.';

revoke all on function public.app_settings_public() from public;
grant execute on function public.app_settings_public() to anon, authenticated, service_role;
