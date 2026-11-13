-- M09 — rollback.
drop function if exists admin.open_identity_document(uuid, text);
drop function if exists admin.reveal_pii(uuid, text);
drop function if exists admin.member_360(uuid);
drop function if exists admin.note_add(uuid, text, boolean);
drop policy if exists member_notes_read_staff on admin.member_notes;
drop table if exists admin.member_notes;
