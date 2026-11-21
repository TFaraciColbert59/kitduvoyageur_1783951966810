BEGIN;
SELECT plan(18);

-- Setup 3 utilisateurs synthétiques + 1 voyage privé + 1 participant confirmé
INSERT INTO auth.users (id, email)
VALUES
  ('c0de0000-0000-4000-8000-000000000001', 'owner-live@test.local'),
  ('c0de0000-0000-4000-8000-000000000002', 'member-live@test.local'),
  ('c0de0000-0000-4000-8000-000000000003', 'outsider-live@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.trips (id, slug, title, user_id, status, visibility)
VALUES (
  'c0de1111-0000-4000-8000-000000000001',
  'trip-live-pgtap',
  'Voyage live pgTAP',
  'c0de0000-0000-4000-8000-000000000001',
  'planned',
  'private'
);

INSERT INTO public.trip_participants (trip_id, user_id, role, status)
VALUES (
  'c0de1111-0000-4000-8000-000000000001',
  'c0de0000-0000-4000-8000-000000000002',
  'member',
  'confirmed'
);

-- 1-4 : Sécurité & RLS activées
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'trip_lifecycle_events'), 'RLS activée sur trip_lifecycle_events');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'trip_live_positions'), 'RLS activée sur trip_live_positions');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'trip_safety_contacts'), 'RLS activée sur trip_safety_contacts');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'hub_field_reports'), 'RLS activée sur hub_field_reports');

-- 5-8 : Cycle de vie atomique et idempotent
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c0de0000-0000-4000-8000-000000000001', true);

SELECT is(
  (public.transition_trip_lifecycle('c0de1111-0000-4000-8000-000000000001', 'active', 'c0de2222-0000-4000-8000-000000000001', 'Départ réel')).to_state,
  'active',
  'Le propriétaire démarre le voyage vers active'
);
SELECT is(
  (public.transition_trip_lifecycle('c0de1111-0000-4000-8000-000000000001', 'active', 'c0de2222-0000-4000-8000-000000000001', 'Départ réel')).to_state,
  'active',
  'Le renvoi avec le même operation_id est idempotent'
);
SELECT is(
  (SELECT count(*)::int FROM public.trip_lifecycle_events WHERE trip_id = 'c0de1111-0000-4000-8000-000000000001'),
  1,
  'Aucun doublon créé lors du renvoi idempotent'
);
SELECT throws_ok(
  $$SELECT public.transition_trip_lifecycle('c0de1111-0000-4000-8000-000000000001', 'paused', 'c0de2222-0000-4000-8000-000000000001')$$,
  '40001',
  'OPERATION_ID_CONFLICT',
  'Un même operation_id avec un autre état est refusé'
);

-- 9-12 : Positions live persistantes, protection paquets inversés et révocation
SELECT is(
  (public.upsert_trip_live_position('c0de1111-0000-4000-8000-000000000001', 45.92, 6.86, now(), 1500, 2, 12, 85::smallint, true, 120)).along_meters,
  1500::double precision,
  'La position live est persistée en base'
);
SELECT is(
  (public.upsert_trip_live_position('c0de1111-0000-4000-8000-000000000001', 45.90, 6.80, now() - interval '10 minutes', 500, 2, 12, 80::smallint, true, 120)).along_meters,
  1500::double precision,
  'Un paquet plus ancien n’écrase jamais la position plus récente'
);

-- Participant confirmé lit la position
SELECT set_config('request.jwt.claim.sub', 'c0de0000-0000-4000-8000-000000000002', true);
SELECT is(
  (SELECT count(*)::int FROM public.read_trip_live_positions('c0de1111-0000-4000-8000-000000000001')),
  1,
  'Le participant confirmé lit la position partagée'
);

-- Outsider ne lit aucune position
SELECT set_config('request.jwt.claim.sub', 'c0de0000-0000-4000-8000-000000000003', true);
SELECT is(
  (SELECT count(*)::int FROM public.read_trip_live_positions('c0de1111-0000-4000-8000-000000000001')),
  0,
  'Un tiers non autorisé ne lit aucune position'
);

-- 13-15 : Contacts de sécurité strictement privés par propriétaire
SELECT set_config('request.jwt.claim.sub', 'c0de0000-0000-4000-8000-000000000001', true);
INSERT INTO public.trip_safety_contacts (trip_id, owner_id, contact_name, contact_channel, contact_value, consent_confirmed)
VALUES ('c0de1111-0000-4000-8000-000000000001', 'c0de0000-0000-4000-8000-000000000001', 'Contact Urgence', 'phone', '+33600000000', true);

SELECT is(
  (SELECT count(*)::int FROM public.trip_safety_contacts WHERE trip_id = 'c0de1111-0000-4000-8000-000000000001'),
  1,
  'Le propriétaire lit son contact d’urgence'
);

SELECT set_config('request.jwt.claim.sub', 'c0de0000-0000-4000-8000-000000000002', true);
SELECT is(
  (SELECT count(*)::int FROM public.trip_safety_contacts WHERE trip_id = 'c0de1111-0000-4000-8000-000000000001'),
  0,
  'Un autre participant ne voit pas le contact de sécurité privé'
);

-- Arrêt du partage live par le propriétaire
SELECT set_config('request.jwt.claim.sub', 'c0de0000-0000-4000-8000-000000000001', true);
SELECT is(
  (public.upsert_trip_live_position('c0de1111-0000-4000-8000-000000000001', 45.92, 6.86, now() + interval '1 minute', 1500, 2, 12, 85::smallint, false, 120)).sharing_enabled,
  false,
  'L’arrêt du partage est immédiatement persisté'
);

-- 16-18 : Signalements terrain et confirmations idempotentes
INSERT INTO public.hub_field_reports (id, trip_id, author_id, category, title, lat, lon)
VALUES ('c0de3333-0000-4000-8000-000000000001', 'c0de1111-0000-4000-8000-000000000001', 'c0de0000-0000-4000-8000-000000000001', 'water_dry', 'Source tarie au col', 45.93, 6.87);

SELECT set_config('request.jwt.claim.sub', 'c0de0000-0000-4000-8000-000000000002', true);
SELECT is(
  public.confirm_hub_field_report('c0de3333-0000-4000-8000-000000000001'),
  2,
  'La confirmation par un second utilisateur incrémente le compteur'
);
SELECT is(
  public.confirm_hub_field_report('c0de3333-0000-4000-8000-000000000001'),
  2,
  'Une double confirmation par le même utilisateur est idempotente'
);
SELECT is(
  (SELECT count(*)::int FROM public.read_trip_live_positions('c0de1111-0000-4000-8000-000000000001')),
  0,
  'Après arrêt du partage, la position n’est plus exposée au participant'
);

SELECT * FROM finish();
ROLLBACK;
