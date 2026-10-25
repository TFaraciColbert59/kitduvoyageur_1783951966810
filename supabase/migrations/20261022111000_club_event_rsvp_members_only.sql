-- 2026-10-22 — I11 : un RSVP à un événement de club est réservé aux membres actifs.
--
-- La route /api/compte/clubs vérifiait déjà l'adhésion `active` avant d'écrire,
-- mais la policy INSERT de `club_event_participants` ne bornait que
-- `user_id = auth.uid()`. Un non-membre (ou un banni) pouvait donc insérer
-- directement via PostgREST, puis le trigger `sync_club_event_participants_count`
-- incrémentait `club_events.participants_count`.
--
-- Policy live vérifiée dans `pg_policies` avant remplacement :
--   event_participants_insert  (INSERT, permissive, authenticated)
--   event_participants_delete  (DELETE, permissive, authenticated)
-- On retire aussi l'ancienne policy ALL historique pour qu'un rejeu sur une base
-- neuve ne laisse pas un chemin INSERT permissif.

drop policy if exists "Users can manage own participation" on public.club_event_participants;
drop policy if exists event_participants_insert on public.club_event_participants;
drop policy if exists event_participants_delete on public.club_event_participants;

-- La suppression reste strictement personnelle.
create policy event_participants_delete
  on public.club_event_participants
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Insertion :
--   * événement rattaché à un club → adhésion `active` dans CE club ;
--   * événement sans club (`club_id is null`) → toute session authentifiée
--     non anonyme (la policy restrictive essai_sans_ecriture_publique reste
--     en place, ce check explicite documente le contrat).
-- L'événement doit exister : on ne peut pas se pré-inscrire à un identifiant
-- inventé (la FK le refuserait de toute façon).
create policy event_participants_insert
  on public.club_event_participants
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not public.is_anonymous_session()
    and exists (
      select 1
      from public.club_events e
      where e.id = club_event_participants.event_id
        and (
          e.club_id is null
          or exists (
            select 1
            from public.club_members m
            where m.club_id = e.club_id
              and m.user_id = auth.uid()
              and m.status = 'active'
          )
        )
    )
  );
