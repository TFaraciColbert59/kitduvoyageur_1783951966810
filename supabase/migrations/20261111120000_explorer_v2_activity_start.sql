-- Explorer v2 — démarrage persistant d'activité (S1.02, K6.15).
--
-- Objectif : une route authentifiée peut créer une ligne `activity_sessions`
-- idempotente à partir d'un identifiant de séance stable fourni par le client.
-- Le serveur génère l'identifiant public de séance, détermine l'acteur avec
-- `auth.uid()` et conserve la variante choisie sans toucher aux colonnes
-- historiques. `finish_activity_session` garde sa signature et propage
-- désormais la variante vers `hike_sessions`.
--
-- Migration strictement additive : colonnes nullables, une table de référence
-- en lecture seule, une FK composite, un index unique partiel, un trigger de
-- garde et une fonction RPC dédiée. Aucune donnée n'est supprimée ni réécrite ;
-- aucun droit table-level n'est retiré aux anciens clients.
--
-- Stratégie : appliquer cette migration avant de déployer la route qui appelle
-- `start_activity_session`. Si elle est déjà appliquée quelque part, ne pas
-- réécrire ce fichier : livrer une migration de suivi additive avec son down.

begin;

-- 1. Contrat additif de `activity_sessions`.
--    - `client_session_id` : clé d'idempotence stable, générée par le client.
--    - `variant_id` : variante choisie (S1.02), nulle pour les anciens appels.
alter table public.activity_sessions
  add column if not exists client_session_id uuid;

alter table public.activity_sessions
  add column if not exists variant_id text;

-- 2. Source de vérité SQL des variantes réellement démarrables.
--    Les variantes bloquées (indoor, métriques non captées, catalogue absent)
--    restent dans la taxonomie TypeScript pour l'affichage, mais ne sont pas
--    insérées ici : une écriture directe ne peut donc pas les référencer.
create table if not exists public.explorer_sport_variants (
  sport text not null
    references public.explorer_sport_map (sport) on delete cascade,
  variant_id text not null
    check (variant_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  primary key (sport, variant_id)
);

comment on table public.explorer_sport_variants is
  'S1.02 — paires (sport, variante) réellement démarrables avec la pile de capture actuelle.';

alter table public.explorer_sport_variants enable row level security;

drop policy if exists explorer_sport_variants_read on public.explorer_sport_variants;
create policy explorer_sport_variants_read on public.explorer_sport_variants
  for select to anon, authenticated using (true);

grant select on public.explorer_sport_variants to anon, authenticated;

insert into public.explorer_sport_variants (sport, variant_id) values
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
on conflict (sport, variant_id) do nothing;

-- 3. Invariant structurel : une variante non nulle appartient toujours à la
--    paire (sport, variante) démarrable. `variant_id` nullable + MATCH SIMPLE
--    laisse passer les écritures historiques qui ne renseignent pas la
--    variante, donc aucun ancien client n'est régressé.
alter table public.activity_sessions
  drop constraint if exists activity_sessions_variant_pair_fkey;
alter table public.activity_sessions
  add constraint activity_sessions_variant_pair_fkey
  foreign key (sport, variant_id)
  references public.explorer_sport_variants (sport, variant_id)
  on delete restrict;

-- 4. Garde d'identité : une séance démarrée avec une clé d'idempotence ne
--    peut plus changer d'acteur logique (clé, sport, variante, itinéraire).
--    Les lignes historiques (`client_session_id` nul) conservent leurs
--    droits d'UPDATE : le trigger ne s'applique qu'aux nouvelles séances.
create or replace function public.guard_activity_session_start_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.client_session_id is not null
     and (
       new.client_session_id is distinct from old.client_session_id
       or new.user_id is distinct from old.user_id
       or new.sport is distinct from old.sport
       or new.variant_id is distinct from old.variant_id
       or new.route_id is distinct from old.route_id
     ) then
    raise exception 'identité de séance immuable' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_activity_session_start_identity() from public;

drop trigger if exists activity_sessions_start_identity_guard on public.activity_sessions;
create trigger activity_sessions_start_identity_guard
  before update on public.activity_sessions
  for each row execute function public.guard_activity_session_start_identity();

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

-- 5. RPC de démarrage idempotent.
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

  -- La table de référence porte aussi les sports démarrables : un sport sans
  -- aucune variante démarrable est refusé, comme dans la taxonomie serveur.
  if p_sport is null or not exists (
    select 1 from public.explorer_sport_variants v where v.sport = p_sport
  ) then
    raise exception 'sport inconnu' using errcode = '22023';
  end if;

  if p_variant_id is not null and p_variant_id !~ '^[a-z0-9][a-z0-9-]{0,63}$' then
    raise exception 'variante invalide' using errcode = '22023';
  end if;

  -- Même source de vérité que la FK composite : seules les paires réellement
  -- démarrables sont acceptées, y compris par un appel direct à la RPC.
  if p_variant_id is not null and not exists (
    select 1
      from public.explorer_sport_variants v
     where v.sport = p_sport
       and v.variant_id = p_variant_id
  ) then
    raise exception 'variante non démarrable' using errcode = '22023';
  end if;

  if p_route_id is not null and p_route_id <= 0 then
    raise exception 'itinéraire invalide' using errcode = '22023';
  end if;

  -- `hiking_routes` est en lecture publique (règle existante) ; on vérifie
  -- explicitement la route avant l'insertion pour rendre le refus lisible au
  -- lieu de laisser la FK produire une erreur opaque.
  if p_route_id is not null and not exists (
    select 1 from public.hiking_routes r where r.id = p_route_id
  ) then
    raise exception 'itinéraire introuvable' using errcode = '22023';
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
      -- `bigint` sérialisé en chaîne : le client ne perd jamais de chiffres.
      'routeId', v_session.route_id::text,
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
    'routeId', v_session.route_id::text,
    'startedAt', v_session.started_at,
    'sessionStatus', v_session.status
  );
