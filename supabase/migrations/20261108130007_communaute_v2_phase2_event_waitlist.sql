-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Communauté v2 — PHASE 2 : sorties, vraie liste d'attente
-- Réécritures de fonctions/triggers existants — à appliquer APRÈS revue (06 § 3).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Prérequis : phase 1 appliquée, dont 20261108130003 (event_participants.status
-- + events.waitlist_enabled).
--
-- Règles :
--   * comportement IDENTIQUE à l'existant quand `waitlist_enabled = false` ;
--   * `join_event` : événement complet + liste d'attente activée → inscription
--     `waitlist`, contrat de retour conservé `{registered, current_participants,
--     status}` + clé `waitlisted` ;
--   * `leave_event` : commence par verrouiller l'événement, **supprime la
--     décrémentation manuelle** de `current_participants` (le recount suffit),
--     puis promeut le plus ancien `waitlist` en `confirmed` (jamais sur une
--     sortie passée ou annulée) et recalcule le compteur (le trigger
--     `sync_event_participants_count` ne se déclenche que sur INSERT/DELETE) ;
--   * `sync_event_participants_count` : ne compte que les `confirmed` ;
--   * `guard_event_participant_insert` : laisse passer `waitlist` si la liste
--     d'attente est activée, refuse toujours un `confirmed` au-delà de la
--     capacité ;
--   * `guard_event_participant_identity` : autorise la SEULE transition
--     `waitlist → confirmed`, et seulement pour une promotion faite par
--     `leave_event` (l'appelant n'est pas le promu). Un utilisateur ne peut donc
--     pas s'auto-promouvoir depuis la liste d'attente.
--
-- Les corps précédents sont restaurés par le .down.sql (copiés depuis pg_proc
-- de la production le 2026-11-08 avant réécriture).
--
-- Compatibilité : les pgTAP existants `event_participants_invariants` et
-- `event_cancellation` restent verts (liste d'attente désactivée par défaut :
-- même erreur « événement complet » / « événement annulé »).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. join_event ──────────────────────────────────────────────────────────
create or replace function public.join_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_max integer;
  v_status text;
  v_waitlist_enabled boolean;
  v_existing_status text;
  v_final_status text;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  select coalesce(current_participants, 0),
         coalesce(max_participants, 0),
         status,
         coalesce(waitlist_enabled, false)
    into v_count, v_max, v_status, v_waitlist_enabled
    from public.events
   where id = p_event_id
   for update;

  if not found then
    raise exception 'événement introuvable' using errcode = 'P0002';
  end if;
  if v_status = 'past' then
    raise exception 'événement terminé' using errcode = 'P0001';
  end if;
  if v_status = 'cancelled' then
    raise exception 'événement annulé' using errcode = 'P0001';
  end if;

  -- Déjà inscrit (confirmé ou en attente) : idempotent, on renvoie l'état réel.
  select status into v_existing_status
    from public.event_participants
   where event_id = p_event_id and user_id = v_uid;

  if v_existing_status is not null then
    select coalesce(current_participants, 0), coalesce(status, 'upcoming')
      into v_count, v_status
      from public.events
     where id = p_event_id;

    return jsonb_build_object(
      'registered', v_existing_status = 'confirmed',
      'current_participants', v_count,
      'status', v_status,
      'waitlisted', v_existing_status = 'waitlist'
    );
  end if;

  if v_max > 0 and v_count >= v_max then
    if not v_waitlist_enabled then
      raise exception 'événement complet' using errcode = 'P0001';
    end if;

    insert into public.event_participants (event_id, user_id, status)
    values (p_event_id, v_uid, 'waitlist')
    on conflict (event_id, user_id) do nothing;
  else
    insert into public.event_participants (event_id, user_id, status)
    values (p_event_id, v_uid, 'confirmed')
    on conflict (event_id, user_id) do nothing;
  end if;

  select status into v_final_status
    from public.event_participants
   where event_id = p_event_id and user_id = v_uid;

  -- Le trigger AFTER INSERT a recalculé current_participants/status.
  select coalesce(current_participants, 0), coalesce(status, 'upcoming')
    into v_count, v_status
    from public.events
   where id = p_event_id;

  return jsonb_build_object(
    'registered', v_final_status = 'confirmed',
    'current_participants', v_count,
    'status', v_status,
    'waitlisted', v_final_status = 'waitlist'
  );
end;
$function$;

