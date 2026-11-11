-- Explorer v2 — démarrage persistant d'activité (S1.02, K6.15).
--
-- Objectif : une route authentifiée peut créer une ligne `activity_sessions`
-- idempotente à partir d'un identifiant de séance stable fourni par le client.
-- Le serveur génère l'identifiant public de séance, détermine l'acteur avec
-- `auth.uid()` et conserve la variante choisie sans toucher aux colonnes
-- historiques ni à `finish_activity_session`.
--
-- Migration strictement additive : deux colonnes nullables (les lignes
-- existantes restent valides), un index unique partiel et une fonction RPC
-- dédiée. Aucune donnée n'est supprimée ni réécrite.

begin;

-- 1. Contrat additif de `activity_sessions`.
--    - `client_session_id` : clé d'idempotence stable, générée par le client.
--    - `variant_id` : variante choisie (S1.02), nulle pour les anciens appels.
alter table public.activity_sessions
  add column if not exists client_session_id uuid;

alter table public.activity_sessions
  add column if not exists variant_id text;

-- Bornes structurelles de la variante au niveau base. La cohérence
-- sport ↔ variante et la disponibilité réelle sont validées par la route
-- serveur (`src/features/explorer-v2/server/activityStart.ts`) avant l'appel.
alter table public.activity_sessions
  drop constraint if exists activity_sessions_variant_id_check;
alter table public.activity_sessions
  add constraint activity_sessions_variant_id_check
  check (variant_id is null or variant_id ~ '^[a-z0-9][a-z0-9-]{0,63}$');

-- Un même identifiant client ne peut produire qu'une seule séance *par
-- propriétaire*. Deux utilisateurs qui choisiraient le même UUID restent
-- indépendants : la clé inclut `user_id`.
create unique index if not exists activity_sessions_user_client_idx
  on public.activity_sessions (user_id, client_session_id)
  where client_session_id is not null;

comment on column public.activity_sessions.client_session_id is
  'S1.02/K6.15 — identifiant de séance stable fourni par le client, clé d''idempotence bornée à (user_id, client_session_id).';
comment on column public.activity_sessions.variant_id is
  'S1.02 — variante de sport choisie (ex. rando-journee), additive ; nul pour les séances antérieures ou les appels sans variante.';

-- 2. RPC de démarrage idempotent.
--    - `security definer` : la fonction écrit dans `activity_sessions` avec
--      l'acteur déterminé côté serveur, jamais avec un `user_id` client. Elle
--      reprend la règle des policies `activity_sessions_owner_*`
--      (`user_id = auth.uid()`), sans créer de nouvelle policy ;
--    - verrou consultatif transactionnel : deux appels concurrents du même
--      propriétaire et de la même clé sont sérialisés, donc un seul crée ;
--    - un rejeu avec le même contenu retourne la même séance (`created=false`) ;
--    - un rejeu avec un contenu différent est un conflit explicite.
create or replace function public.start_activity_session(
  p_client_session_id uuid,
  p_sport text,
  p_variant_id text default null,
  p_route_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_session public.activity_sessions%rowtype;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  if p_client_session_id is null then
    raise exception 'identifiant de séance client invalide' using errcode = '22023';
  end if;

  if p_sport is null or not exists (
    select 1 from public.explorer_sport_map m where m.sport = p_sport
  ) then
    raise exception 'sport inconnu' using errcode = '22023';
  end if;

  if p_variant_id is not null and p_variant_id !~ '^[a-z0-9][a-z0-9-]{0,63}$' then
    raise exception 'variante invalide' using errcode = '22023';
  end if;

  -- Même borne sémantique que la route : seules les paires réellement
  -- démarrables sont acceptées, y compris par un appel direct à la RPC.
  if p_variant_id is not null and not exists (
    select 1
      from (values
        ('course', 'course-route'),
        ('rando', 'rando-journee'),
        ('rando', 'rando-refuge'),
        ('rando', 'rando-matin'),
        ('velo', 'velo-route'),
        ('velo', 'velo-gravel'),
        ('velo', 'velo-bikepacking'),
        ('kayak', 'kayak-riviere'),
        ('kayak', 'kayak-mer'),
        ('trail', 'trail-10k'),
        ('trail', 'trail-ultra'),
        ('ski', 'ski-rando'),
        ('escalade', 'escalade-voie'),
        ('famille', 'famille-balade'),
        ('famille', 'famille-poussette'),
        ('bivouac', 'bivouac-1n'),
        ('bivouac', 'bivouac-2n')
      ) as v(sport, variant_id)
     where v.sport = p_sport
       and v.variant_id = p_variant_id
  ) then
    raise exception 'variante non démarrable' using errcode = '22023';
  end if;

  if p_route_id is not null and p_route_id <= 0 then
    raise exception 'itinéraire invalide' using errcode = '22023';
  end if;

  -- Sérialise les démarrages concurrents de la même clé propriétaire.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text || ':' || p_client_session_id::text, 0)
  );

  insert into public.activity_sessions (
    user_id,
    sport,
    variant_id,
    route_id,
    client_session_id,
    status,
    started_at
  ) values (
    v_user,
    p_sport,
    p_variant_id,
    p_route_id,
    p_client_session_id,
    'live',
    now()
  )
  on conflict (user_id, client_session_id)
    where client_session_id is not null
  do nothing
  returning * into v_session;

  -- Insertion gagnante : la séance vient d'être créée pour cet acteur.
  if found then
    return jsonb_build_object(
      'ok', true,
      'created', true,
      'sessionId', v_session.id,
      'clientSessionId', v_session.client_session_id,
      'sport', v_session.sport,
      'variantId', v_session.variant_id,
      'routeId', v_session.route_id,
      'startedAt', v_session.started_at,
      'sessionStatus', v_session.status
    );
  end if;

  -- Rejeu (ou insert concurrent déjà acquitté) : relire la séance existante.
  select * into v_session
    from public.activity_sessions
   where user_id = v_user
     and client_session_id = p_client_session_id;

  if not found then
    raise exception 'démarrage concurrent introuvable' using errcode = '40001';
  end if;

  if v_session.sport is distinct from p_sport
     or v_session.variant_id is distinct from p_variant_id
     or v_session.route_id is distinct from p_route_id then
    return jsonb_build_object('ok', false, 'reason', 'payload_mismatch');
  end if;

  return jsonb_build_object(
    'ok', true,
    'created', false,
    'sessionId', v_session.id,
    'clientSessionId', v_session.client_session_id,
    'sport', v_session.sport,
    'variantId', v_session.variant_id,
    'routeId', v_session.route_id,
    'startedAt', v_session.started_at,
    'sessionStatus', v_session.status
  );
end;
$$;

revoke all on function public.start_activity_session(uuid, text, text, bigint) from public;
grant execute on function public.start_activity_session(uuid, text, text, bigint) to authenticated;

commit;
