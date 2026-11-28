-- ═══════════════════════════════════════════════════════════════════════════
-- M07 — crm_moderation_inbox  (EX-INBOX-01…07 ; 03_MODELE_DE_DONNEES.md § 2)
-- Une seule file : 8 tables de signalements + SOS + tickets + demandes à
-- valider + contributions + alertes techniques + propositions d'agents.
--
-- Tri (EX-INBOX-02) : urgence haute > délai le plus proche > ancienneté.
-- Compte à rebours (EX-INBOX-03) : due_at par source, délais dans
-- admin.sla_targets ; l'interface en déduit gris / orange / rouge.
--
-- Aucune donnée personnelle dans le retour de la file : identifiants, types,
-- libellés neutres, horodatages. Le contenu se lit par admin.inbox_item().
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Délais par source
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists admin.sla_targets (
  source             text primary key,
  label              text not null,
  target_minutes     integer not null check (target_minutes between 1 and 525600),
  escalation_minutes integer not null default 0 check (escalation_minutes >= 0),
  urgency            smallint not null default 2 check (urgency between 1 and 3)
);

insert into admin.sla_targets (source, label, target_minutes, escalation_minutes, urgency) values
  ('sos','SOS',5,2,3),
  ('alert','Alerte technique',60,15,2),
  ('post_report','Signalement de publication',240,60,2),
  ('comment_report','Signalement de commentaire',240,60,2),
  ('story_report','Signalement de story',240,60,2),
  ('club_report','Signalement de club',480,120,2),
  ('group_report','Signalement de groupe ou de membre',240,60,2),
  ('place_report','Signalement de lieu',1440,360,1),
  ('marketplace_report','Signalement marketplace',240,60,2),
  ('terrain_report','Signalement terrain',720,180,1),
  ('support_ticket','Ticket de support',1440,360,1),
  ('request','Demande à valider',4320,720,2),
  ('contribution','Contribution',2880,720,1),
  ('agent_proposal','Proposition d''agent',480,120,1)
on conflict (source) do update set
  label = excluded.label, target_minutes = excluded.target_minutes,
  escalation_minutes = excluded.escalation_minutes, urgency = excluded.urgency;

alter table admin.sla_targets enable row level security;
revoke all on admin.sla_targets from public, anon, authenticated;
grant select on admin.sla_targets to authenticated;
grant select, insert, update on admin.sla_targets to service_role;

drop policy if exists sla_targets_read_staff on admin.sla_targets;
create policy sla_targets_read_staff on admin.sla_targets for select to authenticated using (admin.is_staff());

