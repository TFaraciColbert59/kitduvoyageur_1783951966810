-- S6.15 — stockage des choix de visibilité par métrique d'une sortie.
--
-- La policy de partage d'une sortie (`private`, `collective_anonymized`) ne
-- dit pas quelles métriques d'effort le propriétaire accepte de publier. Sans
-- stockage serveur, un choix local serait un droit simulé : il ne changerait
-- pas ce que reçoit un tiers. Cette migration ajoute donc une table dédiée,
-- additive et indépendante de `hike_sessions` pour ne pas élargir la lecture
-- brute des traces.
--
-- Le contrat est volontairement fermé :
--   * une seule ligne par sortie (`session_id` primary key) ;
--   * `visibility` est un objet JSONB de booléens stricts ;
--   * les clés inconnues sont refusées par la base, pas seulement par l'API ;
--   * une clé absente vaut `false` à la lecture (`parseMetricVisibility`) ;
--   * aucune valeur de métrique (FC, puissance, calories…) n'est stockée ici.
--
-- Version dédiée : `20261113121000`, sans réutiliser `20261113090000`, déjà
-- réservé à un autre chantier.

-- ── 1. Validateur de la liste fermée ─────────────────────────────────────────
-- Fonction immuable utilisée par la contrainte CHECK. Elle ne lit aucune table
-- et ne dépend d'aucun rôle : seules la forme et les clés du JSON sont jugées.
create or replace function public.outing_metric_visibility_is_valid(p_visibility jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when jsonb_typeof(p_visibility) is distinct from 'object' then false
    else not exists (
      select 1
      from jsonb_each(p_visibility) as entry(key, value)
      where entry.key not in (
        'distance',
        'elevation',
        'elevationGain',
        'maxAltitude',
        'duration',
        'pace',
        'movingTime',
        'heartRate',
        'power',
        'cadence',
        'calories'
      )
      or jsonb_typeof(entry.value) <> 'boolean'
    )
  end;
$$;

revoke all on function public.outing_metric_visibility_is_valid(jsonb) from public;
grant execute on function public.outing_metric_visibility_is_valid(jsonb)
  to authenticated, service_role;

comment on function public.outing_metric_visibility_is_valid(jsonb) is
  'S6.15 — vrai si l''objet ne contient que les clés de métriques connues, '
  'toutes de type booléen. Une clé absente reste valide et vaut false à la lecture.';

-- ── 2. Table des choix du propriétaire ───────────────────────────────────────
create table if not exists public.outing_share_metrics (
  session_id uuid primary key references public.hike_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visibility jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outing_share_metrics_object check (jsonb_typeof(visibility) = 'object'),
  constraint outing_share_metrics_closed_keys check (
    public.outing_metric_visibility_is_valid(visibility)
  )
);

comment on table public.outing_share_metrics is
  'S6.15 — choix explicites du propriétaire, par sortie, des métriques '
  'publiables à un tiers. Une ligne absente signifie « aucun choix enregistré » '
  'et laisse le socle agrégé par défaut. Aucune valeur de santé ou de capteur '
  'n''est stockée dans cette table : uniquement des booléens de visibilité.';

comment on column public.outing_share_metrics.visibility is
  'Objet JSONB fermé : distance, elevation, elevationGain, maxAltitude, '
  'duration, pace, movingTime, heartRate, power, cadence, calories. '
  'Toute valeur non booléenne ou toute clé inconnue est refusée par la base.';

create index if not exists idx_outing_share_metrics_user_id
  on public.outing_share_metrics(user_id);

-- ── 3. Cohérence propriétaire de la sortie ───────────────────────────────────
-- La RLS empêche déjà un tiers d'écrire. Ce trigger ferme le cas d'un appel
-- service_role qui aurait fourni un `user_id` différent du propriétaire réel de
-- la sortie, et interdit de déplacer une politique d'une sortie à une autre.
create or replace function public.outing_share_metrics_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.session_id is distinct from old.session_id then
    raise exception 'outing_share_metrics_session_immutable'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.hike_sessions s
    where s.id = new.session_id
      and s.user_id = new.user_id
  ) then
    raise exception 'outing_share_metrics_owner_mismatch'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.outing_share_metrics_guard() from public, anon, authenticated;

drop trigger if exists trg_outing_share_metrics_guard on public.outing_share_metrics;
create trigger trg_outing_share_metrics_guard
  before insert or update on public.outing_share_metrics
  for each row execute function public.outing_share_metrics_guard();

drop trigger if exists trg_outing_share_metrics_updated_at on public.outing_share_metrics;
create trigger trg_outing_share_metrics_updated_at
  before update on public.outing_share_metrics
  for each row execute function public.adventure_touch_updated_at();

-- ── 4. RLS et privilèges ─────────────────────────────────────────────────────
alter table public.outing_share_metrics enable row level security;
alter table public.outing_share_metrics force row level security;

drop policy if exists outing_share_metrics_select_own on public.outing_share_metrics;
create policy outing_share_metrics_select_own
  on public.outing_share_metrics for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.hike_sessions s
      where s.id = outing_share_metrics.session_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists outing_share_metrics_insert_own on public.outing_share_metrics;
create policy outing_share_metrics_insert_own
  on public.outing_share_metrics for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.hike_sessions s
      where s.id = outing_share_metrics.session_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists outing_share_metrics_update_own on public.outing_share_metrics;
create policy outing_share_metrics_update_own
  on public.outing_share_metrics for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.hike_sessions s
      where s.id = outing_share_metrics.session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.hike_sessions s
      where s.id = outing_share_metrics.session_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists outing_share_metrics_delete_own on public.outing_share_metrics;
create policy outing_share_metrics_delete_own
  on public.outing_share_metrics for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.hike_sessions s
      where s.id = outing_share_metrics.session_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists outing_share_metrics_all_service on public.outing_share_metrics;
create policy outing_share_metrics_all_service
  on public.outing_share_metrics for all to service_role
  using (true)
  with check (true);

revoke all on public.outing_share_metrics from anon;
grant select, insert, update, delete on public.outing_share_metrics to authenticated;
grant all on public.outing_share_metrics to service_role;

comment on policy outing_share_metrics_select_own on public.outing_share_metrics is
  'Le propriétaire lit ses choix. Les tiers ne lisent jamais cette table : la projection serveur la lit avec service_role après autorisation de la sortie.';
comment on policy outing_share_metrics_insert_own on public.outing_share_metrics is
  'Insertion réservée au propriétaire réel de la sortie. Aucun accès anon.';
comment on policy outing_share_metrics_update_own on public.outing_share_metrics is
  'Mise à jour réservée au propriétaire réel de la sortie. Le trigger vérifie aussi la cohérence session/user.';
comment on policy outing_share_metrics_delete_own on public.outing_share_metrics is
  'Suppression réservée au propriétaire : elle remet la sortie sur le socle par défaut.';

comment on policy outing_share_metrics_all_service on public.outing_share_metrics is
  'Lecture service_role après contrôle du rôle de lecture de la sortie. Aucune valeur de métrique, seulement la politique.';
