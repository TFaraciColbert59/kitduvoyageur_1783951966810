-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Communauté v2 — lot D : adhésion aux clubs (colonnes + RPC)
-- Phase 1 (ajouts purs : colonnes nullables/défaut, index, nouvelles fonctions).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat prod (2026-11-08) : `clubs.rules` n'existe pas (le formulaire v1
-- écrit dedans : la création v1 est cassée en prod, ne pas s'en inspirer),
-- `clubs` n'a ni `join_questions`, ni `activities`, ni `location_label` ;
-- `club_join_requests` n'a pas `answers` ; il n'existe aucune RPC d'adhésion.
--
-- Ce lot fournit :
--   - les colonnes de présentation/adhésion (aucune donnée existante modifiée) ;
--   - `join_club` (open → membre, closed → demande, secret → refus explicite,
--     banni → refus), `leave_club` (garde « dernier admin » conservée),
--     `cancel_join_request`, `review_join_request` (admin/modérateur actif) ;
--   - le recalcul de `clubs.members_count` **dans la RPC** : le trigger de
--     compteur (`trg_sync_club_members_count`, migration 20261028160000) est
--     absent de la prod au 2026-11-08 (registre en retard). En CI, où il est
--     présent, le recalcul est idempotent (même valeur) : aucun double comptage.
--
-- Sécurité : toutes les RPC d'écriture sont `security definer`, `search_path`
-- verrouillé, `auth.uid()` non nul **et non anonyme** vérifiés explicitement,
-- `revoke execute ... from public` puis `grant ... to authenticated`. L'erreur
-- remonte au format JSON `{code, message, field?}` (dans `RAISE ... MESSAGE`),
-- que l'UI V2 parse une seule fois et affiche une seule fois.
--
-- On ne touche PAS à la politique `Public read clubs` (elle exclut déjà les
-- clubs `secret` pour les non-membres en prod, vérifié le 2026-11-08) :
-- /clubs et la fiche club v1 gardent leur comportement.
--
-- Les helpers `lkdv_raise` / `lkdv_require_actor` / `lkdv_recount_club_members`
-- sont posés ici car c'est le premier lot qui écrit ; le lot E les réutilise.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Helpers d'erreur et d'identité (internes aux RPC) ───────────────────
create or replace function public.lkdv_raise(
  p_code text,
  p_message text,
  p_field text default null
)
returns void
language plpgsql
set search_path = public
as $$
begin
  raise exception '%',
    jsonb_strip_nulls(jsonb_build_object(
      'code', p_code,
      'message', p_message,
      'field', p_field
    ))::text
    using errcode = 'P0001';
end;
$$;

comment on function public.lkdv_raise(text, text, text) is
  'Communauté v2 : lève une erreur applicative au format JSON {code, message, field?} (SQLSTATE P0001), consommée par createRpc.ts / communityMutations.ts.';

revoke all on function public.lkdv_raise(text, text, text) from public;
revoke all on function public.lkdv_raise(text, text, text) from anon, authenticated;

create or replace function public.lkdv_require_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_anonymous boolean;
begin
  if v_uid is null then
    perform public.lkdv_raise('not_authenticated', 'Connecte-toi pour continuer.');
  end if;

  select coalesce(u.is_anonymous, false)
    into v_anonymous
    from auth.users u
   where u.id = v_uid;

  if coalesce(v_anonymous, false) or public.is_anonymous_session() then
    perform public.lkdv_raise('anonymous_not_allowed', 'Crée un compte pour continuer.');
  end if;

  return v_uid;
end;
$$;

comment on function public.lkdv_require_actor() is
  'Communauté v2 : identité obligatoire pour les RPC d''écriture — auth.uid() non nul, ni session anonyme Supabase (auth.users.is_anonymous / is_anonymous_session()).';

revoke all on function public.lkdv_require_actor() from public;
revoke all on function public.lkdv_require_actor() from anon, authenticated;

create or replace function public.lkdv_recount_club_members(p_club uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from public.club_members
   where club_id = p_club and status = 'active';

  update public.clubs
     set members_count = v_count,
         updated_at = now()
   where id = p_club;

  return v_count;
end;
$$;

comment on function public.lkdv_recount_club_members(uuid) is
  'Communauté v2 : recalcule clubs.members_count (membres actifs). Appelé par les RPC d''adhésion car le trigger de compteur est absent de la prod au 2026-11-08 ; idempotent quand il est présent (CI).';

revoke all on function public.lkdv_recount_club_members(uuid) from public;
revoke all on function public.lkdv_recount_club_members(uuid) from anon, authenticated;

-- ── 2. Colonnes d'adhésion et de présentation ──────────────────────────────
alter table public.clubs
  add column if not exists rules text check (rules is null or char_length(rules) <= 1000),
  add column if not exists join_questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(join_questions) = 'array' and jsonb_array_length(join_questions) <= 3),
  add column if not exists activities text[] not null default '{}',
  add column if not exists location_label text
    check (location_label is null or char_length(location_label) <= 120);

