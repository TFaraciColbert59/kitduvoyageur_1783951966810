-- 2026-10-22 — Un membre banni ne peut pas effacer son bannissement lui-même.
-- La route applicative le refuse déjà ; on ferme aussi l'accès direct PostgREST.
drop policy if exists club_members_self_delete on public.club_members;
create policy club_members_self_delete on public.club_members
  for delete to authenticated
  using (user_id = auth.uid() and status <> 'banned');
