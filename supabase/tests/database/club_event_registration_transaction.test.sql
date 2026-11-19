BEGIN;
SELECT plan(19);

INSERT INTO auth.users (id, email) VALUES
  ('abca00c0-0000-4000-8000-000000000001', 'club-tx-owner@example.test'),
  ('abca00c0-0000-4000-8000-000000000002', 'club-tx-first@example.test'),
  ('abca00c0-0000-4000-8000-000000000003', 'club-tx-second@example.test'),
  ('abca00c0-0000-4000-8000-000000000004', 'club-tx-third@example.test'),
  ('abca00c0-0000-4000-8000-000000000005', 'club-tx-guest@example.test');

INSERT INTO public.clubs (id, slug, name, privacy, created_by) VALUES
  ('abca00c0-1000-4000-8000-000000000001', 'club-transaction-test', 'Club Transaction', 'open', 'abca00c0-0000-4000-8000-000000000001');

INSERT INTO public.club_events (id, club_id, organizer_id, title, event_date, max_participants, waitlist_enabled, visibility) VALUES
  ('abca00c0-2000-4000-8000-000000000001', 'abca00c0-1000-4000-8000-000000000001', 'abca00c0-0000-4000-8000-000000000001',
    'Une place et de l’attente', now() + interval '1 day', 1, true, 'public'),
  ('abca00c0-2000-4000-8000-000000000002', 'abca00c0-1000-4000-8000-000000000001', 'abca00c0-0000-4000-8000-000000000001',
    'Une place sans attente', now() + interval '1 day', 1, false, 'public'),
  ('abca00c0-2000-4000-8000-000000000003', 'abca00c0-1000-4000-8000-000000000001', 'abca00c0-0000-4000-8000-000000000001',
    'Invitation privée', now() + interval '1 day', 1, true, 'private');

INSERT INTO public.club_invites (token, kind, target_id, club_id, created_by, max_uses) VALUES
  ('recette-capacite-pleine', 'event', 'abca00c0-2000-4000-8000-000000000002', 'abca00c0-1000-4000-8000-000000000001',
    'abca00c0-0000-4000-8000-000000000001', 1),
  ('recette-invitation-privee', 'event', 'abca00c0-2000-4000-8000-000000000003', 'abca00c0-1000-4000-8000-000000000001',
    'abca00c0-0000-4000-8000-000000000001', 1),
  ('recette-emetteur-invalide', 'event', 'abca00c0-2000-4000-8000-000000000003', 'abca00c0-1000-4000-8000-000000000001',
    'abca00c0-0000-4000-8000-000000000004', 1);

SELECT ok(NOT has_function_privilege('anon', 'public.transact_club_event_registration(uuid,boolean,text,text)', 'EXECUTE'),
  'La transaction est réservée à une session authentifiée');
SELECT ok(NOT has_table_privilege('authenticated', 'public.club_event_registrations', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.club_event_participants', 'INSERT'),
  'Les deux registres refusent les écritures directes du client');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'abca00c0-0000-4000-8000-000000000002', true);
SELECT is(public.transact_club_event_registration('abca00c0-2000-4000-8000-000000000001', true) #>> '{registration,status}',
  'registered', 'La première demande obtient la place');
SELECT is(public.transact_club_event_registration('abca00c0-2000-4000-8000-000000000001', true) #>> '{registration,status}',
  'registered', 'Une répétition conserve la même inscription');
SELECT is(public.transact_club_event_registration('abca00c0-2000-4000-8000-000000000002', true) #>> '{registration,status}',
  'registered', 'L’autre sortie a sa propre capacité');

SELECT set_config('request.jwt.claim.sub', 'abca00c0-0000-4000-8000-000000000003', true);
SELECT is(public.transact_club_event_registration('abca00c0-2000-4000-8000-000000000001', true) #>> '{registration,status}',
  'waitlist', 'La personne suivante entre en attente');

SELECT set_config('request.jwt.claim.sub', 'abca00c0-0000-4000-8000-000000000004', true);
SELECT is(public.transact_club_event_registration('abca00c0-2000-4000-8000-000000000001', true) #>> '{registration,status}',
  'waitlist', 'Une troisième demande entre en attente');
SELECT throws_ok(
  $$ SELECT public.transact_club_event_registration('abca00c0-2000-4000-8000-000000000002', true, NULL, 'recette-capacite-pleine') $$,
  '23514', 'Cette sortie est complète.', 'Une invitation ne contourne pas une sortie complète sans attente');

SELECT set_config('request.jwt.claim.sub', 'abca00c0-0000-4000-8000-000000000002', true);
SELECT is(public.transact_club_event_registration('abca00c0-2000-4000-8000-000000000001', false) #>> '{registration,status}',
  'cancelled', 'Le retrait est enregistré');
SELECT is(public.transact_club_event_registration('abca00c0-2000-4000-8000-000000000001', false) #>> '{registration,status}',
  'cancelled', 'La répétition du retrait est sans effet supplémentaire');

RESET ROLE;
SELECT is((SELECT status FROM public.club_event_registrations
  WHERE event_id = 'abca00c0-2000-4000-8000-000000000001' AND user_id = 'abca00c0-0000-4000-8000-000000000003'),
  'registered', 'Le premier de la liste est promu');
SELECT is((SELECT status FROM public.club_event_registrations
  WHERE event_id = 'abca00c0-2000-4000-8000-000000000001' AND user_id = 'abca00c0-0000-4000-8000-000000000004'),
  'waitlist', 'La seconde personne conserve sa position');
SELECT is((SELECT participants_count FROM public.club_events WHERE id = 'abca00c0-2000-4000-8000-000000000001'),
  1, 'Le décompte du club inclut le participant promu');
SELECT is((SELECT uses_count FROM public.club_invites WHERE token = 'recette-capacite-pleine'),
  0, 'Une demande impossible ne consomme pas l’invitation');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'abca00c0-0000-4000-8000-000000000005', true);
SELECT throws_ok(
  $$ SELECT public.transact_club_event_registration('abca00c0-2000-4000-8000-000000000003', true) $$,
  '42501', 'Adhésion ou invitation requise.', 'Le tiers ne peut s’inscrire à l’évènement privé');
SELECT throws_ok(
  $$ SELECT public.transact_club_event_registration('abca00c0-2000-4000-8000-000000000003', true, NULL, 'recette-emetteur-invalide') $$,
  'P0002', 'Invitation invalide ou expirée.', 'Le lien doit provenir d’un émetteur habilité');
SELECT is(public.transact_club_event_registration('abca00c0-2000-4000-8000-000000000003', true, NULL, 'recette-invitation-privee') #>> '{registration,status}',
  'registered', 'L’invitation valide crée l’inscription');
SELECT is(public.transact_club_event_registration('abca00c0-2000-4000-8000-000000000003', true, NULL, 'recette-invitation-privee') ->> 'uses_count',
  '1', 'Une répétition ne consomme pas une seconde utilisation');
SELECT throws_ok(
  $$ SELECT public.lkdv_redeem_club_invite('recette-invitation-privee') $$,
  'P0002', 'Invitation invalide, expirée ou épuisée.', 'La consommation seule est fermée pour une invitation de sortie');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
