BEGIN;
SELECT plan(9);

-- ----------------------------------------------------------------------------
-- F-008 — Inscription aux événements : capacité et compteurs sur tous les chemins
-- ----------------------------------------------------------------------------

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
  ('f0080000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ev_a@test.local', 'x', '{}', '{}', now(), now()),
  ('f0080000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ev_b@test.local', 'x', '{}', '{}', now(), now()),
  ('f0080000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'ev_c@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('f0080000-0000-4000-8000-000000000001', 'Eva', 'ev_a@test.local'),
  ('f0080000-0000-4000-8000-000000000002', 'Éric', 'ev_b@test.local'),
  ('f0080000-0000-4000-8000-000000000003', 'Zoé', 'ev_c@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, title, event_date, max_participants, current_participants, status, organizer_id) VALUES
  ('f0e10000-0000-4000-8000-000000000001', 'Sortie test capacité', CURRENT_DATE + 7, 2, 0, 'upcoming', 'f0080000-0000-4000-8000-000000000001'),
  ('f0e10000-0000-4000-8000-000000000002', 'Sortie passée', CURRENT_DATE - 7, 10, 0, 'past', 'f0080000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 1. Insertion DIRECTE (ancien chemin du hub) : acceptée dans la capacité.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0080000-0000-4000-8000-000000000001';
INSERT INTO public.event_participants (event_id, user_id)
VALUES ('f0e10000-0000-4000-8000-000000000001', 'f0080000-0000-4000-8000-000000000001');
SELECT is(
  (SELECT current_participants FROM public.events WHERE id = 'f0e10000-0000-4000-8000-000000000001'),
  1,
  '1. Insertion directe : compteur recalculé (1)'
);

-- 2. Deuxième inscription directe : capacité atteinte → statut full.
SET LOCAL "request.jwt.claim.sub" = 'f0080000-0000-4000-8000-000000000002';
INSERT INTO public.event_participants (event_id, user_id)
VALUES ('f0e10000-0000-4000-8000-000000000001', 'f0080000-0000-4000-8000-000000000002');
SELECT is(
  (SELECT current_participants FROM public.events WHERE id = 'f0e10000-0000-4000-8000-000000000001'),
  2,
  '2. Deuxième inscription : compteur (2)'
);
SELECT is(
  (SELECT status FROM public.events WHERE id = 'f0e10000-0000-4000-8000-000000000001'),
  'full',
  '3. Capacité atteinte : statut full'
);

-- 3. Troisième inscription directe : refusée (dépassement impossible).
SET LOCAL "request.jwt.claim.sub" = 'f0080000-0000-4000-8000-000000000003';
SELECT throws_ok(
  $$ INSERT INTO public.event_participants (event_id, user_id)
     VALUES ('f0e10000-0000-4000-8000-000000000001', 'f0080000-0000-4000-8000-000000000003') $$,
  'P0001',
  NULL,
  '4. Insertion directe au-delà de la capacité : refusée (événement complet)'
);

-- 4. Événement terminé : inscription directe refusée.
SELECT throws_ok(
  $$ INSERT INTO public.event_participants (event_id, user_id)
     VALUES ('f0e10000-0000-4000-8000-000000000002', 'f0080000-0000-4000-8000-000000000003') $$,
  'P0001',
  NULL,
  '5. Inscription directe à un événement terminé : refusée'
);

-- 5. Départ : compteur recalculé et statut rouvert.
SET LOCAL "request.jwt.claim.sub" = 'f0080000-0000-4000-8000-000000000002';
DELETE FROM public.event_participants
 WHERE event_id = 'f0e10000-0000-4000-8000-000000000001'
   AND user_id = 'f0080000-0000-4000-8000-000000000002';
SELECT is(
  (SELECT current_participants FROM public.events WHERE id = 'f0e10000-0000-4000-8000-000000000001'),
  1,
  '6. Départ : compteur recalculé (1)'
);
SELECT is(
  (SELECT status FROM public.events WHERE id = 'f0e10000-0000-4000-8000-000000000001'),
  'upcoming',
  '7. Une place libérée : statut rouvert'
);

-- 6. Identité d'inscription immuable.
SET LOCAL "request.jwt.claim.sub" = 'f0080000-0000-4000-8000-000000000001';
SELECT throws_ok(
  $$ UPDATE public.event_participants
        SET event_id = 'f0e10000-0000-4000-8000-000000000002'
      WHERE event_id = 'f0e10000-0000-4000-8000-000000000001'
        AND user_id = 'f0080000-0000-4000-8000-000000000001' $$,
  '42501',
  NULL,
  '8. Une inscription ne peut pas être déplacée vers un autre événement'
);

-- 7. La RPC join_event reste le chemin nominal et cohérent.
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0080000-0000-4000-8000-000000000003';
SELECT is(
  (SELECT public.join_event('f0e10000-0000-4000-8000-000000000001') ->> 'current_participants'),
  '2',
  '9. join_event (RPC) : compteur cohérent avec le recount des triggers'
);

SELECT * FROM finish();
ROLLBACK;
