-- Ouverture explicite d'une saison : nominal, chevauchement, dates, idempotence,
-- privilèges service_role et refus d'un appel porteur de session.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(9);

SELECT is(
  (public.open_progression_season('season_2027_s2', 99, 'Saison pilote', now() + interval '200 days', now() + interval '256 days'))->>'ok',
  'true',
  '1. ouverture nominale acceptée'
);
SELECT is(
  (SELECT status FROM public.progression_seasons WHERE id = 'season_2027_s2'),
  'upcoming',
  '2. statut upcoming (jamais active implicitement)'
);
SELECT is(
  (public.open_progression_season('season_2027_s2', 99, 'Saison pilote', now() + interval '200 days', now() + interval '256 days'))->>'created',
  'false',
  '3. réouverture du même id : idempotente'
);
SELECT is(
  (public.open_progression_season('season_overlap', 100, 'Chevauche', now() + interval '210 days', now() + interval '260 days'))->>'reason',
  'overlap',
  '4. chevauchement refusé'
);
SELECT is(
  (public.open_progression_season('season_bad_dates', 101, 'Dates inverses', now() + interval '300 days', now() + interval '250 days'))->>'reason',
  'invalid_dates',
  '5. dates invalides refusées'
);
SELECT is(
  (public.open_progression_season('ab', 102, 'Id trop court', now() + interval '400 days', now() + interval '450 days'))->>'reason',
  'invalid_id',
  '6. identifiant invalide refusé'
);
SELECT is(
  (SELECT count(*)::int FROM public.progression_seasons WHERE id IN ('season_2027_s2','season_overlap','season_bad_dates','ab')),
  1,
  '7. seuls les appels valides créent une saison'
);
SELECT is(
  (SELECT bool_and(NOT has_function_privilege(role, 'public.open_progression_season(text,integer,text,timestamptz,timestamptz)', 'EXECUTE'))
   FROM unnest(ARRAY['anon','authenticated']) AS role),
  true,
  '8. anon et authenticated sans EXECUTE'
);
SELECT set_config('request.jwt.claim.sub', '99999999-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-8000-000000000001"}', true);
SELECT throws_ok(
  $$SELECT public.open_progression_season('season_2027_s3', 103, 'Session interdite', now() + interval '500 days', now() + interval '550 days')$$,
  'P0001', NULL,
  '9. un appel porteur de session est refusé'
);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);

SELECT * FROM finish();
ROLLBACK;
