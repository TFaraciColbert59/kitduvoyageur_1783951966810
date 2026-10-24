-- 2026-10-22 — Confidentialité du compte, invitations et republication.
-- Deux niveaux de visibilité (public / privé), invitations à un profil privé,
-- attribution des republications et index chauds du drawer Profil.

-- 1. Visibilité : une seule échelle à deux valeurs.
update public.user_profiles
set profile_visibility = 'public'
where profile_visibility in ('communaute', 'private');

alter table public.user_profiles
  alter column profile_visibility set default 'public';

-- L'ancienne contrainte autorisait 'private' et 'communaute' : on la remplace.
alter table public.user_profiles
  drop constraint if exists user_profiles_profile_visibility_check;

alter table public.user_profiles
  add constraint user_profiles_profile_visibility_check
  check (profile_visibility in ('public','prive'));

-- 2. Republication : un post peut citer le post d'origine, supprimé sans casser la copie.
alter table public.community_posts
  add column if not exists reposted_from_id uuid references public.community_posts(id) on delete set null;

-- 3. Invitations à consulter un profil privé.
create table if not exists public.profile_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid references auth.users(id) on delete set null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profile_invitations enable row level security;

drop policy if exists profile_invitations_owner on public.profile_invitations;
create policy profile_invitations_owner on public.profile_invitations
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists profile_invitations_invitee on public.profile_invitations;
create policy profile_invitations_invitee on public.profile_invitations
  for select to authenticated using (invitee_id = auth.uid());

-- 4. Index des lectures chaudes du Compte.
create index if not exists materiel_loans_lender_status_idx on public.materiel_loans (lender_id, status);
create index if not exists club_events_club_date_idx on public.club_events (club_id, event_date);
create index if not exists community_posts_author_created_idx on public.community_posts (author_id, created_at desc);
create index if not exists story_highlights_owner_position_idx on public.story_highlights (owner_id, position);
create index if not exists profile_invitations_owner_idx on public.profile_invitations (owner_id, status);

-- 5. Projection publique : public → tout le monde ; privé → soi ou invitation
--    acceptée non expirée (invitation nominative : l’invité doit être identifié).
create or replace view public.public_profiles as
select id, full_name, avatar_url, bio, location, website,
       trust_score, loyalty_points, loyalty_level, xp, level, created_at, handle
from public.user_profiles
where is_demo = false
  and (
    profile_visibility = 'public'
    or id = auth.uid()
    or (
      profile_visibility = 'prive'
      and exists (
        select 1
        from public.profile_invitations i
        where i.owner_id = user_profiles.id
          and i.status = 'accepted'
          and i.invitee_id = auth.uid()
          and (i.expires_at is null or i.expires_at > now())
      )
    )
  );

grant select on public.public_profiles to anon, authenticated;
