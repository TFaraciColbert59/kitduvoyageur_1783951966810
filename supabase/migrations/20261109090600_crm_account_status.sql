-- ═══════════════════════════════════════════════════════════════════════════
-- M06 — crm_account_status  (03_MODELE_DE_DONNEES.md § 2)
-- Statut de compte porté par user_profiles, verrou du déclencheur existant,
-- prédicat public.account_can_write() et lecture/écriture bornée.
--
-- Décisions :
--   * `account_status` distinct de `is_suspended_groups` (qui ne vise que les
--     groupes) : ici c'est le compte entier.
--   * la suspension est temporaire (`suspended_until`) ; une suspension
--     échue redonne le droit d'écrire sans intervention humaine.
--   * un compte suspendu ou banni peut TOUJOURS signaler un contenu
--     (tables de signalement volontairement hors du verrou) et écrire au
--     support.
--   * aucune donnée existante modifiée : colonne ajoutée avec sa valeur par
--     défaut ('active' pour les 176 comptes).
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Colonnes
-- ───────────────────────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists account_status text not null default 'active';
alter table public.user_profiles
  add column if not exists suspended_until timestamptz;
alter table public.user_profiles
  add column if not exists status_reason text;
alter table public.user_profiles
  add column if not exists status_changed_at timestamptz;
alter table public.user_profiles
  add column if not exists status_changed_by uuid;

alter table public.user_profiles alter column account_status set default 'active';
alter table public.user_profiles alter column account_status set not null;

alter table public.user_profiles drop constraint if exists user_profiles_account_status_check;
alter table public.user_profiles add constraint user_profiles_account_status_check
  check (account_status in ('active','suspended','banned'));

alter table public.user_profiles drop constraint if exists user_profiles_suspension_window_check;
alter table public.user_profiles add constraint user_profiles_suspension_window_check
  check (account_status <> 'suspended' or suspended_until is not null);

comment on column public.user_profiles.account_status is
  'M06 LKDV Control : active = écrit normalement, suspended = écriture bloquée jusqu''à suspended_until, banned = connexion refusée.';
comment on column public.user_profiles.suspended_until is
  'M06 LKDV Control : fin de suspension. Une suspension échue rend automatiquement le droit d''écrire (public.account_can_write).';

create index if not exists user_profiles_account_status_idx
  on public.user_profiles (account_status) where account_status <> 'active';

-- ───────────────────────────────────────────────────────────────────────────
-- Prédicat d'écriture (public, comme demandé par le bundle)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.account_can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
             when up.account_status = 'active' then true
             when up.account_status = 'suspended'
               then up.suspended_until is not null and up.suspended_until <= now()
             else false
           end
      from public.user_profiles up
     where up.id = (select auth.uid())
  ), false);
$$;

comment on function public.account_can_write() is
  'M06 LKDV Control : vrai si le compte de l''appelant peut écrire (actif, ou suspension échue). Faux sans session, faux pour un compte banni.';

