-- P3 — Classements territoriaux : agrégats, seuil, scores par filtre, local sous
-- flag, anti-triangulation, privilèges et pagination keyset.
BEGIN;
SET LOCAL search_path = public;
SELECT plan(46);

-- ── Jeu de données : 6 utilisateurs, 3 villes, 2 pays. ──────────────────────
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001','authenticated','authenticated','lb-u1@test.local','x','{}','{}',now(),now()),
  ('aaaaaaaa-0000-4000-8000-000000000002','authenticated','authenticated','lb-u2@test.local','x','{}','{}',now(),now()),
  ('aaaaaaaa-0000-4000-8000-000000000003','authenticated','authenticated','lb-u3@test.local','x','{}','{}',now(),now()),
  ('aaaaaaaa-0000-4000-8000-000000000004','authenticated','authenticated','lb-u4@test.local','x','{}','{}',now(),now()),
  ('aaaaaaaa-0000-4000-8000-000000000005','authenticated','authenticated','lb-u5@test.local','x','{}','{}',now(),now()),
  ('aaaaaaaa-0000-4000-8000-000000000006','authenticated','authenticated','lb-u6@test.local','x','{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_territory (user_id, country_code, region_code, city_code, city_name, source) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001','FR','84','38185','Grenoble','manual'),
  ('aaaaaaaa-0000-4000-8000-000000000002','FR','84','38185','Grenoble','manual'),
  ('aaaaaaaa-0000-4000-8000-000000000003','FR','84','38185','Grenoble','manual'),
  ('aaaaaaaa-0000-4000-8000-000000000004','FR','11','75056','Paris','manual'),
  ('aaaaaaaa-0000-4000-8000-000000000005','BE','27','21004','Bruxelles','manual'),
  ('aaaaaaaa-0000-4000-8000-000000000006','FR','11','75056','Paris','manual')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_progression (user_id, lifetime_points, level, level_title) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001',100,2,'Marcheur Averti'),
  ('aaaaaaaa-0000-4000-8000-000000000002',200,2,'Marcheur Averti'),
  ('aaaaaaaa-0000-4000-8000-000000000003',300,3,'Arpenteur des Bois'),
  ('aaaaaaaa-0000-4000-8000-000000000004',400,3,'Arpenteur des Bois'),
  ('aaaaaaaa-0000-4000-8000-000000000005',500,3,'Arpenteur des Bois'),
  ('aaaaaaaa-0000-4000-8000-000000000006',400,3,'Arpenteur des Bois')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_season_progress (user_id, season_id, season_points) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001','season_2026_s1',100),
  ('aaaaaaaa-0000-4000-8000-000000000002','season_2026_s1',200),
  ('aaaaaaaa-0000-4000-8000-000000000003','season_2026_s1',300),
  ('aaaaaaaa-0000-4000-8000-000000000004','season_2026_s1',400),
  ('aaaaaaaa-0000-4000-8000-000000000005','season_2026_s1',500),
  ('aaaaaaaa-0000-4000-8000-000000000006','season_2026_s1',400)
ON CONFLICT (user_id, season_id) DO NOTHING;

-- Dédup : deux mises à jour successives ne créent qu'une entrée de file.
UPDATE public.user_season_progress SET season_points = 100
WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001' AND season_id = 'season_2026_s1';
UPDATE public.user_season_progress SET season_points = 100
WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001' AND season_id = 'season_2026_s1';

