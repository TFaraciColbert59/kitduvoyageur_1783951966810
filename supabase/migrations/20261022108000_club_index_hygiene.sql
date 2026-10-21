-- 2026-10-22 — Hygiène : les unicitées existaient déjà (idx_club_members_unique
-- et la PK de club_event_participants), et deux paires d'index sont dupliquées.
drop index if exists public.club_members_club_user_uidx;
drop index if exists public.club_event_participants_event_user_uidx;
drop index if exists public.idx_club_members_club_id;
drop index if exists public.idx_club_members_user_id;
