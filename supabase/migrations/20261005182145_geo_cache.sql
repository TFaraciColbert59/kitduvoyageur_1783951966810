-- Cache partagé du Compas (lieux, trajets, altitudes) : une même recherche
-- n'interroge les services gratuits (Photon, Nominatim, BRouter/OSRM…) qu'une
-- fois pour tout le monde. Serveur uniquement (clé service) : aucune lecture
-- ni écriture par un client, pour qu'aucun utilisateur ne puisse empoisonner
-- le cache des autres.
create table if not exists public.geo_cache (
  cache_key text primary key,
  kind text not null check (kind in ('place', 'reverse', 'leg', 'elevation', 'stages')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists geo_cache_expires_at_idx on public.geo_cache (expires_at);

alter table public.geo_cache enable row level security;

-- Aucune policy pour anon/authenticated : seule la clé service (qui contourne
-- la RLS) lit et écrit.
revoke all on public.geo_cache from anon, authenticated;

-- Ménage : les entrées expirées sont supprimées par lots (appelé par le serveur).
create or replace function public.purge_geo_cache()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.geo_cache
    where cache_key in (
      select cache_key from public.geo_cache where expires_at < now() limit 5000
    )
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke all on function public.purge_geo_cache() from public, anon, authenticated;
