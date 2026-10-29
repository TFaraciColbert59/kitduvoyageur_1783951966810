begin;

-- ---------------------------------------------------------------------------
-- 1. geo_pois : aucune politique, aucun accès direct (invariant Compas)
-- ---------------------------------------------------------------------------
-- L'Explorer lit les repères par la RPC `explorer_pois` (SECURITY DEFINER,
-- colonnes filtrées), jamais par la table : la base OSM n'est pas exposée.
drop policy if exists geo_pois_public_read on public.geo_pois;
revoke select on public.geo_pois from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. RPC de lecture : DEFINER + search_path + EXECUTE explicite
-- ---------------------------------------------------------------------------
alter function public.explorer_pois(double precision, double precision, double precision, double precision, text[], integer)
  security definer;
alter function public.explorer_pois(double precision, double precision, double precision, double precision, text[], integer)
  set search_path = public, pg_temp;
revoke all on function public.explorer_pois(double precision, double precision, double precision, double precision, text[], integer) from public;
grant execute on function public.explorer_pois(double precision, double precision, double precision, double precision, text[], integer) to anon, authenticated;

alter function public.explorer_place(double precision, double precision) security definer;
alter function public.explorer_place(double precision, double precision) set search_path = public, pg_temp;
revoke all on function public.explorer_place(double precision, double precision) from public;
grant execute on function public.explorer_place(double precision, double precision) to anon, authenticated;

alter function public.explorer_routes(double precision, double precision, double precision, double precision, integer)
  security definer;
alter function public.explorer_routes(double precision, double precision, double precision, double precision, integer)
  set search_path = public, pg_temp;
revoke all on function public.explorer_routes(double precision, double precision, double precision, double precision, integer) from public;
grant execute on function public.explorer_routes(double precision, double precision, double precision, double precision, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Fonctions d'écriture : EXECUTE retiré à PUBLIC (règle 2.4)
-- ---------------------------------------------------------------------------
revoke all on function public.finish_activity_session(uuid) from public;
grant execute on function public.finish_activity_session(uuid) to authenticated;

revoke all on function public.explorer_confirm_report(uuid) from public;
grant execute on function public.explorer_confirm_report(uuid) to authenticated;

revoke all on function public.explorer_mark_report_gone(uuid) from public;
grant execute on function public.explorer_mark_report_gone(uuid) to authenticated;

commit;
