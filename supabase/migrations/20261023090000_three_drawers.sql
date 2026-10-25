-- Trois drawers : Réseau, Sortie, Compte.
-- Audit 2026-10-22 : public_profiles est une vue ; hike_session_photos existe
-- déjà (storage_path/position) ; story_close_friends existe pour la Cordée ;
-- notifications possède déjà actor_id/related_type/related_id/read_at.

-- 1. Profil : couverture et liens (bio existe déjà)
alter table public.user_profiles
  add column if not exists cover_url text,
  add column if not exists links jsonb not null default '[]'::jsonb;

-- 2. Vue publique : exposer la couverture et les liens sans casser la RLS
create or replace view public.public_profiles
with (security_invoker = true) as
select
  id, full_name, avatar_url, bio, location, website,
  trust_score, loyalty_points, loyalty_level, xp, level,
  created_at, handle, cover_url, links
from public.user_profiles
where is_demo = false
  and (
    profile_visibility = 'public'
    or id = auth.uid()
    or (
      profile_visibility = 'prive'
      and exists (
        select 1 from public.profile_invitations i
        where i.owner_id = user_profiles.id
          and i.status = 'accepted'
          and i.invitee_id = auth.uid()
          and (i.expires_at is null or i.expires_at > now())
      )
    )
  );

-- 3. Commandes : suivi transporteur
alter table public.orders
  add column if not exists tracking_url text,
  add column if not exists carrier text,
  add column if not exists estimated_delivery date;

-- 4. Notifications : groupe lisible (le reste existe déjà)
alter table public.notifications
  add column if not exists "group" text not null default 'system';

-- 5. Sorties : titre, altitude max, météo, notes (visibility/duration existent)
alter table public.hike_sessions
  add column if not exists title text,
  add column if not exists max_altitude_m integer,
  add column if not exists weather jsonb,
  add column if not exists notes text;

-- 6. Demandes d'abonnement (comptes privés)
create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.user_profiles(id) on delete cascade,
  target_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, target_id)
);

-- 7. Participants, kudos, commentaires, matériel d'une sortie
create table if not exists public.hike_session_participants (
  session_id uuid not null references public.hike_sessions(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role text not null default 'guest' check (role in ('owner','guest')),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.hike_session_kudos (
  session_id uuid not null references public.hike_sessions(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.hike_session_comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.hike_sessions(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  parent_id uuid references public.hike_session_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.hike_session_gear (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.hike_sessions(id) on delete cascade,
  kit_id uuid references public.materiel_kits(id) on delete set null,
  item_name text not null,
  weight_g integer,
  created_at timestamptz not null default now()
);

-- 8. Partage de profil, vues agrégées, sessions
create table if not exists public.profile_share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_views (
  id bigserial primary key,
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  viewer_id uuid references public.user_profiles(id) on delete set null,
  viewed_at timestamptz not null default now()
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  device text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- 9. Index
create index if not exists user_follows_following_idx on public.user_follows (following_id);
create index if not exists user_follows_follower_idx on public.user_follows (follower_id);
create index if not exists follow_requests_target_idx on public.follow_requests (target_id, status);
create index if not exists follow_requests_requester_idx on public.follow_requests (requester_id, status);
create index if not exists hike_session_participants_user_idx on public.hike_session_participants (user_id);
create index if not exists hike_session_comments_session_idx on public.hike_session_comments (session_id, created_at);
create index if not exists hike_session_gear_session_idx on public.hike_session_gear (session_id);
create index if not exists profile_views_profile_idx on public.profile_views (profile_id, viewed_at desc);
create index if not exists notifications_user_group_idx on public.notifications (user_id, "group", created_at desc);
