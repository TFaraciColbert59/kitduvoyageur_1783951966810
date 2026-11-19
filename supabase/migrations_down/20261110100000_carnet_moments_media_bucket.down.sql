-- Rollback de 20261110100000_carnet_moments_media_bucket.
-- Les objets déjà téléversés doivent être supprimés par l'API Storage avant le
-- retrait du seau (Supabase refuse de supprimer un seau non vide).
drop policy if exists "carnet_moments_media_insert_owner" on storage.objects;
drop policy if exists "carnet_moments_media_delete_owner" on storage.objects;
drop policy if exists "carnet_moments_media_read_public" on storage.objects;
delete from storage.buckets where id = 'carnet-moments-media';
