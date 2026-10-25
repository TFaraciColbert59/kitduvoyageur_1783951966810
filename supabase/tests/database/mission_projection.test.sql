-- T14 — Avancement dérivé des événements :
--   réalisations distinctes, un événement plusieurs vues/aucun gain,
--   fenêtre hebdomadaire, borne à la cible, distinction sans XP,
--   recalcul idempotent et privilèges fermés.
BEGIN;
SELECT plan(15);

-- Fixture : compte réel (FK des événements), deux missions choisies,
-- trois événements récents (2 randonnées, 1 avis).
INSERT INTO auth.users(id,email,aud,role,raw_user_meta_data) VALUES
  ('14141414-0000-4000-8000-00000000000a','t14-projection@test.invalid','authenticated','authenticated','{}');

SELECT public.choose_progression_mission('14141414-0000-4000-8000-00000000000a'::uuid, 'mission_discovery_first_activity');
SELECT public.choose_progression_mission('14141414-0000-4000-8000-00000000000a'::uuid, 'mission_community_review');

INSERT INTO public.progression_events
  (idempotency_key, user_id, action_type, points_total, weight_explorer, weight_preparer, weight_partager, weight_entraider, explanation, effective_at)
VALUES
  ('t14:e1', '14141414-0000-4000-8000-00000000000a', 'hike_session_processed', 40, 1, 0, 0, 0, 'test', now() - interval '2 hours'),
  ('t14:e2', '14141414-0000-4000-8000-00000000000a', 'hike_session_processed', 70, 1, 0, 0, 0, 'test', now() - interval '90 minutes'),
  ('t14:e3', '14141414-0000-4000-8000-00000000000a', 'place_review', 15, 0, 0, 1, 0, 'test', now() - interval '1 hour');

-- 1/2. Le recalcul met à jour les deux missions actives.
SELECT is(
  public.refresh_progression_mission_progress('14141414-0000-4000-8000-00000000000a'::uuid),
  2, 'deux missions recalculées');

SELECT is(
  (SELECT progress FROM public.progression_mission_assignments
    WHERE user_id = '14141414-0000-4000-8000-00000000000a'::uuid AND model_id = 'mission_discovery_first_activity'),
  1, 'randonnée : deux événements, une réalisation comptée (cible 1)');

-- 3. La distinction de fin est posée (aucun XP).
SELECT ok(
  (SELECT completed_at IS NOT NULL FROM public.progression_mission_assignments
    WHERE user_id = '14141414-0000-4000-8000-00000000000a'::uuid AND model_id = 'mission_discovery_first_activity'),
  'fin de mission = distinction datée');

-- 4/5. Un même événement avance plusieurs vues (avis → mission communauté).
SELECT is(
  (SELECT progress FROM public.progression_mission_assignments
    WHERE user_id = '14141414-0000-4000-8000-00000000000a'::uuid AND model_id = 'mission_community_review'),
  1, 'un événement avance une autre mission');
SELECT ok(
  (SELECT completed_at IS NOT NULL FROM public.progression_mission_assignments
    WHERE user_id = '14141414-0000-4000-8000-00000000000a'::uuid AND model_id = 'mission_community_review'),
  'distinction posée pour la mission communauté');

-- 6/7. Aucun gain : ni transaction, ni événement supplémentaire.
SELECT is(
  (SELECT count(*)::int FROM public.reward_transactions WHERE user_id = '14141414-0000-4000-8000-00000000000a'::uuid),
  0, 'aucun PROGRESSION_AWARD émis par la mission');
SELECT is(
  (SELECT count(*)::int FROM public.progression_events WHERE user_id = '14141414-0000-4000-8000-00000000000a'::uuid),
  3, 'les événements sources ne sont pas dupliqués');

-- 8. Idempotence : rejouer le recalcul ne change rien.
SELECT is(
  public.refresh_progression_mission_progress('14141414-0000-4000-8000-00000000000a'::uuid),
  2, 'recalcul rejoué sans erreur');
SELECT is(
  (SELECT progress FROM public.progression_mission_assignments
    WHERE user_id = '14141414-0000-4000-8000-00000000000a'::uuid AND model_id = 'mission_discovery_first_activity'),
  1, 'avancement stable après rejeu');

-- 9. Fenêtre hebdomadaire : un vieil événement n'entre pas dans la semaine.
INSERT INTO public.progression_events
  (idempotency_key, user_id, action_type, points_total, weight_explorer, weight_preparer, weight_partager, weight_entraider, explanation, effective_at)
VALUES
  ('t14:e4', '14141414-0000-4000-8000-00000000000a', 'place_review', 15, 0, 0, 1, 0, 'test', now() - interval '20 days');
UPDATE public.progression_mission_assignments
  SET target_count = 2, completed_at = NULL, period = 'week'
  WHERE user_id = '14141414-0000-4000-8000-00000000000a'::uuid AND model_id = 'mission_community_review';
SELECT public.refresh_progression_mission_progress('14141414-0000-4000-8000-00000000000a'::uuid);
SELECT is(
  (SELECT progress FROM public.progression_mission_assignments
    WHERE user_id = '14141414-0000-4000-8000-00000000000a'::uuid AND model_id = 'mission_community_review'),
  1, 'seul l''avis de la semaine compte (fenêtre ISO UTC)');

-- 10. Mission sans réalisation : zéro, sans distinction.
SELECT public.choose_progression_mission('14141414-0000-4000-8000-00000000000a'::uuid, 'mission_prep_departure_checks');
SELECT public.refresh_progression_mission_progress('14141414-0000-4000-8000-00000000000a'::uuid);
SELECT is(
  (SELECT (progress, completed_at)::text FROM public.progression_mission_assignments
    WHERE user_id = '14141414-0000-4000-8000-00000000000a'::uuid AND model_id = 'mission_prep_departure_checks'),
  '(0,)', 'aucune réalisation : zéro sans distinction');

-- 11/12. Privilèges : clients fermés, service_role autorisé.
SELECT ok(NOT has_function_privilege('authenticated', 'public.refresh_progression_mission_progress(uuid)', 'EXECUTE'), 'client sans recalcul');
SELECT ok(has_function_privilege('service_role', 'public.refresh_progression_mission_progress(uuid)', 'EXECUTE'), 'service_role peut recalculer');
SELECT ok(NOT has_table_privilege('anon', 'public.progression_mission_model_actions', 'SELECT'), 'correspondance illisible par anon');

-- 13. Correspondance modèle → actions cohérente avec les modèles publiés.
SELECT is(
  (SELECT count(*)::int FROM public.progression_mission_model_actions a
     WHERE NOT EXISTS (SELECT 1 FROM public.progression_challenge_models m
                       WHERE m.model_id = a.model_id AND m.provenance = 'canonical_v2')),
  0, 'toutes les actions correspondent à un modèle publié');

SELECT * FROM finish();
ROLLBACK;
