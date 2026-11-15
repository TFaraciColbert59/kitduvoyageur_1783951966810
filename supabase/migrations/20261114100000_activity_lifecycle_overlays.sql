-- Lot A02 — Persistance du cycle de vie des activités (K5.04, K5.07, K5.10,
-- S1.17, S1.18, S1.20, S1.22, S1.23, S1.24, S2.01, S2.16).
--
-- Objectif : conserver le résultat versionné des opérations qui ne peuvent pas
-- être écrites dans les tables sources sans les réécrire (recadrage,
-- fractionnement, correction D+/pics GPS, édition rapide, corbeille 30 jours).
--
-- Choix de conception :
--   • une seule ligne par (propriétaire, activité) porte le contrat
--     `LifecycleActivityRecord` complet en JSONB — la géométrie active, la
--     géométrie d'origine, les statistiques et le journal de révisions restent
--     donc cohérents et rejouables à l'identique ;
--   • les tables `hike_sessions` et `activity_sessions` ne sont jamais
--     modifiées par le lot : la trace brute d'origine y reste la référence ;
--   • `revision` est monotone et permet de refuser une écriture concurrente
--     (compare-and-set) ;
--   • RLS propriétaire stricte : `auth.uid()` en lecture et en écriture ;
--   • aucune donnée existante n'est lue, déplacée ou supprimée par la migration.
--
-- Migration additive et idempotente. Down : suppression de la seule table
-- créée (aucune table source touchée).

begin;

create table if not exists public.activity_lifecycle_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null,
  parent_activity_id text,
  source text not null default 'activity_session'
    check (source in ('hike_session', 'activity_session', 'device_import', 'gpx_import', 'manual')),
  revision integer not null default 1 check (revision >= 1),
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'deleted')),
  deleted_at timestamptz,
  purge_after timestamptz,
  /** Contrat `LifecycleActivityRecord` complet, sérialisé par l'adaptateur A02. */
  record jsonb not null,
  /** Dernière clé d'idempotence appliquée (audit / rejeu). */
  operation_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_lifecycle_records_activity_id_len
    check (length(activity_id) between 1 and 160),
  constraint activity_lifecycle_records_pk primary key (user_id, activity_id)
);

comment on table public.activity_lifecycle_records is
  'A02 — surcouche versionnée du cycle de vie (recadrage, split, corrections, corbeille 30 j). Les tables sources restent la trace brute de référence.';

create index if not exists activity_lifecycle_records_owner_status_idx
  on public.activity_lifecycle_records (user_id, lifecycle_status, deleted_at desc);

create index if not exists activity_lifecycle_records_parent_idx
  on public.activity_lifecycle_records (user_id, parent_activity_id)
  where parent_activity_id is not null;

alter table public.activity_lifecycle_records enable row level security;

drop policy if exists activity_lifecycle_records_owner_read on public.activity_lifecycle_records;
create policy activity_lifecycle_records_owner_read on public.activity_lifecycle_records
  for select to authenticated using (user_id = auth.uid());

drop policy if exists activity_lifecycle_records_owner_insert on public.activity_lifecycle_records;
create policy activity_lifecycle_records_owner_insert on public.activity_lifecycle_records
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists activity_lifecycle_records_owner_update on public.activity_lifecycle_records;
create policy activity_lifecycle_records_owner_update on public.activity_lifecycle_records
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists activity_lifecycle_records_owner_delete on public.activity_lifecycle_records;
create policy activity_lifecycle_records_owner_delete on public.activity_lifecycle_records
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.activity_lifecycle_records from anon;
grant select, insert, update, delete on public.activity_lifecycle_records to authenticated;

commit;
