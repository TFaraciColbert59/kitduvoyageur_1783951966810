-- Purge des essais sans compte (plan 2.3). Supprime des comptes : le
-- connecteur de la session bloque toute suppression, cette migration est
-- lancée par Tony dans le SQL Editor de Supabase, AVANT d'allumer les
-- connexions anonymes. Inerte tant qu'aucun compte anonyme n'existe.

-- 1. Purge des essais : comptes anonymes inactifs depuis 7 jours, et tout ce
--    qui leur appartient (cascades). Les lignes sans cascade (journal
--    d'activité, notifications) partent d'abord ; un compte qui résiste est
--    signalé et gardé, jamais la purge entière en échec.
create or replace function public.purge_anonymous_users(p_inactive interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select u.id from auth.users u
    where u.is_anonymous
      and coalesce(u.last_sign_in_at, u.created_at) < now() - p_inactive
      and u.created_at < now() - p_inactive
      -- Une session rafraîchie récemment = un essai encore utilisé.
      and not exists (
        select 1 from auth.sessions s
        where s.user_id = u.id and s.updated_at > now() - p_inactive
      )
    order by u.created_at
    limit 1000
  loop
    begin
      delete from public.activities where user_id = r.id;
      delete from public.notifications where user_id = r.id;
      delete from auth.users where id = r.id;
      n := n + 1;
    exception when others then
      raise warning 'purge_anonymous_users : compte % gardé (%)', r.id, sqlerrm;
    end;
  end loop;
  return n;
end;
$$;

revoke all on function public.purge_anonymous_users(interval) from public, anon, authenticated;
grant execute on function public.purge_anonymous_users(interval) to service_role;

-- 2. Purge quotidienne (pg_cron, gratuit).
create extension if not exists pg_cron;
select cron.schedule('purge-essais-anonymes', '17 3 * * *', $$select public.purge_anonymous_users()$$);
