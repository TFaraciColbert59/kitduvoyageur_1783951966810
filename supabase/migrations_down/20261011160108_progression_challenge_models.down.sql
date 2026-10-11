-- T12 (données) — Retour arrière : retire la table de liaison.
-- AUCUN défi n'est supprimé ni modifié : `progression_challenges` et les
-- associations `user_progression.current_challenge_id` restent intacts.
DROP TABLE IF EXISTS public.progression_challenge_models;
