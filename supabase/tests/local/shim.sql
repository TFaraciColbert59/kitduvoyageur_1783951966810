-- Shim minimal pour valider les migrations LKDV Control hors production.
-- Reproduit uniquement les objets touchés par M00→M15, avec les colonnes
-- réellement utilisées (relevé information_schema du 2026-11-09).
create extension if not exists pgcrypto;

-- ── auth ───────────────────────────────────────────────────────────────────
create schema if not exists auth;
create schema if not exists realtime;
create schema if not exists extensions;
do $$ begin create domain extensions.vector as text; exception when duplicate_object then null; end $$;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  aud text default 'authenticated',
  role text default 'authenticated',
  encrypted_password text,
  raw_app_meta_data jsonb default '{}',
  raw_user_meta_data jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  deleted_at timestamptz,
  is_anonymous boolean default false,
  is_sso_user boolean default false
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub', ''), '')::uuid;
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'role', current_user);
$$;

-- ── enums & tables public ──────────────────────────────────────────────────
do $$ begin
  create type public.admin_role as enum ('super_admin','admin','moderateur');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.group_member_role as enum ('member','organizer','admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.group_member_status as enum ('active','invited','left');
exception when duplicate_object then null; end $$;

create table if not exists public.user_profiles (
  id uuid primary key,
  email text not null default '',
  full_name text not null default '',
  avatar_url text default '',
  trust_score integer default 50,
  loyalty_points integer default 0,
  loyalty_level text default 'Explorateur',
  bio text default '',
  location text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  xp integer default 0,
  level integer default 1,
  role text not null default 'user',
  phone text default '',
  website text default '',
  notification_prefs jsonb default '{}',
  two_fa_enabled boolean default false,
  is_suspended_groups boolean default false,
  age_confirmed_at timestamptz,
  suspended_from_groups_at timestamptz,
  signature_visibility text not null default 'private',
  is_demo boolean not null default false,
  handle text not null default '',
  profile_visibility text not null default 'public',
  cover_url text,
  links jsonb not null default '[]'
);

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  role public.admin_role not null default 'moderateur',
  created_at timestamptz default now(),
  created_by uuid
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid,
  content text not null default '',
  image_url text default '',
  image_alt text default '',
  post_type text default 'post',
  likes_count integer default 0,
  comments_count integer default 0,
  shares_count integer default 0,
  is_trending boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  title text default '',
  mentions uuid[] not null default '{}',
  media_urls jsonb not null default '[]',
  audience text not null default 'public',
  club_id uuid,
  linked_kit_id uuid,
  reposted_from_id uuid,
  linked_carnet_id uuid
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid, author_id uuid, content text not null, created_at timestamptz default now(), parent_id uuid
);

create table if not exists public.post_stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null, image_url text, caption text,
  visibility text not null default 'public', club_id uuid,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(), media_type text not null default 'image',
  status text not null default 'ready', moderation_state text not null default 'visible'
);

