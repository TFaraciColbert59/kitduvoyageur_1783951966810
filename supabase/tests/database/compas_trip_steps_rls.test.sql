-- ============================================================================
-- Compas — RLS de `trip_steps` (PLAN-100 2.4) : éditeur, lecteur, étranger,
-- anonyme. Les étapes suivent le voyage : lecture = can_read_trip(trip_id),
-- écriture = can_edit_trip(trip_id), y compris pour DÉPLACER une étape d'un
-- voyage à un autre (WITH CHECK sur le nouveau trip_id).
-- ----------------------------------------------------------------------------
-- Fixtures : A propriétaire ; E éditeur et V lecteur du voyage privé P ;
-- S étranger connecté ; U voyage public ; Q voyage privé sans collaborateur.
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(33);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('c2a50000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'steps_a@test.local', 'x', '{}', '{}', now(), now()),
  ('c2a50000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'steps_e@test.local', 'x', '{}', '{}', now(), now()),
  ('c2a50000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'steps_v@test.local', 'x', '{}', '{}', now(), now()),
  ('c2a50000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'steps_s@test.local', 'x', '{}', '{}', now(), now());

INSERT INTO public.trips (id, slug, title, user_id, visibility)
VALUES
  ('c2a50000-0000-4000-8000-0000000000b1', 'rls-steps-prive', 'Voyage privé P', 'c2a50000-0000-4000-8000-0000000000a1', 'private'),
  ('c2a50000-0000-4000-8000-0000000000b2', 'rls-steps-public', 'Voyage public U', 'c2a50000-0000-4000-8000-0000000000a1', 'public'),
  ('c2a50000-0000-4000-8000-0000000000b4', 'rls-steps-prive-q', 'Voyage privé Q', 'c2a50000-0000-4000-8000-0000000000a1', 'private');

INSERT INTO public.trip_collaborators (trip_id, user_id, role, invited_by)
VALUES
  ('c2a50000-0000-4000-8000-0000000000b1', 'c2a50000-0000-4000-8000-0000000000a2', 'editor', 'c2a50000-0000-4000-8000-0000000000a1'),
  ('c2a50000-0000-4000-8000-0000000000b1', 'c2a50000-0000-4000-8000-0000000000a3', 'viewer', 'c2a50000-0000-4000-8000-0000000000a1');

-- Une étape par voyage (s1 dans P, s2 dans U, s3 dans Q).
INSERT INTO public.trip_steps (id, trip_id, day_number, order_index, title, location_name, latitude, longitude)
VALUES
  ('c2a50000-0000-4000-8000-0000000000c1', 'c2a50000-0000-4000-8000-0000000000b1', 1, 0, 'Étape de P', 'Gresse-en-Vercors', 44.8941, 5.5731),
  ('c2a50000-0000-4000-8000-0000000000c2', 'c2a50000-0000-4000-8000-0000000000b2', 1, 0, 'Étape de U', 'Villard-de-Lans', 45.0713, 5.5559),
  ('c2a50000-0000-4000-8000-0000000000c3', 'c2a50000-0000-4000-8000-0000000000b4', 1, 0, 'Étape de Q', 'Die', 44.7523, 5.3694);

-- ============================================================================
-- A — propriétaire
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c2a50000-0000-4000-8000-0000000000a1';

SELECT is(
  (SELECT count(*)::int FROM public.trip_steps WHERE id::text LIKE 'c2a50000-%c_'),
  3,
  '1. A lit les étapes de ses trois voyages'
);
SELECT lives_ok(
  $$ INSERT INTO public.trip_steps (trip_id, day_number, order_index, title) VALUES ('c2a50000-0000-4000-8000-0000000000b1', 2, 0, 'Jour 2 par A') $$,
  '2. A ajoute une étape à P'
);

-- ============================================================================
-- E — éditeur de P
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'c2a50000-0000-4000-8000-0000000000a2';

SELECT is(
  (SELECT count(*)::int FROM public.trip_steps WHERE id::text LIKE 'c2a50000-%c_'),
  2,
  '3. E lit les étapes de P et de U (public), pas celles de Q'
);
SELECT lives_ok(
  $$ INSERT INTO public.trip_steps (trip_id, day_number, order_index, title) VALUES ('c2a50000-0000-4000-8000-0000000000b1', 3, 0, 'Jour 3 par E') $$,
  '4. E ajoute une étape à P'
);
SELECT isnt_empty(
  $$ UPDATE public.trip_steps SET title = 'Étape de P (E)' WHERE id = 'c2a50000-0000-4000-8000-0000000000c1' RETURNING id $$,
  '5. E modifie une étape de P'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_steps (trip_id, day_number, order_index, title) VALUES ('c2a50000-0000-4000-8000-0000000000b4', 2, 0, 'Intrus dans Q') $$,
  '42501',
  'new row violates row-level security policy for table "trip_steps"',
  '6. E n''ajoute rien à Q (voyage dont il n''est pas collaborateur)'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_steps (trip_id, day_number, order_index, title) VALUES ('c2a50000-0000-4000-8000-0000000000b2', 2, 0, 'Intrus dans U') $$,
  '42501',
  'new row violates row-level security policy for table "trip_steps"',
  '7. E n''ajoute rien à U : public en lecture, pas en écriture'
);
SELECT is_empty(
  $$ UPDATE public.trip_steps SET title = 'Pirate' WHERE id = 'c2a50000-0000-4000-8000-0000000000c3' RETURNING id $$,
  '8. E ne modifie pas une étape de Q'
);
SELECT throws_ok(
  $$ UPDATE public.trip_steps SET trip_id = 'c2a50000-0000-4000-8000-0000000000b4' WHERE id = 'c2a50000-0000-4000-8000-0000000000c1' $$,
  '42501',
  'new row violates row-level security policy for table "trip_steps"',
  '9. E ne déplace pas une étape de P vers Q (le nouveau voyage compte aussi)'
);
-- 9b — cas que la policy SELECT ne masque pas : U est LISIBLE par E (public), donc seul le
-- WITH CHECK de la policy UPDATE (can_edit_trip du nouveau trip_id) peut refuser le déplacement.
-- Une mutation de ce WITH CHECK passait inaperçue sans ce test (PLAN-100 2.4).
SELECT throws_ok(
  $$ UPDATE public.trip_steps SET trip_id = 'c2a50000-0000-4000-8000-0000000000b2' WHERE id = 'c2a50000-0000-4000-8000-0000000000c1' $$,
  '42501',
  'new row violates row-level security policy for table "trip_steps"',
  '9b. E ne déplace pas une étape de P vers U, lisible mais non modifiable (WITH CHECK seul en cause)'
);
SELECT is_empty(
  $$ DELETE FROM public.trip_steps WHERE id = 'c2a50000-0000-4000-8000-0000000000c3' RETURNING id $$,
  '10. E ne supprime pas une étape de Q'
);
SELECT isnt_empty(
  $$ DELETE FROM public.trip_steps WHERE trip_id = 'c2a50000-0000-4000-8000-0000000000b1' AND title = 'Jour 3 par E' RETURNING id $$,
  '11. E supprime l''étape qu''il a ajoutée à P'
);

-- ============================================================================
-- V — lecteur de P
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'c2a50000-0000-4000-8000-0000000000a3';

SELECT is(
  (SELECT count(*)::int FROM public.trip_steps WHERE trip_id = 'c2a50000-0000-4000-8000-0000000000b1'),
  2,
  '12. V lit les étapes de P (celle de départ et celle de A)'
);
SELECT is_empty(
  $$ SELECT id FROM public.trip_steps WHERE trip_id = 'c2a50000-0000-4000-8000-0000000000b4' $$,
  '13. V ne lit pas les étapes de Q'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_steps (trip_id, day_number, order_index, title) VALUES ('c2a50000-0000-4000-8000-0000000000b1', 4, 0, 'Ajout par V') $$,
  '42501',
  'new row violates row-level security policy for table "trip_steps"',
  '14. V n''ajoute aucune étape (lecteur)'
);
SELECT is_empty(
  $$ UPDATE public.trip_steps SET title = 'Modifié par V' WHERE id = 'c2a50000-0000-4000-8000-0000000000c1' RETURNING id $$,
  '15. V ne modifie aucune étape'
);
SELECT is_empty(
  $$ DELETE FROM public.trip_steps WHERE id = 'c2a50000-0000-4000-8000-0000000000c1' RETURNING id $$,
  '16. V ne supprime aucune étape'
);

-- ============================================================================
-- S — étranger connecté
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'c2a50000-0000-4000-8000-0000000000a4';

SELECT is(
  (SELECT count(*)::int FROM public.trip_steps WHERE id::text LIKE 'c2a50000-%c_'),
  1,
  '17. S lit seulement l''étape du voyage public U'
);
SELECT is_empty(
  $$ SELECT id FROM public.trip_steps WHERE trip_id IN ('c2a50000-0000-4000-8000-0000000000b1', 'c2a50000-0000-4000-8000-0000000000b4') $$,
  '18. S ne lit aucune étape d''un voyage privé'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_steps (trip_id, day_number, order_index, title) VALUES ('c2a50000-0000-4000-8000-0000000000b2', 5, 0, 'Ajout par S') $$,
  '42501',
  'new row violates row-level security policy for table "trip_steps"',
  '19. S n''ajoute rien à un voyage public'
);
SELECT is_empty(
  $$ UPDATE public.trip_steps SET title = 'Modifié par S' WHERE id = 'c2a50000-0000-4000-8000-0000000000c2' RETURNING id $$,
  '20. S ne modifie pas l''étape d''un voyage public'
);
SELECT is_empty(
  $$ DELETE FROM public.trip_steps WHERE id = 'c2a50000-0000-4000-8000-0000000000c2' RETURNING id $$,
  '21. S ne supprime pas l''étape d''un voyage public'
);

-- ============================================================================
-- Anonyme
-- ============================================================================
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '';

SELECT is(
  (SELECT count(*)::int FROM public.trip_steps WHERE id::text LIKE 'c2a50000-%c_'),
  1,
  '22. anonyme lit seulement l''étape du voyage public U'
);
SELECT is_empty(
  $$ SELECT id FROM public.trip_steps WHERE trip_id IN ('c2a50000-0000-4000-8000-0000000000b1', 'c2a50000-0000-4000-8000-0000000000b4') $$,
  '23. anonyme ne lit aucune étape d''un voyage privé'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_steps (trip_id, day_number, order_index, title) VALUES ('c2a50000-0000-4000-8000-0000000000b2', 6, 0, 'Ajout anonyme') $$,
  '42501',
  'new row violates row-level security policy for table "trip_steps"',
  '24. anonyme n''ajoute aucune étape'
);
SELECT is_empty(
  $$ UPDATE public.trip_steps SET title = 'Modifié anonyme' WHERE id = 'c2a50000-0000-4000-8000-0000000000c2' RETURNING id $$,
  '25. anonyme ne modifie aucune étape'
);
SELECT is_empty(
  $$ DELETE FROM public.trip_steps WHERE id = 'c2a50000-0000-4000-8000-0000000000c2' RETURNING id $$,
  '26. anonyme ne supprime aucune étape'
);

-- ============================================================================
-- Relecture sans RLS : seuls A et E ont écrit
-- ============================================================================
RESET ROLE;

SELECT is(
  (SELECT title FROM public.trip_steps WHERE id = 'c2a50000-0000-4000-8000-0000000000c1'),
  'Étape de P (E)',
  '27. l''étape de P porte la modification de E, pas celle de V'
);
SELECT is(
  (SELECT title FROM public.trip_steps WHERE id = 'c2a50000-0000-4000-8000-0000000000c2'),
  'Étape de U',
  '28. l''étape du voyage public est intacte'
);
SELECT is(
  (SELECT title FROM public.trip_steps WHERE id = 'c2a50000-0000-4000-8000-0000000000c3'),
  'Étape de Q',
  '29. l''étape de Q est intacte'
);
SELECT is(
  (SELECT trip_id FROM public.trip_steps WHERE id = 'c2a50000-0000-4000-8000-0000000000c1'),
  'c2a50000-0000-4000-8000-0000000000b1'::uuid,
  '30. l''étape de P est toujours dans P (déplacement refusé)'
);
SELECT is(
  (SELECT count(*)::int FROM public.trip_steps WHERE trip_id = 'c2a50000-0000-4000-8000-0000000000b1'),
  2,
  '31. P a deux étapes : la sienne et celle de A (celle de E a été supprimée)'
);
SELECT is(
  (SELECT count(*)::int FROM public.trip_steps WHERE title LIKE 'Intrus%' OR title LIKE 'Ajout %'),
  0,
  '32. aucune étape refusée n''a été écrite'
);
SELECT * FROM finish();
ROLLBACK;
