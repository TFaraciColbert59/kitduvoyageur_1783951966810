-- M10 — rollback.
-- Les colonnes ajoutées à public.support_tickets ne sont pas supprimées
-- (DROP COLUMN interdit sur une table LKDV) ; elles restent nullables.
drop function if exists admin.support_thread(uuid);
drop policy if exists support_tickets_staff_all on public.support_tickets;
drop policy if exists support_messages_staff_all on public.support_messages;
drop policy if exists support_messages_member_write on public.support_messages;
drop policy if exists support_messages_member_read on public.support_messages;
drop table if exists public.support_messages;
