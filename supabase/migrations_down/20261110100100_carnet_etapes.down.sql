-- Rollback de 20261110100100_carnet_etapes : retire la table des étapes du
-- carnet (ses lignes sont perdues ; la fiche n'affiche alors plus d'étapes).
drop table if exists public.carnet_etapes cascade;
