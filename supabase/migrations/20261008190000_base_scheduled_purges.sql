-- Purges planifiées de la base gratuite (plan 1.1, 8 octobre). Supprime des
-- lignes : le connecteur de la session bloque toute suppression, cette
-- migration est lancée par Tony dans le SQL Editor de Supabase.
--
-- Aucune purge n'était planifiée (ni vercel.json, ni tâche GitHub) : le cache
-- d'itinéraires gardait 119 entrées toutes expirées. pg_cron (gratuit) s'en
-- charge en base, la nuit (heure UTC).

-- 1. Plafonds des caches partagés : au-delà, les entrées qui expirent le plus
--    tôt partent d'abord (budget : ~35 Mo de trajets, ~50 Mo de lieux).
create or replace function public.cap_shared_caches(
  p_route_max integer default 1000,
  p_geo_max integer default 25000
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route integer := 0;
  v_geo integer := 0;
begin
  delete from public.route_cache r
  where r.cache_key in (
    select c.cache_key from public.route_cache c
    order by c.expires_at desc
    offset greatest(p_route_max, 0)
  );
  get diagnostics v_route = row_count;

  delete from public.geo_cache g
  where g.cache_key in (
    select c.cache_key from public.geo_cache c
    order by c.expires_at desc
    offset greatest(p_geo_max, 0)
  );
  get diagnostics v_geo = row_count;

  return jsonb_build_object('route_cache', v_route, 'geo_cache', v_geo);
end;
$$;

-- 2. Journal du tableau de bord : 90 jours suffisent.
create or replace function public.purge_hub_telemetry(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v integer := 0;
begin
  delete from public.hub_telemetry h
  where h.ts < now() - make_interval(days => greatest(p_days, 7));
  get diagnostics v = row_count;
  return v;
end;
$$;

-- 3. Kits à la corbeille depuis 10 jours. Pas `cleanup_expired_trash_kits()` :
--    la version des migrations exige une session (`auth.uid()`), absente sous
--    pg_cron, et la tâche échouerait chaque nuit. Même suppression, réservée
--    à la planification (aucun droit d'appel depuis l'application).
create or replace function public.purge_expired_trash_kits(p_days integer default 10)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v integer := 0;
begin
  delete from public.custom_kits k
  where k.status = 'trash'
    and k.deleted_at is not null
    and k.deleted_at < now() - make_interval(days => greatest(p_days, 1));
  get diagnostics v = row_count;
  return v;
end;
$$;

-- 4. Journal des préparations (rapport quotidien) : 90 jours suffisent.
create or replace function public.purge_ops_preparation_events(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v integer := 0;
begin
  delete from public.ops_preparation_events e
  where e.at < now() - make_interval(days => greatest(p_days, 7));
  get diagnostics v = row_count;
  return v;
end;
$$;

revoke all on function public.cap_shared_caches(integer, integer) from public, anon, authenticated;
revoke all on function public.purge_hub_telemetry(integer) from public, anon, authenticated;
revoke all on function public.purge_expired_trash_kits(integer) from public, anon, authenticated;
revoke all on function public.purge_ops_preparation_events(integer) from public, anon, authenticated;

-- 5. Planification (heure UTC, la nuit en Europe).
select cron.schedule('purge-geo-cache', '27 3 * * *', $$select public.purge_geo_cache()$$);
select cron.schedule('purge-route-cache', '32 3 * * *', $$select public.purge_route_cache(5000)$$);
select cron.schedule('cap-shared-caches', '37 3 * * *', $$select public.cap_shared_caches(1000, 25000)$$);
select cron.schedule('purge-hub-telemetry', '42 3 * * 0', $$select public.purge_hub_telemetry(90)$$);
select cron.schedule('purge-lkv-events', '47 3 * * 0', $$select public.purge_expired_lkv_events()$$);
select cron.schedule('purge-progression-outbox', '52 3 * * 0', $$select public.purge_progression_outbox(90)$$);
select cron.schedule('purge-progression-logs', '57 3 * * 0', $$select public.purge_progression_logs(30, 180)$$);
select cron.schedule('cleanup-trash-kits', '2 4 * * *', $$select public.purge_expired_trash_kits(10)$$);
select cron.schedule('purge-ops-preparation-events', '12 4 * * 0', $$select public.purge_ops_preparation_events(90)$$);
