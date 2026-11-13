-- Explorer v2 — progression et points de séance idempotents (S1.02, K6.15).
--
-- Pourquoi une migration :
--   `activity_points` n'avait aucun identifiant fourni par le client. Une
--   réponse réseau perdue après insertion était donc indiscernable d'un lot
--   jamais reçu : rejouer le lot créait des points en double. La séquence
--   client + l'index unique `(session_id, client_seq)` rendent le renvoi
--   idempotent, comme le demande le contrat Session v1.
--
-- Portée strictement additive :
--   • une colonne nullable `client_seq` (les points historiques restent NULL) ;
--   • un index unique (les NULL restent distincts) ;
--   • une RPC `sync_activity_session` qui vérifie le propriétaire, ignore les
--     séquences déjà présentes et met à jour les seules métriques de séance.
--
-- Aucune policy, aucun grant existant n'est retiré. Les anciens clients peuvent
-- continuer d'insérer directement dans `activity_points` via leurs droits
-- actuels. La RPC est `SECURITY DEFINER` avec `search_path` verrouillé et
-- `EXECUTE` réservé à `authenticated`.
--
-- Version volontairement hors de la plage `2026111212xxxx` déjà réservée par
-- les branches séance et carnet.

begin;

-- 1. Séquence stable fournie par le client.
alter table public.activity_points
  add column if not exists client_seq integer;

comment on column public.activity_points.client_seq is
  'S1.02/K6.15 — séquence monotone fournie par le client pour rendre le renvoi d''un lot de points idempotent ; NULL pour les points historiques.';

-- 2. Unicité par séance. Les lignes historiques ont client_seq NULL et ne se
--    gênent pas (NULL distincts dans un index unique PostgreSQL).
create unique index if not exists activity_points_session_client_seq_idx
  on public.activity_points (session_id, client_seq);