-- ───────────────────────────────────────────────────────────────────────────
-- SOS : colonnes de prise en charge (la table LKDV n'en avait aucune)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.sos_alerts add column if not exists acknowledged_at timestamptz;
alter table public.sos_alerts add column if not exists acknowledged_by uuid;
alter table public.sos_alerts add column if not exists closed_at timestamptz;
alter table public.sos_alerts add column if not exists closed_by uuid;
alter table public.sos_alerts add column if not exists close_note text;

comment on column public.sos_alerts.acknowledged_at is
  'M07 LKDV Control : prise en charge par un membre de l''équipe (« Je prends »).';
comment on column public.sos_alerts.closed_at is
  'M07 LKDV Control : clôture (note interne dans close_note).';

-- ───────────────────────────────────────────────────────────────────────────
-- Propositions d'agents : table créée en M02 (structure), avec les autres
-- tables du plan de contrôle, pour que les fonctions `language sql` de ce
-- fichier n'aient aucune dépendance d'ordre. Écrite en M14, lue ici.
-- ───────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- Fabrique d'items (interne)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin._inbox_rows()
returns table (
  source      text,
  id          text,
  title       text,
  subtitle    text,
  pole_code   text,
  urgency     integer,
  due_at      timestamptz,
  created_at  timestamptz,
  badges      text[],
  meta        jsonb,
  is_report   boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with sla as (
    select s.source, s.target_minutes, s.urgency from admin.sla_targets s
  ),
  -- 1. SOS
  u1 as (
    select 'sos'::text as source, sa.id::text as id,
           'SOS en cours'::text as title,
           coalesce(to_jsonb(sa) ->> 'country_iso_a2', 'Position non renseignée') as subtitle,
           'CONF'::text as pole_code, 3 as urgency,
           sa.created_at + make_interval(mins => coalesce(sla.target_minutes, 5)) as due_at,
           sa.created_at,
           array['SOS']::text[] as badges,
           jsonb_build_object('userId', sa.user_id, 'status', sa.status,
                              'acknowledgedAt', sa.acknowledged_at) as meta,
           false as is_report
      from public.sos_alerts sa left join sla on sla.source = 'sos'
     where coalesce(sa.status, 'active') in ('active','acknowledged')
  ),
  -- 2. Tickets de support
  u2 as (
    select 'support_ticket', st.id::text, 'Ticket de support',
           coalesce(nullif(btrim(st.subject), ''), 'Sans objet'),
           'MEMB', 2,
           st.created_at + make_interval(mins => coalesce(sla.target_minutes, 1440)),
           st.created_at, array['support']::text[],
           jsonb_build_object('userId', st.user_id, 'status', st.status), false
      from public.support_tickets st left join sla on sla.source = 'support_ticket'
     where coalesce(st.status, 'open') in ('open','pending','waiting')
  ),
  -- 3. Demandes à valider
  u3 as (
    select 'request', r.id::text, coalesce(c.label, r.command),
           coalesce(r.target_type, 'demande à deux personnes'),
           coalesce(c.pole_code, 'TECH'), 2,
           r.expires_at, r.created_at,
           array['validation']::text[],
           jsonb_build_object('command', r.command, 'actorId', r.actor_id,
                              'solo', r.solo, 'fingerprint', r.fingerprint), false
      from admin.requests r
      left join admin.commands c on c.command = r.command
     where r.status = 'pending'
  ),
  -- 4..11. Les 8 tables de signalements
  u4 as (
    select 'post_report', pr.id::text, 'Signalement de publication',
           coalesce(pr.reason, 'motif non renseigné'),
           'CONF', 2,
           pr.created_at + make_interval(mins => coalesce(sla.target_minutes, 240)),
           pr.created_at, array['signalement']::text[],
           jsonb_build_object('targetType', coalesce(to_jsonb(pr) ->> 'target_type', 'post'), 'targetId', pr.post_id,
                              'reporterId', pr.reporter_id), true
      from public.post_reports pr left join sla on sla.source = 'post_report'
     where coalesce(pr.status, 'pending') = 'pending'
  ),
  u5 as (
    select 'comment_report', cr.id::text, 'Signalement de commentaire',
           coalesce(cr.reason, 'motif non renseigné'),
           'CONF', 2,
           cr.created_at + make_interval(mins => coalesce(sla.target_minutes, 240)),
           cr.created_at, array['signalement']::text[],
           jsonb_build_object('table', cr.table_name, 'commentId', cr.comment_id,
                              'reporterId', cr.reporter_id), true
      from public.comment_reports cr left join sla on sla.source = 'comment_report'
     where coalesce(cr.status, 'pending') = 'pending'
  ),
  u6 as (
    select 'story_report', sr.id::text, 'Signalement de story',
           coalesce(sr.reason, 'motif non renseigné'),
           'CONF', 2,
           sr.created_at + make_interval(mins => coalesce(sla.target_minutes, 240)),
           sr.created_at, array['signalement']::text[],
           jsonb_build_object('storyId', sr.story_id, 'authorId', sr.story_author_id,
                              'reporterId', sr.reporter_id), true
      from public.story_reports sr left join sla on sla.source = 'story_report'
     where coalesce(sr.status, 'pending') = 'pending'
  ),
  u7 as (
    select 'club_report', clr.id::text, 'Signalement de club',
           coalesce(clr.reason, 'motif non renseigné'),
           'CONF', 2,
           clr.created_at + make_interval(mins => coalesce(sla.target_minutes, 480)),
           clr.created_at, array['signalement']::text[],
           jsonb_build_object('clubId', clr.club_id, 'targetType', coalesce(to_jsonb(clr) ->> 'target_type', 'topic'),
                              'targetId', clr.target_id, 'reporterId', clr.reporter_id), true
      from public.club_reports clr left join sla on sla.source = 'club_report'
     where coalesce(clr.status, 'pending') = 'pending'
  ),
  u8 as (
    select 'group_report', gr.id::text, 'Signalement de groupe ou de membre',
           coalesce(gr.category, 'catégorie non renseignée'),
           'CONF', 2,
           gr.created_at + make_interval(mins => coalesce(sla.target_minutes, 240)),
           gr.created_at, array['signalement']::text[],
           jsonb_build_object('groupId', gr.group_id, 'reportedUserId', gr.reported_user_id,
                              'severity', gr.severity, 'status', gr.status), true
      from public.group_reports gr left join sla on sla.source = 'group_report'
     where lower(coalesce(gr.status, 'pending')) in ('pending','open','nouveau')
  ),
  u9 as (
    select 'place_report', plr.id::text, 'Signalement de lieu',
           coalesce(plr.reason, 'motif non renseigné'),
           'CONT', 1,
           plr.created_at + make_interval(mins => coalesce(sla.target_minutes, 1440)),
           plr.created_at, array['signalement']::text[],
           jsonb_build_object('placeId', plr.place_id, 'reporterId', plr.reporter_id), true
      from public.place_reports plr left join sla on sla.source = 'place_report'
     where coalesce(plr.status, 'pending') in ('pending','reviewed')
  ),
  u10 as (
    select 'marketplace_report', mr.id::text, 'Signalement marketplace',
           coalesce(mr.reason, 'motif non renseigné'),
           'COMM', 2,
           mr.created_at + make_interval(mins => coalesce(sla.target_minutes, 240)),
           mr.created_at, array['signalement']::text[],
           jsonb_build_object('listingId', mr.listing_id, 'transactionId', mr.transaction_id,
                              'reporterId', mr.reporter_id), true
      from public.marketplace_reports mr left join sla on sla.source = 'marketplace_report'
     where coalesce(mr.status, 'open') = 'open'
  ),
  u11 as (
    select 'terrain_report', tr.id::text, 'Signalement terrain',
           coalesce(tr.category, 'catégorie non renseignée'),
           'CONT', 1,
           tr.created_at + make_interval(mins => coalesce(sla.target_minutes, 720)),
           tr.created_at, array['signalement']::text[],
           jsonb_build_object('segmentId', tr.segment_id, 'status', tr.status,
                              'severity', tr.severity, 'reporterId', tr.reporter_id), true
      from public.terrain_reports tr left join sla on sla.source = 'terrain_report'
     where coalesce(tr.status, 'pending') in ('pending','verify')
  ),
  -- 12. Contributions
  u12 as (
    select 'contribution', pc.id::text, 'Contribution à valider',
           coalesce(pc.action_type, 'contribution'),
           'CONT', 1,
           pc.created_at + make_interval(mins => coalesce(sla.target_minutes, 2880)),
           pc.created_at, array['contribution']::text[],
           jsonb_build_object('userId', pc.user_id, 'targetType', pc.target_type,
                              'targetId', pc.target_id, 'status', pc.status), false
      from public.pending_contributions pc left join sla on sla.source = 'contribution'
     where coalesce(pc.status, 'pending') = 'pending'
  ),
  -- 13. Alertes techniques
  u13 as (
    select 'alert', a.id::text, coalesce(a.type, 'Alerte'),
           coalesce(left(a.message, 120), ''),
           'TECH', case when coalesce(a.severity, 'info') in ('critical','high','error') then 3 else 2 end,
           coalesce(a.due_at, a.created_at + make_interval(mins => coalesce(sla.target_minutes, 60))),
           a.created_at, array['technique']::text[],
           jsonb_build_object('userId', a.user_id, 'severity', a.severity), false
      from public.alerts a left join sla on sla.source = 'alert'
     where coalesce(a.is_resolved, false) = false
  ),
  -- 14. Propositions d'agents (jamais exécutées seules)
  u14 as (
    select 'agent_proposal', ap.id::text, 'Proposition d''agent',
           coalesce(ag.name, 'agent') || ' propose : ' || ap.command,
           coalesce(ag.pole_code, 'TECH'), 2,
           ap.created_at + make_interval(mins => coalesce(sla.target_minutes, 480)),
           ap.created_at, array['agent']::text[],
           jsonb_build_object('agentId', ap.agent_id, 'command', ap.command,
                              'targetType', ap.target_type, 'targetId', ap.target_id), false
      from admin.agent_proposals ap
      left join admin.agents ag on ag.id = ap.agent_id
      left join sla on sla.source = 'agent_proposal'
     where ap.status = 'pending'
  )
  select * from u1 union all select * from u2 union all select * from u3
  union all select * from u4 union all select * from u5 union all select * from u6
  union all select * from u7 union all select * from u8 union all select * from u9
  union all select * from u10 union all select * from u11 union all select * from u12
  union all select * from u13 union all select * from u14;
$$;

revoke all on function admin._inbox_rows() from public, anon, authenticated;
grant execute on function admin._inbox_rows() to service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- File unifiée
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin._inbox_json(p_only_reports boolean default false, p_pole text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with rows as (
    select r.*,
           case
             when r.source = 'sos' then 'urgence_haute'
             when r.source in ('request','agent_proposal') then 'a_valider'
             when r.source = 'contribution' then 'contributions'
             when r.due_at <= now() then 'urgence_haute'
             when r.urgency >= 3 then 'urgence_haute'
             when r.due_at <= now() + make_interval(mins => greatest(5, (select s.target_minutes / 5 from admin.sla_targets s where s.source = r.source)))
               then 'delai_bientot'
             else 'signalements'
           end as grp
      from admin._inbox_rows() r
     where (not p_only_reports or r.is_report)
       and (p_pole is null or r.pole_code = p_pole)
  ),
  ordered as (
    select rows.*,
           case grp
             when 'urgence_haute' then 1
             when 'delai_bientot' then 2
             when 'a_valider' then 3
             when 'signalements' then 4
             else 5
           end as grp_rank
      from rows
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', o.source || ':' || o.id,
               'source', o.source,
               'id', o.id,
               'group', o.grp,
               'title', o.title,
               'subtitle', o.subtitle,
               'pole', o.pole_code,
               'urgency', o.urgency,
               'dueAt', o.due_at,
               'createdAt', o.created_at,
               'badges', to_jsonb(o.badges),
               'meta', o.meta
             ) order by o.grp_rank, o.due_at nulls last, o.created_at)
        from ordered o
    ), '[]'::jsonb),
    -- counts : forme attendue par l'interface (rpc.ts) + répartition par groupe.
    'counts', jsonb_build_object(
      'total', (select count(*) from ordered),
      'urgent', (select count(*) from ordered o where o.grp = 'urgence_haute'),
      'reports', (select count(*) from ordered o where o.is_report),
      'approvals', (select count(*) from ordered o where o.grp = 'a_valider'),
      'contributions', (select count(*) from ordered o where o.grp = 'contributions'),
      'by_pole', coalesce((select jsonb_object_agg(x.pole_code, x.n)
                             from (select o.pole_code, count(*) as n from ordered o group by o.pole_code) x), '{}'::jsonb),
      'by_group', coalesce((select jsonb_object_agg(y.grp, y.n)
                              from (select o.grp, count(*) as n from ordered o group by o.grp) y), '{}'::jsonb)
    ),
    -- sla : compte à rebours (EX-INBOX-03) + progression du jour (EX-INBOX-06).
    'sla', jsonb_build_object(
      'held_days', (select count(distinct date_trunc('day', al.at))
                      from admin.audit_log al
                     where al.at > now() - interval '30 days'),
      'treated_today', (select count(*) from admin.audit_log al
                         where al.at >= date_trunc('day', now())),
      'target_today', (select count(*) from ordered o
                        where o.created_at >= date_trunc('day', now())),
      'by_source', coalesce((select jsonb_object_agg(s.source, jsonb_build_object(
                                 'label', s.label, 'minutes', s.target_minutes,
                                 'escalationMinutes', s.escalation_minutes, 'urgency', s.urgency))
                               from admin.sla_targets s), '{}'::jsonb)
    ),
    'overdue', (select count(*) from ordered o where o.due_at < now())
  );
