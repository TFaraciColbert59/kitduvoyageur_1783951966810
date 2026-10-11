-- T24 — Retour arrière : retire la fonction de résolution (les colonnes additives et leurs données restent, sans lecteur).
DROP FUNCTION IF EXISTS public.resolve_place_report(uuid, uuid, text, text);

