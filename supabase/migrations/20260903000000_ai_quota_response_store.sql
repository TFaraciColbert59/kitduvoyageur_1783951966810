-- ═══════════════════════════════════════════════════════════════════════════
-- Routeur IA Nemotron/OpenRouter — cache de réponses + quota quotidien
-- Idempotent : CREATE IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.
-- NB : nom de fichier volontairement sans "cache" (règle *cache* du .gitignore).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Table de réponses IA mémorisées (accès service role uniquement) ─────
create table if not exists public.ai_response_cache (
  cache_key  text primary key,
  feature    text not null default 'general',
  response   text not null,
  model      text,
  hit_count  integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_ai_response_cache_expires_at
  on public.ai_response_cache(expires_at);

alter table public.ai_response_cache enable row level security;

-- Aucune lecture directe (client) : uniquement via les fonctions SECURITY DEFINER.
drop policy if exists "ai_response_cache_select_false" on public.ai_response_cache;
create policy "ai_response_cache_select_false" on public.ai_response_cache
  for select using (false);

-- ── 2. Consommation IA quotidienne par utilisateur ─────────────────────────
create table if not exists public.ai_usage_daily (
  user_id        uuid not null references auth.users(id) on delete cascade,
  day            date not null default current_date,
  requests_heavy integer not null default 0,
  requests_fast  integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage_daily enable row level security;

-- L'utilisateur lit SA propre consommation uniquement.
drop policy if exists "ai_usage_daily_select_own" on public.ai_usage_daily;
create policy "ai_usage_daily_select_own" on public.ai_usage_daily
  for select using (auth.uid() = user_id);

-- ── 3. Quota atomique : 20 heavy + 100 fast / jour / user ──────────────────
-- INSERT ... ON CONFLICT ... DO UPDATE avec WHERE de garde : le compteur est
-- vérifié AVANT l'incrément, le tout en une seule instruction (atomique).
-- Si la garde échoue, RETURNING ne renvoie pas de ligne → false.
create or replace function public.check_and_increment_ai_quota(p_user_id uuid, p_tier text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.ai_usage_daily%ROWTYPE;
begin
  if p_tier not in ('heavy', 'fast') then
    return false;
  end if;

  insert into public.ai_usage_daily (user_id, day, requests_heavy, requests_fast)
  values (
    p_user_id,
    current_date,
    case when p_tier = 'heavy' then 1 else 0 end,
    case when p_tier = 'fast' then 1 else 0 end
  )
  on conflict (user_id, day) do update set
    requests_heavy = public.ai_usage_daily.requests_heavy
      + (case when p_tier = 'heavy' then 1 else 0 end),
    requests_fast = public.ai_usage_daily.requests_fast
      + (case when p_tier = 'fast' then 1 else 0 end)
  where (
    case when p_tier = 'heavy'
      then public.ai_usage_daily.requests_heavy < 20
      else public.ai_usage_daily.requests_fast < 100
    end
  )
  returning * into v_row;

  return v_row.user_id is not null;
end;
$$;

-- ── 4. Fonctions d'accès au store de réponses (service role uniquement) ────
-- Lecture : NULL si absent ou expiré ; incrémente hit_count sur hit.
create or replace function public.get_ai_cache(p_cache_key text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_response text;
begin
  select response into v_response
  from public.ai_response_cache
  where cache_key = p_cache_key
    and expires_at > now();

  if v_response is not null then
    update public.ai_response_cache
    set hit_count = hit_count + 1
    where cache_key = p_cache_key;
  end if;

  return v_response;
end;
$$;

-- Écriture : upsert avec TTL (minimum 60 s).
create or replace function public.set_ai_cache(
  p_cache_key text,
  p_feature text,
  p_response text,
  p_model text,
  p_ttl_seconds integer
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.ai_response_cache
    (cache_key, feature, response, model, hit_count, created_at, expires_at)
  values (
    p_cache_key, p_feature, p_response, p_model, 0, now(),
    now() + make_interval(secs => greatest(p_ttl_seconds, 60))
  )
  on conflict (cache_key) do update set
    feature    = excluded.feature,
    response   = excluded.response,
    model      = excluded.model,
    created_at = now(),
    expires_at = now() + make_interval(secs => greatest(p_ttl_seconds, 60));
$$;

-- ── 5. Durcissement des privilèges (défaut : public, service role only) ────
revoke all on function public.check_and_increment_ai_quota(uuid, text) from public;
revoke all on function public.get_ai_cache(text) from public;
revoke all on function public.set_ai_cache(text, text, text, text, integer) from public;

grant execute on function public.check_and_increment_ai_quota(uuid, text)
  to authenticated, service_role;
grant execute on function public.get_ai_cache(text) to service_role;
grant execute on function public.set_ai_cache(text, text, text, text, integer) to service_role;