$$;

create or replace function admin.inbox()
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
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;
  return admin._inbox_json(false, null);
end;
$$;

create or replace function admin.moderation_inbox()
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
  return admin._inbox_json(true, null);
end;
$$;

revoke all on function admin._inbox_json(boolean, text) from public, anon, authenticated;
revoke all on function admin.inbox() from public, anon;
revoke all on function admin.moderation_inbox() from public, anon;
grant execute on function admin._inbox_json(boolean, text) to service_role;
grant execute on function admin.inbox() to authenticated, service_role;
grant execute on function admin.moderation_inbox() to authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Détail d'un cas
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.inbox_item(p_source text, p_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_row  jsonb;
  v_pole text;
  v_timeline jsonb;
  v_actions jsonb;
begin
  if not admin.is_staff() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;

  select to_jsonb(r) into v_item
    from admin._inbox_rows() r
   where r.source = p_source and r.id = p_id;
  if v_item is null then
    raise exception 'CRM : cas introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;
  v_pole := v_item ->> 'pole_code';

  -- Ligne source complète, lue avec les droits du propriétaire : c'est la
  -- fonction (et son contrôle aal2/équipe) qui autorise, jamais la RLS seule.
  v_row := case p_source
    when 'sos' then (select to_jsonb(x) from public.sos_alerts x where x.id = p_id::uuid)
    when 'support_ticket' then (select to_jsonb(x) from public.support_tickets x where x.id = p_id::uuid)
    when 'request' then (select to_jsonb(x) from admin.requests x where x.id = p_id::uuid)
    when 'post_report' then (select to_jsonb(x) from public.post_reports x where x.id = p_id::uuid)
    when 'comment_report' then (select to_jsonb(x) from public.comment_reports x where x.id = p_id::uuid)
    when 'story_report' then (select to_jsonb(x) from public.story_reports x where x.id = p_id::uuid)
    when 'club_report' then (select to_jsonb(x) from public.club_reports x where x.id = p_id::uuid)
    when 'group_report' then (select to_jsonb(x) from public.group_reports x where x.id = p_id::uuid)
    when 'place_report' then (select to_jsonb(x) from public.place_reports x where x.id = p_id::uuid)
    when 'marketplace_report' then (select to_jsonb(x) from public.marketplace_reports x where x.id = p_id::uuid)
    when 'terrain_report' then (select to_jsonb(x) from public.terrain_reports x where x.id = p_id::uuid)
    when 'contribution' then (select to_jsonb(x) from public.pending_contributions x where x.id = p_id::uuid)
    when 'alert' then (select to_jsonb(x) from public.alerts x where x.id = p_id::uuid)
    when 'agent_proposal' then (select to_jsonb(x) from admin.agent_proposals x where x.id = p_id::uuid)
    else null
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
           'at', al.at, 'action', al.action, 'actorRole', al.actor_role,
           'actorKind', al.actor_kind, 'reasonCode', al.reason_code,
           'reasonText', al.reason_text) order by al.at desc), '[]'::jsonb)
    into v_timeline
    from admin.audit_log al
   where al.target_type in (p_source, 'request')
     and al.target_id = p_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'command', c.command, 'label', c.label, 'pole', c.pole_code,
           'reasonRequired', c.reason_required, 'needsValidation', c.needs_validation,
           'allowed', admin.can((select auth.uid()), c.command)) order by c.sort), '[]'::jsonb)
    into v_actions
    from admin.commands c
   where c.pole_code = v_pole and v_pole is not null;

  return jsonb_build_object(
    'source', p_source,
    'id', p_id,
    'item', v_item,
    'row', v_row,
    'timeline', v_timeline,
    'actions', v_actions,
    'solo', admin.solo_mode()
  );
