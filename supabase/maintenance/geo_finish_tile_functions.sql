-- Fonctions `*_finish_tile` des référentiels geo_trails, geo_sites, geo_rivers et geo_areas (lots AH, AI, AJ, AK).
--
-- À coller telles quelles dans le SQL Editor de Supabase, APRÈS que les tables existent.
-- Elles contiennent un `delete from` : le connecteur Supabase de la session les prend pour des
-- opérations destructrices et attend une confirmation qu'il n'affiche pas (expiration à 60 s),
-- d'où ce fichier à part. Idempotent (create or replace).

create or replace function public.geo_trails_finish_tile(
  p_west real,
  p_south real,
  p_east real,
  p_north real,
  p_run date default current_date,
  p_count_misses boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_prev date;
  v_missed integer := 0;
  v_deleted integer := 0;
  v_rows integer;
begin
  select done_on into v_prev from public.geo_trails_coverage
  where west = p_west and south = p_south and east = p_east and north = p_north;

  if p_count_misses and (v_prev is null or p_run - v_prev >= 20) then
    update public.geo_trails
       set missed = missed + 1
     where seen_on < p_run
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_missed = row_count;
    delete from public.geo_trails
     where missed >= 2
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_deleted = row_count;
  end if;

  select count(*) into v_rows from public.geo_trails
  where lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;

  insert into public.geo_trails_coverage (west, south, east, north, rows, done_on)
  values (p_west, p_south, p_east, p_north, v_rows, p_run)
  on conflict (west, south, east, north) do update set rows = excluded.rows, done_on = excluded.done_on;

  return jsonb_build_object('missed', v_missed, 'deleted', v_deleted, 'rows', v_rows);
end;
$$;

revoke all on function public.geo_trails_finish_tile(real, real, real, real, date, boolean) from public, anon, authenticated;
grant execute on function public.geo_trails_finish_tile(real, real, real, real, date, boolean) to service_role;

create or replace function public.geo_sites_finish_tile(
  p_west real,
  p_south real,
  p_east real,
  p_north real,
  p_run date default current_date,
  p_count_misses boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_prev date;
  v_missed integer := 0;
  v_deleted integer := 0;
  v_rows integer;
begin
  select done_on into v_prev from public.geo_sites_coverage
  where west = p_west and south = p_south and east = p_east and north = p_north;

  if p_count_misses and (v_prev is null or p_run - v_prev >= 20) then
    update public.geo_sites
       set missed = missed + 1
     where seen_on < p_run
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_missed = row_count;
    delete from public.geo_sites
     where missed >= 2
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_deleted = row_count;
  end if;

  select count(*) into v_rows from public.geo_sites
  where lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;

  insert into public.geo_sites_coverage (west, south, east, north, rows, done_on)
  values (p_west, p_south, p_east, p_north, v_rows, p_run)
  on conflict (west, south, east, north) do update set rows = excluded.rows, done_on = excluded.done_on;

  return jsonb_build_object('missed', v_missed, 'deleted', v_deleted, 'rows', v_rows);
end;
$$;

revoke all on function public.geo_sites_finish_tile(real, real, real, real, date, boolean) from public, anon, authenticated;

grant execute on function public.geo_sites_finish_tile(real, real, real, real, date, boolean) to service_role;

create or replace function public.geo_rivers_finish_tile(
  p_west real,
  p_south real,
  p_east real,
  p_north real,
  p_run date default current_date,
  p_count_misses boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_prev date;
  v_missed integer := 0;
  v_deleted integer := 0;
  v_rows integer;
begin
  select done_on into v_prev from public.geo_rivers_coverage
  where west = p_west and south = p_south and east = p_east and north = p_north;

  if p_count_misses and (v_prev is null or p_run - v_prev >= 20) then
    update public.geo_rivers
       set missed = missed + 1
     where seen_on < p_run
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_missed = row_count;
    delete from public.geo_rivers
     where missed >= 2
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_deleted = row_count;
  end if;

  select count(*) into v_rows from public.geo_rivers
  where lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;

  insert into public.geo_rivers_coverage (west, south, east, north, rows, done_on)
  values (p_west, p_south, p_east, p_north, v_rows, p_run)
  on conflict (west, south, east, north) do update set rows = excluded.rows, done_on = excluded.done_on;

  return jsonb_build_object('missed', v_missed, 'deleted', v_deleted, 'rows', v_rows);
end;
$$;

revoke all on function public.geo_rivers_finish_tile(real, real, real, real, date, boolean) from public, anon, authenticated;
grant execute on function public.geo_rivers_finish_tile(real, real, real, real, date, boolean) to service_role;

create or replace function public.geo_areas_finish_tile(
  p_west real,
  p_south real,
  p_east real,
  p_north real,
  p_run date default current_date,
  p_count_misses boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_prev date;
  v_missed integer := 0;
  v_deleted integer := 0;
  v_rows integer;
begin
  select done_on into v_prev from public.geo_areas_coverage
  where west = p_west and south = p_south and east = p_east and north = p_north;

  if p_count_misses and (v_prev is null or p_run - v_prev >= 20) then
    update public.geo_areas
       set missed = missed + 1
     where seen_on < p_run
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_missed = row_count;
    delete from public.geo_areas
     where missed >= 2
       and lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;
    get diagnostics v_deleted = row_count;
  end if;

  select count(*) into v_rows from public.geo_areas
  where lon >= p_west and lon < p_east and lat >= p_south and lat < p_north;

  insert into public.geo_areas_coverage (west, south, east, north, rows, done_on)
  values (p_west, p_south, p_east, p_north, v_rows, p_run)
  on conflict (west, south, east, north) do update set rows = excluded.rows, done_on = excluded.done_on;

  return jsonb_build_object('missed', v_missed, 'deleted', v_deleted, 'rows', v_rows);
end;
$$;

revoke all on function public.geo_areas_finish_tile(real, real, real, real, date, boolean) from public, anon, authenticated;
grant execute on function public.geo_areas_finish_tile(real, real, real, real, date, boolean) to service_role;
