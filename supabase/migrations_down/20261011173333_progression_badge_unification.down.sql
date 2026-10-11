-- T15 — Retour arrière : retire la table de liaison.
-- Les badges, leurs possessions (user_badges) et les associations historiques
-- restent INTACTS ; les points_reward remis à zéro ne sont pas restaurés
-- (c'étaient des promesses, pas des droits).
DROP TABLE IF EXISTS public.progression_badge_links;
