-- P1 — Correspondance versionnée des niveaux hérités : plancher honorifique,
-- aucune saison rétroactive, idempotence, jamais de baisse.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(14);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('aaaaaaaa-0000-4000-8000-00000000aa01','authenticated','authenticated','legacy@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email, xp, level)
VALUES ('aaaaaaaa-0000-4000-8000-00000000aa01','Léo Legacy','legacy@test.local', 800, 4)
ON CONFLICT (id) DO UPDATE SET xp = 800, level = 4;

SELECT is((SELECT count(*)::int FROM public.user_progression WHERE user_id = 'aaaaaaaa-0000-4000-8000-00000000aa01'), 0, '1. aucune projection préalable');

CREATE TEMP TABLE legacy_first AS
  SELECT public.apply_legacy_level_mapping('aaaaaaaa-0000-4000-8000-00000000aa01') AS result;

SELECT is((SELECT result->>'ok' FROM legacy_first), 'true', '2. mapping appliqué');
SELECT is((SELECT result->>'mappedLifetimePoints' FROM legacy_first), '700', '3. niveau 4 → plancher 700 (seuil réel des règles)');
SELECT is((SELECT lifetime_points FROM public.user_progression WHERE user_id = 'aaaaaaaa-0000-4000-8000-00000000aa01'), 700, '4. cumul à vie = plancher honorifique');
SELECT is((SELECT count(*)::int FROM public.user_season_progress WHERE user_id = 'aaaaaaaa-0000-4000-8000-00000000aa01'), 0, '5. aucune saison rétroactive créée');
SELECT is((SELECT skill_explorer_points + skill_preparer_points + skill_partager_points + skill_entraider_points FROM public.user_progression WHERE user_id = 'aaaaaaaa-0000-4000-8000-00000000aa01'), 0, '6. aucune compétence inventée');
SELECT is((SELECT level || ':' || level_title FROM public.user_progression WHERE user_id = 'aaaaaaaa-0000-4000-8000-00000000aa01'), '4:Éclaireur des Cimes', '7. niveau et titre recalculés depuis le cumul');

SELECT is((SELECT count(*)::int FROM public.progression_legacy_mapping WHERE user_id = 'aaaaaaaa-0000-4000-8000-00000000aa01' AND legacy_source = 'level' AND legacy_value = 4 AND mapping_version = 'legacy-xp-v1' AND applied_at IS NOT NULL), 1, '8. trace de mapping versionnée');

SELECT is((public.apply_legacy_level_mapping('aaaaaaaa-0000-4000-8000-00000000aa01'))->>'alreadyApplied', 'true', '9. réexécution idempotente');
SELECT is((SELECT count(*)::int FROM public.progression_legacy_mapping WHERE user_id = 'aaaaaaaa-0000-4000-8000-00000000aa01'), 1, '10. aucune double trace');

-- Jamais de baisse : un cumul réel supérieur au plancher est conservé.
UPDATE public.user_progression SET lifetime_points = 2500 WHERE user_id = 'aaaaaaaa-0000-4000-8000-00000000aa01';
SELECT is((public.apply_legacy_level_mapping('aaaaaaaa-0000-4000-8000-00000000aa01', 'legacy-xp-v2'))->>'lifetimePoints', '2500', '11. cumul existant jamais abaissé');
SELECT is((SELECT level FROM public.user_progression WHERE user_id = 'aaaaaaaa-0000-4000-8000-00000000aa01'), 5, '12. niveau recalculé sur le cumul conservé');

SELECT is((SELECT bool_and(NOT has_function_privilege(role_name, 'public.apply_legacy_level_mapping(uuid,text)', 'EXECUTE'))
  FROM (VALUES ('anon'), ('authenticated')) AS t(role_name)), true, '13. non exécutable par anon/authenticated');
SELECT is(has_function_privilege('service_role', 'public.apply_legacy_level_mapping(uuid,text)', 'EXECUTE'), true, '14. exécutable par service_role');

SELECT * FROM finish();
ROLLBACK;
