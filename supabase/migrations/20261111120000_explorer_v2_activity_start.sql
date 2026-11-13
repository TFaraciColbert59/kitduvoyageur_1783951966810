-- Explorer v2 — démarrage persistant d'activité (S1.02, K6.15).
--
-- Objectif : une route authentifiée peut créer une ligne `activity_sessions`
-- idempotente à partir d'un identifiant de séance stable fourni par le client.
-- Le serveur génère l'identifiant public de séance, détermine l'acteur avec
-- `auth.uid()` et conserve la variante choisie sans toucher aux colonnes
-- historiques. `finish_activity_session` garde sa signature et propage
-- désormais la variante vers `hike_sessions`.
--
-- Migration additive pour les données : colonnes nullables, une table de
-- référence en lecture seule, des FK, un index unique partiel, un trigger de
-- garde et une fonction RPC dédiée. Aucune donnée n'est supprimée ni réécrite ;
-- aucun droit table-level n'est retiré aux anciens clients.
--
-- Compatibilité route/RPC : la RPC renvoie `routeId` en nombre pour les
-- identifiants <= 2^31-1 (lisibles par l'ancienne route) et en chaîne au-delà
-- (la nouvelle route lit les deux). L'ordre recommandé reste : déployer la
-- route, puis appliquer cette migration. Une migration appliquée avant la
-- nouvelle route ne casse plus les identifiants que l'ancienne route accepte.
--
-- État de cette révision : migration locale sur une branche non intégrée,
-- version absente du baseline ; aucune preuve d'application distante n'est supposée.
-- Si une application est constatée ailleurs, ne pas rejouer ce fichier modifié :
-- reprendre les sections 4 bis et 7 dans une migration de suivi additive avec
-- son down.
--
-- Révision de revue :
--   • la clé d'idempotence de fin est liée à `p_session` (colonne dédiée et
--     index unique partiel) ; une clé réutilisée pour une autre séance est un
--     conflit explicite, jamais un `duplicate` trompeur ;
--   • aucun enregistrement `applied` n'est écrit sans résumé : une séance déjà
--     close sans résumé connu répond `already_finished` ;
--   • les fins concurrentes d'une même séance sont sérialisées même lorsque
--     les clés diffèrent, et une seconde clé relit le résumé de la première ;
--   • le down est un rollback de sécurité documenté, pas un retour
--     byte-for-byte (voir son en-tête).
--
-- Verrous : l'ajout des FK et de l'index prend un verrou de table. Sur une
-- table volumineuse, prévoir une fenêtre de maintenance ; la migration reste
-- transactionnelle et ne supprime aucune ligne.

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

revoke all on public.explorer_sport_variants from anon, authenticated;
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

-- 3. Invariants structurels.
--    - `sport` doit exister dans la taxonomie (`explorer_sport_map`) ;
--    - une variante non nulle appartient toujours à la paire démarrable.
--    Les contraintes sont ajoutées `NOT VALID` puis validées seulement si les
--    lignes historiques sont compatibles : aucune donnée existante n'est
--    supprimée ou réécrite. `NOT VALID` protège déjà toutes les nouvelles
--    écritures, y compris les mises à jour de lignes anciennes.
alter table public.activity_sessions
  drop constraint if exists activity_sessions_variant_id_check;

alter table public.activity_sessions
  drop constraint if exists activity_sessions_variant_pair_fkey;
alter table public.activity_sessions
  add constraint activity_sessions_variant_pair_fkey
  foreign key (sport, variant_id)
  references public.explorer_sport_variants (sport, variant_id)
  on delete restrict
  not valid;

alter table public.activity_sessions
  drop constraint if exists activity_sessions_sport_fkey;
alter table public.activity_sessions
  add constraint activity_sessions_sport_fkey
  foreign key (sport)
  references public.explorer_sport_map (sport)
  on delete restrict
  not valid;

-- Index de support des deux FK : le préfixe `sport` sert aussi à la FK simple.
create index if not exists activity_sessions_sport_variant_idx
  on public.activity_sessions (sport, variant_id);

do $$
begin
  if exists (
    select 1
      from public.activity_sessions s
     where s.variant_id is not null
       and not exists (
         select 1
           from public.explorer_sport_variants v
          where v.sport = s.sport
            and v.variant_id = s.variant_id
       )
  ) then
    raise warning 'activity_sessions: variantes historiques hors référentiel, contrainte activity_sessions_variant_pair_fkey laissée NOT VALID';
  else
    execute 'alter table public.activity_sessions validate constraint activity_sessions_variant_pair_fkey';
  end if;

  if exists (
    select 1
      from public.activity_sessions s
     where not exists (
       select 1 from public.explorer_sport_map m where m.sport = s.sport
     )
  ) then
    raise warning 'activity_sessions: sports historiques hors taxonomie, contrainte activity_sessions_sport_fkey laissée NOT VALID';
  else
    execute 'alter table public.activity_sessions validate constraint activity_sessions_sport_fkey';
  end if;
end $$;

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

-- 4 bis. Registre de fin : lier la clé d'idempotence à la séance qu'elle a
--       réellement close. La colonne est additive et nulle pour l'historique
--       et pour les autres opérations hors-ligne ; elle ne change aucun grant.
alter table public.offline_sync_operations
  add column if not exists activity_session_id uuid;

comment on column public.offline_sync_operations.activity_session_id is
  'S1.02/K6.15 — séance close par une opération activity.finish ; NULL pour les autres opérations et l''historique.';

-- Une seule fin acquittée par séance, même si deux clés différentes ont été
-- utilisées. L'index est partiel : les opérations hors-ligne non liées à une
-- séance et les lignes historiques restent hors index.
create unique index if not exists offline_sync_activity_finish_session_idx
  on public.offline_sync_operations (user_id, activity_session_id)
  where kind = 'activity.finish'
    and status = 'applied'
    and activity_session_id is not null;

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
  c_legacy_route_max constant bigint := 2147483647;
  v_route_id jsonb;
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
    -- Nombre pour les identifiants que l'ancienne route sait lire, chaîne
    -- exacte au-delà : aucune perte de chiffres, aucun client cassé.
    v_route_id := case
      when v_session.route_id is not null and v_session.route_id > c_legacy_route_max
        then to_jsonb(v_session.route_id::text)
      else to_jsonb(v_session.route_id)
    end;

    return jsonb_build_object(
      'ok', true,
      'created', true,
      'sessionId', v_session.id,
      'clientSessionId', v_session.client_session_id,
      'sport', v_session.sport,
      'variantId', v_session.variant_id,
      -- Compatibilité : nombre si l'ancienne route peut le lire, sinon texte.
      'routeId', v_route_id,
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

  v_route_id := case
    when v_session.route_id is not null and v_session.route_id > c_legacy_route_max
      then to_jsonb(v_session.route_id::text)
    else to_jsonb(v_session.route_id)
  end;

  return jsonb_build_object(
    'ok', true,
    'created', false,
    'sessionId', v_session.id,
    'clientSessionId', v_session.client_session_id,
    'sport', v_session.sport,
    'variantId', v_session.variant_id,
    'routeId', v_route_id,
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
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  s public.activity_sessions;
  v_summary_id uuid;
  v_track jsonb;
begin
  select * into s from public.activity_sessions where id = p_session;
  if not found then
    raise exception 'session introuvable' using errcode = 'P0002';
  end if;
  -- `auth.uid()` nul rend la comparaison nulle : le test explicite ferme le
  -- chemin non authentifié au lieu de laisser passer la séance.
  if v_user is null or s.user_id <> v_user then
    raise exception 'session d''un autre utilisateur' using errcode = '42501';
  end if;
  if s.status = 'finished' then
    return null;
  end if;

  -- Verrou de ligne par update conditionnel : deux fins concurrentes ne
  -- peuvent pas insérer deux résumés. La seconde voit 0 ligne et sort.
  update public.activity_sessions
     set status = 'finished',
         ended_at = coalesce(ended_at, now()),
         updated_at = now()
   where id = p_session
     and status <> 'finished'
  returning * into s;

  if not found then
    return null;
  end if;

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

-- 7. Fin idempotente : la clé est liée à la séance et les fins concurrentes
--    d'une même séance sont sérialisées, même lorsqu'elles utilisent des clés
--    différentes.
--    - verrou de clé : deux rejeux de la même clé ne se croisent pas ;
--    - une ligne de registre existante est comparée à `p_session` : une clé
--      réutilisée pour une autre séance est un `conflict`, jamais un
--      `duplicate` du résumé d'autrui ;
--    - verrou de séance : deux clés différentes pour la même séance ne
--      produisent pas deux résumés ; la seconde relit le résumé de la première ;
--    - aucun `applied` sans résumé : une séance déjà close sans résumé connu
--      répond `already_finished`, sans écrire dans le registre.
create or replace function public.finish_activity_session_idempotent(
  p_session uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.offline_sync_operations%rowtype;
  v_summary uuid;
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'clé d''idempotence invalide' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text || ':finish:' || p_idempotency_key, 0)
  );

  select * into v_existing
    from public.offline_sync_operations
   where user_id = v_user and idempotency_key = p_idempotency_key;

  if found then
    -- L'historique de 20261107/5ce8ef2 porte `kind = activity.finish`,
    -- `status = applied` et `result.sessionId`. Une ligne d'une autre
    -- opération ou d'une autre séance ne doit jamais servir de preuve.
    if v_existing.kind is distinct from 'activity.finish'
       or v_existing.status is distinct from 'applied'
       or (v_existing.result ->> 'sessionId') is distinct from p_session::text then
      return jsonb_build_object(
        'status', 'conflict',
        'reason', 'idempotency_key_reused',
        'summaryId', null
      );
    end if;

    if (v_existing.result ->> 'summaryId') is null then
      return jsonb_build_object(
        'status', 'already_finished',
        'reason', 'session_already_finished',
        'summaryId', null
      );
    end if;

    return jsonb_build_object(
      'status', 'duplicate',
      'summaryId', v_existing.result ->> 'summaryId'
    );
  end if;

  -- Deux clés différentes pour la même séance sont sérialisées ici : la
  -- seconde voit la ligne `applied` de la première et renvoie son résumé.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text || ':finish-session:' || p_session::text, 0)
  );

  select * into v_existing
    from public.offline_sync_operations
   where user_id = v_user
     and activity_session_id = p_session
     and kind = 'activity.finish'
     and status = 'applied';

  if found then
    if (v_existing.result ->> 'summaryId') is null then
      return jsonb_build_object(
        'status', 'already_finished',
        'reason', 'session_already_finished',
        'summaryId', null
      );
    end if;

    return jsonb_build_object(
      'status', 'duplicate',
      'summaryId', v_existing.result ->> 'summaryId'
    );
  end if;

  v_summary := public.finish_activity_session(p_session);

  -- La séance était déjà close (autre appareil, ancien client sans clé, ligne
  -- historique) : on ne prétend pas avoir appliqué une fin, et on n'écrit pas
  -- un `applied` sans résumé.
  if v_summary is null then
    return jsonb_build_object(
      'status', 'already_finished',
      'reason', 'session_already_finished',
      'summaryId', null
    );
  end if;

  insert into public.offline_sync_operations (
    user_id,
    idempotency_key,
    store,
    kind,
    status,
    result,
    activity_session_id
  )
  values (
    v_user,
    p_idempotency_key,
    'explorer',
    'activity.finish',
    'applied',
    jsonb_build_object('summaryId', v_summary, 'sessionId', p_session),
    p_session
  )
  on conflict do nothing;

  -- Une autre voie a acquitté la même clé, ou la même séance avec une autre
  -- clé, entre-temps : relire la ligne gagnante plutôt que de renvoyer un
  -- résumé qui n'est pas celui du registre.
  if not found then
    select * into v_existing
      from public.offline_sync_operations
     where user_id = v_user and idempotency_key = p_idempotency_key;

    if found then
      if v_existing.kind is distinct from 'activity.finish'
         or v_existing.status is distinct from 'applied'
         or (v_existing.result ->> 'sessionId') is distinct from p_session::text then
        return jsonb_build_object(
          'status', 'conflict',
          'reason', 'idempotency_key_reused',
          'summaryId', null
        );
      end if;

      if (v_existing.result ->> 'summaryId') is null then
        return jsonb_build_object(
          'status', 'already_finished',
          'reason', 'session_already_finished',
          'summaryId', null
        );
      end if;

      return jsonb_build_object(
        'status', 'duplicate',
        'summaryId', v_existing.result ->> 'summaryId'
      );
    end if;

    select * into v_existing
      from public.offline_sync_operations
     where user_id = v_user
       and activity_session_id = p_session
       and kind = 'activity.finish'
       and status = 'applied';

    if found then
      if (v_existing.result ->> 'summaryId') is null then
        return jsonb_build_object(
          'status', 'already_finished',
          'reason', 'session_already_finished',
          'summaryId', null
        );
      end if;

      return jsonb_build_object(
        'status', 'duplicate',
        'summaryId', v_existing.result ->> 'summaryId'
      );
    end if;

    raise exception 'fin de séance concurrente introuvable' using errcode = '40001';
  end if;

  return jsonb_build_object('status', 'applied', 'summaryId', v_summary);
end;
$$;

revoke all on function public.finish_activity_session_idempotent(uuid, text) from public;
grant execute on function public.finish_activity_session_idempotent(uuid, text) to authenticated;

commit;
