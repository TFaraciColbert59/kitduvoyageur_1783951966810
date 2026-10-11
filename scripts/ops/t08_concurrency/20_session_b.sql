-- Session B : démarre pendant que A tient le verrou ; elle attend la fin de la
-- transaction de A puis voit le quota réellement consommé.
SELECT public.award_progression_gain(
  'a0808080-0000-4000-8000-000000000001','hike_session_processed','hike_session','race-b',
  now() - interval '80 minutes', 40,
  '{"explorer":1,"preparer":0,"partager":0,"entraider":0}'::jsonb, 'race B') AS session_b;
