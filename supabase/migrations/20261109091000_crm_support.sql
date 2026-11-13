-- ═══════════════════════════════════════════════════════════════════════════
-- M10 — crm_support  (03_MODELE_DE_DONNEES.md § 2)
-- Fil de support (public.support_messages), assignation, priorité, délais.
-- Le ticket reste dans public.support_tickets (LKDV) ; on l'enrichit sans le
-- casser : colonnes ajoutées avec valeur par défaut.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.support_tickets add column if not exists assigned_to uuid;
alter table public.support_tickets add column if not exists priority smallint not null default 2;
alter table public.support_tickets add column if not exists first_reply_at timestamptz;
alter table public.support_tickets add column if not exists closed_at timestamptz;
alter table public.support_tickets add column if not exists closed_by uuid;
alter table public.support_tickets add column if not exists category text;

alter table public.support_tickets drop constraint if exists support_tickets_priority_check;
alter table public.support_tickets add constraint support_tickets_priority_check
  check (priority between 1 and 3);

create index if not exists support_tickets_assigned_idx
  on public.support_tickets (assigned_to) where assigned_to is not null;

create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets (id) on delete cascade,
  author_id  uuid not null,
  body       text not null,
  internal   boolean not null default false,
  created_at timestamptz not null default now(),
  constraint support_messages_body_check check (length(btrim(body)) between 1 and 8000)
);

create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

alter table public.support_messages enable row level security;
revoke all on public.support_messages from public, anon, authenticated;
grant select, insert on public.support_messages to authenticated;
grant select, insert, update on public.support_messages to service_role;

-- Le membre voit son fil hors notes internes.
drop policy if exists support_messages_member_read on public.support_messages;
create policy support_messages_member_read on public.support_messages
  for select to authenticated
  using (
    not internal
    and exists (
      select 1 from public.support_tickets t
       where t.id = support_messages.ticket_id
         and t.user_id = (select auth.uid())
    )
  );

-- Le membre écrit dans son propre fil, jamais en interne.
drop policy if exists support_messages_member_write on public.support_messages;
create policy support_messages_member_write on public.support_messages
  for insert to authenticated
  with check (
    not internal
    and author_id = (select auth.uid())
    and exists (
      select 1 from public.support_tickets t
       where t.id = support_messages.ticket_id
         and t.user_id = (select auth.uid())
         and coalesce(t.status, 'open') <> 'closed'
    )
  );

-- L'équipe voit tout (notes internes comprises) et écrit, avec MFA.
drop policy if exists support_messages_staff_all on public.support_messages;
create policy support_messages_staff_all on public.support_messages
  for all to authenticated
  using (admin.is_team_member((select auth.uid()))
         and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2')
  with check (admin.is_team_member((select auth.uid()))
              and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2');

-- L'équipe peut lire/modifier les tickets ; le membre garde la main sur les siens.
drop policy if exists support_tickets_staff_all on public.support_tickets;
create policy support_tickets_staff_all on public.support_tickets
  for all to authenticated
  using (admin.is_team_member((select auth.uid()))
         and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2')
  with check (admin.is_team_member((select auth.uid()))
              and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2');

-- Un membre suspendu doit pouvoir écrire au support : pas de verrou
-- compte_actif_pour_ecrire ici (décision M06).

-- ───────────────────────────────────────────────────────────────────────────
-- Fil complet pour l'équipe
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.support_thread(p_ticket uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_t public.support_tickets;
begin
  if not admin.is_team_member((select auth.uid())) then
    raise exception 'CRM : accès réservé à l''équipe.' using errcode = '42501', hint = 'not_allowed';
  end if;
  if coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'CRM : double authentification requise.' using errcode = '42501', hint = 'mfa_required';
  end if;

  select * into v_t from public.support_tickets t where t.id = p_ticket;
  if not found then
    raise exception 'CRM : ticket introuvable.' using errcode = 'P0002', hint = 'not_found';
  end if;

  return jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', v_t.id, 'userId', v_t.user_id, 'subject', v_t.subject,
      'status', v_t.status, 'priority', v_t.priority, 'assignedTo', v_t.assigned_to,
      'createdAt', v_t.created_at, 'updatedAt', v_t.updated_at,
      'firstReplyAt', v_t.first_reply_at, 'closedAt', v_t.closed_at,
      'category', v_t.category
    ),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'authorId', m.author_id, 'body', m.body,
               'internal', m.internal, 'createdAt', m.created_at) order by m.created_at)
        from public.support_messages m where m.ticket_id = p_ticket
    ), '[]'::jsonb),
    'sla', (select jsonb_build_object('label', s.label, 'minutes', s.target_minutes)
              from admin.sla_targets s where s.source = 'support_ticket'),
    'dueAt', v_t.created_at + make_interval(mins => coalesce(
      (select s.target_minutes from admin.sla_targets s where s.source = 'support_ticket'), 1440))
  );
end;
$$;

revoke all on function admin.support_thread(uuid) from public, anon;
grant execute on function admin.support_thread(uuid) to authenticated, service_role;

comment on table public.support_messages is
  'M10 LKDV Control : messages d''un ticket de support. internal = note interne, jamais visible du membre (policy).';
