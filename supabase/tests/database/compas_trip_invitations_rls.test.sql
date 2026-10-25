-- ============================================================================
-- Compas — RLS et fonctions de `trip_invitations` (PLAN-100 2.4).
-- ----------------------------------------------------------------------------
-- Règles éprouvées :
--   - un LIEN d'invitation (invitee_id nul, jeton réutilisable) n'est lisible
--     que des éditeurs du voyage (faille du 8 oct. : un simple lecteur, ou
--     n'importe qui sur un voyage public, lisait le jeton puis devenait
--     éditeur) ; une invitation nominative reste lisible des lecteurs ;
--   - créer ou annuler une invitation exige can_edit_trip, et `invited_by`
--     est la personne connectée ; un rôle `owner` est refusé par la base ;
--   - une session d'essai (JWT is_anonymous) n'écrit pas d'invitation
--     (politique RESTRICTIVE `essai_sans_ecriture_publique`) ;
--   - la seule voie d'entrée dans un voyage est `respond_trip_invitation`
--     (jamais une écriture directe dans trip_collaborators) ; un lien ne
--     promeut pas un collaborateur existant ; anonyme : refusé.
-- Fixtures : A propriétaire ; E éditeur et V lecteur du voyage privé P ;
-- S invité nominatif ; X étranger ; U voyage public.
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(47);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('c3a50000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'inv_a@test.local', 'x', '{}', '{}', now(), now()),
  ('c3a50000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'inv_e@test.local', 'x', '{}', '{}', now(), now()),
  ('c3a50000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'inv_v@test.local', 'x', '{}', '{}', now(), now()),
  ('c3a50000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'inv_s@test.local', 'x', '{}', '{}', now(), now()),
  ('c3a50000-0000-4000-8000-0000000000a5', 'authenticated', 'authenticated', 'inv_x@test.local', 'x', '{}', '{}', now(), now());

INSERT INTO public.trips (id, slug, title, user_id, visibility)
VALUES
  ('c3a50000-0000-4000-8000-0000000000b1', 'rls-inv-prive', 'Voyage privé P', 'c3a50000-0000-4000-8000-0000000000a1', 'private'),
  ('c3a50000-0000-4000-8000-0000000000b2', 'rls-inv-public', 'Voyage public U', 'c3a50000-0000-4000-8000-0000000000a1', 'public');

INSERT INTO public.trip_collaborators (trip_id, user_id, role, invited_by)
VALUES
  ('c3a50000-0000-4000-8000-0000000000b1', 'c3a50000-0000-4000-8000-0000000000a2', 'editor', 'c3a50000-0000-4000-8000-0000000000a1'),
  ('c3a50000-0000-4000-8000-0000000000b1', 'c3a50000-0000-4000-8000-0000000000a3', 'viewer', 'c3a50000-0000-4000-8000-0000000000a1');

-- d1 : lien éditeur sur P ; d2 : lien lecteur sur P (sera annulé) ;
-- d3 : invitation nominative de S sur P ; d4 : invitation de X sur P, expirée ;
-- d5 : lien lecteur sur le voyage PUBLIC U.
INSERT INTO public.trip_invitations (id, trip_id, invitee_id, invited_by, role, token, expires_at)
VALUES
  ('c3a50000-0000-4000-8000-0000000000d1', 'c3a50000-0000-4000-8000-0000000000b1', NULL, 'c3a50000-0000-4000-8000-0000000000a1', 'editor', 'lienEditeurP0000000000000001', now() + interval '10 days'),
  ('c3a50000-0000-4000-8000-0000000000d2', 'c3a50000-0000-4000-8000-0000000000b1', NULL, 'c3a50000-0000-4000-8000-0000000000a1', 'viewer', 'lienLecteurP0000000000000002', now() + interval '10 days'),
  ('c3a50000-0000-4000-8000-0000000000d3', 'c3a50000-0000-4000-8000-0000000000b1', 'c3a50000-0000-4000-8000-0000000000a4', 'c3a50000-0000-4000-8000-0000000000a1', 'viewer', 'nominativeS000000000000000003', now() + interval '10 days'),
  ('c3a50000-0000-4000-8000-0000000000d4', 'c3a50000-0000-4000-8000-0000000000b1', 'c3a50000-0000-4000-8000-0000000000a5', 'c3a50000-0000-4000-8000-0000000000a1', 'viewer', 'expireeX0000000000000000004', now() - interval '1 day'),
  ('c3a50000-0000-4000-8000-0000000000d5', 'c3a50000-0000-4000-8000-0000000000b2', NULL, 'c3a50000-0000-4000-8000-0000000000a1', 'viewer', 'lienPublicU0000000000000005', now() + interval '10 days');

-- ============================================================================
-- A — propriétaire : voit tout
-- ============================================================================
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c3a50000-0000-4000-8000-0000000000a1';

SELECT is(
  (SELECT count(*)::int FROM public.trip_invitations WHERE id::text LIKE 'c3a50000-%d_'),
  5,
  '1. A lit les cinq invitations de ses voyages (liens compris)'
);

-- ============================================================================
-- E — éditeur de P : voit les liens de P, en crée, en annule
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'c3a50000-0000-4000-8000-0000000000a2';

SELECT is(
  (SELECT count(*)::int FROM public.trip_invitations WHERE id::text LIKE 'c3a50000-%d_'),
  4,
  '2. E lit les quatre invitations de P (liens et nominatives), pas le lien du voyage public U'
);
SELECT isnt_empty(
  $$ SELECT token FROM public.trip_invitations WHERE id = 'c3a50000-0000-4000-8000-0000000000d1' $$,
  '3. E lit le jeton du lien de P (il doit pouvoir le partager)'
);
SELECT lives_ok(
  $$ INSERT INTO public.trip_invitations (trip_id, invited_by, role) VALUES ('c3a50000-0000-4000-8000-0000000000b1', 'c3a50000-0000-4000-8000-0000000000a2', 'viewer') $$,
  '4. E crée un lien d''invitation en son nom'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_invitations (trip_id, invited_by, role) VALUES ('c3a50000-0000-4000-8000-0000000000b1', 'c3a50000-0000-4000-8000-0000000000a1', 'viewer') $$,
  '42501',
  'new row violates row-level security policy for table "trip_invitations"',
  '5. E n''écrit pas une invitation au nom de A (invited_by = personne connectée)'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_invitations (trip_id, invited_by, role) VALUES ('c3a50000-0000-4000-8000-0000000000b1', 'c3a50000-0000-4000-8000-0000000000a2', 'owner') $$,
  '23514',
  NULL,
  '6. E ne crée pas une invitation au rôle owner (contrainte de la table)'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_invitations (trip_id, invited_by, role) VALUES ('c3a50000-0000-4000-8000-0000000000b2', 'c3a50000-0000-4000-8000-0000000000a2', 'viewer') $$,
  '42501',
  'new row violates row-level security policy for table "trip_invitations"',
  '7. E n''invite pas sur U : lecteur seulement du voyage public'
);
SELECT isnt_empty(
  $$ UPDATE public.trip_invitations SET status = 'cancelled' WHERE id = 'c3a50000-0000-4000-8000-0000000000d2' RETURNING id $$,
  '8. E annule le lien d2 de P'
);
SELECT is_empty(
  $$ UPDATE public.trip_invitations SET status = 'cancelled' WHERE id = 'c3a50000-0000-4000-8000-0000000000d5' RETURNING id $$,
  '9. E n''annule pas le lien d5 d''un voyage qu''il ne peut pas modifier'
);

-- ============================================================================
-- V — lecteur de P : jamais un jeton de lien
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'c3a50000-0000-4000-8000-0000000000a3';

SELECT is(
  (SELECT count(*)::int FROM public.trip_invitations WHERE id::text LIKE 'c3a50000-%d_'),
  2,
  '10. V lit seulement les invitations nominatives de P (d3, d4)'
);
SELECT is_empty(
  $$ SELECT token FROM public.trip_invitations WHERE invitee_id IS NULL $$,
  '11. V ne lit aucun lien d''invitation (ni sur P, ni sur le voyage public U)'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_invitations (trip_id, invited_by, role) VALUES ('c3a50000-0000-4000-8000-0000000000b1', 'c3a50000-0000-4000-8000-0000000000a3', 'editor') $$,
  '42501',
  'new row violates row-level security policy for table "trip_invitations"',
  '12. V ne crée aucune invitation'
);
SELECT is_empty(
  $$ UPDATE public.trip_invitations SET status = 'cancelled' WHERE id = 'c3a50000-0000-4000-8000-0000000000d3' RETURNING id $$,
  '13. V n''annule aucune invitation'
);
SELECT is_empty(
  $$ UPDATE public.trip_collaborators SET role = 'editor' WHERE trip_id = 'c3a50000-0000-4000-8000-0000000000b1' AND user_id = 'c3a50000-0000-4000-8000-0000000000a3' RETURNING id $$,
  '14. V ne se promeut pas éditeur par écriture directe dans trip_collaborators'
);
-- Un lien « éditeur » ne promeut pas un collaborateur déjà présent : il reste lecteur.
SELECT is(
  (SELECT public.respond_trip_invitation(NULL, 'lienEditeurP0000000000000001', true)),
  'c3a50000-0000-4000-8000-0000000000b1'::uuid,
  '15. V ouvre le lien éditeur de P : la fonction répond avec le voyage'
);
SELECT is(
  (SELECT role::text FROM public.trip_collaborators
    WHERE trip_id = 'c3a50000-0000-4000-8000-0000000000b1' AND user_id = 'c3a50000-0000-4000-8000-0000000000a3'),
  'viewer',
  '16. V reste lecteur : un lien n''élève pas un collaborateur existant'
);
SELECT ok(
  NOT public.can_edit_trip('c3a50000-0000-4000-8000-0000000000b1'),
  '17. can_edit_trip reste faux pour V sur P'
);

-- ============================================================================
-- X — étranger connecté : ni lecture, ni écriture ; entre par la fonction
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'c3a50000-0000-4000-8000-0000000000a5';

SELECT is(
  (SELECT count(*)::int FROM public.trip_invitations WHERE id::text LIKE 'c3a50000-%d_'),
  1,
  '18. X lit sa seule invitation nominative (d4, expirée)'
);
SELECT throws_ok(
  $$ SELECT public.respond_trip_invitation('c3a50000-0000-4000-8000-0000000000d3', NULL, true) $$,
  'P0001',
  'not invitee',
  '19. X ne répond pas à l''invitation nominative de S'
);
SELECT throws_ok(
  $$ SELECT public.respond_trip_invitation('c3a50000-0000-4000-8000-0000000000d4', NULL, true) $$,
  'P0001',
  'invitation closed',
  '20. X n''accepte pas sa propre invitation expirée'
);
SELECT throws_ok(
  $$ SELECT public.respond_trip_invitation(NULL, 'lienLecteurP0000000000000002', true) $$,
  'P0001',
  'invitation closed',
  '21. X n''utilise pas un lien annulé par un éditeur'
);
SELECT throws_ok(
  $$ SELECT public.respond_trip_invitation(NULL, 'jeton-inconnu-0000000000', true) $$,
  'P0001',
  'invitation not found',
  '22. X n''utilise pas un jeton inconnu'
);
SELECT is(
  (SELECT public.respond_trip_invitation(NULL, 'lienEditeurP0000000000000001', true)),
  'c3a50000-0000-4000-8000-0000000000b1'::uuid,
  '23. X accepte le lien éditeur de P'
);
SELECT ok(
  public.can_edit_trip('c3a50000-0000-4000-8000-0000000000b1'),
  '24. X est devenu éditeur de P par le lien (rôle du lien)'
);

-- ============================================================================
-- S — invité nominatif : voit la sienne, accepte une fois
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'c3a50000-0000-4000-8000-0000000000a4';

SELECT is(
  (SELECT count(*)::int FROM public.trip_invitations WHERE id::text LIKE 'c3a50000-%d_'),
  1,
  '25. S lit sa seule invitation (d3), ni les liens ni celle de X'
);
SELECT is(
  (SELECT count(*)::int FROM public.my_trip_invitations()),
  1,
  '26. my_trip_invitations : S voit son invitation en attente'
);
SELECT ok(
  (SELECT for_me AND NOT already_member AND NOT expired FROM public.trip_invitation_preview('nominativeS000000000000000003')),
  '27. trip_invitation_preview : l''invitation est pour S, qui n''est pas encore membre'
);
SELECT is_empty(
  $$ SELECT * FROM public.trip_invitation_preview('court') $$,
  '28. trip_invitation_preview : un jeton trop court ne renvoie rien'
);
SELECT is_empty(
  $$ UPDATE public.trip_invitations SET status = 'accepted' WHERE id = 'c3a50000-0000-4000-8000-0000000000d3' RETURNING id $$,
  '29. S ne marque pas lui-même son invitation acceptée (seule la fonction ouvre l''accès)'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_collaborators (trip_id, user_id, role) VALUES ('c3a50000-0000-4000-8000-0000000000b1', 'c3a50000-0000-4000-8000-0000000000a4', 'viewer') $$,
  '42501',
  'new row violates row-level security policy for table "trip_collaborators"',
  '30. S ne s''ajoute pas lui-même à trip_collaborators'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_invitations (trip_id, invited_by, role) VALUES ('c3a50000-0000-4000-8000-0000000000b1', 'c3a50000-0000-4000-8000-0000000000a4', 'viewer') $$,
  '42501',
  'new row violates row-level security policy for table "trip_invitations"',
  '31. S n''invite personne sur P'
);
SELECT ok(
  NOT public.can_read_trip('c3a50000-0000-4000-8000-0000000000b1'),
  '32. S ne lit pas encore P'
);
SELECT is(
  (SELECT public.respond_trip_invitation('c3a50000-0000-4000-8000-0000000000d3', NULL, true)),
  'c3a50000-0000-4000-8000-0000000000b1'::uuid,
  '33. S accepte son invitation nominative'
);
SELECT ok(
  public.can_read_trip('c3a50000-0000-4000-8000-0000000000b1') AND NOT public.can_edit_trip('c3a50000-0000-4000-8000-0000000000b1'),
  '34. S lit désormais P, avec le rôle de l''invitation (lecteur)'
);
SELECT is(
  (SELECT status FROM public.trip_invitations WHERE id = 'c3a50000-0000-4000-8000-0000000000d3'),
  'accepted',
  '35. l''invitation de S est marquée acceptée'
);
SELECT throws_ok(
  $$ SELECT public.respond_trip_invitation('c3a50000-0000-4000-8000-0000000000d3', NULL, true) $$,
  'P0001',
  'invitation closed',
  '36. S ne peut pas l''accepter une seconde fois'
);

-- ============================================================================
-- Session d'essai (sans compte) : propriétaire, mais pas d'écriture d'invitation
-- ============================================================================
SET LOCAL "request.jwt.claim.sub" = 'c3a50000-0000-4000-8000-0000000000a1';
SET LOCAL "request.jwt.claims" = '{"sub":"c3a50000-0000-4000-8000-0000000000a1","role":"authenticated","is_anonymous":true}';

SELECT throws_ok(
  $$ INSERT INTO public.trip_invitations (trip_id, invited_by, role) VALUES ('c3a50000-0000-4000-8000-0000000000b1', 'c3a50000-0000-4000-8000-0000000000a1', 'viewer') $$,
  '42501',
  'new row violates row-level security policy "essai_sans_ecriture_publique" for table "trip_invitations"',
  '37. une session d''essai propriétaire du voyage ne crée aucune invitation'
);

SET LOCAL "request.jwt.claims" = '{"sub":"c3a50000-0000-4000-8000-0000000000a1","role":"authenticated","is_anonymous":false}';

SELECT lives_ok(
  $$ INSERT INTO public.trip_invitations (trip_id, invited_by, role) VALUES ('c3a50000-0000-4000-8000-0000000000b1', 'c3a50000-0000-4000-8000-0000000000a1', 'viewer') $$,
  '38. le même propriétaire avec un compte crée l''invitation (la politique d''essai est bien la cause du refus)'
);

-- ============================================================================
-- Anonyme
-- ============================================================================
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '';

SELECT is_empty(
  $$ SELECT id FROM public.trip_invitations $$,
  '39. anonyme ne lit aucune invitation (ni sur le voyage public U)'
);
SELECT throws_ok(
  $$ INSERT INTO public.trip_invitations (trip_id, invited_by, role) VALUES ('c3a50000-0000-4000-8000-0000000000b2', 'c3a50000-0000-4000-8000-0000000000a1', 'editor') $$,
  '42501',
  'new row violates row-level security policy for table "trip_invitations"',
  '40. anonyme ne crée aucune invitation'
);
SELECT is_empty(
  $$ UPDATE public.trip_invitations SET status = 'cancelled' RETURNING id $$,
  '41. anonyme n''annule aucune invitation'
);
SELECT throws_ok(
  $$ SELECT public.respond_trip_invitation(NULL, 'lienPublicU0000000000000005', true) $$,
  '42501',
  'permission denied for function respond_trip_invitation',
  '42. anonyme ne répond à aucune invitation (EXECUTE réservé aux comptes connectés)'
);
SELECT throws_ok(
  $$ SELECT * FROM public.my_trip_invitations() $$,
  '42501',
  'permission denied for function my_trip_invitations',
  '43. anonyme n''appelle pas my_trip_invitations'
);
SELECT throws_ok(
  $$ SELECT * FROM public.trip_invitation_preview('lienPublicU0000000000000005') $$,
  '42501',
  'permission denied for function trip_invitation_preview',
  '44. anonyme n''appelle pas trip_invitation_preview'
);

-- ============================================================================
-- Relecture sans RLS
-- ============================================================================
RESET ROLE;

SELECT is(
  (SELECT status FROM public.trip_invitations WHERE id = 'c3a50000-0000-4000-8000-0000000000d1'),
  'pending',
  '45. le lien d1 reste ouvert après usage (réutilisable)'
);
SELECT is(
  (SELECT status FROM public.trip_invitations WHERE id = 'c3a50000-0000-4000-8000-0000000000d2'),
  'cancelled',
  '46. le lien d2 est annulé'
);
SELECT is(
  (SELECT string_agg(user_id::text || ':' || role::text, ',' ORDER BY user_id::text)
     FROM public.trip_collaborators WHERE trip_id = 'c3a50000-0000-4000-8000-0000000000b1'),
  'c3a50000-0000-4000-8000-0000000000a1:owner,c3a50000-0000-4000-8000-0000000000a2:editor,c3a50000-0000-4000-8000-0000000000a3:viewer,c3a50000-0000-4000-8000-0000000000a4:viewer,c3a50000-0000-4000-8000-0000000000a5:editor',
  '47. P a cinq membres : A owner, E éditeur, V lecteur, S lecteur (invitation), X éditeur (lien)'
);

SELECT * FROM finish();
ROLLBACK;
