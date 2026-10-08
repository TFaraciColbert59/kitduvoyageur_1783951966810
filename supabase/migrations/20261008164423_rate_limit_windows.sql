-- Limite de fréquence partagée par toutes les instances (audit du 8 octobre).
-- Sans Upstash, chaque instance Vercel comptait pour elle seule. La fenêtre
-- fixe vit désormais ici ; seul le rôle de service l'appelle (src/lib/rate-limit).
-- Table non journalisée : un compteur perdu après un arrêt brutal de la base
-- rouvre au pire une fenêtre, sans autre conséquence. Clés hachées (SHA-256)
-- par le serveur : aucune IP ni identifiant lisible.

create unlogged table if not exists public.rate_limit_windows (
  key text primary key,
  window_start timestamptz not null,
  window_ms integer not null,
  hits integer not null
);

alter table public.rate_limit_windows enable row level security;
-- Aucune policy : ni anon ni authenticated n'y accèdent.
revoke all on table public.rate_limit_windows from anon, authenticated;

create or replace function public.rate_limit_consume(p_key text, p_window_ms integer)
returns table (current_hits integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_hits integer;
  v_reset timestamptz;
begin
  if p_key is null or length(p_key) < 1 or length(p_key) > 128 then
    raise exception 'rate_limit_cle_invalide' using errcode = '22023';
  end if;
  if p_window_ms is null or p_window_ms < 1000 or p_window_ms > 86400000 then
    raise exception 'rate_limit_fenetre_invalide' using errcode = '22023';
  end if;

  insert into public.rate_limit_windows as w (key, window_start, window_ms, hits)
  values (p_key, v_now, p_window_ms, 1)
  on conflict (key) do update set
    hits = case
      when w.window_start + w.window_ms * interval '1 millisecond' <= v_now then 1
      else w.hits + 1
    end,
    window_start = case
      when w.window_start + w.window_ms * interval '1 millisecond' <= v_now then v_now
      else w.window_start
    end,
    window_ms = case
      when w.window_start + w.window_ms * interval '1 millisecond' <= v_now then p_window_ms
      else w.window_ms
    end
  returning w.hits, w.window_start + w.window_ms * interval '1 millisecond'
  into v_hits, v_reset;

  -- Purge occasionnelle des fenêtres closes depuis plus d'une heure.
  if random() < 0.02 then
    delete from public.rate_limit_windows r
    where r.window_start + r.window_ms * interval '1 millisecond' < v_now - interval '1 hour';
  end if;

  current_hits := v_hits;
  reset_at := v_reset;
  return next;
end;
$$;

revoke all on function public.rate_limit_consume(text, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_consume(text, integer) to service_role;
