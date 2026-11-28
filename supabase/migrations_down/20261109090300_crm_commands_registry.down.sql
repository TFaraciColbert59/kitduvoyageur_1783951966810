-- M03 — rollback : retire l'amorçage du registre et le catalogue exposé.
drop function if exists admin.commands_catalog();
delete from admin.commands where id like 'ACT-%';
