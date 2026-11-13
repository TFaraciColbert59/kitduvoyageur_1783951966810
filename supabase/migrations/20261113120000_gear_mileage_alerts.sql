-- ═══════════════════════════════════════════════════════════════════════════
-- D04 · S6.09 / S6.10 — matériel associé, kilométrage, seuils et composants
--
-- Migration additive, idempotente dans sa partie DDL.
-- Aucune donnée n'est supprimée ni réécrite en dehors des deux backfills
-- conservateurs ci-dessous (lien objet/séance et sport de la séance).
--
-- Modèle retenu :
--  • `hike_session_gear` porte le lien stable vers `gear_items` : l'objet est
--    associé à une séance, pas déduit du seul libellé ;
--  • `gear_mileage_settings` porte le seuil, sa version et les acquittements ;
--  • `gear_alert_history` garantit une seule alerte par (objet, version) ;
--  • `gear_components` suit les composants d'un vélo entre installation et
--    remplacement, sans recalcul rétroactif du kilométrage du vélo ;
--  • `gear_sport_defaults` propose le matériel par sport sans l'imposer.
--
-- Le kilométrage n'est pas stocké en double : il est dérivé des séances
-- terminées (`hike_sessions.distance_km`) et de leur sport
-- (`activity_sessions.sport`), ce qui applique naturellement une correction
-- sans double comptage (une séance = un `sessionId`).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Lien stable entre une séance et un objet d'inventaire ────────────────
alter table public.hike_session_gear
  add column if not exists gear_item_id uuid references public.product_ownership(id) on delete set null,
  add column if not exists sport text;

create index if not exists hike_session_gear_gear_item_idx
  on public.hike_session_gear (gear_item_id)
  where gear_item_id is not null;

-- Backfill prudent : uniquement quand le propriétaire de la séance possède
-- exactement un objet du même nom (insensible à la casse et aux espaces).
-- Une ambiguïté laisse `gear_item_id` NULL plutôt que de relier au hasard.
with candidates as (
  select g.id as link_id, (array_agg(gi.id))[1] as gear_item_id
    from public.hike_session_gear g
    join public.hike_sessions s on s.id = g.session_id
    join public.gear_items gi
      on gi.user_id = s.user_id
     and lower(btrim(gi.name)) = lower(btrim(g.item_name))
   where g.gear_item_id is null
   group by g.id
  having count(distinct gi.id) = 1
)
update public.hike_session_gear g
   set gear_item_id = c.gear_item_id
  from candidates c
 where g.id = c.link_id;

-- Sport de la séance : la séance multi-sport liée fait foi ; à défaut on
-- conserve `rando`, qui est le seul type historiquement capturé par Compte.
update public.hike_session_gear g
   set sport = coalesce(a.sport, 'rando')
  from public.hike_sessions s
  left join public.activity_sessions a on a.id = s.activity_session_id
 where s.id = g.session_id
   and g.sport is null;

-- ── 2. Réglages de kilométrage et de seuil ──────────────────────────────────
create table if not exists public.gear_mileage_settings (
  gear_item_id      uuid primary key references public.product_ownership(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  threshold_km      numeric(10,1),
  threshold_version integer not null default 1,
  notified_version  integer,
  dismissed_version integer,
  updated_at        timestamptz not null default now(),
  constraint gear_mileage_settings_threshold_positive
    check (threshold_km is null or threshold_km > 0)
);

comment on column public.gear_mileage_settings.threshold_version is
  'Incrémenté à chaque changement de seuil : une nouvelle version autorise une nouvelle alerte.';
comment on column public.gear_mileage_settings.notified_version is
  'Dernière version de seuil ayant déclenché une alerte (écrite par acquittement).';
comment on column public.gear_mileage_settings.dismissed_version is
  'Dernière version de seuil explicitement écartée par l’utilisateur.';

alter table public.gear_mileage_settings enable row level security;

drop policy if exists gear_mileage_settings_owner on public.gear_mileage_settings;
create policy gear_mileage_settings_owner on public.gear_mileage_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── 3. Historique d'alertes : une seule par couple (objet, version) ─────────
create table if not exists public.gear_alert_history (
  id                uuid primary key default gen_random_uuid(),
  gear_item_id      uuid not null references public.product_ownership(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  threshold_km      numeric(10,1) not null,
  threshold_version integer not null,
  triggered_at      timestamptz not null default now(),
  constraint gear_alert_history_threshold_positive check (threshold_km > 0),
  constraint gear_alert_history_unique_version unique (gear_item_id, threshold_version)
);

alter table public.gear_alert_history
  add column if not exists threshold_km numeric(10,1),
  add column if not exists threshold_version integer,
  add column if not exists triggered_at timestamptz not null default now();

create unique index if not exists gear_alert_history_unique_version_idx
  on public.gear_alert_history (gear_item_id, threshold_version)
  where threshold_version is not null;

create index if not exists gear_alert_history_user_idx
  on public.gear_alert_history (user_id, triggered_at desc);

alter table public.gear_alert_history enable row level security;

drop policy if exists gear_alert_history_owner on public.gear_alert_history;
create policy gear_alert_history_owner on public.gear_alert_history
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── 4. Composants d'un vélo ─────────────────────────────────────────────────
create table if not exists public.gear_components (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  gear_item_id     uuid not null references public.product_ownership(id) on delete cascade,
  name             text not null,
  kind             text not null default 'autre'
    check (kind in ('chaine','pneus','plaquettes','plateau','cassette','derailleur','roue','autre')),
  installed_at_km  numeric(10,1)
    check (installed_at_km is null or installed_at_km >= 0),
  replaced_at_km   numeric(10,1)
    check (replaced_at_km is null or replaced_at_km >= 0),
  threshold_km     numeric(10,1)
    check (threshold_km is null or threshold_km > 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint gear_components_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint gear_components_replacement_after_install
    check (replaced_at_km is null or installed_at_km is null or replaced_at_km >= installed_at_km)
);

create index if not exists gear_components_gear_idx
  on public.gear_components (gear_item_id, created_at);
create index if not exists gear_components_user_idx
  on public.gear_components (user_id);

alter table public.gear_components enable row level security;

drop policy if exists gear_components_owner on public.gear_components;
create policy gear_components_owner on public.gear_components
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── 5. Matériel par défaut selon le sport ───────────────────────────────────
create table if not exists public.gear_sport_defaults (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  sport        text not null,
  kind         text not null check (kind in ('bike','shoe','component','other')),
  gear_item_id uuid not null references public.product_ownership(id) on delete cascade,
  priority     integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint gear_sport_defaults_unique unique (user_id, sport, kind, gear_item_id)
);

create index if not exists gear_sport_defaults_lookup_idx
  on public.gear_sport_defaults (user_id, sport, kind, priority);

alter table public.gear_sport_defaults enable row level security;

drop policy if exists gear_sport_defaults_owner on public.gear_sport_defaults;
create policy gear_sport_defaults_owner on public.gear_sport_defaults
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── 6. Privilèges explicites (RLS reste la barrière) ────────────────────────
revoke all on public.gear_mileage_settings from anon;
revoke all on public.gear_alert_history from anon;
revoke all on public.gear_components from anon;
revoke all on public.gear_sport_defaults from anon;

grant select, insert, update, delete on public.gear_mileage_settings to authenticated;
grant select, insert, update, delete on public.gear_alert_history to authenticated;
grant select, insert, update, delete on public.gear_components to authenticated;
grant select, insert, update, delete on public.gear_sport_defaults to authenticated;

commit;