create table if not exists public.carnets (
  id uuid primary key default gen_random_uuid(),
  author_id uuid, title text, destination text, visibility text default 'public',
  verified boolean default false, live_sharing boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.carnet_comments (
  id uuid primary key default gen_random_uuid(), carnet_id uuid, author_id uuid,
  content text not null default '', created_at timestamptz default now()
);
create table if not exists public.carnet_day_comments (
  id uuid primary key default gen_random_uuid(), carnet_id uuid not null, jour_numero integer not null,
  author_id uuid not null, content text not null, parent_id uuid,
  created_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.carnet_moment_comments (
  id uuid primary key default gen_random_uuid(), moment_id uuid not null,
  author_id uuid, content text not null, parent_id uuid,
  created_at timestamptz not null default now(), deleted_at timestamptz
);

create table if not exists public.place_reviews (
  id uuid primary key default gen_random_uuid(), place_id uuid not null, author_id uuid,
  rating integer not null, comment text not null, has_field_proof boolean not null default false,
  visit_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  trip_id uuid
);
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(), product_id uuid, author_id uuid,
  rating integer default 5, title text default '', content text default '',
  verified_purchase boolean default false, helpful_count integer default 0,
  created_at timestamptz default now()
);
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(), user_id uuid, type text, target_name text,
  rating integer, title text, comment text, verified boolean default false,
  helpful_count integer default 0, created_at timestamptz default now()
);

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(), slug text, name text, type text, emoji text,
  description text, cover_color text, cover_image text, category text, privacy text,
  members_count integer default 0, active_this_month integer default 0,
  is_verified boolean default false, created_by uuid, created_at timestamptz default now(),
  updated_at timestamptz default now(), country_iso text
);
create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(), club_id uuid, user_id uuid, role text,
  status text, joined_at timestamptz default now()
);
create table if not exists public.club_topics (
  id uuid primary key default gen_random_uuid(), club_id uuid, author_id uuid,
  title text not null, content text default '', is_pinned boolean default false,
  is_announcement boolean default false, is_approved boolean default true,
  likes_count integer default 0, replies_count integer default 0, reports_count integer default 0,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  mentions uuid[] not null default '{}', client_request_id uuid
);
create table if not exists public.club_topic_replies (
  id uuid primary key default gen_random_uuid(), topic_id uuid, author_id uuid,
  content text not null, is_approved boolean default true, likes_count integer default 0,
  created_at timestamptz default now(), parent_id uuid
);
create table if not exists public.club_events (
  id uuid primary key default gen_random_uuid(), club_id uuid, created_by uuid, title text,
  starts_at timestamptz, created_at timestamptz default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(), group_id uuid, user_id uuid,
  weight_capacity integer, joined_at timestamptz default now(),
  role public.group_member_role, status public.group_member_status, invited_by uuid
);

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(), post_id uuid, reporter_id uuid, reason text,
  details text, status text default 'pending', created_at timestamptz default now(),
  resolved_at timestamptz, resolved_by uuid, target_type text default 'post'
);
create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(), comment_id uuid, reporter_id uuid, reason text,
  table_name text, status text default 'pending', created_at timestamptz default now(),
  resolved_at timestamptz, resolved_by uuid
);
create table if not exists public.story_reports (
  id uuid primary key default gen_random_uuid(), story_id uuid, story_author_id uuid, reporter_id uuid,
  reason text, created_at timestamptz default now(), status text default 'pending',
  resolved_at timestamptz, resolved_by uuid
);
create table if not exists public.club_reports (
  id uuid primary key default gen_random_uuid(), club_id uuid, reporter_id uuid, target_type text,
  target_id uuid, reason text, status text default 'pending', created_at timestamptz default now()
);
create table if not exists public.group_reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid, reported_user_id uuid, group_id uuid,
  category text, reason text, severity text, status text default 'pending',
  created_at timestamptz default now(), resolved_at timestamptz, resolved_by uuid
);
create table if not exists public.place_reports (
  id uuid primary key default gen_random_uuid(), place_id uuid, reporter_id uuid, reason text, details text,
  status text default 'pending', created_at timestamptz default now(), resolved_by uuid,
  resolution text, resolution_reason text, resolved_at timestamptz
);
create table if not exists public.marketplace_reports (
  id uuid primary key default gen_random_uuid(), listing_id uuid, transaction_id uuid, reporter_id uuid,
  reason text, status text default 'open', resolution_note text, resolved_by uuid,
  created_at timestamptz default now(), resolved_at timestamptz
);
create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(), item_id uuid, owner_id uuid, name text, brand text,
  category text, condition text, photo_url text, mode text, description text, public_location text,
  price_cents integer, deposit_cents integer, status text, created_at timestamptz default now()
);
create table if not exists public.terrain_reports (
  id uuid primary key default gen_random_uuid(), segment_id bigint, reporter_id uuid, category text,
  severity text, passability text, description text, photo_url text, lat numeric, lng numeric,
  gps_accuracy_m numeric, direction text, source_type text, status text default 'pending',
  present_count integer default 0, gone_count integer default 0, unknown_count integer default 0,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  expires_at timestamptz, report_count integer default 0
);
create table if not exists public.pending_contributions (
  id uuid primary key default gen_random_uuid(), user_id uuid, action_type text, target_id uuid,
  target_type text, base_points integer, quality_score numeric, trust_score integer, final_points integer,
  status text default 'pending', rejection_reason text, metadata jsonb, created_at timestamptz default now(),
  validated_at timestamptz
);
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(), user_id uuid, product_ownership_id uuid, type text,
  severity text, message text, is_resolved boolean default false, resolved_at timestamptz,
  due_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, subject text not null,
  message text not null, status text not null default 'open', response text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.sos_alerts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, latitude numeric, longitude numeric,
  status text default 'active', created_at timestamptz default now(), accuracy_m numeric(6,1),
  battery smallint, session_id uuid, country_iso_a2 text, cancelled_at timestamptz,
  resolved_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, type text not null,
  title text not null, message text, read boolean default false, created_at timestamptz default now(),
  actor_id uuid, related_type text, related_id uuid, link text, read_at timestamptz,
  channels_sent jsonb default '[]', updated_at timestamptz default now(),
  group_count integer not null default 1, "group" text not null default 'system'
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid, order_number text not null,
  status text not null default 'pending', payment_method text not null default 'card',
  shipping_address jsonb not null default '{}', items jsonb not null default '[]',
  subtotal_eur numeric not null default 0, shipping_eur numeric not null default 0,
  total_eur numeric not null default 0, loyalty_points_earned integer not null default 0,
  notes text default '', created_at timestamptz default now(), updated_at timestamptz default now(),
  stripe_session_id text, payment_state text not null default 'pending',
  paid_merchandise_cents integer not null default 0, refunded_merchandise_cents integer not null default 0,
  tracking_url text, carrier text, estimated_delivery date
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid, sender_id uuid, content text,
  type text, gps_lat double precision, gps_lng double precision, gps_label text,
  gps_expires_at timestamptz, created_at timestamptz default now(), message_type text,
  reply_to_id uuid, metadata jsonb, deleted_at timestamptz, updated_at timestamptz default now()
);
create table if not exists public.qa_answers (
  id uuid primary key default gen_random_uuid(), question_id uuid, author_id uuid,
  content text, created_at timestamptz default now()
);
create table if not exists public.hike_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz default now()
);
create table if not exists public.trip_notes (
  id uuid primary key default gen_random_uuid(), trip_id uuid, author_id uuid,
  content text, created_at timestamptz default now()
);
create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(), trip_id uuid, user_id uuid,
  amount_eur numeric, created_at timestamptz default now()
);
create table if not exists public.trip_steps (
  id uuid primary key default gen_random_uuid(), trip_id uuid, title text,
  created_at timestamptz default now()
);
create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(), requester_id uuid, target_id uuid,
  status text default 'pending', created_at timestamptz default now()
);
create table if not exists public.trip_documents (
  id uuid primary key default gen_random_uuid(), trip_id uuid, user_id uuid, title text,
  category text, file_url text, file_name text, file_size_bytes bigint, mime_type text,
  expires_at date, notes text, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(), blocker_id uuid, blocked_id uuid,
  created_at timestamptz default now()
);
create table if not exists public.trip_safety_checkpoints (
  id uuid primary key default gen_random_uuid(), trip_id uuid, due_at timestamptz,
  status text default 'pending', created_at timestamptz default now()
);
create table if not exists public.feature_flags (
  id text primary key, enabled boolean default false, scope text default 'global',
  updated_at timestamptz default now(), updated_by uuid
);
create table if not exists public.app_errors (
  id bigint generated always as identity primary key, at timestamptz not null default now(),
  scope text, code text, message text
);
create table if not exists public.ops_daily_reports (
  id bigint generated always as identity primary key, created_at timestamptz default now(),
  report jsonb
);
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key, admin_id uuid, action text, cible_type text,
  cible_id uuid, avant jsonb, apres jsonb, created_at timestamptz default now()
);
create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key, admin_email text, action text,
  target_table text, target_id text, target_name text, old_data jsonb, new_data jsonb,
  created_at timestamptz default now()
);

-- ── vues ───────────────────────────────────────────────────────────────────
create or replace view public.hub_dashboard_kpis as select count(*)::double precision as dau_hub_pct_7d from public.user_profiles;
create or replace view public.public_profiles as
  select id, full_name, avatar_url, bio, location, website, trust_score, loyalty_points,
         loyalty_level, xp, level, created_at, handle, cover_url, links
    from public.user_profiles
   where (is_demo = false or (is_demo = true and email like '%@kitduvoyageur.fr'))
     and (profile_visibility = 'public' or id = auth.uid());

-- ── fonctions LKDV utilisées ───────────────────────────────────────────────
create or replace function public.is_admin() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.user_profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function public.is_moderateur() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.admin_roles ar where ar.user_id = auth.uid());
$$;
create or replace function public.is_anonymous_session() returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'is_anonymous', 'false')::boolean;
$$;
create or replace function public.match_pays_chat_chunks(p_query_embedding extensions.vector, p_country_code text, p_limit integer)
returns table (id uuid) language sql stable security definer as $$ select null::uuid where false; $$;
create or replace function public.guard_user_profile_privileged_columns() returns trigger language plpgsql as $$
begin return new; end; $$;
drop trigger if exists guard_user_profile_privileged_columns on public.user_profiles;
create trigger guard_user_profile_privileged_columns before insert or update on public.user_profiles
  for each row execute function public.guard_user_profile_privileged_columns();

