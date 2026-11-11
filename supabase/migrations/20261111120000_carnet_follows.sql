-- Carnet v2 — suivre un carnet et choisir la fréquence de ses notifications.
--
-- Propositions n° 20 et 41 de `docs/carnets/maquette-carnets-de-bord.html` :
-- « suivre le carnet, pas seulement la personne » et « choix de notification
-- par suiveur » (à chaque moment / résumé du soir / départ-sommets-arrivée).
-- Aujourd'hui : `user_follows` ne suit que des personnes et la préférence de
-- la lentille « Suivre » ne vit qu'en localStorage, par appareil.
--
-- Table additive, sans effet sur le code déjà déployé : seule la fiche Carnet
-- v2 (branche en cours) la lit et l'écrit. RLS : chaque personne ne voit et ne
-- modifie que ses propres suivis ; un participant au carnet ne « suit » pas son
-- propre carnet ; aucune lecture publique, aucun accès anonyme.
--
-- À appliquer en production AVANT de déployer le code qui l'utilise.
-- Rollback : supabase/migrations_down/20261111120000_carnet_follows.down.sql

create table if not exists public.carnet_follows (
  carnet_id uuid not null references public.carnets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notify_mode text not null default 'digest'
    check (notify_mode in ('moment', 'digest', 'highlights')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (carnet_id, user_id)
);

create index if not exists carnet_follows_user_idx
  on public.carnet_follows (user_id);
create index if not exists carnet_follows_carnet_idx
  on public.carnet_follows (carnet_id);

alter table public.carnet_follows enable row level security;

drop policy if exists carnet_follows_select on public.carnet_follows;
create policy carnet_follows_select on public.carnet_follows
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists carnet_follows_insert on public.carnet_follows;
create policy carnet_follows_insert on public.carnet_follows
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not public.is_carnet_participant(carnet_id)
  );

drop policy if exists carnet_follows_update on public.carnet_follows;
create policy carnet_follows_update on public.carnet_follows
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and not public.is_carnet_participant(carnet_id)
  );

drop policy if exists carnet_follows_delete on public.carnet_follows;
create policy carnet_follows_delete on public.carnet_follows
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Défense en profondeur : le rôle anonyme n'a aucun accès à cette table.
revoke all on public.carnet_follows from anon;
grant select, insert, update, delete on public.carnet_follows to authenticated;

comment on table public.carnet_follows is
  'Carnet v2 : suivis de carnets par les lecteurs + fréquence de notification choisie (moment / digest / highlights). Aucune lecture publique.';