end;
$$;

revoke all on function admin.inbox_item(text, text) from public, anon;
grant execute on function admin.inbox_item(text, text) to authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- SOS
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.sos_board()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- auth.uid() nul = service_role (tâche planifiée) : autorisé explicitement.
  if auth.uid() is not null and not admin.is_staff() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', sa.id,
               'userId', sa.user_id,
               'status', sa.status,
               'createdAt', sa.created_at,
               'acknowledgedAt', sa.acknowledged_at,
               'acknowledgedBy', sa.acknowledged_by,
               'closedAt', sa.closed_at,
               'closeNote', sa.close_note,
               'minutesOpen', floor(extract(epoch from (now() - sa.created_at)) / 60)::int,
               'country', sa.country_iso_a2,
               'battery', sa.battery
             ) order by sa.acknowledged_at nulls first, sa.created_at)
        from public.sos_alerts sa
       where coalesce(sa.status, 'active') in ('active','acknowledged')
    ), '[]'::jsonb),
    'count', (select count(*) from public.sos_alerts
               where coalesce(status, 'active') in ('active','acknowledged')),
    'unacknowledged', (select count(*) from public.sos_alerts
                        where coalesce(status, 'active') = 'active' and acknowledged_at is null)
  );
end;
$$;

create or replace function admin.sos_overdue(p_minutes integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not admin.is_staff() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', sa.id, 'userId', sa.user_id, 'createdAt', sa.created_at,
               'minutesOpen', floor(extract(epoch from (now() - sa.created_at)) / 60)::int,
               'status', sa.status) order by sa.created_at)
        from public.sos_alerts sa
       where coalesce(sa.status, 'active') in ('active','acknowledged')
         and sa.acknowledged_at is null
         and sa.created_at < now() - make_interval(mins => greatest(1, p_minutes))
    ), '[]'::jsonb),
    'count', (select count(*) from public.sos_alerts
               where coalesce(status, 'active') in ('active','acknowledged')
                 and acknowledged_at is null
                 and created_at < now() - make_interval(mins => greatest(1, p_minutes)))
  );
