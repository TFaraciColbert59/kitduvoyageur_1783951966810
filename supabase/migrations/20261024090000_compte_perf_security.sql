-- Performance Compte : index de flux et politiques notifications resserrées.
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- Les admins ne doivent pas lire les aperçus de messages privés via l'activité.
drop policy if exists "Users can read own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Users can delete own notifications" on public.notifications;
drop policy if exists "Un utilisateur voit ses propres notifications" on public.notifications;
drop policy if exists "Un utilisateur modifie ses propres notifications" on public.notifications;
drop policy if exists "Un utilisateur supprime ses propres notifications" on public.notifications;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

create policy notifications_admin_activity on public.notifications
  for select to authenticated
  using (
    public.is_admin()
    and type not in ('new_message', 'group_message', 'digest')
  );
