-- Dépôt des maillages 3D de sacs servis hors du dépôt Git.
-- Le palier « web » (< 900 Ko) reste dans public/assets/bags/ et part avec le déploiement.
-- Le palier « hd » (jusqu'à 60 Mo par sac) vit ici : un dépôt Git et un déploiement Vercel ne sont
-- pas faits pour porter 218 Mo de binaires, et le client ne télécharge le master que s'il le peut.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bag-models',
  'bag-models',
  true,
  62914560,
  array['model/gltf-binary', 'application/octet-stream']
)
on conflict (id) do nothing;

-- Lecture publique : un maillage de sac n'est pas une donnée personnelle, et le Studio le charge
-- sans session. Même forme que « Public view product-images ».
drop policy if exists "Public view bag-models" on storage.objects;
create policy "Public view bag-models"
  on storage.objects for select
  to public
  using (bucket_id = 'bag-models');

-- Écriture réservée aux administrateurs : personne ne dépose un maillage depuis le navigateur.
-- Le rôle de service, utilisé par le script de téléversement, contourne RLS et n'a pas besoin
-- de policy.
drop policy if exists "bag_models_admin_write" on storage.objects;
create policy "bag_models_admin_write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'bag-models' and is_admin())
  with check (bucket_id = 'bag-models' and is_admin());