end;
$$;

create or replace function admin.sos_ack(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_before jsonb; v_id bigint;
begin
  if v_me is null or not admin.is_team_member(v_me) then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  select to_jsonb(sa) into v_before from public.sos_alerts sa where sa.id = p_id for update;
  if v_before is null then
    raise exception 'CRM : SOS introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if (v_before ->> 'acknowledged_at') is not null then
    raise exception 'CRM : SOS déjà pris en charge.' using errcode = '40001', hint = 'conflict';
  end if;

  update public.sos_alerts
     set acknowledged_at = now(), acknowledged_by = v_me,
         status = case when coalesce(status, 'active') = 'active' then 'acknowledged' else status end,
         updated_at = now()
   where id = p_id;

  v_id := admin.log('sos_ack', 'sos', p_id::text, null, null, v_before,
                    (select to_jsonb(sa) from public.sos_alerts sa where sa.id = p_id));

  return jsonb_build_object('ok', true, 'audit_id', v_id);
end;
$$;

create or replace function admin.sos_close(p_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_before jsonb; v_id bigint;
begin
  if v_me is null or not admin.is_team_member(v_me) then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if nullif(btrim(p_note), '') is null then
    raise exception 'CRM : une note est requise pour clore un SOS.' using errcode = '22023', hint = 'reason_required';
  end if;

  select to_jsonb(sa) into v_before from public.sos_alerts sa where sa.id = p_id for update;
  if v_before is null then
    raise exception 'CRM : SOS introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;

  update public.sos_alerts
     set closed_at = now(), closed_by = v_me, close_note = btrim(p_note),
         status = 'resolved',
         acknowledged_at = coalesce(acknowledged_at, now()),
         acknowledged_by = coalesce(acknowledged_by, v_me),
         updated_at = now()
   where id = p_id;

  v_id := admin.log('sos_close', 'sos', p_id::text, null, btrim(p_note), v_before,
                    (select to_jsonb(sa) from public.sos_alerts sa where sa.id = p_id));

  return jsonb_build_object('ok', true, 'audit_id', v_id);
end;
$$;

revoke all on function admin.sos_board() from public, anon;
revoke all on function admin.sos_overdue(integer) from public, anon;
revoke all on function admin.sos_ack(uuid) from public, anon;
revoke all on function admin.sos_close(uuid, text) from public, anon;
grant execute on function admin.sos_board() to authenticated, service_role;
grant execute on function admin.sos_overdue(integer) to authenticated, service_role;
grant execute on function admin.sos_ack(uuid) to authenticated;
grant execute on function admin.sos_close(uuid, text) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Demandes expirées + résumé par pôle
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.requests_overdue()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_expired integer;
begin
  if auth.uid() is not null and not admin.is_staff() then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;

  with done as (
    update admin.requests r
       set status = 'expired', updated_at = now()
     where r.status = 'pending' and r.expires_at <= now()
    returning 1
  ) select count(*) into v_expired from done;

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'command', r.command, 'createdAt', r.created_at,
               'expiresAt', r.expires_at, 'actorId', r.actor_id,
               'minutesLate', floor(extract(epoch from (now() - r.expires_at)) / 60)::int)
             order by r.expires_at)
        from admin.requests r where r.status = 'expired' and r.expires_at > now() - interval '7 days'
    ), '[]'::jsonb),
    'count', (select count(*) from admin.requests where status = 'expired'),
    'expired', v_expired
  );
