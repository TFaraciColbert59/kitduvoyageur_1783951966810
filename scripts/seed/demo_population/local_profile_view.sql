-- Local seed only. Keep the application's column list and audience rules.
-- Demo IDs come from the loaded lot, including the preserved Auth anchor.
create or replace view public.public_profiles with (security_invoker=false) as
select p.id, p.full_name, p.avatar_url, p.bio, p.location, p.website,
       p.trust_score, p.loyalty_points, p.loyalty_level, p.xp, p.level,
       p.created_at, p.handle, p.cover_url, p.links
from public.user_profiles p
where (
  not p.is_demo
  or (p.is_demo and (
    p.email like '%@voyageurs.lkdv.app'
    or p.email like '%@kitduvoyageur.fr'
    or exists (select 1 from lkdv_demo_local.people f where f.id=p.id)
  ))
)
and (
  p.profile_visibility = 'public'
  or p.id = auth.uid()
  or (p.profile_visibility = 'prive' and exists (
    select 1 from public.profile_invitations i
    where i.owner_id=p.id and i.invitee_id=auth.uid() and i.status='accepted'
      and (i.expires_at is null or i.expires_at > now())
  ))
);
