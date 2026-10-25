-- 2026-10-21 — Fondations des données réelles du Compte.
-- Handle public, visibilité de profil, photos de sortie, partages de post.

-- 1. Handle public + visibilité de profil.
alter table public.user_profiles add column if not exists handle text;
alter table public.user_profiles add column if not exists profile_visibility text;

update public.user_profiles
set handle = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g')) || '_' || left(id::text, 4)
where handle is null or btrim(handle) = '';

update public.user_profiles
set handle = 'user_' || left(id::text, 8)
where handle is null or btrim(handle) = '';

alter table public.user_profiles alter column handle set not null;

update public.user_profiles
set profile_visibility = 'public'
where profile_visibility is null;

alter table public.user_profiles alter column profile_visibility set default 'communaute';
alter table public.user_profiles alter column profile_visibility set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_profiles'::regclass
      and conname = 'user_profiles_profile_visibility_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_profile_visibility_check
      check (profile_visibility in ('private','communaute','public')) not valid;
  end if;
end $$;
alter table public.user_profiles validate constraint user_profiles_profile_visibility_check;

create unique index if not exists idx_user_profiles_handle_unique
  on public.user_profiles (lower(handle));

-- 2. Projection publique : handle + visibilité.
create or replace view public.public_profiles as
select id, full_name, avatar_url, bio, location, website,
       trust_score, loyalty_points, loyalty_level, xp, level, created_at, handle
from public.user_profiles
where is_demo = false
  and (
    profile_visibility = 'public'
    or (profile_visibility = 'communaute' and auth.uid() is not null)
    or id = auth.uid()
  );

grant select on public.public_profiles to anon, authenticated;

-- 3. Photos de sortie.
create table if not exists public.hike_session_photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.hike_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  caption text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (session_id, storage_path)
);

alter table public.hike_session_photos enable row level security;

drop policy if exists hike_session_photos_owner_all on public.hike_session_photos;
create policy hike_session_photos_owner_all
on public.hike_session_photos for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists idx_hike_session_photos_session
  on public.hike_session_photos (session_id, position);

-- 4. Partage d'un post dans une conversation.
create table if not exists public.post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.post_shares enable row level security;

drop policy if exists post_shares_insert_own on public.post_shares;
create policy post_shares_insert_own
on public.post_shares for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists post_shares_read_own on public.post_shares;
create policy post_shares_read_own
on public.post_shares for select to authenticated
using (user_id = auth.uid());

create index if not exists idx_post_shares_post
  on public.post_shares (post_id, created_at desc);

create or replace function public.sync_community_post_shares_count()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_post uuid := coalesce(new.post_id, old.post_id);
begin
  update public.community_posts p
  set shares_count = (select count(*) from public.post_shares s where s.post_id = v_post)
  where p.id = v_post;
  return null;
end;
$function$;

drop trigger if exists trg_community_post_shares_count on public.post_shares;
create trigger trg_community_post_shares_count
after insert or delete on public.post_shares
for each row execute function public.sync_community_post_shares_count();

-- 5. Bucket privé pour les photos de sortie.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('outing-media', 'outing-media', false, 26214400,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists outing_media_select_owner on storage.objects;
create policy outing_media_select_owner
on storage.objects for select to authenticated
using (
  bucket_id = 'outing-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists outing_media_insert_owner on storage.objects;
create policy outing_media_insert_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'outing-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce((metadata->>'size')::bigint, 0) <= 26214400
);

drop policy if exists outing_media_delete_owner on storage.objects;
create policy outing_media_delete_owner
on storage.objects for delete to authenticated
using (
  bucket_id = 'outing-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
