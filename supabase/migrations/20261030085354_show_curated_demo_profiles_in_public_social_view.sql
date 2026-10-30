-- DEMO PREVIEW ONLY. Keep is_demo=true for rewards/rankings isolation.
-- Do not reveal private profiles; remove this visibility exception before public launch if required.
create or replace view public.public_profiles with (security_invoker = false) as
select id, full_name, avatar_url, bio, location, website, trust_score,
       loyalty_points, loyalty_level, xp, level, created_at, handle, cover_url, links
from public.user_profiles
where (is_demo = false or (is_demo = true and email like '%@voyageurs.lkdv.app'))
  and (
    profile_visibility = 'public'
    or id = auth.uid()
    or (
      profile_visibility = 'prive'
      and exists (
        select 1 from public.profile_invitations i
        where i.owner_id = user_profiles.id
          and i.status = 'accepted'
          and i.invitee_id = auth.uid()
          and (i.expires_at is null or i.expires_at > now())
      )
    )
  );
comment on view public.public_profiles is
'Privacy-safe social subset including curated @voyageurs.lkdv.app demo profiles; remains is_demo=true and excluded from real-user rankings.';
