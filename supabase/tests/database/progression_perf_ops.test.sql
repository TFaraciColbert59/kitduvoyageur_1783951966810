-- P4 — performance et exploitation : index du moteur et purge de rétention.
-- Exécutable sur base locale (`lkdv-test-db`) comme sur base neuve.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(15);

-- Fixtures : les deux journaux portent une FK user_id -> auth.users.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('cccccccc-0000-4000-8000-000000000001','authenticated','authenticated','perfops@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;

-- 1-5. Index de requêtes chaudes réellement créés.
SELECT has_index('public', 'progression_events', 'progression_events_user_effective_idx',
  '1. index journal (user_id, effective_at DESC)');
SELECT has_index('public', 'progression_decisions', 'progression_decisions_user_action_effective_idx',
  '2. index plafonds (user_id, action_type, effective_at DESC)');
SELECT has_index('public', 'progression_outbox', 'progression_outbox_user_idx',
  '3. index outbox (user_id)');
SELECT has_index('public', 'leaderboard_access_log', 'leaderboard_access_log_created_idx',
  '4. index rétention accès (created_at)');
SELECT has_index('public', 'territory_change_log', 'territory_change_log_created_idx',
  '5. index rétention territoire (created_at)');

-- 6-8. purge_progression_logs : service_role uniquement.
SELECT is(has_function_privilege('service_role', 'public.purge_progression_logs(integer,integer)', 'EXECUTE'),
  true, '6. service_role peut purger');
SELECT is(has_function_privilege('authenticated', 'public.purge_progression_logs(integer,integer)', 'EXECUTE'),
  false, '7. authenticated ne peut pas purger');
SELECT is(has_function_privilege('anon', 'public.purge_progression_logs(integer,integer)', 'EXECUTE'),
  false, '8. anon ne peut pas purger');

-- 9-10. Fenêtres 30/180 : une ligne de 40 j part, une de 10 j reste.
INSERT INTO public.leaderboard_access_log (user_id, created_at) VALUES
  ('cccccccc-0000-4000-8000-000000000001', now() - interval '40 days'),
  ('cccccccc-0000-4000-8000-000000000001', now() - interval '10 days');
SELECT is((public.purge_progression_logs(30, 180))->>'leaderboard_access_log', '1',
  '9. accès > 30 j purgé');
SELECT is((SELECT count(*)::int FROM public.leaderboard_access_log), 1,
  '10. accès < 30 j conservé');

-- 11-12. Journal territoire : 200 j part, 100 j reste.
INSERT INTO public.territory_change_log (user_id, created_at, reason) VALUES
  ('cccccccc-0000-4000-8000-000000000001', now() - interval '200 days', 'test'),
  ('cccccccc-0000-4000-8000-000000000001', now() - interval '100 days', 'test');
SELECT is((public.purge_progression_logs(30, 180))->>'territory_change_log', '1',
  '11. territoire > 180 j purgé');
SELECT is((SELECT count(*)::int FROM public.territory_change_log), 1,
  '12. territoire < 180 j conservé');

-- 13. Borne basse : (0, 0) est ramené à 1 jour, une ligne de 12 h survit.
DELETE FROM public.leaderboard_access_log;
INSERT INTO public.leaderboard_access_log (user_id, created_at)
VALUES ('cccccccc-0000-4000-8000-000000000001', now() - interval '12 hours');
SELECT is((public.purge_progression_logs(0, 0))->>'leaderboard_access_log', '0',
  '13. borne basse 1 jour respectée (12 h conservées)');

-- 14. Paramètres NULL : fenêtres par défaut 30/180 appliquées.
INSERT INTO public.leaderboard_access_log (user_id, created_at)
VALUES ('cccccccc-0000-4000-8000-000000000001', now() - interval '40 days');
SELECT is((public.purge_progression_logs(NULL, NULL))->>'leaderboard_access_log', '1',
  '14. NULL => défauts 30/180');

-- 15. Bornes hautes : valeurs hors intervalle sans erreur.
SELECT lives_ok('SELECT public.purge_progression_logs(99999, -1)',
  '15. paramètres hors bornes acceptés (clampés)');

SELECT * FROM finish();
ROLLBACK;
