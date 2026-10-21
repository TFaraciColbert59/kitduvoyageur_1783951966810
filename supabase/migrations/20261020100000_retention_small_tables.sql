-- Plan 1.1 / 2.10 (20 octobre 2026) : durées de conservation des petites tables
-- sans purge. Les purges de la nuit (`20261008190000_base_scheduled_purges.sql`)
-- couvraient les caches de lieux et de trajets, les journaux et les kits à la
-- corbeille ; restaient sans effacement :
--   * `ai_response_cache` (réponses de l'IA, colonne `expires_at` jamais lue par une purge) ;
--   * `ai_usage_daily` (compteur par personne et par jour : seul le jour courant sert) ;
--   * `ai_jobs` terminés (résultat d'un récit : texte lié à une personne) ;
--   * `api_credit_days` (crédits du jour des services gratuits, une ligne par service et par jour) ;
--   * `rate_limit_windows` (fenêtres closes : purgées seulement au hasard, 2 % des appels ;
--     sans trafic, rien ne les efface) ;
--   * `ops_daily_reports` (compteurs sans donnée personnelle, gardés 13 mois pour les tendances).
--
-- SUPPRESSION de lignes : à lancer par Tony dans le SQL Editor (règle du chantier : le
-- connecteur de la session refuse toute suppression). Une seule fonction, une seule tâche
-- `pg_cron` par nuit, qui rend le nombre de lignes effacées par table.
create or replace function public.purge_retention_small_tables(
  p_usage_days integer default 90,
  p_jobs_days integer default 90,
  p_reports_days integer default 400
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ai_cache integer := 0;
  v_ai_usage integer := 0;
  v_ai_jobs integer := 0;
  v_credits integer := 0;
  v_windows integer := 0;
  v_reports integer := 0;
begin
  delete from public.ai_response_cache c
  where c.expires_at < now();
  get diagnostics v_ai_cache = row_count;

  delete from public.ai_usage_daily u
  where u.day < (now() at time zone 'utc')::date - greatest(p_usage_days, 7);
  get diagnostics v_ai_usage = row_count;

  delete from public.ai_jobs j
  where j.status in ('done', 'failed')
    and j.created_at < now() - make_interval(days => greatest(p_jobs_days, 7));
  get diagnostics v_ai_jobs = row_count;

  delete from public.api_credit_days a
  where a.day < (now() at time zone 'utc')::date - greatest(p_usage_days, 7);
  get diagnostics v_credits = row_count;

  delete from public.rate_limit_windows r
  where r.window_start + r.window_ms * interval '1 millisecond' < now() - interval '1 day';
  get diagnostics v_windows = row_count;

  delete from public.ops_daily_reports o
  where o.day < (now() at time zone 'utc')::date - greatest(p_reports_days, 90);
  get diagnostics v_reports = row_count;

  return jsonb_build_object(
    'ai_response_cache', v_ai_cache,
    'ai_usage_daily', v_ai_usage,
    'ai_jobs', v_ai_jobs,
    'api_credit_days', v_credits,
    'rate_limit_windows', v_windows,
    'ops_daily_reports', v_reports
  );
end;
$$;

revoke all on function public.purge_retention_small_tables(integer, integer, integer) from public, anon, authenticated;

-- 4 h 22 UTC, après le rapport quotidien (4 h 07), qui lit encore les compteurs de la veille.
select cron.schedule(
  'purge-retention-small-tables',
  '22 4 * * *',
  $$select public.purge_retention_small_tables(90, 90, 400)$$
);
