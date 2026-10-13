BEGIN;
SELECT plan(5);

-- A-124 — annulation d'événement.

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('a1240000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ev_a@test.local', 'x', '{}', '{}', now(), now()),
  ('a1240000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ev_b@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('a1240000-0000-4000-8000-000000000001', 'Alma', 'ev_a@test.local'),
  ('a1240000-0000-4000-8000-000000000002', 'Bo', 'ev_b@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, title, event_date, max_participants, current_participants, status, organizer_id) VALUES
  ('a1240000-1000-4000-8000-000000000001', 'Sortie à annuler', CURRENT_DATE + 5, 10, 0, 'upcoming', 'a1240000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Bo s'inscrit AVANT l'annulation (chemin nominal).
INSERT INTO public.event_participants (event_id, user_id)
VALUES ('a1240000-1000-4000-8000-000000000001', 'a1240000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- 1. L'organisateur annule (policy auth_update_events).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a1240000-0000-4000-8000-000000000001';
UPDATE public.events SET status = 'cancelled'
 WHERE id = 'a1240000-1000-4000-8000-000000000001';
SELECT is(
  (SELECT status FROM public.events WHERE id = 'a1240000-1000-4000-8000-000000000001'),
  'cancelled',
  '1. L''organisateur peut annuler la sortie'
);

-- 2. La RPC d'inscription refuse l'événement annulé.
SET LOCAL "request.jwt.claim.sub" = 'a1240000-0000-4000-8000-000000000002';
SELECT throws_ok(
  $$ SELECT public.join_event('a1240000-1000-4000-8000-000000000001') $$,
  'P0001', NULL,
  '2. join_event refuse un événement annulé'
);

-- 3. La voie directe est refusée aussi (garde du trigger).
SELECT throws_ok(
  $$ INSERT INTO public.event_participants (event_id, user_id)
     VALUES ('a1240000-1000-4000-8000-000000000001', 'a1240000-0000-4000-8000-000000000002') $$,
  'P0001', NULL,
  '3. L''inscription directe est refusée sur un événement annulé'
);

-- 4. Un participant qui s'était inscrit AVANT peut encore partir : le
--    recount ne ressuscite pas le statut annulé.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'a1240000-0000-4000-8000-000000000002';
DELETE FROM public.event_participants
 WHERE event_id = 'a1240000-1000-4000-8000-000000000001'
   AND user_id = 'a1240000-0000-4000-8000-000000000002';
RESET ROLE;
SELECT is(
  (SELECT status FROM public.events WHERE id = 'a1240000-1000-4000-8000-000000000001'),
  'cancelled',
  '4. Le décompte des participants ne ressuscite pas le statut annulé'
);

-- 5. La contrainte accepte les quatre états.
SELECT ok(
  (SELECT pg_get_constraintdef(oid) LIKE '%cancelled%'
     FROM pg_constraint WHERE conname = 'events_status_check'),
  '5. La contrainte de statut couvre les quatre états'
);

SELECT * FROM finish();
ROLLBACK;
