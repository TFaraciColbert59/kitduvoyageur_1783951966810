-- ═══════════════════════════════════════════════════════════════════════════
-- Lot G02 — écrans et API clubs : salons, sorties, défis, classements,
-- invitations et appariement d'activités.
--
-- Migration strictement additive : colonnes IF NOT EXISTS sur les tables
-- existantes, nouvelles tables dédiées, RLS activée sur chaque nouvelle table.
-- Aucune policy existante n'est supprimée ; les helpers d'appartenance sont
-- SECURITY DEFINER avec search_path verrouillé et EXECUTE retiré à PUBLIC.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Colonnes du contrat G02 ─────────────────────────────────────────────
alter table public.clubs
  add column if not exists primary_sport text,
  add column if not exists sports text[] not null default '{}'::text[],
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'revoked')),
  add column if not exists verified_at timestamptz,
  add column if not exists verification_badge_label text,
  add column if not exists verification_sports text[] not null default '{}'::text[];

alter table public.club_members
  add column if not exists muted_until timestamptz,
  add column if not exists leaderboard_opt_in boolean not null default false,
  add column if not exists is_pro_athlete boolean not null default false,
  add column if not exists verified_sports text[] not null default '{}'::text[];

alter table public.club_events
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists sport text,
  add column if not exists format text not null default 'trail_outing'
    check (format in ('social_ride', 'training', 'race', 'trail_outing', 'indoor')),
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'friends', 'club_only', 'private')),
  add column if not exists meeting_point text,
  add column if not exists lat double precision check (lat is null or lat between -90 and 90),
  add column if not exists lng double precision check (lng is null or lng between -180 and 180),
  add column if not exists waitlist_enabled boolean not null default true,
  add column if not exists pace_groups jsonb not null default '[]'::jsonb,
  add column if not exists registration_url text,
  add column if not exists route_id text,
  add column if not exists route_revision integer not null default 0 check (route_revision >= 0),
  add column if not exists co_host_club_ids uuid[] not null default '{}'::uuid[];

alter table public.club_challenges
  add column if not exists scope text not null default 'club'
    check (scope in ('individual', 'club')),
  add column if not exists sport text,
  add column if not exists metric text not null default 'activities_count'
    check (metric in ('distance_m', 'duration_s', 'elevation_gain_m', 'activities_count')),
  add column if not exists target_value numeric not null default 1 check (target_value > 0),
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists badge_title text,
  add column if not exists badge_icon text,
  add column if not exists created_by uuid;

create index if not exists idx_club_events_club_starts
  on public.club_events (club_id, starts_at);
create index if not exists idx_club_challenges_club_created
  on public.club_challenges (club_id, created_at desc);

-- ── 2. Helpers d'appartenance (SECURITY DEFINER, search_path verrouillé) ───
create or replace function public.lkdv_is_club_member(
  p_club uuid,
  p_statuses text[] default array['active']
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.club_members cm
     where cm.club_id = p_club
       and cm.user_id = auth.uid()
       and cm.status = any (p_statuses)
  );
$$;

create or replace function public.lkdv_is_club_moderator(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.club_members cm
     where cm.club_id = p_club
       and cm.user_id = auth.uid()
       and cm.status = 'active'
       and cm.role in ('admin', 'moderator')
  );
$$;

revoke all on function public.lkdv_is_club_member(uuid, text[]) from public;
revoke all on function public.lkdv_is_club_moderator(uuid) from public;
grant execute on function public.lkdv_is_club_member(uuid, text[]) to authenticated;
grant execute on function public.lkdv_is_club_moderator(uuid) to authenticated;

-- Les policies historiques réservent l’écriture au créateur ou au membre
-- lui-même. Les RPC/écrans G02 doivent aussi permettre à un admin/modérateur
-- actif de gérer les adhésions, les demandes et la fiche du club : ces policies
-- sont additives (OR) et ne retirent aucun droit existant.
drop policy if exists clubs_g02_moderator_update on public.clubs;
create policy clubs_g02_moderator_update on public.clubs
  for update to authenticated using (public.lkdv_is_club_moderator(id))
  with check (public.lkdv_is_club_moderator(id));