-- ── 2. leave_event ─────────────────────────────────────────────────────────
create or replace function public.leave_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_status text;
  v_event_status text;
  v_deleted integer := 0;
  v_was_confirmed boolean := false;
  v_promoted uuid;
  v_next_id uuid;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  -- Verrou de l'événement AVANT toute lecture/écriture (absent avant A-124
  -- pour leave_event) : sérialise départ et promotion.
  select coalesce(status, 'upcoming') into v_event_status
    from public.events
   where id = p_event_id
   for update;

  if not found then
    raise exception 'événement introuvable' using errcode = 'P0002';
  end if;

  delete from public.event_participants
   where event_id = p_event_id
     and user_id = v_uid
     and status = 'confirmed';
  get diagnostics v_deleted = row_count;
  v_was_confirmed := v_deleted > 0;

  if not v_was_confirmed then
    -- Départ depuis la liste d'attente : rien à promouvoir.
    delete from public.event_participants
     where event_id = p_event_id
       and user_id = v_uid
       and status = 'waitlist';
  elsif v_event_status not in ('past', 'cancelled') then
    -- Promotion : le plus ancien en attente prend la place libérée.
    select id into v_next_id
      from public.event_participants
     where event_id = p_event_id and status = 'waitlist'
     order by coalesce(created_at, 'epoch'::timestamptz) asc, id asc
     limit 1
     for update;

    if v_next_id is not null then
      update public.event_participants
         set status = 'confirmed'
       where id = v_next_id;
      v_promoted := v_next_id;
    end if;
  end if;

  -- Recount des confirmés : le trigger AFTER INSERT/DELETE ne couvre pas la
  -- promotion (UPDATE) ; on garantit le même résultat quel que soit l'état.
  select count(*) into v_count
    from public.event_participants
   where event_id = p_event_id and status = 'confirmed';

  update public.events
     set current_participants = v_count,
         status = case
           when status in ('past', 'cancelled') then status
           when coalesce(max_participants, 0) > 0 and v_count >= max_participants then 'full'
           else 'upcoming'
         end
   where id = p_event_id
   returning current_participants, status into v_count, v_status;

  return jsonb_build_object(
    'registered', false,
    'current_participants', v_count,
    'status', v_status,
    'waitlisted', exists (
      select 1 from public.event_participants
       where event_id = p_event_id and user_id = v_uid and status = 'waitlist'
    ),
    'promoted', v_promoted
  );
end;
$function$;

-- ── 3. guard_event_participant_insert ─────────────────────────────────────
create or replace function public.guard_event_participant_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max integer;
  v_count integer;
  v_status text;
  v_waitlist_enabled boolean;
begin
  select coalesce(max_participants, 0),
         coalesce(current_participants, 0),
         status,
         coalesce(waitlist_enabled, false)
    into v_max, v_count, v_status, v_waitlist_enabled
    from public.events
   where id = new.event_id
   for update;

  if not found then
    raise exception 'événement introuvable' using errcode = 'P0002';
  end if;
  if v_status = 'past' then
    raise exception 'événement terminé' using errcode = 'P0001';
  end if;
  if v_status = 'cancelled' then
    raise exception 'événement annulé' using errcode = 'P0001';
  end if;

  -- Liste d'attente : autorisée seulement si l'organisateur l'a activée.
  if coalesce(new.status, 'confirmed') = 'waitlist' then
    if not v_waitlist_enabled then
      raise exception 'liste d''attente désactivée' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if v_max > 0 and v_count >= v_max then
    raise exception 'événement complet' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.guard_event_participant_insert() is
  'F-008 + A-124 + Communauté v2 : capacité/statut (terminé, annulé, complet) vérifiés à l''insertion ; waitlist acceptée seulement si waitlist_enabled.';

-- ── 4. guard_event_participant_identity ───────────────────────────────────
create or replace function public.guard_event_participant_identity()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.event_id is distinct from old.event_id
     or new.user_id is distinct from old.user_id then
    raise exception 'event_participants: une inscription ne se déplace pas (quitter puis rejoindre)'
      using errcode = '42501';
  end if;

  -- Une seule transition autorisée : la promotion waitlist → confirmed faite
  -- par leave_event, qui promeut une AUTRE personne que l'appelant.
  if new.status is distinct from old.status then
    if old.status = 'waitlist'
       and new.status = 'confirmed'
       and (select auth.uid()) is not null
       and (select auth.uid()) is distinct from new.user_id then
      return new;
    end if;

    raise exception 'event_participants: seule la promotion liste d''attente → confirmé par leave_event est autorisée'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

-- ── 5. sync_event_participants_count ──────────────────────────────────────
create or replace function public.sync_event_participants_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event uuid := coalesce(new.event_id, old.event_id);
  v_count integer;
begin
  -- Seuls les confirmés sont comptés : les inscrits en liste d'attente ne
  -- prennent pas de place.
  select count(*) into v_count
    from public.event_participants
   where event_id = v_event and status = 'confirmed';

  update public.events
     set current_participants = v_count,
         status = case
           when coalesce(max_participants, 0) > 0 and v_count >= max_participants then 'full'
           else 'upcoming'
         end
   where id = v_event
     and status not in ('past', 'cancelled');

  return null;
end;
$$;

comment on function public.sync_event_participants_count() is
  'F-008 + A-124 + Communauté v2 : recount des participants CONFIRMÉS (la liste d''attente ne compte pas) ; ne ressuscite jamais past/cancelled.';

-- ── 6. Privilèges (revue statique 2.4 + hygiène des RPC definer) ──────────
-- Les deux RPC sont des fonctions `security definer` : PUBLIC garde EXECUTE
-- par défaut en PostgreSQL, on le retire explicitement puis on n'ouvre qu'aux
-- utilisateurs connectés (l'invité reste refusé). Les trois fonctions de
-- trigger ne sont jamais appelées par un client : aucun EXECUTE accordé.
revoke execute on function public.join_event(uuid) from public, anon;
grant execute on function public.join_event(uuid) to authenticated;

revoke execute on function public.leave_event(uuid) from public, anon;
grant execute on function public.leave_event(uuid) to authenticated;

revoke execute on function public.guard_event_participant_insert() from public, anon, authenticated;
revoke execute on function public.guard_event_participant_identity() from public, anon, authenticated;
revoke execute on function public.sync_event_participants_count() from public, anon, authenticated;
