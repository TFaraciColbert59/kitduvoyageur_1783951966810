-- T35 — Retour arrière : retire la fonction et la colonne d'opt-in.
DROP FUNCTION IF EXISTS public.set_competition_optin(uuid, boolean);
ALTER TABLE public.progression_user_preferences DROP COLUMN IF EXISTS competition_opt_in;