-- ───────────────────────────────────────────────────────────────────────────
-- Extension du déclencheur existant aux colonnes de statut
-- ───────────────────────────────────────────────────────────────────────────
-- Corps d'origine conservé à l'identique (mêmes colonnes, mêmes messages) ;
-- ajout des 5 colonnes de statut. search_path verrouillé.
create or replace function public.guard_user_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  privileged_change boolean := false;
begin
  if auth.role() is null or auth.role() not in ('authenticated', 'anon') then
    return new;
  end if;
  -- Les membres d'équipe passent : le contrôle fin (pôle, rôle, motif, journal)
  -- est fait par admin.assert_actor dans la commande, pas par ce garde-fou.
  if tg_op = 'UPDATE' and (public.is_admin() or admin.is_team_member((select auth.uid()))) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    privileged_change :=
      new.role is distinct from 'user'
      or new.trust_score is distinct from 50
      or new.is_suspended_groups is distinct from false
      or new.suspended_from_groups_at is not null
      or new.two_fa_enabled is distinct from false
      or new.loyalty_points is distinct from 0
      or new.loyalty_level is distinct from 'Explorateur'
      or new.xp is distinct from 0
      or new.level is distinct from 1
      or new.account_status is distinct from 'active'
      or new.suspended_until is not null
      or new.status_reason is not null
      or new.status_changed_at is not null
      or new.status_changed_by is not null;
  else
    privileged_change :=
      new.role is distinct from old.role
      or new.trust_score is distinct from old.trust_score
      or new.is_suspended_groups is distinct from old.is_suspended_groups
      or new.suspended_from_groups_at is distinct from old.suspended_from_groups_at
      or new.two_fa_enabled is distinct from old.two_fa_enabled
      or new.email is distinct from old.email
      or new.loyalty_points is distinct from old.loyalty_points
      or new.loyalty_level is distinct from old.loyalty_level
      or new.xp is distinct from old.xp
      or new.level is distinct from old.level
      or new.account_status is distinct from old.account_status
      or new.suspended_until is distinct from old.suspended_until
      or new.status_reason is distinct from old.status_reason
      or new.status_changed_at is distinct from old.status_changed_at
      or new.status_changed_by is distinct from old.status_changed_by;
  end if;

  if privileged_change then
    raise exception 'user_profiles: colonne de privilège protégée (role, trust_score, suspension, 2FA, email, loyalty, xp, level, statut de compte)'
      using errcode = '42501', hint = 'not_allowed';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_user_profile_privileged_columns() from public, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- Politiques restrictives d'écriture
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  -- Tables d'écriture des membres. Les tables de signalement (post_reports,
  -- comment_reports, story_reports, club_reports, group_reports,
  -- place_reports, marketplace_reports, terrain_reports) en sont exclues :
  -- un compte suspendu doit toujours pouvoir signaler.
  tables constant text[] := array[
    'community_posts','post_comments','post_stories',
    'carnet_comments','carnet_day_comments','carnet_moment_comments','carnets',
    'club_topics','club_topic_replies','clubs','club_events',
    'place_reviews','product_reviews','reviews','qa_answers',
    'messages','group_members','hike_sessions',
    'trip_notes','trip_expenses','trip_steps','follow_requests'
  ];
begin
  foreach t in array tables loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and c.relname = t and c.relkind = 'r') then
      execute format('drop policy if exists compte_actif_pour_ecrire on public.%I', t);
      execute format(
        'create policy compte_actif_pour_ecrire on public.%I as restrictive for insert to public with check (public.account_can_write())',
        t);
    end if;
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Sortie de suspension (tâche planifiée, idempotente)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function admin.expire_suspensions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  with done as (
    update public.user_profiles
       set account_status = 'active',
           status_reason = coalesce(status_reason, '') || ' [suspension échue]',
           status_changed_at = now(),
           updated_at = now()
     where account_status = 'suspended'
       and suspended_until is not null
       and suspended_until <= now()
    returning 1
  )
  select count(*) into v_n from done;

  if v_n > 0 then
    perform admin.log('account_status_expire', 'system', 'user_profiles', null, null,
                      null, jsonb_build_object('reactivated', v_n));
  end if;

  return jsonb_build_object('ok', true, 'reactivated', v_n);
end;
$$;

revoke all on function admin.expire_suspensions() from public, anon, authenticated;
grant execute on function admin.expire_suspensions() to service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- Lecture de son propre statut (écrans LKDV : bandeau de suspension)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.my_account_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'status', coalesce(up.account_status, 'active'),
           'suspendedUntil', up.suspended_until,
           'canWrite', public.account_can_write(),
           'reason', up.status_reason
         )
    from (select 1) s
    left join public.user_profiles up on up.id = (select auth.uid());
$$;

revoke all on function public.account_can_write() from public, anon;
grant execute on function public.account_can_write() to authenticated, service_role;
revoke all on function public.my_account_status() from public, anon;
grant execute on function public.my_account_status() to authenticated, service_role;
