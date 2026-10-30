begin;

-- `a5_terrain_reports_near` était SECURITY INVOKER : la RLS
-- `terrain_reports_select_own` ne laissait voir que ses propres signalements,
-- donc la carte communautaire ne pouvait jamais afficher ceux des autres.
-- La fonction ne renvoie aucune identité (ni reporter_id ni contributor) :
-- on l'exécute en SECURITY DEFINER pour exposer l'agrégat public.
alter function public.a5_terrain_reports_near(double precision, double precision, double precision)
  security definer;

alter function public.a5_terrain_reports_near(double precision, double precision, double precision)
  set search_path = public, pg_temp;

grant execute on function public.a5_terrain_reports_near(double precision, double precision, double precision)
  to anon, authenticated;

commit;