end;
$$;

create or replace function admin.poles_summary()
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
    'poles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', p.code,
               'label', p.label,
               'count', coalesce((select count(*)
                                    from admin._inbox_rows() r
                                   where r.pole_code = p.code), 0),
               'role', (select max(sm.role) from admin.staff_memberships sm
                         where sm.user_id = (select auth.uid())
                           and sm.pole_code = p.code and sm.revoked_at is null),
               'superAdmin', admin.is_super_admin_for((select auth.uid()))
             ) order by p.sort)
        from admin.poles p
    ), '[]'::jsonb),
    'total', (select count(*) from admin._inbox_rows()),
    'solo', admin.solo_mode()
  );
end;
$$;

revoke all on function admin.requests_overdue() from public, anon;
revoke all on function admin.poles_summary() from public, anon;
grant execute on function admin.requests_overdue() to authenticated, service_role;
grant execute on function admin.poles_summary() to authenticated, service_role;

comment on function admin.inbox() is
  'LKDV Control : file unifiée (14 sources). Tri EX-INBOX-02 : urgence haute > délai le plus proche > ancienneté.';
comment on function admin.inbox_item(text, text) is
  'LKDV Control : détail d''un cas (ligne source, historique d''audit, actions du pôle). Réservé équipe + aal2.';
