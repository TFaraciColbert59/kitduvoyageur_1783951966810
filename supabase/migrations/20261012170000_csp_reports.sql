-- Plan 2.11 : lecture des rapports de la CSP (Content-Security-Policy-Report-Only).
-- Les rapports arrivent par /api/csp-report, une ligne par violation dans `app_errors`
-- (scope 'csp', code = directive, message '<report|enforce> <hôte bloqué> <page>').
-- Aucune donnée personnelle : voir src/lib/security/cspReport.ts.
-- À appliquer par Tony ; rien n'est supprimé ici (la purge à 30 jours d'app_errors existe).

-- 1. Résumé lisible : une ligne par jour, directive, hôte bloqué et page.
--    Dans le SQL Editor : select * from public.csp_report_summary(7);
create or replace function public.csp_report_summary(p_days integer default 7)
returns table (day date, directive text, disposition text, blocked text, page text, hits bigint)
language sql
security definer
set search_path = ''
as $$
  select a.at::date,
         a.code,
         split_part(a.message, ' ', 1),
         split_part(a.message, ' ', 2),
         split_part(a.message, ' ', 3),
         count(*)
    from public.app_errors a
   where a.scope = 'csp'
     and a.at >= now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30))
   group by 1, 2, 3, 4, 5
   order by 1 desc, 6 desc;
$$;

revoke all on function public.csp_report_summary(integer) from public, anon, authenticated;
grant execute on function public.csp_report_summary(integer) to service_role;

-- 2. Rapport quotidien : les violations CSP ont leur propre colonne et ne comptent plus
--    dans « au moins 50 erreurs serveur » (une page qui viole la règle à chaque
--    chargement ferait sonner l'alerte sans qu'aucune erreur serveur n'ait eu lieu).
--    Sans valeur par défaut : les jours d'avant restent « non renseignés ».
alter table public.ops_daily_reports
  add column if not exists csp_reports integer;

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
  v_csp integer;
  v_alerts text[] := '{}';
  r public.ops_daily_reports;
begin
  select count(*) filter (where e.kind = 'ok'), count(*) filter (where e.kind = 'failed')
    into v_ok, v_failed
    from public.ops_preparation_events e
   where e.at >= v_since and e.at < v_until;
  select count(*) filter (where a.scope <> 'csp'), count(*) filter (where a.scope = 'csp')
    into v_errors, v_csp
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
    anonymous_users, preparations_ok, preparations_failed, app_errors, csp_reports, alerts
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
    v_csp,
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
    csp_reports = excluded.csp_reports,
    alerts = excluded.alerts,
    created_at = now()
  returning * into r;
  return r;
end;
$$;

revoke all on function public.ops_daily_report() from public, anon, authenticated;
