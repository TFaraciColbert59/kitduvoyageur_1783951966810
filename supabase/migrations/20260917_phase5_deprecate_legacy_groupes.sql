-- =====================================================================
-- LKDV — OPÉRATION ZÉRO DÉFAUT
-- Migration Phase 5.1 : Dépréciation des 13 tables legacy groupe_* (français)
-- Date: 17 septembre 2026
-- RÈGLE : RENAME TO _deprecated_<nom> (aucune destruction de donnée).
-- =====================================================================

ALTER TABLE IF EXISTS public.groupe_activites RENAME TO _deprecated_groupe_activites;
ALTER TABLE IF EXISTS public.groupe_messages RENAME TO _deprecated_groupe_messages;
ALTER TABLE IF EXISTS public.groupe_vote_choix RENAME TO _deprecated_groupe_vote_choix;
ALTER TABLE IF EXISTS public.groupe_vote_options RENAME TO _deprecated_groupe_vote_options;
ALTER TABLE IF EXISTS public.groupe_votes RENAME TO _deprecated_groupe_votes;
ALTER TABLE IF EXISTS public.groupe_depense_parts RENAME TO _deprecated_groupe_depense_parts;
ALTER TABLE IF EXISTS public.groupe_depenses RENAME TO _deprecated_groupe_depenses;
ALTER TABLE IF EXISTS public.groupe_equipement RENAME TO _deprecated_groupe_equipement;
ALTER TABLE IF EXISTS public.groupe_taches RENAME TO _deprecated_groupe_taches;
ALTER TABLE IF EXISTS public.groupe_hebergements RENAME TO _deprecated_groupe_hebergements;
ALTER TABLE IF EXISTS public.groupe_etapes RENAME TO _deprecated_groupe_etapes;
ALTER TABLE IF EXISTS public.groupe_membres RENAME TO _deprecated_groupe_membres;
ALTER TABLE IF EXISTS public.groupes RENAME TO _deprecated_groupes;
