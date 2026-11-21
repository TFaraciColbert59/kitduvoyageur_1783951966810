-- Exécuter dans une transaction et dans l’ordre inverse des migrations.
LOCK TABLE trip_private.trip_step_execution_events IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM trip_private.trip_step_execution_events) THEN
    RAISE EXCEPTION 'Le retour arrière supprimerait l’historique des étapes.';
  END IF;
END;
$$;

DROP FUNCTION public.read_trip_step_execution(uuid);
DROP FUNCTION trip_private.read_trip_step_execution(uuid);
DROP FUNCTION public.record_trip_step_execution(uuid, uuid, uuid, integer, timestamptz, text, text);
DROP FUNCTION trip_private.record_trip_step_execution(uuid, uuid, uuid, integer, timestamptz, text, text);
DROP TABLE trip_private.trip_step_execution_events;