-- ── realtime ───────────────────────────────────────────────────────────────
create table if not exists realtime.messages (
  id bigint generated always as identity primary key, topic text, extension text,
  payload jsonb, event text, private boolean default false, inserted_at timestamptz default now()
);
alter table realtime.messages enable row level security;
create or replace function realtime.topic() returns text language sql stable as $$
  select coalesce(current_setting('realtime.topic', true), '');
$$;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean)
returns void language plpgsql as $$
begin
  insert into realtime.messages (topic, event, payload, private) values (topic, event, payload, private);
end; $$;

-- privilèges par défaut Supabase (authenticated/anon ont ALL sur public)
grant all on all tables in schema public to authenticated, anon;
grant all on all sequences in schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon, public;
grant execute on all functions in schema public to authenticated, anon;
grant all on all tables in schema realtime to authenticated;
alter default privileges in schema public grant all on tables to authenticated, anon;

-- publications
do $$ begin
  create publication supabase_realtime;
exception when duplicate_object then null; end $$;
alter publication supabase_realtime add table public.notifications;


-- ── policies « production-like » minimales pour exercer la RLS ─────────────
grant usage on schema realtime to authenticated, anon;
grant select, insert on realtime.messages to authenticated;

alter table public.community_posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_stories enable row level security;
alter table public.carnet_comments enable row level security;
alter table public.carnet_day_comments enable row level security;
alter table public.carnet_moment_comments enable row level security;
alter table public.place_reviews enable row level security;
alter table public.product_reviews enable row level security;
alter table public.reviews enable row level security;
alter table public.qa_answers enable row level security;
alter table public.club_topics enable row level security;
alter table public.club_topic_replies enable row level security;
alter table public.carnets enable row level security;
alter table public.clubs enable row level security;
alter table public.club_events enable row level security;
alter table public.messages enable row level security;
alter table public.group_members enable row level security;
alter table public.hike_sessions enable row level security;
alter table public.trip_notes enable row level security;
alter table public.trip_expenses enable row level security;
alter table public.trip_steps enable row level security;
alter table public.follow_requests enable row level security;
alter table public.post_reports enable row level security;
alter table public.comment_reports enable row level security;
alter table public.story_reports enable row level security;
alter table public.club_reports enable row level security;
alter table public.group_reports enable row level security;
alter table public.place_reports enable row level security;
alter table public.marketplace_reports enable row level security;
alter table public.terrain_reports enable row level security;
alter table public.support_tickets enable row level security;
alter table public.sos_alerts enable row level security;
alter table public.notifications enable row level security;
alter table public.orders enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.pending_contributions enable row level security;
alter table public.alerts enable row level security;
alter table public.feature_flags enable row level security;

