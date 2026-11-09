-- Migration Lot A : fonctions d'accès canoniques pour Carnet v2
-- Prérequis pour les politiques RLS des lots B, C, D

-- 1. Helper participant : auteur, collaborateur ou participant d'une sortie liée
create or replace function public.is_carnet_participant(p_carnet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.carnets c
      where c.id = p_carnet and c.author_id = (select auth.uid())
    )
    or exists (
      select 1 from public.carnet_collaborators cc
      where cc.carnet_id = p_carnet
        and cc.user_id = (select auth.uid())
        and cc.role in ('owner', 'contributor')
    )
    or exists (
      select 1 from public.hike_sessions hs
      join public.hike_session_participants hp on hp.session_id = hs.id
      where hs.carnet_id = p_carnet and hp.user_id = (select auth.uid())
    )
  );
$$;

revoke all on function public.is_carnet_participant(uuid) from public;
grant execute on function public.is_carnet_participant(uuid) to authenticated, anon;

-- 2. Helper visibilité : participant, ou carnet public (hors blocage), ou friends/followers suivi
create or replace function public.can_view_carnet(p_carnet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_carnet_participant(p_carnet)
    or exists (
      select 1 from public.carnets c
      where c.id = p_carnet
        and (
          (select auth.uid()) is null
          or not exists (
            select 1 from public.user_blocks b
            where (b.blocker_id = c.author_id and b.blocked_id = (select auth.uid()))
               or (b.blocker_id = (select auth.uid()) and b.blocked_id = c.author_id)
          )
        )
        and (
          c.visibility = 'public'
          or (
            c.visibility in ('friends', 'followers')
            and (select auth.uid()) is not null
            and exists (
              select 1 from public.user_follows f
              where f.following_id = c.author_id and f.follower_id = (select auth.uid())
            )
          )
        )
    );
$$;

revoke all on function public.can_view_carnet(uuid) from public;
grant execute on function public.can_view_carnet(uuid) to authenticated, anon;

-- Index utiles pour les jointures des fonctions d'accès
create index if not exists idx_carnet_collaborators_lookup
  on public.carnet_collaborators (carnet_id, user_id, role);

create index if not exists idx_hike_sessions_carnet_id
  on public.hike_sessions (carnet_id);

-- Hygiène des triggers applicatifs : révoque l'accès anon résiduel sur les triggers récents
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'trg_sync_materiel_kits_aliases'
  ) then
    revoke all on function public.trg_sync_materiel_kits_aliases() from public, anon;
    grant execute on function public.trg_sync_materiel_kits_aliases() to authenticated, service_role;
  end if;
end $$;
