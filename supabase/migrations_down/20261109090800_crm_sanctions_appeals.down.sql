-- M08 — rollback.
drop function if exists admin.strike_scale(uuid);
drop function if exists admin.strike_expire();
drop function if exists admin.strike_add(uuid, text, text, bigint);
drop function if exists admin.appeal_decide(uuid, text, text);
drop function if exists admin.appeal_submit(bigint, text);
drop policy if exists appeals_read_own_or_staff on admin.appeals;
drop table if exists admin.appeals;
drop policy if exists strikes_read_staff on admin.strikes;
drop table if exists admin.strikes;
