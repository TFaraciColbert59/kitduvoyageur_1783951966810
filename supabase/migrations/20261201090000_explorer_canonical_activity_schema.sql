-- ============================================================================
-- Lot 00 — Réconciliation Schéma Canonique Explorer, RPC finish_activity_session
-- (positions_timed + sport + trip_id + carnet_id), discard_activity_session,
-- et création des tables durables absentes (zéro split-brain).
--
-- Migration strictement additive et idempotente :
--   • Ne recrée aucune table existante (`user_privacy_zones`,
--     `activity_lifecycle_records`, `hike_session_gear`, `user_entitlements`).
--   • Préserve 100 % des signatures RPC existantes pour rétrocompatibilité
--     avec les binaires iOS déjà déployés.
--   • Applique RLS + FORCE RLS fail-closed sur toutes les nouvelles tables.
-- ============================================================================

begin;

-- ── 1. Extension déclarative de explorer_sport_variants + correctifs paires ──
alter table public.explorer_sport_variants
  add column if not exists canonical_slug text,
  add column if not exists legacy_slug_aliases text[] not null default '{}',
  add column if not exists family_id text not null default 'hiking_trekking',
  add column if not exists pipeline_id text not null default 'gps_outdoor',
  add column if not exists rollout_wave text not null default 'V1_SOCLE',
  add column if not exists spec_version text not null default '2.0.0',
  add column if not exists profile_spec jsonb not null default '{}'::jsonb,
  add column if not exists rgpd_art9_sensitive boolean not null default false,
  add column if not exists leaderboard_eligible boolean not null default true,
  add column if not exists fit_sport smallint,
  add column if not exists fit_sub_sport smallint,
  add column if not exists hk_activity_type text,
  add column if not exists strava_sport_type text,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'explorer_sport_variants_rollout_wave_check'
      and conrelid = 'public.explorer_sport_variants'::regclass
  ) then
    alter table public.explorer_sport_variants
      add constraint explorer_sport_variants_rollout_wave_check
      check (rollout_wave in ('V1_SOCLE', 'V2_SPECIALIZED', 'V3_HARDWARE_PRO'));
  end if;
end $$;

create unique index if not exists idx_explorer_sport_variants_canonical_slug
  on public.explorer_sport_variants (canonical_slug)
  where canonical_slug is not null;

create index if not exists idx_explorer_sport_variants_aliases
  on public.explorer_sport_variants using gin (legacy_slug_aliases);

create index if not exists idx_explorer_sport_variants_wave_family
  on public.explorer_sport_variants (rollout_wave, family_id)
  where is_active = true;

