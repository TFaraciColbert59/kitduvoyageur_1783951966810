-- M04 — rollback.
drop function if exists admin.complete_request(uuid, jsonb, text);
drop function if exists admin.reject_request(uuid, text);
drop function if exists admin.request_guard_approval(uuid, text);
drop function if exists admin.request_detail(uuid);
drop function if exists admin.requests_pending();
drop function if exists admin.request_create(text, jsonb, uuid, text, text, text, text, text, text, boolean);
drop function if exists admin.notify_member(uuid, text, text, text, text, text, uuid);
drop function if exists admin.request_fingerprint(text, jsonb);
drop policy if exists requests_read_staff on admin.requests;
drop table if exists admin.requests;
