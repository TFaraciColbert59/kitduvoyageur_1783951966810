-- ============================================================
-- TRIBU — M0 : alignement de l'enum group_member_status
-- ============================================================
-- La production contient 'rejected' (ajoute hors migrations) :
-- cette migration aligne le jeu de migrations pour un replay exact.
-- Valeur ajoutee seule, jamais utilisee dans cette migration.
-- ============================================================

ALTER TYPE public.group_member_status ADD VALUE IF NOT EXISTS 'rejected';
