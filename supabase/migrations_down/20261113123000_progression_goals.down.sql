-- Rollback de 20261113123000_progression_goals.
--
-- Retire uniquement la table ajoutée par S2.19 et ses droits. Aucune autre
-- table, policy ou donnée de progression n'est touchée. Les objectifs privés
-- qu'elle contenait sont supprimés : ne l'exécuter qu'après avoir prévenu les
-- personnes concernées ou exporté leurs lignes si nécessaire.

begin;

DROP TABLE IF EXISTS public.progression_goals;

commit;
