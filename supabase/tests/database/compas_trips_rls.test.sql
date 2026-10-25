-- ============================================================================
-- Compas — RLS de `trips` (PLAN-100 2.4) : propriétaire, éditeur, lecteur,
-- étranger connecté, anonyme.
-- ----------------------------------------------------------------------------
-- Ce que les tests unitaires (requireEditorAuthorization.test.ts) ne prouvent
-- pas : leur client en mémoire rejoue à la main `trips_select_policy`,
-- `can_read_trip` et `can_edit_trip`. Ici ce sont les politiques et les
-- fonctions RÉELLES de la base, sous les rôles PostgreSQL `anon` et
-- `authenticated`, avec une identité posée comme PostgREST le fait
-- (`request.jwt.claim.sub`).
--
-- Fixtures : A propriétaire ; E éditeur et V lecteur du voyage privé P ;
-- S étranger connecté. U public, L non répertorié, Q privé sans collaborateur.
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(37);

-- ----------------------------------------------------------------------------
-- 1 — Garde-fou : la RLS reste active sur les tables du voyage
-- ----------------------------------------------------------------------------
SELECT ok(
  (SELECT bool_and(c.relrowsecurity) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('trips', 'trip_steps', 'trip_collaborators', 'trip_invitations')),
  '1. RLS active sur trips, trip_steps, trip_collaborators et trip_invitations'
);