alter table public.club_join_requests
  add column if not exists answers jsonb not null default '[]'::jsonb
  check (jsonb_typeof(answers) = 'array');

create index if not exists idx_club_join_requests_club_status
  on public.club_join_requests (club_id, status);

comment on column public.clubs.rules is
  'Communauté v2 — règlement intérieur du club (texte libre ≤ 1000). Colonne absente de la prod 2026-11-08 avant ce lot.';
comment on column public.clubs.join_questions is
  'Communauté v2 — jusqu''à 3 questions d''adhésion (tableau JSON de chaînes).';
comment on column public.clubs.activities is
  'Communauté v2 — activités du club (chips d''activité du volet Clubs).';
comment on column public.clubs.location_label is
  'Communauté v2 — libellé de lieu affiché (le point géographique est clubs.zone_geom, lot B).';
comment on column public.club_join_requests.answers is
  'Communauté v2 — réponses aux join_questions du club, même ordre que les questions.';

-- ── 3. Adhésion : join_club / leave_club / cancel_join_request ────────────
create or replace function public.join_club(
  p_club uuid,
  p_answers jsonb default '[]'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.lkdv_require_actor();
  v_privacy text;
  v_effective text;
  v_member_status text;
  v_answers jsonb;
begin
  if p_club is null then
    perform public.lkdv_raise('validation_failed', 'Club manquant.', 'club');
  end if;

  v_answers := case
    when p_answers is null or jsonb_typeof(p_answers) <> 'array' then '[]'::jsonb
    else p_answers
  end;

  if jsonb_array_length(v_answers) > 3 then
    perform public.lkdv_raise('validation_failed', 'Trois réponses d''adhésion au maximum.', 'answers');
  end if;

  -- Verrou du club : sérialise les adhésions et le compteur.
  select privacy into v_privacy
    from public.clubs
   where id = p_club
   for update;

  if not found then
    perform public.lkdv_raise('not_found', 'Club introuvable.');
  end if;

  v_effective := case
    when v_privacy in ('open', 'closed', 'secret') then v_privacy
    else 'open'
  end;

  select status into v_member_status
    from public.club_members
   where club_id = p_club and user_id = v_uid;

  if v_member_status = 'banned' then
    perform public.lkdv_raise('banned', 'Tu ne peux pas rejoindre ce club.');
  end if;
  if v_member_status = 'active' then
    return 'member';
  end if;

  if v_effective = 'secret' then
    perform public.lkdv_raise('secret_club', 'Ce club est privé : demande une invitation.');
  end if;

  if v_effective = 'closed' then
    insert into public.club_join_requests (club_id, user_id, status, answers)
    values (p_club, v_uid, 'pending', v_answers)
    on conflict (club_id, user_id) do update
      set status = 'pending',
          answers = excluded.answers,
          reviewed_by = null,
          updated_at = now();
    return 'pending';
  end if;

  -- open : adhésion directe, idempotente.
  insert into public.club_members (club_id, user_id, role, status)
  values (p_club, v_uid, 'member', 'active')
  on conflict (club_id, user_id) do nothing;

  perform public.lkdv_recount_club_members(p_club);
  return 'member';
end;
$$;

comment on function public.join_club(uuid, jsonb) is
  'Communauté v2 — Clubs#15 : open → membre (idempotent), closed → demande pending (upsert + réponses), secret → refus secret_club, banni → refus banned. Compteur recalculé dans la transaction.';

revoke all on function public.join_club(uuid, jsonb) from public;
grant execute on function public.join_club(uuid, jsonb) to authenticated;

create or replace function public.leave_club(p_club uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.lkdv_require_actor();
  v_status text;
  v_deleted integer := 0;
begin
  if p_club is null then
    perform public.lkdv_raise('validation_failed', 'Club manquant.', 'club');
  end if;

  perform 1 from public.clubs where id = p_club for update;
  if not found then
    perform public.lkdv_raise('not_found', 'Club introuvable.');
  end if;

  select status into v_status
    from public.club_members
   where club_id = p_club and user_id = v_uid;

  if v_status is null then
    return 'none';
  end if;
  if v_status = 'banned' then
    perform public.lkdv_raise('banned', 'Tu es exclu de ce club.');
  end if;

  -- La garde « dernier administrateur » du trigger lève 42501 : on la traduit
  -- en erreur applicative lisible (l'UI affiche un seul message).
  begin
    delete from public.club_members
     where club_id = p_club and user_id = v_uid;
    get diagnostics v_deleted = row_count;
  exception
    when sqlstate '42501' then
      perform public.lkdv_raise(
        'last_admin',
        'Désigne un autre administrateur avant de quitter le club.'
      );
  end;

  perform public.lkdv_recount_club_members(p_club);
  return case when v_deleted > 0 then 'left' else 'none' end;
end;
$$;

comment on function public.leave_club(uuid) is
  'Communauté v2 — quitter un club : last_admin traduit en erreur applicative, banni refusé (le retrait d''une exclusion n''est pas un départ), compteur recalculé.';

revoke all on function public.leave_club(uuid) from public;
grant execute on function public.leave_club(uuid) to authenticated;

create or replace function public.cancel_join_request(p_club uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.lkdv_require_actor();
  v_deleted integer := 0;
begin
  if p_club is null then
    perform public.lkdv_raise('validation_failed', 'Club manquant.', 'club');
  end if;

  delete from public.club_join_requests
   where club_id = p_club and user_id = v_uid and status = 'pending';
  get diagnostics v_deleted = row_count;

  return case when v_deleted > 0 then 'cancelled' else 'none' end;
end;
$$;

comment on function public.cancel_join_request(uuid) is
  'Communauté v2 — annuler sa demande d''adhésion pending ; retourne cancelled ou none.';

revoke all on function public.cancel_join_request(uuid) from public;
grant execute on function public.cancel_join_request(uuid) to authenticated;

-- ── 4. Modération : review_join_request ───────────────────────────────────
create or replace function public.review_join_request(
  p_request uuid,
  p_approve boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.lkdv_require_actor();
  v_club uuid;
  v_user uuid;
  v_status text;
  v_actor_role text;
  v_actor_status text;
  v_member_status text;
  v_new_status text;
  v_count integer;
begin
  if p_request is null then
    perform public.lkdv_raise('validation_failed', 'Demande manquante.', 'request');
  end if;

  select club_id, user_id, status
    into v_club, v_user, v_status
    from public.club_join_requests
   where id = p_request
   for update;

  if not found then
    perform public.lkdv_raise('not_found', 'Demande introuvable.');
  end if;

  select role, status
    into v_actor_role, v_actor_status
    from public.club_members
   where club_id = v_club and user_id = v_uid;

  if coalesce(v_actor_status, '') <> 'active'
     or coalesce(v_actor_role, 'member') not in ('admin', 'moderator') then
    perform public.lkdv_raise(
      'forbidden',
      'Seuls les administrateurs et modérateurs du club peuvent traiter les demandes.'
    );
  end if;

  if v_status <> 'pending' then
    select coalesce(members_count, 0) into v_count from public.clubs where id = v_club;
    return jsonb_build_object(
      'status', v_status,
      'changed', false,
      'members_count', v_count
    );
  end if;

  if coalesce(p_approve, false) then
    select status into v_member_status
      from public.club_members
     where club_id = v_club and user_id = v_user;

    if v_member_status = 'banned' then
      perform public.lkdv_raise(
        'banned',
        'Cette personne est exclue du club : lève l''exclusion avant de l''accepter.'
      );
    end if;

    insert into public.club_members (club_id, user_id, role, status)
    values (v_club, v_user, 'member', 'active')
    on conflict (club_id, user_id) do update
      set status = 'active';

    v_new_status := 'approved';
  else
    v_new_status := 'rejected';
  end if;

  update public.club_join_requests
     set status = v_new_status,
         reviewed_by = v_uid,
         updated_at = now()
   where id = p_request;

  v_count := public.lkdv_recount_club_members(v_club);

  return jsonb_build_object(
    'status', v_new_status,
    'changed', true,
    'members_count', v_count,
    'user_id', v_user
  );
end;
$$;

comment on function public.review_join_request(uuid, boolean) is
  'Communauté v2 — Clubs#7 : accepter/refuser une demande pending. Réservé à un admin/modérateur actif ; approuver crée le club_members(member, active) et recale le compteur. Réponse {status, changed, members_count[, user_id]}.';

revoke all on function public.review_join_request(uuid, boolean) from public;
grant execute on function public.review_join_request(uuid, boolean) to authenticated;
