-- Step 1: Storage buckets + carnet_media table

-- Create storage buckets
insert into storage.buckets (id, name, public)
values
  ('carnet-media', 'carnet-media', true),
  ('gear-photos', 'gear-photos', true),
  ('user-documents', 'user-documents', false)
on conflict (id) do nothing;

-- Policies for carnet-media
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Upload authentifié carnet-media'
  ) then
    create policy "Upload authentifié carnet-media"
      on storage.objects for insert
      with check (bucket_id = 'carnet-media' and auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Lecture publique carnet-media'
  ) then
    create policy "Lecture publique carnet-media"
      on storage.objects for select
      using (bucket_id = 'carnet-media');
  end if;
end $$;

-- Policies for gear-photos
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Upload authentifié gear-photos'
  ) then
    create policy "Upload authentifié gear-photos"
      on storage.objects for insert
      with check (bucket_id = 'gear-photos' and auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Lecture publique gear-photos'
  ) then
    create policy "Lecture publique gear-photos"
      on storage.objects for select
      using (bucket_id = 'gear-photos');
  end if;
end $$;

-- Policies for user-documents
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Un utilisateur gère ses propres documents'
  ) then
    create policy "Un utilisateur gère ses propres documents"
      on storage.objects for all
      using (bucket_id = 'user-documents' and auth.uid()::text = (storage.foldername(name))[1])
      with check (bucket_id = 'user-documents' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
end $$;

-- carnet_media table for multiple media per carnet
create table if not exists public.carnet_media (
  id uuid primary key default gen_random_uuid(),
  carnet_id uuid references public.carnets(id) on delete cascade not null,
  url text not null,
  type text default 'photo',
  caption text,
  position int default 0,
  created_at timestamptz default now()
);

alter table public.carnet_media enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'carnet_media' and policyname = 'Lecture publique des médias de carnet'
  ) then
    create policy "Lecture publique des médias de carnet"
      on public.carnet_media for select using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'carnet_media' and policyname = 'L auteur du carnet gère ses médias'
  ) then
    create policy "L auteur du carnet gère ses médias"
      on public.carnet_media for all
      using (auth.uid() = (select author_id from public.carnets where id = carnet_id))
      with check (auth.uid() = (select author_id from public.carnets where id = carnet_id));
  end if;
end $$;

-- RPC for map routes with simplification + bbox
create or replace function public.get_routes_for_map(
  min_lng float,
  min_lat float,
  max_lng float,
  max_lat float,
  simplify_tolerance float default 0.0005
)
returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'geometry', st_asgeojson(st_simplify(geom, simplify_tolerance))::jsonb,
        'properties', jsonb_build_object('id', id, 'name', name, 'ref', ref, 'network', network)
      )
    ), '[]'::jsonb)
  )
  from public.hiking_routes
  where geom && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326);
$$;

grant execute on function public.get_routes_for_map to anon, authenticated;

-- Fix ai_description templates (quick fix: clean template)
update public.trail_metadata t
set ai_description = format(
  'Randonnée %s de %s km, %s. Dénivelé positif : %s m.',
  coalesce((select name from public.hiking_routes h where h.id = t.trail_id), 'sans nom'),
  round(coalesce((select distance_km from public.hiking_routes h where h.id = t.trail_id), 0)::numeric, 1),
  lower(coalesce(t.difficulty, 'modérée')),
  coalesce(t.elevation_gain, 0)
)
where ai_description is null
   or ai_description like '%  %'
   or ai_description not like '%km%';
