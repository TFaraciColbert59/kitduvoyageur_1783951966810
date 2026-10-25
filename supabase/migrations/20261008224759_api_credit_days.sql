-- Crédits du jour des services gratuits (plan 1.3, lot F) : un compteur par
-- service et par jour (UTC), pris de façon atomique. Geoapify donne 3 000
-- crédits par jour pour tout (lieux, géocodage, routage) et un appel de lieux
-- en coûte jusqu'à 25 : compter les appels ne suffit pas. Écriture et lecture
-- par la clé de service seulement (aucune policy).
create table if not exists public.api_credit_days (
  service text not null check (char_length(service) between 1 and 40),
  day date not null default (now() at time zone 'utc')::date,
  used integer not null default 0 check (used >= 0),
  primary key (service, day)
);
alter table public.api_credit_days enable row level security;
revoke all on table public.api_credit_days from anon, authenticated;

-- Prend `p_cost` crédits si le total du jour reste sous `p_limit` ; sinon rien
-- n'est pris et la réponse est false.
create or replace function public.take_api_credits(p_service text, p_cost integer, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_used integer;
begin
  if p_cost is null or p_cost < 1 or p_limit is null or p_limit < 1 or p_cost > p_limit then
    return false;
  end if;
  insert into public.api_credit_days as a (service, day, used)
  values (p_service, v_day, p_cost)
  on conflict (service, day) do update
    set used = a.used + excluded.used
    where a.used + excluded.used <= p_limit
  returning a.used into v_used;
  return v_used is not null and v_used <= p_limit;
end;
$$;

revoke all on function public.take_api_credits(text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_api_credits(text, integer, integer) to service_role;
