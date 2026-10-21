-- 2026-10-21 — Lancement mondial : durcissement stockage, compteurs, contenus, realtime.
-- Migration additive et réversible par politiques ; aucune donnée métier supprimée.

-- ---------------------------------------------------------------------------
-- 1. Storage : fermer les uploads anonymes et vérifier le propriétaire.
-- ---------------------------------------------------------------------------

drop policy if exists "Upload authentifié carnet-media" on storage.objects;
drop policy if exists "Upload authentifié gear-photos" on storage.objects;
drop policy if exists "stories-private upload propriétaire" on storage.objects;
drop policy if exists "storage_insert_message_attachments" on storage.objects;
drop policy if exists "Admin manage product-images" on storage.objects;

create policy "carnet_media_insert_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'carnet-media'
  and (
    ((storage.foldername(name))[1] = 'community-posts'
      and (storage.foldername(name))[2] = (select auth.uid())::text)
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
  and coalesce((metadata->>'size')::bigint, 0) <= 10485760
  and lower(split_part(name, '.', -1)) in ('jpg','jpeg','png','webp','heic','heif')
);

create policy "gear_photos_insert_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'gear-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce((metadata->>'size')::bigint, 0) <= 10485760
  and lower(split_part(name, '.', -1)) in ('jpg','jpeg','png','webp','heic','heif')
);

create policy "stories_private_insert_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'stories-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce((metadata->>'size')::bigint, 0) <= 26214400
);

create policy "message_attachments_insert_member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and public.is_conversation_member(
    ((storage.foldername(name))[1])::uuid,
    (select auth.uid())
  )
  and coalesce((metadata->>'size')::bigint, 0) <= 26214400
);

create policy "product_images_admin_write"
on storage.objects for all to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

create policy "group_media_insert_member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'group-media'
  and (
    public.is_group_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
    or public.is_club_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  )
  and coalesce((metadata->>'size')::bigint, 0) <= 10485760
);

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif']
where id in ('carnet-media','gear-photos');

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'product-images';

update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp']
where id = 'user-documents';

-- ---------------------------------------------------------------------------
-- 2. Likes : une seule source de vérité (trigger), plus de double comptage.
-- ---------------------------------------------------------------------------

create or replace function public.toggle_community_post_like(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1 from public.post_likes
    where post_id = p_post_id and user_id = v_user_id
  ) then
    delete from public.post_likes
    where post_id = p_post_id and user_id = v_user_id;
  else
    insert into public.post_likes (post_id, user_id)
    values (p_post_id, v_user_id)
    on conflict (post_id, user_id) do nothing;
  end if;
end;
$function$;

revoke execute on function public.toggle_community_post_like(uuid) from public, anon;
grant execute on function public.toggle_community_post_like(uuid) to authenticated;

update public.community_posts p
set likes_count = (select count(*) from public.post_likes l where l.post_id = p.id);

update public.community_posts p
set comments_count = (select count(*) from public.post_comments c where c.post_id = p.id);

-- ---------------------------------------------------------------------------
-- 3. Contenus : bornes explicites et validation des CHECK existants.
-- ---------------------------------------------------------------------------

alter table public.community_posts validate constraint community_posts_content_bounds;

alter table public.post_comments
  add constraint post_comments_content_bounds
  check (char_length(btrim(content)) between 1 and 5000) not valid;
alter table public.post_comments validate constraint post_comments_content_bounds;

alter table public.messages
  add constraint messages_content_bounds
  check (char_length(content) <= 10000) not valid;
alter table public.messages validate constraint messages_content_bounds;

-- ---------------------------------------------------------------------------
-- 4. Index chauds pour le compte / la communauté.
-- ---------------------------------------------------------------------------

create index if not exists idx_notifications_user_unread_created
  on public.notifications (user_id, read, created_at desc);

create index if not exists idx_post_comments_post_created
  on public.post_comments (post_id, created_at);

create index if not exists idx_post_comments_parent_created
  on public.post_comments (parent_id, created_at);

create index if not exists idx_community_posts_audience_created
  on public.community_posts (audience, created_at desc);

create index if not exists idx_hike_sessions_user_started
  on public.hike_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- 5. Realtime : commentaires et notifications.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_comments'
  ) then
    execute 'alter publication supabase_realtime add table public.post_comments';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Profils publics : retirer les profils de démonstration de la projection.
--    La vue reste une projection contrôlée (colonnes publiques uniquement).
-- ---------------------------------------------------------------------------

create or replace view public.public_profiles as
select id, full_name, avatar_url, bio, location, website,
       trust_score, loyalty_points, loyalty_level, xp, level, created_at
from public.user_profiles
where is_demo = false;

grant select on public.public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. spatial_ref_sys : RLS activée avec lecture publique des référentiels SRID.
--    Donnée système non sensible ; nécessaire aux transformations PostGIS.
-- ---------------------------------------------------------------------------

alter table public.spatial_ref_sys enable row level security;

drop policy if exists spatial_ref_sys_read on public.spatial_ref_sys;
create policy spatial_ref_sys_read
on public.spatial_ref_sys for select to anon, authenticated
using (true);
