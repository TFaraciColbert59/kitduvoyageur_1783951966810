-- ============================================================================
-- Field proof — l'épreuve du terrain (Lot 2)
--   • hike_sessions.kit_id (rattachement)
--   • trigger field_proven_count (seuil : distance_km >= 1)
--   • kit_field_reports (débriefing, upsert UNIQUE (hike_session_id, item_key))
--   • get_kit_journal (agrégats anonymisés — jamais de lat/lon, jamais de noms)
-- Exécution : pgTAP, transaction annulée.
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(15);

-- ----------------------------------------------------------------------------
-- Fixtures
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'field_a@test.local', 'x', '{}', '{}', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'field_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice Terrain', 'field_a@test.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bob Terrain', 'field_b@test.local')
ON CONFLICT (id) DO NOTHING;

-- Deux kits : racine + fork (le trigger de filiation du Lot 1 dérive)
INSERT INTO public.materiel_kits (id, user_id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kit racine A');
INSERT INTO public.materiel_kits (id, user_id, name, forked_from)
VALUES ('00000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fork de A', '00000000-0000-0000-0000-000000000001');

-- Une route de randonnée avec massif (région), pour le journal
INSERT INTO public.hiking_routes (id, osm_relation_id, name, region, distance_km)
VALUES (90001, 10090001, 'GR20 Corse', 'Corse', 180.0)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Test 1 : session >= 1 km rattachée au kit → field_proven_count = 1
-- ----------------------------------------------------------------------------
INSERT INTO public.hike_sessions (id, user_id, kit_id, route_id, started_at, ended_at, distance_km, duration_seconds)
VALUES ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 90001, now() - interval '2 days', now() - interval '2 days' + interval '6 hours', 12.5, 21600);

SELECT is(
  (SELECT field_proven_count FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000001'),
  1,
  '1. Une session ≥ 1 km rattachée incrémente field_proven_count'
);

-- ----------------------------------------------------------------------------
-- Test 2 : session < 1 km → non comptée
-- ----------------------------------------------------------------------------
INSERT INTO public.hike_sessions (id, user_id, kit_id, started_at, ended_at, distance_km, duration_seconds)
VALUES ('10000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', now() - interval '1 day', now() - interval '1 day' + interval '20 minutes', 0.4, 1200);

SELECT is(
  (SELECT field_proven_count FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000001'),
  1,
  '2. Une session < 1 km ne compte pas'
);

-- ----------------------------------------------------------------------------
-- Test 3 : un UPDATE qui change le kit ajuste les deux compteurs
-- ----------------------------------------------------------------------------
UPDATE public.hike_sessions SET kit_id = '00000000-0000-0000-0000-000000000002'
WHERE id = '10000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT field_proven_count FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000001'),
  0,
  '3a. L''ancien kit est décrémenté'
);
SELECT is(
  (SELECT field_proven_count FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000002'),
  1,
  '3b. Le nouveau kit est incrémenté'
);

-- ----------------------------------------------------------------------------
-- Test 4 : DELETE d'une session → décrément
-- ----------------------------------------------------------------------------
DELETE FROM public.hike_sessions WHERE id = '10000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT field_proven_count FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000001'),
  0,
  '4. La suppression d''une session décrémente (reste à 0)'
);

-- ----------------------------------------------------------------------------
-- Test 5 : champ jamais négatif (garde-fou)
-- ----------------------------------------------------------------------------
DELETE FROM public.hike_sessions WHERE id = '10000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT field_proven_count FROM public.materiel_kits WHERE id = '00000000-0000-0000-0000-000000000002'),
  0,
  '5. Le compteur ne descend jamais en dessous de zéro'
);

-- ----------------------------------------------------------------------------
-- Tests 6-8 : kit_field_reports — upsert UNIQUE (hike_session_id, item_key)
-- ----------------------------------------------------------------------------
INSERT INTO public.hike_sessions (id, user_id, kit_id, started_at, ended_at, distance_km, duration_seconds)
VALUES ('10000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', now(), now(), 8.0, 3600);

INSERT INTO public.kit_field_reports (kit_id, hike_session_id, user_id, item_key, verdict)
VALUES ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tente-msr-hubba', 'essentiel');

