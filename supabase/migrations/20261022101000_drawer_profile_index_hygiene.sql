-- 2026-10-22 — Hygiène issue de la revue Task 1 du drawer Profil.
-- 1) Une invitation acceptée doit être liée à un invité identifié.
alter table public.profile_invitations
  drop constraint if exists profile_invitations_accepted_bound;
alter table public.profile_invitations
  add constraint profile_invitations_accepted_bound
  check (status <> 'accepted' or invitee_id is not null);

-- 2) Portabilité : aucune valeur legacy ne doit bloquer la contrainte.
update public.user_profiles set profile_visibility = 'public' where profile_visibility = 'private';

-- 3) Index redondants couverts par des index composites plus récents.
drop index if exists public.story_highlights_owner_idx;
drop index if exists public.idx_materiel_loans_lender_id;
drop index if exists public.idx_community_posts_author_id;
