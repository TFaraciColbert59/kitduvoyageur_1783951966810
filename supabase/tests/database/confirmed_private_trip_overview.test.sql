BEGIN;
SELECT plan(14);

INSERT INTO auth.users (id, email) VALUES
  ('65c05d17-2b61-4dd6-a380-100000000001', 'overview-owner@example.test'),
  ('65c05d17-2b61-4dd6-a380-100000000002', 'overview-traveller@example.test'),
  ('65c05d17-2b61-4dd6-a380-100000000003', 'overview-invite@example.test'),
  ('65c05d17-2b61-4dd6-a380-100000000004', 'overview-outsider@example.test');

INSERT INTO public.trips (id, user_id, title, slug, visibility, description, estimated_budget) VALUES
  ('65c05d17-2b61-4dd6-a380-200000000001', '65c05d17-2b61-4dd6-a380-100000000001',
    'Voyage de recette', 'overview-confirmed-traveller', 'private', 'Note du propriétaire', 720),
  ('65c05d17-2b61-4dd6-a380-200000000002', '65c05d17-2b61-4dd6-a380-100000000001',
    'Autre voyage', 'overview-other-trip', 'private', NULL, NULL);

INSERT INTO public.trip_participants (trip_id, user_id, role, status) VALUES
  ('65c05d17-2b61-4dd6-a380-200000000001', '65c05d17-2b61-4dd6-a380-100000000002', 'member', 'confirmed'),
  ('65c05d17-2b61-4dd6-a380-200000000001', '65c05d17-2b61-4dd6-a380-100000000003', 'guest', 'invited');

INSERT INTO public.trip_steps (trip_id, day_number, order_index, title, start_time, description, accommodation_name, distance_km) VALUES
  ('65c05d17-2b61-4dd6-a380-200000000001', 1, 2, 'Arrivée', '17:15', 'Note de préparation', 'Hébergement personnel', 5.0),
  ('65c05d17-2b61-4dd6-a380-200000000001', 1, 1, 'Départ', '09:00', NULL, NULL, 0.0);

SELECT ok(NOT has_function_privilege('anon', 'public.get_confirmed_trip_overview(text)', 'EXECUTE'),
  'Le rôle anonyme ne peut pas appeler la projection');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '65c05d17-2b61-4dd6-a380-100000000002', true);

SELECT is((SELECT count(*) FROM public.get_confirmed_trip_overview()), 1::bigint,
  'Le participant confirmé ne voit que sa sortie privée dans la liste');
SELECT is((SELECT participant_role FROM public.get_confirmed_trip_overview('overview-confirmed-traveller')),
  'member', 'Le rôle retourné décrit sa participation');
SELECT is((SELECT steps -> 1 ->> 'distance_km' FROM public.get_confirmed_trip_overview())::numeric, 5.0::numeric,
  'Le résumé contient les distances enregistrées');
SELECT is((SELECT steps -> 0 ->> 'title' FROM public.get_confirmed_trip_overview('overview-confirmed-traveller')),
  'Départ', 'Le détail contient les étapes du voyage dans leur ordre');
SELECT is((SELECT steps -> 1 ->> 'start_time' FROM public.get_confirmed_trip_overview('overview-confirmed-traveller')),
  '17:15:00', 'Le détail utilise l’heure enregistrée');
SELECT ok((SELECT NOT (steps -> 1 ?| ARRAY['description', 'accommodation_name', 'metadata'])
    FROM public.get_confirmed_trip_overview('overview-confirmed-traveller')),
  'Les notes et hébergements privés sont absents du détail');
SELECT ok((SELECT NOT (to_jsonb(o) ?| ARRAY['share_token', 'estimated_budget', 'metadata', 'description'])
    FROM public.get_confirmed_trip_overview('overview-confirmed-traveller') AS o),
  'Le jeton de partage, le budget et les notes restent exclus');
SELECT is((SELECT count(*) FROM public.get_confirmed_trip_overview('overview-other-trip')), 0::bigint,
  'La demande par slug ne donne aucun accès à une sortie tierce');
SELECT is((SELECT count(*) FROM public.trips WHERE slug = 'overview-confirmed-traveller'), 0::bigint,
  'La RLS brute du voyage reste intacte');

SELECT set_config('request.jwt.claim.sub', '65c05d17-2b61-4dd6-a380-100000000003', true);
SELECT is((SELECT count(*) FROM public.get_confirmed_trip_overview()), 0::bigint,
  'Une invitation en attente ne donne aucun accès');

SELECT set_config('request.jwt.claim.sub', '65c05d17-2b61-4dd6-a380-100000000004', true);
SELECT is((SELECT count(*) FROM public.get_confirmed_trip_overview('overview-confirmed-traveller')), 0::bigint,
  'Un compte tiers ne voit aucun détail');

RESET ROLE;
INSERT INTO public.trip_collaborators (trip_id, user_id, role) VALUES
  ('65c05d17-2b61-4dd6-a380-200000000001', '65c05d17-2b61-4dd6-a380-100000000002', 'viewer');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '65c05d17-2b61-4dd6-a380-100000000002', true);
SELECT is((SELECT count(*) FROM public.get_confirmed_trip_overview()), 0::bigint,
  'Le collaborateur déjà visible par le chemin direct ne reçoit aucun doublon');

RESET ROLE;
DELETE FROM public.trip_collaborators
WHERE trip_id = '65c05d17-2b61-4dd6-a380-200000000001'
  AND user_id = '65c05d17-2b61-4dd6-a380-100000000002';
UPDATE public.trip_participants SET status = 'removed'
WHERE trip_id = '65c05d17-2b61-4dd6-a380-200000000001'
  AND user_id = '65c05d17-2b61-4dd6-a380-100000000002';
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.get_confirmed_trip_overview()), 0::bigint,
  'La révocation ferme immédiatement la projection');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
