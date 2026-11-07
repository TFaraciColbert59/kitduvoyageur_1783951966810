-- Retour arrière du dépôt des maillages 3D.
-- Les policies partent d'abord ; le bucket n'est supprimé que s'il est vide, pour qu'un retour
-- arrière ne détruise jamais des fichiers téléversés sans qu'on l'ait décidé.
drop policy if exists "bag_models_admin_write" on storage.objects;
drop policy if exists "Public view bag-models" on storage.objects;

delete from storage.buckets
where id = 'bag-models'
  and not exists (select 1 from storage.objects where bucket_id = 'bag-models');
