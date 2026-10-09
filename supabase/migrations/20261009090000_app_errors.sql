-- Plan 2.9 : erreurs serveur du Compas, sans donnée personnelle (lieu du code,
-- code, message rédigé et tronqué). Écrites par le serveur seul (clé de
-- service) ; aucune lecture ni écriture depuis le navigateur. Purge à 30 jours :
-- avec les purges planifiées à lancer par Tony (aucune suppression ici).
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  scope text not null check (char_length(scope) between 1 and 60),
  code text check (code is null or char_length(code) <= 40),
  message text not null check (char_length(message) between 1 and 300)
);
create index if not exists app_errors_at_idx on public.app_errors (at);
alter table public.app_errors enable row level security;
revoke all on table public.app_errors from anon, authenticated;

-- Rapport quotidien (plan 1.1) : erreurs de la veille et alertes de seuil.
alter table public.ops_daily_reports
  add column if not exists app_errors integer not null default 0,
  add column if not exists alerts text[] not null default '{}';

create or replace function public.ops_daily_report()
returns public.ops_daily_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := date_trunc('day', now() - interval '1 day');
  v_until timestamptz := date_trunc('day', now());
  v_bytes bigint := pg_database_size(current_database());
  v_ok integer;
  v_failed integer;
  v_errors integer;
  v_alerts text[] := '{}';
  r public.ops_daily_reports;
begin
  select count(*) filter (where e.kind = 'ok'), count(*) filter (where e.kind = 'failed')
    into v_ok, v_failed
    from public.ops_preparation_events e
   where e.at >= v_since and e.at < v_until;
  select count(*) into v_errors
    from public.app_errors a
   where a.at >= v_since and a.at < v_until;
  -- array_append : « tableau || 'texte' » lirait le texte comme un tableau.
  if v_bytes > 430::bigint * 1024 * 1024 then
    v_alerts := array_append(v_alerts, 'base au-dessus de 430 Mo');
  end if;
  if v_ok + v_failed >= 10 and v_failed * 10 > v_ok + v_failed then
    v_alerts := array_append(v_alerts, 'plus de 10 % de préparations échouées');
  end if;
  if v_errors >= 50 then
    v_alerts := array_append(v_alerts, 'au moins 50 erreurs serveur');
  end if;

  insert into public.ops_daily_reports as o (
    day, db_bytes, geo_cache_rows, route_cache_rows, rate_limit_rows,
    anonymous_users, preparations_ok, preparations_failed, app_errors, alerts
  )
  select
    (now() - interval '1 day')::date,
    v_bytes,
    (select count(*) from public.geo_cache),
    (select count(*) from public.route_cache),
    (select count(*) from public.rate_limit_windows),
    (select count(*) from auth.users u where u.is_anonymous),
    v_ok,
    v_failed,
    v_errors,
    v_alerts
  on conflict (day) do update set
    db_bytes = excluded.db_bytes,
    geo_cache_rows = excluded.geo_cache_rows,
    route_cache_rows = excluded.route_cache_rows,
    rate_limit_rows = excluded.rate_limit_rows,
    anonymous_users = excluded.anonymous_users,
    preparations_ok = excluded.preparations_ok,
    preparations_failed = excluded.preparations_failed,
    app_errors = excluded.app_errors,
    alerts = excluded.alerts,
    created_at = now()
  returning * into r;
  return r;
end;
$$;

revoke all on function public.ops_daily_report() from public, anon, authenticated;
