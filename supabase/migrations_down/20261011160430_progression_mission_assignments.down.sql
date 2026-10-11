-- T13 — Retour arrière : retire les fonctions et la table d'assignations.
-- Aucune donnée de progression, aucun XP, aucune association historique
-- (`user_progression.current_challenge_id`) n'est modifié.
DROP FUNCTION IF EXISTS public.abandon_progression_mission(uuid, uuid);
DROP FUNCTION IF EXISTS public.replace_progression_mission(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.choose_progression_mission(uuid, text);
DROP FUNCTION IF EXISTS public.is_published_mission_model(text);
DROP TABLE IF EXISTS public.progression_mission_assignments;