end;
$$;

revoke all on function public.start_activity_session(uuid, text, text, bigint) from public;
grant execute on function public.start_activity_session(uuid, text, text, bigint) to authenticated;

-- 6. Historique : la variante est conservée avec le résumé de fin de sortie.
--    La colonne est additive et nullable ; `finish_activity_session` garde sa
--    signature et son comportement, il ajoute seulement la copie de
--    `variant_id`. Les séances historiques restent à NULL.
alter table public.hike_sessions
  add column if not exists variant_id text;

alter table public.hike_sessions
  drop constraint if exists hike_sessions_variant_id_check;
alter table public.hike_sessions
  add constraint hike_sessions_variant_id_check
  check (variant_id is null or variant_id ~ '^[a-z0-9][a-z0-9-]{0,63}$');

comment on column public.hike_sessions.variant_id is
  'S1.02 — variante de la séance source, copiée par finish_activity_session ; nulle pour l''historique antérieur.';

create or replace function public.finish_activity_session(p_session uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.activity_sessions;
  v_summary_id uuid;
  v_track jsonb;
begin
  select * into s from public.activity_sessions where id = p_session;
  if not found then
    raise exception 'session introuvable' using errcode = 'P0002';
  end if;
  if s.user_id <> auth.uid() then
    raise exception 'session d''un autre utilisateur' using errcode = '42501';
  end if;
  if s.status = 'finished' then
    return null;
  end if;

  update public.activity_sessions
     set status = 'finished',
         ended_at = coalesce(ended_at, now()),
         updated_at = now()
   where id = p_session;

  select jsonb_build_object(
    'type', 'LineString',
    'coordinates', coalesce(
      jsonb_agg(jsonb_build_array(lng, lat) order by t),
      '[]'::jsonb
    )
  )
  into v_track
  from public.activity_points
  where session_id = p_session;

  insert into public.hike_sessions (
    user_id, route_id, variant_id, started_at, ended_at, distance_km, duration_seconds,
    elevation_gain_m, positions_geojson, processing_status, visibility, title
  ) values (
    s.user_id,
    s.route_id,
    s.variant_id,
    s.started_at,
    coalesce(s.ended_at, now()),
    round((s.distance_m::numeric / 1000.0), 2),
    greatest(s.moving_s, extract(epoch from (coalesce(s.ended_at, now()) - s.started_at))::int),
    s.elev_gain_m,
    case when jsonb_array_length(coalesce(v_track->'coordinates', '[]'::jsonb)) > 1 then v_track else null end,
    'pending',
    'private',
    null
  )
  returning id into v_summary_id;

  return v_summary_id;
end;
$$;

revoke all on function public.finish_activity_session(uuid) from public;
grant execute on function public.finish_activity_session(uuid) to authenticated;

commit;
