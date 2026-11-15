-- Rollback de 20261112121000_carnet_v2_trace_raw_guard.sql
--
-- AVERTISSEMENT : ce down RÉOUVRE la lecture brute des sorties privées
-- rattachées à un carnet public (et des sorties collectives d'un carnet
-- visible). Ce n'est pas un rollback neutre. À n'exécuter qu'avec le revert
-- applicatif, en fenêtre de maintenance, et de préférence après un forward-fix.
-- Ordre : exécuter ce down AVANT celui de 20261112090000, sinon la policy
-- `hike_sessions_select_shared_carnet` recréée ici survivrait à la suppression
-- de l'autre down. L'état restauré est celui connu du dépôt, pas forcément
-- celui de la production : comparer `pg_get_expr(polqual, polrelid)` avant.
drop policy if exists hike_sessions_select_owner_or_participant on public.hike_sessions;

-- Restaure l'état antérieur (phase 8 + 20261112090000).
drop policy if exists hike_sessions_select_owner_or_public_carnet on public.hike_sessions;
create policy hike_sessions_select_owner_or_public_carnet on public.hike_sessions
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.carnets c
      where c.id = hike_sessions.carnet_id
        and (c.visibility = 'public' or c.author_id = auth.uid())
    )
  );

drop policy if exists hike_sessions_select_shared_carnet on public.hike_sessions;
create policy hike_sessions_select_shared_carnet on public.hike_sessions
  for select to public
  using (
    carnet_id is not null
    and public.can_view_carnet(carnet_id)
    and visibility in ('public', 'collective_anonymized')
  );

-- Restaure la policy `FOR ALL` historique. Elle ne recrée pas de cycle ici :
-- la policy `hike_sessions_select_owner_or_participant` qui interrogeait
-- `hike_session_participants` a été supprimée plus haut. Si un down partiel
-- laissait cette policy en place, PostgreSQL refuserait les lectures (42P17).
drop policy if exists hike_participants_owner_insert on public.hike_session_participants;
drop policy if exists hike_participants_owner_update on public.hike_session_participants;
drop policy if exists hike_participants_owner_delete on public.hike_session_participants;
drop policy if exists hike_participants_owner_write on public.hike_session_participants;
create policy hike_participants_owner_write on public.hike_session_participants
  for all
  using (
    exists (
      select 1 from public.hike_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.hike_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );
