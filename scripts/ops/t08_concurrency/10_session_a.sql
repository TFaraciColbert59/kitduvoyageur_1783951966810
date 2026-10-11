-- Session A : gagne la course si elle obtient le verrou en premier, tient la
-- transaction 3 secondes pour forcer B à attendre le verrou consultatif.
BEGIN;
SELECT public.award_progression_gain(
  'a0808080-0000-4000-8000-000000000001','hike_session_processed','hike_session','race-a',
  now() - interval '90 minutes', 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}'::jsonb, 'race A') ->> 'outcome' AS session_a_outcome;
SELECT pg_sleep(3);
COMMIT;