-- Garantit les paires prod connues (corrige FK 23503 natation-eau-libre et
-- collision TS/SQL rehab-marche sans casser l'existant).
insert into public.explorer_sport_variants (sport, variant_id) values
  ('kayak', 'natation-eau-libre'),
  ('kayak', 'natation-piscine'),
  ('rando', 'rehab-marche'),
  ('famille', 'rehab-marche')
on conflict (sport, variant_id) do nothing;

-- ── 2. Extension canonique de activity_sessions (zéro doublon RPE) ──────────
alter table public.activity_sessions
  add column if not exists canonical_slug text not null default 'hiking',
  add column if not exists spec_version text not null default '2.0.0',
  add column if not exists writer_lease_id uuid,
  add column if not exists source_origin text not null default 'lkdv_ios_native',
  add column if not exists external_source_id text,
  add column if not exists external_healthkit_uuid uuid,
  add column if not exists raw_trace_r2_key text,
  add column if not exists raw_points_count integer not null default 0,
  add column if not exists private_route_geom geometry(LineStringZ, 4326),
  add column if not exists public_route_geom geometry(LineStringZ, 4326),
  add column if not exists epz_applied boolean not null default false,
  add column if not exists rgpd_art9_sensitive boolean not null default false,
  add column if not exists ai_insight_allowed boolean not null default true,
  add column if not exists leaderboard_eligible boolean not null default true,
  add column if not exists vehicle_crop_applied boolean not null default false,
  add column if not exists visibility text not null default 'private',
  add column if not exists metric_bundle jsonb not null default '{}'::jsonb,
  add column if not exists trip_id uuid,
  add column if not exists carnet_id uuid,
  add column if not exists club_event_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'activity_sessions_source_origin_check'
      and conrelid = 'public.activity_sessions'::regclass
  ) then
    alter table public.activity_sessions
      add constraint activity_sessions_source_origin_check
      check (source_origin in (
        'lkdv_ios_native', 'lkdv_web', 'apple_healthkit', 'garmin_fit',
        'coros_fit', 'suunto_fit', 'strava_api', 'gpx_upload', 'manual_entry'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'activity_sessions_visibility_check'
      and conrelid = 'public.activity_sessions'::regclass
  ) then
    alter table public.activity_sessions
      add constraint activity_sessions_visibility_check
      check (visibility in ('private', 'followers', 'club', 'public'));
  end if;

  -- Verrou juridique RGPD Art. 9 : une séance clinique/réhab est toujours privée,
  -- interdite d'IA tiers et exclue des classements.
  if not exists (
    select 1 from pg_constraint
    where conname = 'activity_sessions_rgpd_art9_guard'
      and conrelid = 'public.activity_sessions'::regclass
  ) then
    alter table public.activity_sessions
      add constraint activity_sessions_rgpd_art9_guard
      check (
        not rgpd_art9_sensitive
        or (visibility = 'private' and ai_insight_allowed = false and leaderboard_eligible = false)
      );
  end if;

  -- Verrou CGU Strava 2024+ : interdiction IA/ML sur toute donnée Strava API.
  if not exists (
    select 1 from pg_constraint
    where conname = 'activity_sessions_strava_ai_guard'
      and conrelid = 'public.activity_sessions'::regclass
  ) then
    alter table public.activity_sessions
      add constraint activity_sessions_strava_ai_guard
      check (source_origin <> 'strava_api' or ai_insight_allowed = false);
  end if;
end $$;

create index if not exists idx_activity_sessions_public_geom
  on public.activity_sessions using gist (public_route_geom)
  where public_route_geom is not null;

create unique index if not exists idx_activity_sessions_ext_dedup
  on public.activity_sessions (user_id, source_origin, external_source_id)
  where external_source_id is not null;

-- Colonnes de projection complémentaires sur hike_sessions (rpe existe déjà).
alter table public.hike_sessions
  add column if not exists sport text,
  add column if not exists trip_id uuid,
  add column if not exists carnet_id uuid,
  add column if not exists club_event_id uuid;

-- ── 3. Réconciliation user_privacy_zones (auto-portant + additif) ──────────
create table if not exists public.user_privacy_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  radius_m integer not null default 500 check (radius_m between 200 and 5000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_privacy_zones_user_id
  on public.user_privacy_zones(user_id);

alter table public.user_privacy_zones enable row level security;
alter table public.user_privacy_zones force row level security;

drop policy if exists user_privacy_zones_select_own on public.user_privacy_zones;
create policy user_privacy_zones_select_own
  on public.user_privacy_zones for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists user_privacy_zones_insert_own on public.user_privacy_zones;
create policy user_privacy_zones_insert_own
  on public.user_privacy_zones for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists user_privacy_zones_update_own on public.user_privacy_zones;
create policy user_privacy_zones_update_own
  on public.user_privacy_zones for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists user_privacy_zones_delete_own on public.user_privacy_zones;
create policy user_privacy_zones_delete_own
  on public.user_privacy_zones for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists user_privacy_zones_all_service on public.user_privacy_zones;
create policy user_privacy_zones_all_service
  on public.user_privacy_zones for all to service_role
  using (true)
  with check (true);

revoke all on public.user_privacy_zones from anon;
grant select, insert, update, delete on public.user_privacy_zones to authenticated;
grant all on public.user_privacy_zones to service_role;

alter table public.user_privacy_zones
  add column if not exists zone_kind text not null default 'home',
  add column if not exists shifted_center_lat double precision,
  add column if not exists shifted_center_lng double precision,
  add column if not exists jitter_seed_hash text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_privacy_zones_zone_kind_check'
      and conrelid = 'public.user_privacy_zones'::regclass
  ) then
    alter table public.user_privacy_zones
      add constraint user_privacy_zones_zone_kind_check
      check (zone_kind in ('home', 'work', 'bivouac', 'custom'));
  end if;
end $$;

-- ── 4. Ledger d'usure matériel réversible ponté sur product_ownership ───────
create table if not exists public.gear_usage_ledger (
  ledger_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gear_item_id uuid not null references public.product_ownership(id) on delete cascade,
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  delta_km numeric(10,3) not null default 0,
  delta_hours numeric(8,3) not null default 0,
  delta_cycles integer not null default 0,
  entry_kind text not null check (entry_kind in ('initial', 'crop_adjustment', 'split_reallocation', 'reversal_delete')),
  created_at timestamptz not null default now()
);

create index if not exists idx_gear_usage_ledger_item
  on public.gear_usage_ledger (gear_item_id, created_at desc);
create index if not exists idx_gear_usage_ledger_session
  on public.gear_usage_ledger (session_id);

alter table public.gear_usage_ledger enable row level security;
alter table public.gear_usage_ledger force row level security;

drop policy if exists gear_usage_ledger_owner on public.gear_usage_ledger;
create policy gear_usage_ledger_owner on public.gear_usage_ledger
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── 5. Tables durables remplaçant les 3 stores in-memory + Outbox + Art.9 ───
create table if not exists public.live_beacons (
  beacon_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  share_token_hash text not null unique,
  scope text not null check (scope in ('guest_link', 'trip_members', 'carnet_followers', 'club_group')),
  trip_id uuid,
  carnet_id uuid,
  club_event_id uuid,
  status text not null check (status in ('active', 'paused', 'ended', 'revoked')),
  last_lat double precision,
  last_lng double precision,
  last_alt_m real,
  last_battery_pct smallint,
  last_ping_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_live_beacons_user_status
  on public.live_beacons (user_id, status, expires_at desc);

alter table public.live_beacons enable row level security;
alter table public.live_beacons force row level security;

drop policy if exists live_beacons_owner on public.live_beacons;
create policy live_beacons_owner on public.live_beacons
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.watch_devices (
  device_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vendor text not null check (vendor in ('apple_watch', 'garmin', 'coros', 'suunto', 'polar', 'wahoo')),
  external_device_uid text not null,
  model_name text not null,
  capabilities_json jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, vendor, external_device_uid)
);

alter table public.watch_devices enable row level security;
alter table public.watch_devices force row level security;

drop policy if exists watch_devices_owner on public.watch_devices;
create policy watch_devices_owner on public.watch_devices
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.external_connector_accounts (
  connector_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('garmin_health', 'coros', 'suunto', 'strava', 'komoot')),
  provider_user_id text not null,
  access_token_enc bytea not null,
  refresh_token_enc bytea,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null check (status in ('connected', 'expired', 'revoked', 'error')),
  updated_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);

