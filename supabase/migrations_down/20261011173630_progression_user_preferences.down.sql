-- T16 — Retour arrière : retire les préférences de rythme.
-- Aucune donnée de progression, aucun XP, aucune mission n'est concerné.
DROP FUNCTION IF EXISTS public.update_progression_preferences(uuid, text, boolean, boolean, boolean);
DROP TABLE IF EXISTS public.progression_user_preferences;
