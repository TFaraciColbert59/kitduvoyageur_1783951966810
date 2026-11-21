-- Ces conflits de version sont des réponses métier. PostgREST doit les exposer
-- en HTTP 409 sans essayer de rejouer la publication ni la décision.
DO $$
DECLARE
  target regprocedure;
  definition text;
  previous_code constant text := 'ERRCODE = ''40001''';
  conflict_code constant text := 'ERRCODE = ''PT409''';
  expected_count integer;
BEGIN
  FOR target, expected_count IN
    SELECT 'club_private.publish_club_event_route(uuid,integer,bigint,text)'::regprocedure, 1
    UNION ALL
    SELECT 'club_private.save_event_route_state(uuid,integer,boolean)'::regprocedure, 2
  LOOP
    definition := pg_get_functiondef(target);
    IF regexp_count(definition, previous_code) <> expected_count THEN
      RAISE EXCEPTION 'Définition inattendue pour %.', target;
    END IF;
    EXECUTE replace(definition, previous_code, conflict_code);
  END LOOP;
END;
$$;