drop policy if exists club_members_g02_moderator_insert on public.club_members;
create policy club_members_g02_moderator_insert on public.club_members
  for insert to authenticated with check (public.lkdv_is_club_moderator(club_id));

drop policy if exists club_members_g02_moderator_update on public.club_members;
create policy club_members_g02_moderator_update on public.club_members
  for update to authenticated using (public.lkdv_is_club_moderator(club_id))
  with check (public.lkdv_is_club_moderator(club_id));

drop policy if exists club_members_g02_moderator_delete on public.club_members;
create policy club_members_g02_moderator_delete on public.club_members
  for delete to authenticated using (public.lkdv_is_club_moderator(club_id));

drop policy if exists club_join_requests_g02_moderator_update on public.club_join_requests;
create policy club_join_requests_g02_moderator_update on public.club_join_requests
  for update to authenticated using (public.lkdv_is_club_moderator(club_id))
  with check (public.lkdv_is_club_moderator(club_id));

drop policy if exists club_events_g02_moderator_update on public.club_events;
create policy club_events_g02_moderator_update on public.club_events
  for update to authenticated using (public.lkdv_is_club_moderator(club_id))
  with check (public.lkdv_is_club_moderator(club_id));

-- ── 3. Salons S5.07 ────────────────────────────────────────────────────────
create table if not exists public.club_channels (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  kind text not null default 'general'
    check (kind in ('general', 'announcements', 'events', 'custom')),
  read_only_for_members boolean not null default false,
  notifications_enabled_by_default boolean not null default true,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.club_channel_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.club_channels(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_id uuid not null references public.user_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  hidden_by_moderator_id uuid references public.user_profiles(id) on delete set null,
  hidden_reason text,
  deleted_at timestamptz
);

create table if not exists public.club_content_reports (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  channel_id uuid not null references public.club_channels(id) on delete cascade,
  message_id uuid not null references public.club_channel_messages(id) on delete cascade,
  reporter_id uuid not null references public.user_profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 2 and 280),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_by uuid references public.user_profiles(id) on delete set null,
  resolved_at timestamptz,
  unique (message_id, reporter_id)
);

create index if not exists idx_club_channels_club on public.club_channels (club_id, created_at);
create index if not exists idx_club_messages_channel on public.club_channel_messages (channel_id, created_at);
create index if not exists idx_club_reports_club on public.club_content_reports (club_id, status);

alter table public.club_channels enable row level security;
alter table public.club_channel_messages enable row level security;
alter table public.club_content_reports enable row level security;

drop policy if exists club_channels_member_read on public.club_channels;
create policy club_channels_member_read on public.club_channels
  for select to authenticated using (public.lkdv_is_club_member(club_id));

drop policy if exists club_channels_moderator_write on public.club_channels;
create policy club_channels_moderator_write on public.club_channels
  for insert to authenticated with check (public.lkdv_is_club_moderator(club_id));

drop policy if exists club_messages_member_read on public.club_channel_messages;
create policy club_messages_member_read on public.club_channel_messages
  for select to authenticated using (public.lkdv_is_club_member(club_id));

drop policy if exists club_messages_member_insert on public.club_channel_messages;
create policy club_messages_member_insert on public.club_channel_messages
  for insert to authenticated with check (
    author_id = auth.uid() and public.lkdv_is_club_member(club_id)
  );

drop policy if exists club_messages_author_update on public.club_channel_messages;
create policy club_messages_author_update on public.club_channel_messages
  for update to authenticated using (
    public.lkdv_is_club_moderator(club_id) or author_id = auth.uid()
  ) with check (
    public.lkdv_is_club_moderator(club_id) or author_id = auth.uid()
  );

drop policy if exists club_messages_author_delete on public.club_channel_messages;
create policy club_messages_author_delete on public.club_channel_messages
  for delete to authenticated using (
    public.lkdv_is_club_moderator(club_id) or author_id = auth.uid()
  );

drop policy if exists club_reports_member_insert on public.club_content_reports;
create policy club_reports_member_insert on public.club_content_reports
  for insert to authenticated with check (
    reporter_id = auth.uid() and public.lkdv_is_club_member(club_id)
  );

drop policy if exists club_reports_moderator_read on public.club_content_reports;
create policy club_reports_moderator_read on public.club_content_reports
  for select to authenticated using (public.lkdv_is_club_moderator(club_id));