SELECT is(
  (SELECT count(*) FROM public.kit_field_reports
    WHERE hike_session_id = '10000000-0000-0000-0000-000000000003' AND item_key = 'tente-msr-hubba'),
  1,
  '6. Un premier débriefing crée la ligne'
);

INSERT INTO public.kit_field_reports (kit_id, hike_session_id, user_id, item_key, verdict, note)
VALUES ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tente-msr-hubba', 'defaillant', 'Arceau tordu sous le vent')
ON CONFLICT (hike_session_id, item_key)
DO UPDATE SET verdict = EXCLUDED.verdict, note = EXCLUDED.note;

SELECT is(
  (SELECT verdict FROM public.kit_field_reports
    WHERE hike_session_id = '10000000-0000-0000-0000-000000000003' AND item_key = 'tente-msr-hubba'),
  'defaillant',
  '7. Le re-débriefing du même item (même session) met à jour le verdict'
);
SELECT is(
  (SELECT note FROM public.kit_field_reports
    WHERE hike_session_id = '10000000-0000-0000-0000-000000000003' AND item_key = 'tente-msr-hubba'),
  'Arceau tordu sous le vent',
  '8. La note libre est mise à jour elle aussi'
);

-- ----------------------------------------------------------------------------
-- Test 9 : note > 500 caractères refusée (CHECK)
-- ----------------------------------------------------------------------------
SELECT throws_ok(
  $$ INSERT INTO public.kit_field_reports (kit_id, hike_session_id, user_id, item_key, verdict, note)
     VALUES ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sac-40l', 'jamais_servi', repeat('x', 501)) $$,
  'new row for relation "kit_field_reports" violates check constraint "kit_field_reports_note_chk"',
  '9. Une note de plus de 500 caractères est refusée'
);

-- ----------------------------------------------------------------------------
-- Test 10 : verdict hors vocabulaire refusé (CHECK)
-- ----------------------------------------------------------------------------
SELECT throws_ok(
  $$ INSERT INTO public.kit_field_reports (kit_id, hike_session_id, user_id, item_key, verdict)
     VALUES ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sac-40l', 'superflu') $$,
  'new row for relation "kit_field_reports" violates check constraint "kit_field_reports_verdict_chk"',
  '10. Un verdict hors vocabulaire (essentiel|utile|jamais_servi|defaillant|manquait) est refusé'
);

-- ----------------------------------------------------------------------------
-- Tests 11-15 : get_kit_journal — anonymisation stricte (RGPD)
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT public.get_kit_journal('00000000-0000-0000-0000-000000000001')->'field'->>'session_count'),
  '1',
  '11. Le journal compte les sessions terrain du kit'
);

SELECT ok(
  (SELECT public.get_kit_journal('00000000-0000-0000-0000-000000000001')
     ::text NOT LIKE '%positions_geojson%' AND
   public.get_kit_journal('00000000-0000-0000-0000-000000000001')
     ::text NOT LIKE '%"lat"%' AND
   public.get_kit_journal('00000000-0000-0000-0000-000000000001')
     ::text NOT LIKE '%"lon"%'),
  '12. Le journal n''expose AUCUNE donnée de localisation précise'
);

SELECT ok(
  (SELECT public.get_kit_journal('00000000-0000-0000-0000-000000000002')
     ::text NOT LIKE '%Alice%' AND
   public.get_kit_journal('00000000-0000-0000-0000-000000000002')
     ::text NOT LIKE '%field_a@test.local%'),
  '13. Le journal d''un kit d''autrui ne contient aucun nom ni email'
);

SELECT is(
  (SELECT public.get_kit_journal('00000000-0000-0000-0000-000000000001')->'field'->'regions'->0->>'region'),
  'Corse',
  '14. La granularité maximale exposée est le massif (région)'
);

SELECT is(
  (SELECT public.get_kit_journal('00000000-0000-0000-0000-000000000001')->'birth'->>'origin'),
  'manuel',
  '15. Le journal restitue l''origine du kit (naissance de la lignée)'
);

SELECT * FROM finish();
ROLLBACK;