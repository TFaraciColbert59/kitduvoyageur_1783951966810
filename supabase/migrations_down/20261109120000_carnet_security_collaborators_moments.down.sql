-- Rollback de 20261109120000 : remet les règles telles qu'en production au
-- 2026-11-09 (baseline prod_schema_20260911 + lot D carnet v2). Rejouable.
-- Attention : ce retour arrière rouvre les deux élévations de privilège
-- décrites dans la migration ; à n'utiliser qu'en cas de casse avérée.

drop policy if exists carnet_collab_insert_by_author on public.carnet_collaborators;
drop policy if exists carnet_collab_update_by_author on public.carnet_collaborators;
drop policy if exists carnet_collab_delete_by_author_or_self on public.carnet_collaborators;

drop policy if exists "carnet_collab_manage" on public.carnet_collaborators;
create policy "carnet_collab_manage" on public.carnet_collaborators
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists carnet_moments_select_viewable on public.carnet_moments;

drop policy if exists "carnet_moments_read_scoped" on public.carnet_moments;
create policy "carnet_moments_read_scoped" on public.carnet_moments
  for select
  using (
    exists (
      select 1 from public.carnets c
      where c.id = carnet_moments.carnet_id
        and (c.visibility = 'public' or c.author_id = auth.uid())
    )
  );

drop policy if exists "auth_manage_carnet_moments" on public.carnet_moments;
create policy "auth_manage_carnet_moments" on public.carnet_moments
  for all to authenticated
  using (auth.uid() = auteur_id)
  with check (auth.uid() = auteur_id);