drop policy if exists club_reports_moderator_update on public.club_content_reports;
create policy club_reports_moderator_update on public.club_content_reports
  for update to authenticated using (public.lkdv_is_club_moderator(club_id))
  with check (public.lkdv_is_club_moderator(club_id));

-- ── 4. Sorties K5.21 / K5.23 / S5.13–S5.16 ────────────────────────────────
create table if not exists public.club_event_registrations (
  event_id uuid not null references public.club_events(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'registered'
    check (status in ('registered', 'waitlist', 'cancelled')),
  pace_group_id text,
  invited_by_user_id uuid references public.user_profiles(id) on delete set null,
  invite_id uuid,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.club_event_attendance (
  event_id uuid not null references public.club_events(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  activity_id uuid not null,
  consent_granted boolean not null default false,
  activity_visibility text not null default 'private'
    check (activity_visibility in ('public', 'friends', 'club_only', 'private')),
  matched_at timestamptz not null default now(),
  primary key (event_id, activity_id)
);

create table if not exists public.club_event_route_revisions (
  event_id uuid not null references public.club_events(id) on delete cascade,
  revision integer not null check (revision > 0),
  route_id text not null,
  checksum text not null,
  distance_m numeric not null check (distance_m >= 0),
  elevation_gain_m numeric not null default 0 check (elevation_gain_m >= 0),
  updated_by uuid not null references public.user_profiles(id) on delete cascade,
  updated_at timestamptz not null default now(),
  requires_participant_decision boolean not null default false,
  primary key (event_id, revision)
);

create table if not exists public.club_event_route_sync (
  event_id uuid not null references public.club_events(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  last_synced_revision integer not null default 0,
  pending_revision integer,
  decision_required boolean not null default false,
  revoked boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists idx_club_event_regs_event on public.club_event_registrations (event_id, status);
create index if not exists idx_club_event_attendance_event on public.club_event_attendance (event_id);

alter table public.club_event_registrations enable row level security;
alter table public.club_event_attendance enable row level security;
alter table public.club_event_route_revisions enable row level security;
alter table public.club_event_route_sync enable row level security;

drop policy if exists club_event_regs_read on public.club_event_registrations;
create policy club_event_regs_read on public.club_event_registrations
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.club_events e
       where e.id = event_id and public.lkdv_is_club_moderator(e.club_id)
    )
  );

drop policy if exists club_event_regs_insert on public.club_event_registrations;
create policy club_event_regs_insert on public.club_event_registrations
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists club_event_regs_update on public.club_event_registrations;
create policy club_event_regs_update on public.club_event_registrations
  for update to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.club_events e
       where e.id = event_id and public.lkdv_is_club_moderator(e.club_id)
    )
  ) with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.club_events e
       where e.id = event_id and public.lkdv_is_club_moderator(e.club_id)
    )
  );

drop policy if exists club_event_attendance_read on public.club_event_attendance;
create policy club_event_attendance_read on public.club_event_attendance
  for select to authenticated using (
    (user_id = auth.uid() and consent_granted)
    or exists (
      select 1 from public.club_events e
       where e.id = event_id and public.lkdv_is_club_moderator(e.club_id)
    )
  );

drop policy if exists club_event_attendance_insert on public.club_event_attendance;
create policy club_event_attendance_insert on public.club_event_attendance
  for insert to authenticated with check (user_id = auth.uid() and consent_granted);

drop policy if exists club_event_route_rev_read on public.club_event_route_revisions;
create policy club_event_route_rev_read on public.club_event_route_revisions
  for select to authenticated using (
    exists (
      select 1 from public.club_events e
       where e.id = event_id and public.lkdv_is_club_member(e.club_id)
    )
  );

drop policy if exists club_event_route_rev_insert on public.club_event_route_revisions;
create policy club_event_route_rev_insert on public.club_event_route_revisions
  for insert to authenticated with check (
    exists (
      select 1 from public.club_events e
       where e.id = event_id and public.lkdv_is_club_moderator(e.club_id)
    )
  );

drop policy if exists club_event_route_sync_read on public.club_event_route_sync;
create policy club_event_route_sync_read on public.club_event_route_sync
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.club_events e
       where e.id = event_id and public.lkdv_is_club_moderator(e.club_id)
    )
  );

