-- Carnet v2 : les étapes du carnet dans leur propre table (2026-11-11).
--
-- Pourquoi : la fiche lisait et écrivait les étapes dans `groupe_etapes`
-- (via carnets.groupe_id). Ces tables `groupe_*` n'existent plus en
-- production (supprimées avec l'adaptateur 20260917020000 : seule reste la
-- vue `groupes` sur `crews`). Les étapes deviennent une donnée du CARNET,
-- sur le modèle de `carnet_nights` (lot D) : lecture `can_view_carnet`,
-- écriture `is_carnet_participant`. Aucun lien à un groupe : la classe de
-- failles « carnet pointant vers le groupe d'autrui » disparaît.
-- Remplace la version 20261110100100_carnet_participants_write_etapes
-- (jamais appliquée : inapplicable en production).
-- Rollback : supabase/migrations_down/20261110100100_carnet_etapes.down.sql

create table if not exists public.carnet_etapes (
  id uuid primary key default gen_random_uuid(),
  carnet_id uuid not null references public.carnets(id) on delete cascade,
  jour_numero int not null check (jour_numero between 1 and 366),
  ordre int not null default 1 check (ordre between 1 and 1000),
  date_etape date,
  lieu_depart text check (char_length(lieu_depart) <= 160),
  lieu_arrivee text check (char_length(lieu_arrivee) <= 160),
  recit text check (char_length(recit) <= 4000),
  distance_km numeric(7,2) check (distance_km is null or distance_km between 0 and 2000),
  denivele_m int check (denivele_m is null or denivele_m between 0 and 20000),
  duree_texte text check (char_length(duree_texte) <= 40),
  meteo text check (char_length(meteo) <= 60),
  temperature_c numeric(4,1) check (temperature_c is null or temperature_c between -80 and 70),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carnet_etapes_carnet_idx
  on public.carnet_etapes (carnet_id, jour_numero, ordre);

alter table public.carnet_etapes enable row level security;

drop policy if exists carnet_etapes_select on public.carnet_etapes;
create policy carnet_etapes_select on public.carnet_etapes
  for select using (public.can_view_carnet(carnet_id));

drop policy if exists carnet_etapes_insert on public.carnet_etapes;
create policy carnet_etapes_insert on public.carnet_etapes
  for insert to authenticated
  with check (public.is_carnet_participant(carnet_id));

drop policy if exists carnet_etapes_update on public.carnet_etapes;
create policy carnet_etapes_update on public.carnet_etapes
  for update to authenticated
  using (public.is_carnet_participant(carnet_id))
  with check (public.is_carnet_participant(carnet_id));

drop policy if exists carnet_etapes_delete on public.carnet_etapes;
create policy carnet_etapes_delete on public.carnet_etapes
  for delete to authenticated
  using (public.is_carnet_participant(carnet_id));

-- Les privilèges par défaut du schéma donnent aussi l'écriture à anon : la RLS
-- la refuse déjà, on la retire en plus (défense en profondeur).
revoke insert, update, delete on public.carnet_etapes from anon;
grant select on public.carnet_etapes to anon, authenticated;
grant insert, update, delete on public.carnet_etapes to authenticated;
