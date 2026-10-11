-- T35/T36 — opt-in de compétition (retrait EFFECTIF) et cohortes de ligues
-- (population réelle ≥ 20, démos exclues, gel rejouable refusé).
BEGIN;
SELECT plan(8);

-- Fixtures : 20 comptes réels + 30 démos + une saison existante.
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
SELECT (
    '20000000-0000-4000-8000-' || LPAD(i::text, 12, '0')
  )::uuid,
  't36-user-' || i || '@test.invalid', 'authenticated', 'authenticated', '{}'
FROM generate_series(1, 20) AS i
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
SELECT (
    '21000000-0000-4000-8000-' || LPAD(i::text, 12, '0')
  )::uuid,
  't36-demo-' || i || '@test.invalid', 'authenticated', 'authenticated', '{}'
FROM generate_series(1, 30) AS i
ON CONFLICT (id) DO NOTHING;

UPDATE public.user_profiles SET is_demo = true
WHERE email LIKE 't36-demo-%@test.invalid';

-- Neuf opt-in seulement : la porte doit refuser (moins de 20).
SELECT public.set_competition_optin(('20000000-0000-4000-8000-' || LPAD(i::text, 12, '0'))::uuid, true)
FROM generate_series(1, 9) AS i;

SELECT is(
  (public.create_league_cohorts((SELECT id FROM public.progression_seasons LIMIT 1)))->>'reason',
  'population_insuffisante', 'moins de 20 opt-in → aucune ligue');

-- Opt-out d'un agrégat : la ligne disparaît EFFECTIVEMENT.
INSERT INTO public.progression_leaderboard_agg (season_id, scope_type, scope_id, user_id, alias, level, season_points)
SELECT (SELECT id FROM public.progression_seasons LIMIT 1), 'city', 'x', '20000000-0000-4000-8000-000000000001', 'A', 1, 10
ON CONFLICT DO NOTHING;
SELECT public.set_competition_optin('20000000-0000-4000-8000-000000000001', false);
SELECT public.set_competition_optin('20000000-0000-4000-8000-000000000001', false);
SELECT is(
  (SELECT count(*)::int FROM public.progression_leaderboard_agg WHERE user_id = '20000000-0000-4000-8000-000000000001'),
  0, 'retrait : la ligne de classement est supprimée');

-- Vingt opt-in + saison : la formation gèle des cohortes déterministes.
SELECT public.set_competition_optin(('20000000-0000-4000-8000-' || LPAD(i::text, 12, '0'))::uuid, true)
FROM generate_series(1, 20) AS i;

INSERT INTO public.user_season_progress (user_id, season_id, season_points)
SELECT ('20000000-0000-4000-8000-' || LPAD(i::text, 12, '0'))::uuid,
       (SELECT id FROM public.progression_seasons LIMIT 1), i * 10
FROM generate_series(1, 20) AS i
ON CONFLICT (user_id, season_id) DO UPDATE SET season_points = EXCLUDED.season_points;

-- Les démos, même avec des points, ne comptent pas.
INSERT INTO public.user_season_progress (user_id, season_id, season_points)
SELECT ('21000000-0000-4000-8000-' || LPAD(i::text, 12, '0'))::uuid,
       (SELECT id FROM public.progression_seasons LIMIT 1), 999
FROM generate_series(1, 30) AS i
ON CONFLICT (user_id, season_id) DO NOTHING;
SELECT public.set_competition_optin(('21000000-0000-4000-8000-' || LPAD(1::text, 12, '0'))::uuid, true);

SELECT is(
  (public.create_league_cohorts((SELECT id FROM public.progression_seasons LIMIT 1), 30))->>'ok',
  'true', '20 éligibles réels → ligue formée');
SELECT is(
  (SELECT count(*)::int FROM public.progression_league_cohorts c
    WHERE c.season_id = (SELECT id FROM public.progression_seasons LIMIT 1)),
  1, 'une cohorte gelée');
SELECT is(
  (SELECT array_length(member_ids, 1) FROM public.progression_league_cohorts c
    WHERE c.season_id = (SELECT id FROM public.progression_seasons LIMIT 1)),
  20, 'les 20 éligibles réels sont membres');
SELECT is(
  (SELECT count(*)::int FROM public.progression_league_cohorts c
    WHERE c.season_id = (SELECT id FROM public.progression_seasons LIMIT 1)
      AND EXISTS (SELECT 1 FROM unnest(c.member_ids) AS m
                  JOIN public.user_profiles p ON p.id = m WHERE p.is_demo)),
  0, 'aucune démo dans les cohortes');
SELECT is(
  (public.create_league_cohorts((SELECT id FROM public.progression_seasons LIMIT 1)))->>'reason',
  'saison_deja_gelee', 'seconde formation refusée (gel stable)');

-- La promotion ne touche ni XP permanents ni permissions (aucune écriture ici).
SELECT is(
  (SELECT count(*)::int FROM public.reward_transactions WHERE transaction_type = 'PROGRESSION_AWARD'
    AND user_id IN (SELECT unnest(member_ids) FROM public.progression_league_cohorts c
                    WHERE c.season_id = (SELECT id FROM public.progression_seasons LIMIT 1))),
  0, 'aucun XP émis par la ligue');

SELECT * FROM finish();
ROLLBACK;