drop policy if exists club_event_route_sync_write on public.club_event_route_sync;
create policy club_event_route_sync_write on public.club_event_route_sync
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists club_event_route_sync_update on public.club_event_route_sync;
create policy club_event_route_sync_update on public.club_event_route_sync
  for update to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.club_events e
       where e.id = event_id and public.lkdv_is_club_moderator(e.club_id)
    )
  ) with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.club_events e
       where e.id = event_id and public.lkdv_is_club_moderator(e.club_id)
    )
  );

-- ── 5. Invitations K5.21 / K5.22 / S5.19 ──────────────────────────────────
create table if not exists public.club_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  kind text not null check (kind in ('club', 'event', 'recorded_activity')),
  target_id text not null,
  club_id uuid references public.clubs(id) on delete cascade,
  created_by uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses >= 1),
  uses_count integer not null default 0 check (uses_count >= 0),
  revoked_at timestamptz,
  share_url text not null default '',
  qr_payload text not null default ''
);

create table if not exists public.club_recorded_activity_invites (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  owner_user_id uuid not null references public.user_profiles(id) on delete cascade,
  invitee_user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (activity_id, invitee_user_id)
);

create index if not exists idx_club_invites_club on public.club_invites (club_id, created_at desc);
create index if not exists idx_club_activity_invites_invitee on public.club_recorded_activity_invites (invitee_user_id, status);

alter table public.club_invites enable row level security;
alter table public.club_recorded_activity_invites enable row level security;

drop policy if exists club_invites_creator_read on public.club_invites;
create policy club_invites_creator_read on public.club_invites
  for select to authenticated using (
    created_by = auth.uid()
    or (club_id is not null and public.lkdv_is_club_moderator(club_id))
  );

drop policy if exists club_invites_creator_insert on public.club_invites;
create policy club_invites_creator_insert on public.club_invites
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists club_invites_creator_update on public.club_invites;
create policy club_invites_creator_update on public.club_invites
  for update to authenticated using (
    created_by = auth.uid()
    or (club_id is not null and public.lkdv_is_club_moderator(club_id))
  ) with check (
    created_by = auth.uid()
    or (club_id is not null and public.lkdv_is_club_moderator(club_id))
  );

drop policy if exists club_activity_invites_read on public.club_recorded_activity_invites;
create policy club_activity_invites_read on public.club_recorded_activity_invites
  for select to authenticated using (
    owner_user_id = auth.uid() or invitee_user_id = auth.uid()
  );

drop policy if exists club_activity_invites_insert on public.club_recorded_activity_invites;
create policy club_activity_invites_insert on public.club_recorded_activity_invites
  for insert to authenticated with check (owner_user_id = auth.uid());

drop policy if exists club_activity_invites_update on public.club_recorded_activity_invites;
create policy club_activity_invites_update on public.club_recorded_activity_invites
  for update to authenticated using (
    owner_user_id = auth.uid() or invitee_user_id = auth.uid()
  ) with check (
    owner_user_id = auth.uid() or invitee_user_id = auth.uid()
  );

-- ── 6. Défis & progression ─────────────────────────────────────────────────
create table if not exists public.club_challenge_progress (
  challenge_id uuid not null references public.club_challenges(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  current_value numeric not null default 0 check (current_value >= 0),
  recorded_activity_ids uuid[] not null default '{}'::uuid[],
  completed_at timestamptz,
  badge_id text,
  badge_title text,
  badge_icon text,
  badge_awarded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

alter table public.club_challenge_progress enable row level security;

drop policy if exists club_challenge_progress_read on public.club_challenge_progress;
create policy club_challenge_progress_read on public.club_challenge_progress
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.club_challenges c
       where c.id = challenge_id and c.club_id is not null
         and public.lkdv_is_club_member(c.club_id)
    )
  );

