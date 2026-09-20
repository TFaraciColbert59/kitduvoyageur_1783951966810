-- Rollback 20260920106000 — retire les tables de territoire privé.
-- Choix délibéré : ne RESTAURE PAS les policies dangereuses supprimées
-- ("Public read user progression", "Users update own territory") ni les
-- fonctions legacy supprimées : un rollback ne doit pas réouvrir une faille.
DROP TABLE IF EXISTS public.user_territory_private;
DROP TABLE IF EXISTS public.user_territory;
