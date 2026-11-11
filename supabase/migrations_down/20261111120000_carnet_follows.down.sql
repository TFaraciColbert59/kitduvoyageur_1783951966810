-- Rollback de 20261111120000_carnet_follows : retire la table des suivis de
-- carnet et leurs préférences de notification (les lignes sont perdues ; la
-- lentille « Suivre » retombe sur la préférence locale de l'appareil).

drop table if exists public.carnet_follows cascade;
