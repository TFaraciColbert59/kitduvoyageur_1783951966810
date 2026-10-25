-- T14 — Retour arrière : retire projection et table de correspondance.
-- Les assignations existantes sont conservées (la colonne completed_at
-- reste, sans lecteur) ; aucun journal, aucun XP, aucune association
-- historique n'est modifié.
DROP FUNCTION IF EXISTS public.refresh_progression_mission_progress(uuid);
DROP TABLE IF EXISTS public.progression_mission_model_actions;