-- ----------------------------------------------------------------------------
-- Fixtures (propriétaire de la base : la RLS n'est pas appliquée)
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('c1a50000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'rls_a@test.local', 'x', '{}', '{}', now(), now()),
  ('c1a50000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'rls_e@test.local', 'x', '{}', '{}', now(), now()),
  ('c1a50000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'rls_v@test.local', 'x', '{}', '{}', now(), now()),
  ('c1a50000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'rls_s@test.local', 'x', '{}', '{}', now(), now());

INSERT INTO public.trips (id, slug, title, user_id, visibility)
VALUES
  ('c1a50000-0000-4000-8000-0000000000b1', 'rls-compas-prive', 'Voyage privé P', 'c1a50000-0000-4000-8000-0000000000a1', 'private'),
  ('c1a50000-0000-4000-8000-0000000000b2', 'rls-compas-public', 'Voyage public U', 'c1a50000-0000-4000-8000-0000000000a1', 'public'),
  ('c1a50000-0000-4000-8000-0000000000b3', 'rls-compas-nonrepertorie', 'Voyage non répertorié L', 'c1a50000-0000-4000-8000-0000000000a1', 'unlisted'),
  ('c1a50000-0000-4000-8000-0000000000b4', 'rls-compas-prive-q', 'Voyage privé Q', 'c1a50000-0000-4000-8000-0000000000a1', 'private');

-- Le déclencheur `trg_trips_insert_owner` a posé la ligne « owner » de A.
INSERT INTO public.trip_collaborators (trip_id, user_id, role, invited_by)
VALUES
  ('c1a50000-0000-4000-8000-0000000000b1', 'c1a50000-0000-4000-8000-0000000000a2', 'editor', 'c1a50000-0000-4000-8000-0000000000a1'),
  ('c1a50000-0000-4000-8000-0000000000b1', 'c1a50000-0000-4000-8000-0000000000a3', 'viewer', 'c1a50000-0000-4000-8000-0000000000a1');

-- ============================================================================
-- A — propriétaire
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c1a50000-0000-4000-8000-0000000000a1';

SELECT is(
  (SELECT count(*)::int FROM public.trips WHERE id::text LIKE 'c1a50000-%'),
  4,
  '2. A (propriétaire) lit ses quatre voyages'
);
SELECT isnt_empty(
  $$ UPDATE public.trips SET title = 'Voyage privé P (A)' WHERE id = 'c1a50000-0000-4000-8000-0000000000b1' RETURNING id $$,
  '3. A modifie son voyage'
);
SELECT lives_ok(
  $$ INSERT INTO public.trips (slug, title, user_id) VALUES ('rls-compas-a-cree', 'Créé par A', 'c1a50000-0000-4000-8000-0000000000a1') $$,
  '4. A crée un voyage à son nom'
);
SELECT throws_ok(
  $$ UPDATE public.trips SET user_id = 'c1a50000-0000-4000-8000-0000000000a4' WHERE id = 'c1a50000-0000-4000-8000-0000000000b4' $$,
  'P0001',
  'trips.user_id est immuable (transfert de propriété interdit via RLS)',
  '5. A ne peut pas céder la propriété (déclencheur freeze_trip_owner)'
);

-- ============================================================================
-- E — éditeur de P (collaborateur « editor »)
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'c1a50000-0000-4000-8000-0000000000a2';

SELECT is(
  (SELECT count(*)::int FROM public.trips WHERE id::text LIKE 'c1a50000-%b_'),
  3,
  '6. E lit P (collaborateur), U (public) et L (non répertorié)'
);
SELECT is_empty(
  $$ SELECT id FROM public.trips WHERE id = 'c1a50000-0000-4000-8000-0000000000b4' $$,
  '7. E ne lit pas le voyage privé Q dont il n''est pas collaborateur'
);
SELECT isnt_empty(
  $$ UPDATE public.trips SET description = 'Retouché par E' WHERE id = 'c1a50000-0000-4000-8000-0000000000b1' RETURNING id $$,
  '8. E modifie P'
);
SELECT is_empty(
  $$ UPDATE public.trips SET description = 'Pirate' WHERE id = 'c1a50000-0000-4000-8000-0000000000b4' RETURNING id $$,
  '9. E ne modifie pas Q (aucune ligne visible en écriture)'
);
SELECT throws_ok(
  $$ UPDATE public.trips SET user_id = 'c1a50000-0000-4000-8000-0000000000a2' WHERE id = 'c1a50000-0000-4000-8000-0000000000b1' $$,
  'P0001',
  'trips.user_id est immuable (transfert de propriété interdit via RLS)',
  '10. E ne peut pas s''approprier P'
);
SELECT is_empty(
  $$ DELETE FROM public.trips WHERE id = 'c1a50000-0000-4000-8000-0000000000b1' RETURNING id $$,
  '11. E ne supprime pas P (suppression réservée au propriétaire)'
);
SELECT ok(
  public.can_edit_trip('c1a50000-0000-4000-8000-0000000000b1') AND NOT public.can_edit_trip('c1a50000-0000-4000-8000-0000000000b4'),
  '12. can_edit_trip : vrai pour E sur P, faux sur Q'
);

-- ============================================================================
-- V — lecteur de P (collaborateur « viewer »)
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'c1a50000-0000-4000-8000-0000000000a3';

SELECT is(
  (SELECT count(*)::int FROM public.trips WHERE id::text LIKE 'c1a50000-%b_'),
  3,
  '13. V lit P (collaborateur), U (public) et L (non répertorié), pas Q'
);
SELECT is_empty(
  $$ UPDATE public.trips SET title = 'Modifié par V' WHERE id = 'c1a50000-0000-4000-8000-0000000000b1' RETURNING id $$,
  '14. V ne modifie pas P (lecteur)'
);
SELECT is_empty(
  $$ DELETE FROM public.trips WHERE id = 'c1a50000-0000-4000-8000-0000000000b1' RETURNING id $$,
  '15. V ne supprime pas P'
);
SELECT throws_ok(
  $$ INSERT INTO public.trips (slug, title, user_id) VALUES ('rls-compas-v-usurpe', 'Au nom de A', 'c1a50000-0000-4000-8000-0000000000a1') $$,
  '42501',
  'new row violates row-level security policy for table "trips"',
  '16. V ne crée pas un voyage au nom d''un autre'
);
SELECT ok(
  public.can_read_trip('c1a50000-0000-4000-8000-0000000000b1') AND NOT public.can_edit_trip('c1a50000-0000-4000-8000-0000000000b1'),
  '17. can_read_trip vrai et can_edit_trip faux pour V sur P'
);

-- ============================================================================
-- S — étranger connecté (aucun lien avec P, Q)
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'c1a50000-0000-4000-8000-0000000000a4';

SELECT is(
  (SELECT count(*)::int FROM public.trips WHERE id::text LIKE 'c1a50000-%b_'),
  2,
  '18. S lit seulement U (public) et L (non répertorié)'
);
SELECT is_empty(
  $$ SELECT id FROM public.trips WHERE id IN ('c1a50000-0000-4000-8000-0000000000b1', 'c1a50000-0000-4000-8000-0000000000b4') $$,
  '19. S ne lit aucun voyage privé de A'
);
SELECT is_empty(
  $$ UPDATE public.trips SET title = 'Pirate' WHERE id = 'c1a50000-0000-4000-8000-0000000000b2' RETURNING id $$,
  '20. S ne modifie pas un voyage public (lecture seule)'
);
SELECT is_empty(
  $$ DELETE FROM public.trips WHERE id = 'c1a50000-0000-4000-8000-0000000000b2' RETURNING id $$,
  '21. S ne supprime pas un voyage public'
);
SELECT throws_ok(
  $$ INSERT INTO public.trips (slug, title, user_id) VALUES ('rls-compas-s-usurpe', 'Au nom de A', 'c1a50000-0000-4000-8000-0000000000a1') $$,
  '42501',
  'new row violates row-level security policy for table "trips"',
  '22. S ne crée pas un voyage au nom de A'
);
SELECT lives_ok(
  $$ INSERT INTO public.trips (slug, title, user_id) VALUES ('rls-compas-s-cree', 'Créé par S', 'c1a50000-0000-4000-8000-0000000000a4') $$,
  '23. S crée un voyage à son propre nom'
);
SELECT ok(
  NOT public.can_read_trip('c1a50000-0000-4000-8000-0000000000b1') AND public.can_read_trip('c1a50000-0000-4000-8000-0000000000b2'),
  '24. can_read_trip : faux pour S sur P (privé), vrai sur U (public)'
);

-- ============================================================================
-- Anonyme — rôle `anon`, aucune identité
-- ============================================================================
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '';

SELECT is(
  (SELECT count(*)::int FROM public.trips WHERE id = 'c1a50000-0000-4000-8000-0000000000b2'),
  1,
  '25. anonyme lit un voyage public'
);
-- Caractérisation (fonction can_read_trip : « visible publiquement ou non
-- répertorié ») : un voyage non répertorié se lit quand on connaît son identifiant.
SELECT is(
  (SELECT count(*)::int FROM public.trips WHERE id = 'c1a50000-0000-4000-8000-0000000000b3'),
  1,
  '26. anonyme lit un voyage non répertorié dont il connaît l''identifiant'
);
SELECT is_empty(
  $$ SELECT id FROM public.trips WHERE id IN ('c1a50000-0000-4000-8000-0000000000b1', 'c1a50000-0000-4000-8000-0000000000b4') $$,
  '27. anonyme ne lit aucun voyage privé'
);
SELECT is_empty(
  $$ UPDATE public.trips SET title = 'Pirate' WHERE id = 'c1a50000-0000-4000-8000-0000000000b2' RETURNING id $$,
  '28. anonyme ne modifie pas un voyage public'
);
SELECT is_empty(
  $$ DELETE FROM public.trips WHERE id = 'c1a50000-0000-4000-8000-0000000000b2' RETURNING id $$,
  '29. anonyme ne supprime pas un voyage public'
);
SELECT throws_ok(
  $$ INSERT INTO public.trips (slug, title, user_id) VALUES ('rls-compas-anon', 'Anonyme', 'c1a50000-0000-4000-8000-0000000000a1') $$,
  '42501',
  'new row violates row-level security policy for table "trips"',
  '30. anonyme ne crée aucun voyage'
);
SELECT ok(
  NOT public.can_edit_trip('c1a50000-0000-4000-8000-0000000000b2') AND NOT public.can_read_trip('c1a50000-0000-4000-8000-0000000000b1'),
  '31. anonyme : can_edit_trip faux sur U, can_read_trip faux sur P'
);

-- ============================================================================
-- Rien n'a été écrit par les refus : relecture en propriétaire de la base
-- ============================================================================
RESET ROLE;

SELECT is(
  (SELECT title FROM public.trips WHERE id = 'c1a50000-0000-4000-8000-0000000000b1'),
  'Voyage privé P (A)',
  '32. le titre de P est celui posé par A (les écritures de V, S et anonyme n''ont rien changé)'
);
SELECT is(
  (SELECT description FROM public.trips WHERE id = 'c1a50000-0000-4000-8000-0000000000b1'),
  'Retouché par E',
  '33. la description de P est celle posée par E (éditeur)'
);
SELECT is(
  (SELECT title FROM public.trips WHERE id = 'c1a50000-0000-4000-8000-0000000000b2'),
  'Voyage public U',
  '34. le voyage public U est intact'
);
SELECT is(
  (SELECT count(*)::int FROM public.trips WHERE id::text LIKE 'c1a50000-%b_'),
  4,
  '35. aucun des quatre voyages n''a été supprimé'
);
SELECT is(
  (SELECT user_id FROM public.trips WHERE id = 'c1a50000-0000-4000-8000-0000000000b1'),
  'c1a50000-0000-4000-8000-0000000000a1'::uuid,
  '36. P appartient toujours à A'
);
SELECT is(
  (SELECT count(*)::int FROM public.trips WHERE slug IN ('rls-compas-v-usurpe', 'rls-compas-s-usurpe', 'rls-compas-anon')),
  0,
  '37. aucun voyage usurpé n''existe'
);

SELECT * FROM finish();
ROLLBACK;
