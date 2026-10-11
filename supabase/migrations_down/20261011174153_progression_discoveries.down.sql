-- T18 — Retour arrière : retire la fonction et la table des découvertes.
-- Aucune donnée de progression, aucun XP, aucune association n'est modifié.
DROP FUNCTION IF EXISTS public.record_verified_discovery(uuid, text, text, text, text);
DROP TABLE IF EXISTS public.progression_discoveries;
