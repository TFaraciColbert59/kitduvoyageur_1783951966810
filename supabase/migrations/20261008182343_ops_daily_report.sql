-- Rapport quotidien (plan 1.1, 8 octobre), lu par Claude et repris dans
-- ETAT.md : taille de la base, caches, essais sans compte, préparations du
-- jour réussies ou échouées. Les purges planifiées (suppressions) sont dans
-- la migration suivante, lancée par Tony dans le SQL Editor.
create table if not exists public.ops_daily_reports (
  day date primary key,
  db_bytes bigint not null,
  geo_cache_rows integer not null,
  route_cache_rows integer not null,
  rate_limit_rows integer not null,
  anonymous_users integer not null,
  preparations_ok integer not null,
  preparations_failed integer not null,
  created_at timestamptz not null default now()
);
alter table public.ops_daily_reports enable row level security;
revoke all on table public.ops_daily_reports from anon, authenticated;

create or replace function public.ops_daily_report()
returns public.ops_daily_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since bigint := (extract(epoch from date_trunc('day', now() - interval '1 day')) * 1000)::bigint;
  v_until bigint := (extract(epoch from date_trunc('day', now())) * 1000)::bigint;
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
    (select count(*) from public.trips t
       where (t.metadata->'compas'->'autofill_result'->>'success') = 'true'
         and (t.metadata->'compas'->'autofill_result'->>'at')::bigint >= v_since
         and (t.metadata->'compas'->'autofill_result'->>'at')::bigint < v_until),
    (select count(*) from public.trips t
       where (t.metadata->'compas'->'autofill_result'->>'success') = 'false'
         and (t.metadata->'compas'->'autofill_result'->>'at')::bigint >= v_since
         and (t.metadata->'compas'->'autofill_result'->>'at')::bigint < v_until)
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

select cron.schedule('ops-daily-report', '7 4 * * *', $$select public.ops_daily_report()$$);
