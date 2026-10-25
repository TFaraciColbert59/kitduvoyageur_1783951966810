-- Rapport quotidien, correction (revue du 8 octobre) : les préparations se
-- comptent sur un journal d'événements, une ligne par issue, et non plus sur
-- `trips.metadata.compas.autofill_result`, qui ne garde que la DERNIÈRE issue
-- de chaque voyage (une préparation relancée effaçait la précédente) et dont
-- un `at` non numérique, écrit par le client, faisait échouer tout le rapport.
--
-- Écrit par le serveur seul (clé de service) ; aucune lecture ni écriture
-- depuis le navigateur. Purge à 90 jours : migration des purges (Tony).
create table if not exists public.ops_preparation_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('ok', 'pending', 'already', 'limited', 'failed'))
);
create index if not exists ops_preparation_events_at_idx on public.ops_preparation_events (at);
alter table public.ops_preparation_events enable row level security;
revoke all on table public.ops_preparation_events from anon, authenticated;

create or replace function public.ops_daily_report()
returns public.ops_daily_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := date_trunc('day', now() - interval '1 day');
  v_until timestamptz := date_trunc('day', now());
  r public.ops_daily_reports;
begin
  insert into public.ops_daily_reports as o (
    day, db_bytes, geo_cache_rows, route_cache_rows, rate_limit_rows,
    anonymous_users, preparations_ok, preparations_failed
  )
  select
    (now() - interval '1 day')::date,
    pg_database_size(current_database()),
    (select count(*) from public.geo_cache),
    (select count(*) from public.route_cache),
    (select count(*) from public.rate_limit_windows),
    (select count(*) from auth.users u where u.is_anonymous),
    (select count(*) from public.ops_preparation_events e
       where e.kind = 'ok' and e.at >= v_since and e.at < v_until),
    (select count(*) from public.ops_preparation_events e
       where e.kind = 'failed' and e.at >= v_since and e.at < v_until)
  on conflict (day) do update set
    db_bytes = excluded.db_bytes,
    geo_cache_rows = excluded.geo_cache_rows,
    route_cache_rows = excluded.route_cache_rows,
    rate_limit_rows = excluded.rate_limit_rows,
    anonymous_users = excluded.anonymous_users,
    preparations_ok = excluded.preparations_ok,
    preparations_failed = excluded.preparations_failed,
    created_at = now()
  returning * into r;
  return r;
end;
$$;

revoke all on function public.ops_daily_report() from public, anon, authenticated;
