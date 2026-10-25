-- P1 — Clôture de saison : nominal, idempotence, saison inconnue, agrégats
-- conservés, privilèges service_role uniquement.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(12);

INSERT INTO public.progression_seasons (id, season_number, name, starts_at, ends_at, status)
VALUES ('season_close_test', 990001, 'Saison test clôture', now() - interval '1 day', now() + interval '1 day', 'active')
ON CONFLICT (id) DO NOTHING;

-- FK CASCADE (20260921100000_legacy_hardening) : les porteurs doivent exister.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('cccccccc-0000-4000-8000-000000000001','authenticated','authenticated','season-close-u1@test.local','x','{}','{}',now(),now()),
  ('cccccccc-0000-4000-8000-000000000002','authenticated','authenticated','season-close-u2@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_season_progress
  (user_id, season_id, season_points, skill_explorer_points, skill_preparer_points, skill_partager_points, skill_entraider_points)
VALUES
  ('cccccccc-0000-4000-8000-000000000001', 'season_close_test', 37, 30, 7, 0, 0),
  ('cccccccc-0000-4000-8000-000000000002', 'season_close_test', 12, 0, 0, 12, 0);

CREATE TEMP TABLE close_result AS
  SELECT public.close_progression_season('season_close_test') AS result;

SELECT is((SELECT result->>'ok' FROM close_result), 'true', '1. clôture nominale acceptée');
SELECT is((SELECT result->>'seasonId' FROM close_result), 'season_close_test', '2. identifiant de saison restitué');
SELECT is((SELECT result->>'participants' FROM close_result), '2', '3. récapitulatif : 2 participants');
SELECT is((SELECT result->>'archivedAt' FROM close_result) IS NOT NULL, true, '4. horodatage d''archivage fourni');

SELECT is((SELECT status FROM public.progression_seasons WHERE id = 'season_close_test'), 'completed', '5. saison marquée completed');
SELECT is((SELECT season_points FROM public.user_season_progress WHERE season_id = 'season_close_test' AND user_id = 'cccccccc-0000-4000-8000-000000000001'), 37, '6. points de saison conservés (aucune remise à zéro)');
SELECT is((SELECT skill_explorer_points FROM public.user_season_progress WHERE season_id = 'season_close_test' AND user_id = 'cccccccc-0000-4000-8000-000000000001'), 30, '7. compétences de saison conservées');

SELECT is((public.close_progression_season('season_close_test'))->>'alreadyClosed', 'true', '8. réexécution idempotente (alreadyClosed)');
SELECT is((SELECT count(*)::int FROM public.user_season_progress WHERE season_id = 'season_close_test'), 2, '9. agrégats de saison intacts après réexécution');

SELECT is((public.close_progression_season('saison_inconnue_xyz'))->>'reason', 'season_not_found', '10. saison inconnue refusée proprement');

SELECT is((SELECT bool_and(NOT has_function_privilege(role_name, 'public.close_progression_season(text)', 'EXECUTE'))
  FROM (VALUES ('anon'), ('authenticated')) AS t(role_name)), true, '11. non exécutable par anon/authenticated');
SELECT is(has_function_privilege('service_role', 'public.close_progression_season(text)', 'EXECUTE'), true, '12. exécutable par service_role');

SELECT * FROM finish();
ROLLBACK;