create policy shim_posts_read on public.community_posts for select to public
  using (audience = 'public' or author_id = auth.uid());
create policy shim_posts_write on public.community_posts for insert to authenticated
  with check (author_id = auth.uid());
create policy shim_posts_update on public.community_posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy shim_reports_read on public.post_reports for select to authenticated
  using (public.is_moderateur());
create policy shim_reports_write on public.post_reports for insert to authenticated
  with check (reporter_id = auth.uid());

create policy shim_tickets_own on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.is_moderateur());
create policy shim_tickets_insert on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid());
create policy shim_sos_own on public.sos_alerts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy shim_notif_own on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy shim_orders_own on public.orders for select to authenticated
  using (user_id = auth.uid());

do $$
declare r record;
  -- (table, colonne propriétaire)
  author_tables constant text[][] := array[
    ['post_comments','author_id'], ['carnet_comments','author_id'], ['carnet_day_comments','author_id'],
    ['carnet_moment_comments','author_id'], ['place_reviews','author_id'], ['product_reviews','author_id'],
    ['qa_answers','author_id'], ['club_topics','author_id'], ['club_topic_replies','author_id'],
    ['messages','sender_id'], ['hike_sessions','user_id'], ['trip_notes','author_id'],
    ['trip_expenses','user_id'], ['carnets','author_id'], ['reviews','user_id']
  ];
begin
  for i in 1 .. array_length(author_tables, 1) loop
    execute format('drop policy if exists shim_author_read on public.%I', author_tables[i][1]);
    execute format('create policy shim_author_read on public.%I for select to public using (true)', author_tables[i][1]);
    execute format('drop policy if exists shim_author_write on public.%I', author_tables[i][1]);
    execute format('create policy shim_author_write on public.%I for insert to authenticated with check (%I = auth.uid())',
                   author_tables[i][1], author_tables[i][2]);
    execute format('drop policy if exists shim_author_update on public.%I', author_tables[i][1]);
    execute format('create policy shim_author_update on public.%I for update to authenticated using (%I = auth.uid()) with check (%I = auth.uid())',
                   author_tables[i][1], author_tables[i][2], author_tables[i][2]);
  end loop;
end $$;

create policy shim_group_members on public.group_members for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy shim_trip_notes on public.trip_notes for all to authenticated using (true) with check (true);
create policy shim_trip_expenses on public.trip_expenses for all to authenticated using (true) with check (true);
create policy shim_trip_steps on public.trip_steps for all to authenticated using (true) with check (true);
create policy shim_follow on public.follow_requests for all to authenticated using (true) with check (true);
create policy shim_clubs on public.clubs for all to authenticated using (true) with check (true);
create policy shim_club_events on public.club_events for all to authenticated using (true) with check (true);
create policy shim_listings on public.marketplace_listings for all to authenticated using (true) with check (true);
create policy shim_contrib on public.pending_contributions for all to authenticated using (true) with check (true);
create policy shim_alerts on public.alerts for all to authenticated using (true) with check (true);
create policy shim_flags on public.feature_flags for all to authenticated using (true) with check (true);
create policy shim_terrain on public.terrain_reports for all to authenticated using (true) with check (true);
create policy shim_place_reports on public.place_reports for all to authenticated using (true) with check (true);
create policy shim_club_reports on public.club_reports for all to authenticated using (true) with check (true);
create policy shim_group_reports on public.group_reports for all to authenticated using (true) with check (true);
create policy shim_comment_reports on public.comment_reports for all to authenticated using (true) with check (true);
create policy shim_story_reports on public.story_reports for all to authenticated using (true) with check (true);
create policy shim_mkt_reports on public.marketplace_reports for all to authenticated using (true) with check (true);