SELECT is(
  (SELECT count(*)::int FROM public.leaderboard_refresh_queue
   WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  '1. file dédupliquée par (user_id, season_id)'
);
SELECT is(
  (SELECT count(*)::int FROM public.leaderboard_refresh_queue),
  6,
  '2. une entrée par utilisateur à la suite des insertions'
);
SELECT is(
  (public.refresh_leaderboard_batch(100))->>'processed',
  '6',
  '3. le lot consomme les 6 entrées'
);
SELECT is(
  (public.refresh_leaderboard_batch(100))->>'processed',
  '0',
  '4. un second passage ne retraite rien'
);

-- ── (a) Agrégats monde/pays/région/ville. ───────────────────────────────────
SELECT is(
  (SELECT count(*)::int FROM public.progression_leaderboard_agg
   WHERE season_id = 'season_2026_s1' AND scope_type = 'world' AND scope_id = ''),
  6,
  '5. agrégat monde = 6 participants'
);
SELECT is(
  (SELECT scope_id FROM public.progression_leaderboard_agg
   WHERE season_id = 'season_2026_s1' AND scope_type = 'country'
     AND user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'FR',
  '6. scope pays correct'
);
SELECT is(
  (SELECT scope_id FROM public.progression_leaderboard_agg
   WHERE season_id = 'season_2026_s1' AND scope_type = 'region'
     AND user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '84',
  '7. scope région correct'
);
SELECT is(
  (SELECT scope_id FROM public.progression_leaderboard_agg
   WHERE season_id = 'season_2026_s1' AND scope_type = 'city'
     AND user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '38185',
  '8. scope ville correct'
);
SELECT is(
  (SELECT season_points FROM public.progression_leaderboard_agg
   WHERE season_id = 'season_2026_s1' AND scope_type = 'world'
     AND user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  100,
  '9. points de saison repris de user_season_progress'
);
SELECT is(
  (SELECT level FROM public.progression_leaderboard_agg
   WHERE season_id = 'season_2026_s1' AND scope_type = 'world'
     AND user_id = 'aaaaaaaa-0000-4000-8000-000000000003'),
  3,
  '10. niveau repris de user_progression'
);
SELECT is(
  (SELECT level_title FROM public.progression_leaderboard_agg
   WHERE season_id = 'season_2026_s1' AND scope_type = 'world'
     AND user_id = 'aaaaaaaa-0000-4000-8000-000000000003'),
  'Arpenteur des Bois',
  '11. titre de niveau repris de user_progression'
);
SELECT is(
  (SELECT alias FROM public.progression_leaderboard_agg
   WHERE season_id = 'season_2026_s1' AND scope_type = 'world'
     AND user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Voyageur ' || substr(md5('aaaaaaaa-0000-4000-8000-000000000001'), 1, 6),
  '12. alias pseudonyme stable, jamais nom réel ni UUID'
);
SELECT is(
  (SELECT count(*)::int FROM public.progression_leaderboard_agg
   WHERE season_id = 'season_2026_s1'
     AND user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  4,
  '13. présence dans monde + pays + région + ville'
);
SELECT is(
  (SELECT count(*)::int FROM public.progression_leaderboard_agg WHERE scope_type = 'local'),
  0,
  '14. jamais de ligne local écrite par le rafraîchissement'
);

-- ── (b) Seuil de 5 participants → communauté en formation. ──────────────────
SELECT is(
  (public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','city',50))->>'total_participants',
  '3',
  '15. ville = 3 participants'
);
SELECT is(
  (public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','city',50))->>'community_forming',
  'true',
  '16. ville sous le seuil → communauté en formation'
);
SELECT is(
  (public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','world',50))->>'community_forming',
  'false',
  '17. monde au seuil → communauté formée'
);

-- ── (c) Même score selon le filtre, rang différent. ─────────────────────────
SELECT is(
  (SELECT r->>'season_points' FROM jsonb_array_elements(
     public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','world',50)->'rows') r
   WHERE (r->>'is_current_user')::boolean),
  (SELECT r->>'season_points' FROM jsonb_array_elements(
     public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','city',50)->'rows') r
   WHERE (r->>'is_current_user')::boolean),
  '18. score identique entre deux filtres'
);
SELECT is(
  (public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','world',50))->>'rank',
  '6',
  '19. rang monde = 6'
);
SELECT is(
  (public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','city',50))->>'rank',
  '3',
  '20. rang ville = 3'
);
SELECT is(
  strpos(
    (public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','world',50))::text,
    'aaaaaaaa-0000-4000-8000-000000000001'
  ),
  0,
  '21. aucun UUID dans le payload de classement'
);

-- ── (d) Flag local OFF (défaut) → local_unavailable. ────────────────────────
SELECT is(
  (public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','local',50))->>'local_unavailable',
  'true',
  '22. local indisponible quand le flag est éteint'
);
SELECT is(
  (public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','local',50))->>'reason',
  'flag_off',
  '23. raison = flag_off'
);
SELECT is(
  jsonb_array_length(public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','local',50)->'rows'),
  0,
  '24. aucune ligne local quand le flag est éteint'
);

-- ── (e) Flag local ON : 2 consentis à moins de 1000 m, un lointain exclu. ───
UPDATE public.feature_flags SET enabled = true WHERE id = 'local_leaderboard_active';
INSERT INTO public.user_territory_private (user_id, lat, lng, accuracy_m, consent_at, locked_until) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 48.8566, 2.3522, 15, now(), now() + interval '1 day'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 48.8570, 2.3530, 20, now(), now() + interval '1 day'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 48.9500, 2.5000, 25, now(), now() + interval '1 day')
ON CONFLICT (user_id) DO NOTHING;

SELECT is(
  (public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','local',50))->>'total_participants',
  '2',
  '25. seuls les consentis à moins de 1000 m sont candidats'
);
SELECT is(
  jsonb_array_length(public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','local',50)->'rows'),
  2,
  '26. participants locaux visibles'
);
SELECT is(
  (public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','local',50))->>'community_forming',
  'true',
  '27. seuil local sous 5 → communauté en formation'
);
SELECT is(
  (SELECT count(*)::int FROM jsonb_array_elements(
     public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','local',50)->'rows') r
   WHERE r ? 'lat' OR r ? 'lng' OR r ? 'distance' OR r ? 'distance_m' OR r ? 'user_id'),
  0,
  '28. aucune coordonnée, distance ni UUID dans les lignes local'
);
SELECT is(
  strpos(
    (public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','local',50))::text,
    'lat'
  ),
  0,
  '29. aucune clé lat dans le payload local'
);

-- ── Anti-triangulation : 30 consultations/heure maximum. ────────────────────
DO $$
DECLARE
  v_missing INTEGER;
BEGIN
  SELECT 30 - count(*) INTO v_missing
  FROM public.leaderboard_access_log
  WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  FOR i IN 1..GREATEST(v_missing, 0) LOOP
    PERFORM public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001', 'local', 50);
  END LOOP;
END;
$$;

SELECT is(
  (public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','local',50))->>'error',
  'rate_limited',
  '30. 31e consultation locale sur l''heure → rate_limited'
);

-- ── Recalcul : un changement de ville ne laisse pas d'agrégat orphelin. ─────
UPDATE public.user_territory SET city_code = '99999'
WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000006';
SELECT public.refresh_leaderboard_for_user('aaaaaaaa-0000-4000-8000-000000000006', 'season_2026_s1');
SELECT is(
  (SELECT count(*)::int FROM public.progression_leaderboard_agg
   WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000006'
     AND scope_type = 'city' AND scope_id = '75056'),
  0,
  '31. l''ancienne ville est retirée du recalcul'
);
SELECT is(
  (SELECT count(*)::int FROM public.progression_leaderboard_agg
   WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000006'
     AND scope_type = 'city' AND scope_id = '99999'),
  1,
  '32. la nouvelle ville est présente'
);

-- ── (f) Accès croisé : privilèges clients fermés. ───────────────────────────
SELECT is(
  (SELECT has_table_privilege('authenticated','public.progression_leaderboard_agg','SELECT')),
  false,
  '33. SELECT authenticated révoqué sur les agrégats'
);
SELECT is(
  (SELECT has_table_privilege('authenticated','public.leaderboard_refresh_queue','SELECT')),
  false,
  '34. SELECT authenticated révoqué sur la file'
);
SELECT is(
  (SELECT has_table_privilege('authenticated','public.leaderboard_access_log','SELECT')),
  false,
  '35. SELECT authenticated révoqué sur le journal d''accès'
);
SELECT is(
  (SELECT has_table_privilege('authenticated','public.territory_change_log','SELECT')),
  false,
  '36. SELECT authenticated révoqué sur le journal de territoire'
);
SELECT is(
  (SELECT has_table_privilege('anon','public.progression_leaderboard_agg','SELECT')),
  false,
  '37. SELECT anon révoqué sur les agrégats'
);
SELECT is(
  (SELECT has_function_privilege('authenticated','public.get_leaderboard(uuid,text,integer,integer,uuid)','EXECUTE')),
  false,
  '38. get_leaderboard réservée au service_role'
);
SELECT is(
  (SELECT has_function_privilege('authenticated','public.refresh_leaderboard_for_user(uuid,text)','EXECUTE')),
  false,
  '39. refresh_leaderboard_for_user réservée au service_role'
);
SELECT is(
  (SELECT has_function_privilege('authenticated','public.refresh_leaderboard_batch(integer)','EXECUTE')),
  false,
  '40. refresh_leaderboard_batch réservée au service_role'
);

-- Un client authenticated ne peut pas lire les coordonnées privées d'autrui.
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  'SELECT count(*) FROM public.user_territory_private',
  '42501',
  NULL,
  '41. coordonnées privées inaccessibles au rôle authenticated'
);
RESET ROLE;

-- ── (g) Pagination keyset sans doublon, égalité de score incluse. ───────────
SELECT is(
  (SELECT array_agg((r->>'rank')::int ORDER BY (r->>'rank')::int)
   FROM jsonb_array_elements(public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','world',2)->'rows') r),
  ARRAY[1,2],
  '42. page 1 = rangs 1-2'
);
SELECT is(
  (SELECT array_agg((r->>'rank')::int ORDER BY (r->>'rank')::int)
   FROM jsonb_array_elements(public.get_leaderboard(
     'aaaaaaaa-0000-4000-8000-000000000001','world',2,400,
     'aaaaaaaa-0000-4000-8000-000000000004')->'rows') r),
  ARRAY[3,4],
  '43. page 2 = rangs 3-4 (égalité de score non sautée)'
);
SELECT is(
  (public.get_leaderboard(
     'aaaaaaaa-0000-4000-8000-000000000001','world',2,400,
     'aaaaaaaa-0000-4000-8000-000000000004')->'rows'->0->>'season_points'),
  '400',
  '44. la ligne au même score est bien reprise par le curseur'
);
SELECT is(
  (SELECT array_agg((r->>'rank')::int ORDER BY (r->>'rank')::int)
   FROM jsonb_array_elements(public.get_leaderboard(
     'aaaaaaaa-0000-4000-8000-000000000001','world',2,300,
     'aaaaaaaa-0000-4000-8000-000000000003')->'rows') r),
  ARRAY[5,6],
  '45. page 3 = rangs 5-6'
);
SELECT is(
  (SELECT array_agg((r->>'rank')::int ORDER BY (r->>'rank')::int)
   FROM (
     SELECT r FROM jsonb_array_elements(public.get_leaderboard('aaaaaaaa-0000-4000-8000-000000000001','world',2)->'rows') r
     UNION ALL
     SELECT r FROM jsonb_array_elements(public.get_leaderboard(
       'aaaaaaaa-0000-4000-8000-000000000001','world',2,400,
       'aaaaaaaa-0000-4000-8000-000000000004')->'rows') r
     UNION ALL
     SELECT r FROM jsonb_array_elements(public.get_leaderboard(
       'aaaaaaaa-0000-4000-8000-000000000001','world',2,300,
       'aaaaaaaa-0000-4000-8000-000000000003')->'rows') r
   ) all_pages),
  ARRAY[1,2,3,4,5,6],
  '46. concaténation des pages sans doublon ni trou'
);

SELECT * FROM finish();
ROLLBACK;
