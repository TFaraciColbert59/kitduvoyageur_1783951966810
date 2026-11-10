-- Carnet v2 : stockage des notes vocales et des vidéos de moments (2026-11-10).
--
-- `carnet-media` est limité aux images (migration 20261021093000) : une note
-- vocale (MediaRecorder) ou une vidéo de moment y est refusée. Plutôt que
-- d'élargir ce seau durci (stories, publications), un seau dédié, additif :
--   * lecture publique (comme `carnet-media` : l'URL du moment est dans la fiche ;
--     les chemins portent un UUID non devinable) ;
--   * écriture réservée à la personne connectée, dans son propre dossier
--     `<auth.uid()>/…` (même règle que `carnet_media_insert_owner`) ;
--   * 25 Mo, audio et vidéo seulement, extensions listées.
-- Risque à connaître : un fichier d'un carnet privé reste lisible par qui
-- connaît l'URL exacte (même modèle que les photos de `carnet-media`).
-- Rollback : supabase/migrations_down/20261110100000_carnet_moments_media_bucket.down.sql

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'carnet-moments-media',
  'carnet-moments-media',
  true,
  26214400,
  array[
    'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/aac',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "carnet_moments_media_insert_owner" on storage.objects;
create policy "carnet_moments_media_insert_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'carnet-moments-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce((metadata->>'size')::bigint, 0) <= 26214400
  and lower(split_part(name, '.', -1)) in ('webm', 'm4a', 'ogg', 'mp3', 'aac', 'mp4', 'mov')
);

drop policy if exists "carnet_moments_media_delete_owner" on storage.objects;
create policy "carnet_moments_media_delete_owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'carnet-moments-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "carnet_moments_media_read_public" on storage.objects;
create policy "carnet_moments_media_read_public"
on storage.objects for select
using (bucket_id = 'carnet-moments-media');