drop policy if exists club_challenge_progress_write on public.club_challenge_progress;
create policy club_challenge_progress_write on public.club_challenge_progress
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists club_challenge_progress_update on public.club_challenge_progress;
create policy club_challenge_progress_update on public.club_challenge_progress
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 7. Appariement S5.17 / S5.18 ───────────────────────────────────────────
create table if not exists public.club_activity_matches (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  event_id uuid not null references public.club_events(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  confidence_score numeric not null default 0 check (confidence_score between 0 and 1),
  matched_at timestamptz not null default now(),
  detached_at timestamptz,
  unique (activity_id, event_id)
);

create index if not exists idx_club_matches_event on public.club_activity_matches (event_id, detached_at);

alter table public.club_activity_matches enable row level security;

drop policy if exists club_matches_read on public.club_activity_matches;
create policy club_matches_read on public.club_activity_matches
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.club_events e
       where e.id = event_id and public.lkdv_is_club_moderator(e.club_id)
    )
  );

drop policy if exists club_matches_insert on public.club_activity_matches;
create policy club_matches_insert on public.club_activity_matches
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists club_matches_update on public.club_activity_matches;
create policy club_matches_update on public.club_activity_matches
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 8. Classement hebdomadaire : lecture agrégée par club ──────────────────
-- `activities` est en RLS « propriétaire uniquement ». Le classement a besoin
-- des activités des autres membres : la fonction SECURITY DEFINER ci-dessous
-- ne renvoie que les activités des membres actifs du club demandé, et refuse
-- l'appel si l'appelant n'est pas lui-même membre actif.
create or replace function public.lkdv_club_week_activities(
  p_club uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  id uuid,
  user_id uuid,
  started_at timestamptz,
  ended_at timestamptz,
  distance_km numeric,
  duration_seconds integer,
  elevation_gain_m numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.user_id, a.started_at, a.ended_at, a.distance_km, a.duration_seconds, 0::numeric
    from public.activities a
    join public.club_members cm
      on cm.user_id = a.user_id
     and cm.club_id = p_club
     and cm.status = 'active'
   where public.lkdv_is_club_member(p_club)
     and a.started_at >= p_start
     and a.started_at < p_end;
$$;

revoke all on function public.lkdv_club_week_activities(uuid, timestamptz, timestamptz) from public;
grant execute on function public.lkdv_club_week_activities(uuid, timestamptz, timestamptz) to authenticated;

-- Lecture ciblée par token : une politique RLS ne peut pas filtrer sur un
-- token sans exposer toute la table. La fonction SECURITY DEFINER ne renvoie
-- que la ligne du token fourni, et seulement à un utilisateur authentifié.
create or replace function public.lkdv_get_club_invite(p_token text)
returns setof public.club_invites
language sql
stable
security definer
set search_path = public
as $$
  select *
    from public.club_invites
   where token = p_token
   limit 1;
$$;

revoke all on function public.lkdv_get_club_invite(text) from public;
grant execute on function public.lkdv_get_club_invite(text) to authenticated;

-- ── 9. Consommation atomique d'une invitation ──────────────────────────────
create or replace function public.lkdv_redeem_club_invite(p_token text)
returns table (uses_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;

  update public.club_invites i
     set uses_count = i.uses_count + 1
   where i.token = p_token
     and i.revoked_at is null
     and (i.expires_at is null or i.expires_at > now())
     and (i.max_uses is null or i.uses_count < i.max_uses)
  returning i.uses_count into v_count;

  if v_count is null then
    raise exception 'Invitation invalide, expirée ou épuisée.' using errcode = 'P0002';
  end if;

  return query select v_count;
end;
$$;

revoke all on function public.lkdv_redeem_club_invite(text) from public;
grant execute on function public.lkdv_redeem_club_invite(text) to authenticated;

comment on table public.club_channels is
  'Lot G02 — salons de club (S5.07), lecture réservée aux membres actifs.';
comment on table public.club_event_registrations is
  'Lot G02 — inscriptions et liste d’attente des sorties de club (K5.21).';
comment on table public.club_event_route_revisions is
  'Lot G02 — révisions immuables du tracé partagé d’une sortie (K5.23).';
comment on table public.club_invites is
  'Lot G02 — liens/QR d’invitation club, sortie ou trace, avec quota et expiration.';
comment on function public.lkdv_club_week_activities(uuid, timestamptz, timestamptz) is
  'Lot G02 — activités de la semaine des membres actifs du club, réservée aux membres actifs (classement S5.11).';
comment on function public.lkdv_redeem_club_invite(text) is
  'Lot G02 — incrément atomique de uses_count d’une invitation valide (K5.22).';
