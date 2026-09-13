-- ============================================================
-- TRIBU — M5 : enum group_visibility (+ club_only)
-- ============================================================
-- Contrainte Postgres : une valeur d'enum ajoutee ne peut pas etre
-- utilisee dans la transaction qui la cree. Cette migration ne contient
-- donc QUE l'ajout, seule instruction. La policy qui l'utilise vit dans
-- 20260913060000_tribu_club_only_policy.sql.
-- ============================================================

ALTER TYPE public.group_visibility ADD VALUE IF NOT EXISTS 'club_only';
