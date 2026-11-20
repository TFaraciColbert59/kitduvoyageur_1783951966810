insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hub-carnet-media', 'hub-carnet-media', false, 26214400, array[
  'image/jpeg', 'image/png',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mp4', 'audio/aac', 'audio/webm', 'audio/ogg'
])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy hub_carnet_media_read on storage.objects
for select to authenticated, anon
using (bucket_id = 'hub-carnet-media' and
  case when (storage.foldername(name))[2] = 'carnet-moments'
    and (storage.foldername(name))[3] ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then public.can_view_carnet(((storage.foldername(name))[3])::uuid)
  else false end
);

create policy hub_carnet_media_write on storage.objects
for insert to authenticated
with check (bucket_id = 'hub-carnet-media' and
  (storage.foldername(name))[1] = (select auth.uid())::text and
  case when (storage.foldername(name))[2] = 'carnet-moments'
    and (storage.foldername(name))[3] ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then public.is_carnet_editor(((storage.foldername(name))[3])::uuid)
  else false end
);

create policy hub_carnet_media_delete_own on storage.objects
for delete to authenticated
using (bucket_id = 'hub-carnet-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
