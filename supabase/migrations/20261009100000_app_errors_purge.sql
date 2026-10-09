-- Plan 2.9 : purge des erreurs serveur (`app_errors`) au-delà de 30 jours.
-- Suppression planifiée : à lancer par Tony dans le SQL Editor, après
-- `20261008190000_base_scheduled_purges.sql` (règle du chantier : toute
-- suppression passe par lui).
create or replace function public.purge_app_errors(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v integer := 0;
begin
  delete from public.app_errors a
  where a.at < now() - make_interval(days => greatest(p_days, 7));
  get diagnostics v = row_count;
  return v;
end;
$$;

revoke all on function public.purge_app_errors(integer) from public, anon, authenticated;

select cron.schedule('purge-app-errors', '17 4 * * *', $$select public.purge_app_errors(30)$$);
