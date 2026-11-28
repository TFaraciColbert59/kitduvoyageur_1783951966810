-- M00 — rollback. Restaure les privilèges antérieurs et retire les policies ajoutées.
do $$
declare t text;
  tables text[] := array[
    'api_credit_days','app_errors','geo_areas','geo_areas_coverage','geo_cache',
    'geo_pois','geo_pois_coverage','geo_rivers','geo_rivers_coverage','geo_sites',
    'geo_sites_coverage','geo_trails','geo_trails_coverage','leaderboard_access_log',
    'leaderboard_refresh_queue','ops_daily_reports','ops_preparation_events',
    'order_encashment_events','osm_poi_cache','progression_award_intents',
    'progression_badge_links','progression_challenge_models','progression_claims',
    'progression_decisions','progression_discoveries','progression_leaderboard_agg',
    'progression_league_cohorts','progression_legacy_mapping','progression_legacy_snapshot',
    'progression_mission_assignments','progression_mission_model_actions',
    'progression_outbox','progression_rule_publications','progression_rules',
    'progression_user_preferences','rate_limit_windows','territory_change_log',
    'trip_launches','user_progression','user_season_progress','user_territory_private'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists crm_no_direct_access on public.%I', t);
  end loop;
end $$;

alter view public.public_profiles reset (security_barrier);
comment on view public.public_profiles is null;
comment on view public.hub_dashboard_kpis is null;
grant select on table public.hub_dashboard_kpis to anon;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'match_pays_chat_chunks'
  loop
    execute format('grant execute on function %s to public', f.sig);
  end loop;
end $$;
