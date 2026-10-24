-- 2026-10-22 — Idempotence réelle des adhésions et RSVP.
-- La route /api/compte/clubs s'appuie sur une pré-lecture ; sans contrainte
-- unique, deux requêtes concurrentes pourraient créer des doublons.
create unique index if not exists club_members_club_user_uidx
  on public.club_members (club_id, user_id);
create unique index if not exists club_event_participants_event_user_uidx
  on public.club_event_participants (event_id, user_id);