-- 3. Progression de séance : points séquencés + métriques, atomiquement.
create or replace function public.sync_activity_session(
  p_session uuid,
  p_points jsonb,
  p_distance_m integer,
  p_elev_gain_m integer,
  p_moving_s integer,
  p_paused boolean,
  p_started_at timestamptz default null,
  p_ended_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_session public.activity_sessions%rowtype;
  v_received integer;
  v_inserted integer := 0;
  v_ack integer := 0;
  v_last_lat numeric(8,5);
  v_last_lng numeric(8,5);
begin
  if v_user is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;

  if p_points is null or jsonb_typeof(p_points) <> 'array' then
    raise exception 'points invalides' using errcode = '22023';
  end if;

  v_received := jsonb_array_length(p_points);
  if v_received > 200 then
    raise exception 'lot de points trop grand' using errcode = '22023';
  end if;

  if p_distance_m is null or p_distance_m < 0
     or p_elev_gain_m is null or p_elev_gain_m < 0
     or p_moving_s is null or p_moving_s < 0 then
    raise exception 'métriques invalides' using errcode = '22023';
  end if;

  -- Verrou de ligne : une fin concurrente ne peut pas clore la séance entre
  -- la validation et l'insertion des derniers points.
  select * into v_session
    from public.activity_sessions
   where id = p_session
     for update;

  if not found then
    raise exception 'séance introuvable' using errcode = 'P0002';
  end if;
  if v_session.user_id <> v_user then
    raise exception 'séance d''un autre utilisateur' using errcode = '42501';
  end if;
  if v_session.status = 'finished' or v_session.status = 'abandoned' then
    raise exception 'séance déjà close' using errcode = '22023';
  end if;

  -- Validation défensive : la route valide déjà, mais la RPC est appelable
  -- directement. Les casts numériques sont sûrs après `jsonb_typeof`.
  if exists (
    select 1
      from jsonb_array_elements(p_points) as e
     where case
             when coalesce(jsonb_typeof(e->'seq'), 'missing') = 'number' then
               (e->>'seq')::numeric < 1
               or (e->>'seq')::numeric > 1000000000
               or (e->>'seq')::numeric <> trunc((e->>'seq')::numeric)
             else false
           end
        or coalesce(jsonb_typeof(e->'seq'), 'missing') <> 'number'
        or coalesce(jsonb_typeof(e->'t'), 'missing') <> 'string'
        or (e->>'t') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
        or case
             when coalesce(jsonb_typeof(e->'lat'), 'missing') = 'number' then
               (e->>'lat')::numeric < -90 or (e->>'lat')::numeric > 90
             else false
           end
        or case
             when coalesce(jsonb_typeof(e->'lng'), 'missing') = 'number' then
               (e->>'lng')::numeric < -180 or (e->>'lng')::numeric > 180
             else false
           end
        or coalesce(jsonb_typeof(e->'lat'), 'missing') <> 'number'
        or coalesce(jsonb_typeof(e->'lng'), 'missing') <> 'number'
        or (e ? 'ele' and coalesce(jsonb_typeof(e->'ele'), 'null') not in ('null', 'number'))
        or (e ? 'acc' and coalesce(jsonb_typeof(e->'acc'), 'null') not in ('null', 'number'))
        or (e ? 'speed' and coalesce(jsonb_typeof(e->'speed'), 'null') not in ('null', 'number'))
  ) then
    raise exception 'point invalide' using errcode = '22023';
  end if;

  insert into public.activity_points (
    session_id, t, lat, lng, ele, acc, speed, client_seq
  )
  select
    p_session,
    (e->>'t')::timestamptz,
    (e->>'lat')::numeric(9,6),
    (e->>'lng')::numeric(9,6),
    case when jsonb_typeof(e->'ele') = 'number' then (e->>'ele')::numeric(7,1) else null end,
    case when jsonb_typeof(e->'acc') = 'number' then (e->>'acc')::numeric(6,1) else null end,
    case when jsonb_typeof(e->'speed') = 'number' then (e->>'speed')::numeric(6,2) else null end,
    (e->>'seq')::integer
  from jsonb_array_elements(p_points) as e
  on conflict (session_id, client_seq) do nothing;

  get diagnostics v_inserted = row_count;

  -- Acquittement de la plus grande séquence du lot. Le client ne fera avancer
  -- son curseur qu'après cette réponse ; un doublon ne change pas la valeur.
  if v_received > 0 then
    select max((e->>'seq')::integer)
      into v_ack
      from jsonb_array_elements(p_points) as e;

    select (e->>'lat')::numeric(8,5), (e->>'lng')::numeric(8,5)
      into v_last_lat, v_last_lng
      from jsonb_array_elements(p_points) as e
     order by (e->>'seq')::integer desc
     limit 1;
  end if;

  update public.activity_sessions
     set distance_m = p_distance_m,
         elev_gain_m = p_elev_gain_m,
         moving_s = p_moving_s,
         status = case when p_paused then 'paused' else 'live' end,
         -- Une séance créée après coup (départ hors ligne) doit conserver
         -- l'heure réelle du premier point, jamais l'heure de la requête.
         -- On ne peut pas la déplacer vers le futur par une horloge aberrante.
         started_at = case
           when p_started_at is not null
             and p_started_at >= timestamptz '2000-01-01'
             and p_started_at <= now()
             and p_started_at < started_at
             then p_started_at
           else started_at
         end,
         -- Même règle pour la fin : un arrêt hors ligne ne doit pas être
         -- déplacé à l'heure de la reconnexion.
         ended_at = case
           when p_ended_at is not null
             and p_ended_at >= timestamptz '2000-01-01'
             and p_ended_at <= now()
             then p_ended_at
           else ended_at
         end,
         last_lat = coalesce(v_last_lat, last_lat),
         last_lng = coalesce(v_last_lng, last_lng),
         updated_at = now()
   where id = p_session;

  return jsonb_build_object(
    'inserted', v_inserted,
    'received', v_received,
    'syncedThroughSeq', coalesce(v_ack, 0)
  );
end;
$$;

revoke all on function public.sync_activity_session(uuid, jsonb, integer, integer, integer, boolean, timestamptz, timestamptz)
  from public;
grant execute on function public.sync_activity_session(uuid, jsonb, integer, integer, integer, boolean, timestamptz, timestamptz)
  to authenticated;

commit;
