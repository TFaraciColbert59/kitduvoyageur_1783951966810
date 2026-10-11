-- T06 — Retour arrière : retire les capteurs d'intention et la table.
-- Aucune donnée de progression, aucun journal, aucun droit n'est supprimé
-- ailleurs ; les décisions déjà prises restent dans leurs propres journaux.
DROP TRIGGER IF EXISTS trg_prog_intent_hike ON public.hike_sessions;
DROP TRIGGER IF EXISTS trg_prog_intent_carnet ON public.carnets;
DROP TRIGGER IF EXISTS trg_prog_intent_trip ON public.trips;
DROP TRIGGER IF EXISTS trg_prog_intent_checklist ON public.trip_checklist_items;
DROP TRIGGER IF EXISTS trg_prog_intent_kit_report ON public.kit_field_reports;
DROP TRIGGER IF EXISTS trg_prog_intent_place_review ON public.place_reviews;

DROP FUNCTION IF EXISTS public.progression_intent_hike_processed();
DROP FUNCTION IF EXISTS public.progression_intent_carnet_published();
DROP FUNCTION IF EXISTS public.progression_intent_trip_completed();
DROP FUNCTION IF EXISTS public.progression_intent_checklist_completed();
DROP FUNCTION IF EXISTS public.progression_intent_kit_field_report();
DROP FUNCTION IF EXISTS public.progression_intent_place_review();
DROP FUNCTION IF EXISTS public.enqueue_progression_award_intent(uuid, text, text, text, timestamptz, jsonb);

DROP TABLE IF EXISTS public.progression_award_intents;
