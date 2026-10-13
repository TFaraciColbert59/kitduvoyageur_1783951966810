-- ============================================================================
-- Compas (lot AH) — `trip_items.borrowed_from` : la colonne « emprunté à » et sa RLS.
-- La colonne est additive ; la RLS de `trip_items` ne change pas : lecture =
-- can_read_trip(trip_id), écriture = can_edit_trip(trip_id). Ce test garde donc
-- les deux : la colonne existe comme prévu (nullable, FK vers auth.users, SET NULL),
-- et elle ne donne à personne un droit d'écriture que la table refusait.
-- ----------------------------------------------------------------------------
-- Fixtures : A propriétaire ; E éditeur et V lecteur du voyage privé P ;
-- S étranger connecté ; L la personne qui prête (compte existant).
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(25);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('b0770000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'borrow_a@test.local', 'x', '{}', '{}', now(), now()),
  ('b0770000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'borrow_e@test.local', 'x', '{}', '{}', now(), now()),
  ('b0770000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'borrow_v@test.local', 'x', '{}', '{}', now(), now()),
  ('b0770000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'borrow_s@test.local', 'x', '{}', '{}', now(), now()),
  ('b0770000-0000-4000-8000-0000000000a5', 'authenticated', 'authenticated', 'borrow_l@test.local', 'x', '{}', '{}', now(), now());

INSERT INTO public.trips (id, slug, title, user_id, visibility)
VALUES ('b0770000-0000-4000-8000-0000000000b1', 'rls-borrow-prive', 'Voyage privé P', 'b0770000-0000-4000-8000-0000000000a1', 'private');

INSERT INTO public.trip_collaborators (trip_id, user_id, role, invited_by)
VALUES
  ('b0770000-0000-4000-8000-0000000000b1', 'b0770000-0000-4000-8000-0000000000a2', 'editor', 'b0770000-0000-4000-8000-0000000000a1'),
  ('b0770000-0000-4000-8000-0000000000b1', 'b0770000-0000-4000-8000-0000000000a3', 'viewer', 'b0770000-0000-4000-8000-0000000000a1');

-- Un objet du kit de P, que personne n'emprunte encore.
INSERT INTO public.trip_items (id, trip_id, item_name)
VALUES ('b0770000-0000-4000-8000-0000000000c1', 'b0770000-0000-4000-8000-0000000000b1', 'Réchaud');

-- ============================================================================
-- La colonne
-- ============================================================================
SELECT has_column('public', 'trip_items', 'borrowed_from', '1. trip_items.borrowed_from existe');
SELECT col_type_is('public', 'trip_items', 'borrowed_from', 'uuid', '2. borrowed_from est un uuid');
SELECT col_is_null('public', 'trip_items', 'borrowed_from', '3. borrowed_from est nullable (NULL = rien d''emprunté)');
SELECT col_hasnt_default('public', 'trip_items', 'borrowed_from', '4. borrowed_from n''a pas de défaut : jamais un prêteur inventé');
SELECT fk_ok('public', 'trip_items', 'borrowed_from', 'auth', 'users', 'id', '5. borrowed_from référence un vrai compte (auth.users)');
SELECT is(
  (SELECT c.confdeltype::text
     FROM pg_constraint c
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.trip_items'::regclass AND c.contype = 'f' AND a.attname = 'borrowed_from'),
  'n',
  '6. le compte du prêteur supprimé : l''emprunt tombe (ON DELETE SET NULL), pas de prêteur fantôme'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.trip_items'::regclass),
  '7. la RLS de trip_items est toujours activée'
);
SELECT is(
  (SELECT borrowed_from FROM public.trip_items WHERE id = 'b0770000-0000-4000-8000-0000000000c1'),
  NULL::uuid,
  '8. un objet existant n''est emprunté à personne'
);
SELECT throws_ok(
  $$ UPDATE public.trip_items SET borrowed_from = 'b0770000-0000-4000-8000-0000000000ff' WHERE id = 'b0770000-0000-4000-8000-0000000000c1' $$,
  '23503',
  NULL,
  '9. un prêteur qui n''est pas un compte est refusé (clé étrangère)'
);

-- ============================================================================
-- A — propriétaire
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'b0770000-0000-4000-8000-0000000000a1';

SELECT isnt_empty(
  $$ UPDATE public.trip_items SET borrowed_from = 'b0770000-0000-4000-8000-0000000000a5' WHERE id = 'b0770000-0000-4000-8000-0000000000c1' RETURNING id $$,
  '10. A enregistre un emprunt à L sur un objet de P'
);

-- ============================================================================
-- E — éditeur de P
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'b0770000-0000-4000-8000-0000000000a2';

SELECT is(
  (SELECT borrowed_from FROM public.trip_items WHERE id = 'b0770000-0000-4000-8000-0000000000c1'),
  'b0770000-0000-4000-8000-0000000000a5'::uuid,
  '11. E lit l''emprunt de P'
);
SELECT isnt_empty(
  $$ UPDATE public.trip_items SET borrowed_from = NULL WHERE id = 'b0770000-0000-4000-8000-0000000000c1' RETURNING id $$,
  '12. E annule l''emprunt'
);
SELECT isnt_empty(
  $$ UPDATE public.trip_items SET borrowed_from = 'b0770000-0000-4000-8000-0000000000a5' WHERE id = 'b0770000-0000-4000-8000-0000000000c1' RETURNING id $$,
  '13. E le rétablit'
);

-- ============================================================================
-- V — lecteur de P
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'b0770000-0000-4000-8000-0000000000a3';

SELECT is(
  (SELECT borrowed_from FROM public.trip_items WHERE id = 'b0770000-0000-4000-8000-0000000000c1'),
  'b0770000-0000-4000-8000-0000000000a5'::uuid,
  '14. V lit l''emprunt de P'
);
SELECT is_empty(
  $$ UPDATE public.trip_items SET borrowed_from = NULL WHERE id = 'b0770000-0000-4000-8000-0000000000c1' RETURNING id $$,
  '15. V n''annule pas l''emprunt (lecteur)'
);

-- ============================================================================
-- S — étranger connecté
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'b0770000-0000-4000-8000-0000000000a4';

SELECT is_empty(
  $$ SELECT id FROM public.trip_items WHERE id = 'b0770000-0000-4000-8000-0000000000c1' $$,
  '16. S ne lit aucun objet d''un voyage privé'
);
SELECT is_empty(
  $$ UPDATE public.trip_items SET borrowed_from = 'b0770000-0000-4000-8000-0000000000a4' WHERE id = 'b0770000-0000-4000-8000-0000000000c1' RETURNING id $$,
  '17. S n''enregistre aucun emprunt sur le voyage d''un autre'
);

-- ============================================================================
-- Anonyme
-- ============================================================================
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '';

SELECT is_empty(
  $$ SELECT id FROM public.trip_items WHERE id = 'b0770000-0000-4000-8000-0000000000c1' $$,
  '18. anonyme ne lit aucun objet d''un voyage privé'
);

-- ============================================================================
-- Relecture sans RLS : seuls A et E ont écrit
-- ============================================================================
RESET ROLE;

SELECT is(
  (SELECT borrowed_from FROM public.trip_items WHERE id = 'b0770000-0000-4000-8000-0000000000c1'),
  'b0770000-0000-4000-8000-0000000000a5'::uuid,
  '19. l''emprunt porte l''écriture de A et E, ni celle de V ni celle de S'
);
SELECT lives_ok(
  $$ INSERT INTO public.trip_items (id, trip_id, item_name, borrowed_from) VALUES ('b0770000-0000-4000-8000-0000000000c2', 'b0770000-0000-4000-8000-0000000000b1', 'Popote', 'b0770000-0000-4000-8000-0000000000a5') $$,
  '20. un objet peut naître emprunté'
);
SELECT is(
  (SELECT count(*)::int FROM public.trip_items WHERE trip_id = 'b0770000-0000-4000-8000-0000000000b1' AND borrowed_from IS NOT NULL),
  2,
  '21. P compte deux objets empruntés : aucun autre emprunt n''a été écrit'
);

-- Ce que l'emprunt a remplacé (porteur, mode) : rétabli par « Annuler l'emprunt ».
SELECT fk_ok('public', 'trip_items', 'borrow_prev_owner_id', 'auth', 'users', 'id', '22. borrow_prev_owner_id référence un vrai compte (auth.users)');
SELECT col_type_is('public', 'trip_items', 'borrow_prev_ownership', 'text', '23. borrow_prev_ownership est un texte');
SELECT lives_ok(
  $$ UPDATE public.trip_items SET borrow_prev_owner_id = 'b0770000-0000-4000-8000-0000000000a2', borrow_prev_ownership = 'personal' WHERE id = 'b0770000-0000-4000-8000-0000000000c2' $$,
  '24. l''emprunt garde le porteur et le mode qu''il remplace'
);
SELECT throws_ok(
  $$ UPDATE public.trip_items SET borrow_prev_ownership = 'loue' WHERE id = 'b0770000-0000-4000-8000-0000000000c2' $$,
  '23514',
  NULL,
  '25. borrow_prev_ownership n''accepte que personal ou shared'
);
SELECT * FROM finish();
ROLLBACK;