alter table public.external_connector_accounts enable row level security;
alter table public.external_connector_accounts force row level security;

drop policy if exists external_connector_accounts_owner on public.external_connector_accounts;
create policy external_connector_accounts_owner on public.external_connector_accounts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.activity_domain_outbox (
  event_id uuid primary key,
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  payload jsonb not null,
  processed_consumers text[] not null default '{}',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_activity_domain_outbox_pending
  on public.activity_domain_outbox (created_at asc)
  where processed_at is null;

alter table public.activity_domain_outbox enable row level security;
alter table public.activity_domain_outbox force row level security;

drop policy if exists activity_domain_outbox_owner_select on public.activity_domain_outbox;
create policy activity_domain_outbox_owner_select on public.activity_domain_outbox
  for select to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.user_health_consents (
  consent_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('rgpd_art9_rehab', 'healthkit_read', 'healthkit_write')),
  policy_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, scope, policy_version)
);

alter table public.user_health_consents enable row level security;
alter table public.user_health_consents force row level security;

drop policy if exists user_health_consents_owner on public.user_health_consents;
create policy user_health_consents_owner on public.user_health_consents
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.apns_live_activity_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.activity_sessions(id) on delete cascade,
  token_kind text not null check (token_kind in ('push_to_start', 'activity_update')),
  apns_token text not null,
  environment text not null default 'production' check (environment in ('development', 'production')),
  updated_at timestamptz not null default now(),
  unique (user_id, token_kind, apns_token)
);

alter table public.apns_live_activity_tokens enable row level security;
alter table public.apns_live_activity_tokens force row level security;

