-- Le référentiel des massifs est public (policy `geo_massifs_read_public`) mais
-- les rôles API n'avaient pas le GRANT SELECT : les lectures renvoyaient 401 et
-- la carte du Compte affichait « 0 massif ». Additif et idempotent.
grant select on public.geo_massifs to anon, authenticated;