drop policy if exists apns_live_activity_tokens_owner on public.apns_live_activity_tokens;
create policy apns_live_activity_tokens_owner on public.apns_live_activity_tokens
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── 6. Fix P0 RPC finish_activity_session : peuple positions_timed + sport ──
-- Signature identique (p_session uuid) pour 100 % rétrocompatibilité avec
-- finish_activity_session_idempotent et les clients iOS existants.
create or replace function public.finish_activity_session(p_session uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  s public.activity_sessions;
  v_summary_id uuid;
  v_track jsonb;
  v_timed jsonb;
begin
  select * into s from public.activity_sessions where id = p_session;
  if not found then
    raise exception 'session introuvable' using errcode = 'P0002';
  end if;
  if v_user is null or s.user_id <> v_user then
    raise exception 'session d''un autre utilisateur' using errcode = '42501';
  end if;
  if s.status = 'finished' then
    return null;
  end if;

  update public.activity_sessions
     set status = 'finished',
         ended_at = coalesce(ended_at, now()),
         updated_at = now()
   where id = p_session
     and status <> 'finished'
  returning * into s;

  if not found then
    return null;
  end if;

  select h.id into v_summary_id
    from public.hike_sessions h
   where h.user_id = s.user_id
     and h.activity_session_id = p_session
   limit 1;

  if v_summary_id is not null then
    return v_summary_id;
  end if;

  select
    jsonb_build_object(
      'type', 'LineString',
      'coordinates', coalesce(
        jsonb_agg(jsonb_build_array(lng, lat) order by t, coalesce(client_seq, 0)),
        '[]'::jsonb
      )
    ),
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'lat', lat,
          'lng', lng,
          'timestamp', floor(extract(epoch from t) * 1000)::bigint,
          'elevationM', ele,
          'accuracyM', acc,
          'speedMps', speed
        )
      )
      order by t, coalesce(client_seq, 0)
    )
  into v_track, v_timed
  from public.activity_points
  where session_id = p_session;

  insert into public.hike_sessions (
    user_id, route_id, sport, variant_id, activity_session_id,
    trip_id, carnet_id, club_event_id,
    started_at, ended_at,
    distance_km, duration_seconds, elevation_gain_m,
    positions_geojson, positions_timed,
    processing_status, visibility, title
  ) values (
    s.user_id,
    s.route_id,
    s.sport,
    case
      when s.variant_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$' then s.variant_id
      else null
    end,
    p_session,
    s.trip_id,
    s.carnet_id,
    s.club_event_id,
    s.started_at,
    coalesce(s.ended_at, now()),
    round((s.distance_m::numeric / 1000.0), 2),
    greatest(s.moving_s, extract(epoch from (coalesce(s.ended_at, now()) - s.started_at))::int),
    s.elev_gain_m,
    case when jsonb_array_length(coalesce(v_track->'coordinates', '[]'::jsonb)) > 1 then v_track else null end,
    case when v_timed is not null and jsonb_array_length(v_timed) > 0 then v_timed else null end,
    'pending',
    case when s.rgpd_art9_sensitive then 'private' else 'private' end,
    null
  )
  on conflict do nothing
  returning id into v_summary_id;

  if v_summary_id is null then
    select h.id into v_summary_id
      from public.hike_sessions h
     where h.user_id = s.user_id
       and h.activity_session_id = p_session
     limit 1;
  end if;

  return v_summary_id;
end;
$$;

revoke all on function public.finish_activity_session(uuid) from public;
grant execute on function public.finish_activity_session(uuid) to authenticated;

-- ── 7. RPC idempotente discard_activity_session (fix onDiscard orphelin) ────
create or replace function public.discard_activity_session(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_deleted_summaries integer := 0;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  select user_id into v_owner
    from public.activity_sessions
   where id = p_session
     for update;

  if not found then
    return jsonb_build_object('discarded', true, 'alreadyAbsent', true);
  end if;

  if v_owner <> v_user then
    raise exception 'séance d''un autre utilisateur' using errcode = '42501';
  end if;

  delete from public.hike_sessions
   where activity_session_id = p_session
     and user_id = v_user;
  get diagnostics v_deleted_summaries = row_count;

  delete from public.activity_points
   where session_id = p_session;

  update public.activity_sessions
     set status = 'abandoned',
         ended_at = coalesce(ended_at, now()),
         updated_at = now()
   where id = p_session
     and user_id = v_user;

  return jsonb_build_object(
    'discarded', true,
    'deletedSummaries', v_deleted_summaries
  );
end;
$$;

revoke all on function public.discard_activity_session(uuid) from public;
grant execute on function public.discard_activity_session(uuid) to authenticated;

commit;
