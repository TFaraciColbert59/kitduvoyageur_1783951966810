\set owner 'abca22c0-0000-4000-8000-000000000001'
\set confirmed 'abca22c0-0000-4000-8000-000000000002'
\set standby 'abca22c0-0000-4000-8000-000000000003'
\set legacy 'abca22c0-0000-4000-8000-000000000004'
\set club 'abca22c0-1000-4000-8000-000000000001'
\set event 'abca22c0-2000-4000-8000-000000000001'
\set historic 'abca22c0-2000-4000-8000-000000000002'
\set trip 'abca22c0-3000-4000-8000-000000000001'

BEGIN;
SELECT plan(25);
INSERT INTO auth.users (id, email) VALUES
  (:'owner', 'club-event-cancel-owner@example.test'),
  (:'confirmed', 'club-event-cancel-confirmed@example.test'),
  (:'standby', 'club-event-cancel-standby@example.test'),
  (:'legacy', 'club-event-cancel-legacy@example.test');
INSERT INTO public.clubs (id, slug, name, privacy, created_by)
VALUES (:'club', 'club-event-cancel-test', 'Club recette annulation', 'open', :'owner');
INSERT INTO public.club_events (id, club_id, organizer_id, title, event_date, max_participants, waitlist_enabled) VALUES
  (:'event', :'club', :'owner', 'Annulation de la sortie à venir', now() + interval '2 days', 1, true),
  (:'historic', :'club', :'owner', 'Annulation historique', now() - interval '5 days', 1, true);
INSERT INTO public.club_event_participants (event_id, user_id) VALUES (:'historic', :'legacy');
INSERT INTO public.club_invites (token, kind, target_id, club_id, created_by)
VALUES ('annulation-lien-recette', 'event', :'event', :'club', :'owner');
INSERT INTO public.trips (id, user_id, title, slug, visibility) VALUES (:'trip', :'owner', 'Sortie privée', 'club-event-cancel-private', 'private');

SELECT ok(NOT has_function_privilege('anon', 'public.cancel_club_event(uuid)', 'EXECUTE'),
  'L’annulation requiert une session');
SELECT ok(NOT has_function_privilege('authenticated', 'club_private.transact_open_club_event_registration(uuid,boolean,text,text)', 'EXECUTE'),
  'Le moteur interne ne permet pas de contourner le contrôle d’état');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'owner', true);
SELECT public.set_event_trip('club_event', :'event', :'trip');
SELECT public.set_event_trip('club_event', :'historic', :'trip');
SELECT throws_ok(format('UPDATE public.club_events SET cancelled_at = now() WHERE id = %L', :'event'),
  '42501', 'L’état d’annulation passe par la transaction de sortie.', 'L’écriture directe ne peut pas annuler une sortie');
SELECT throws_ok(format('INSERT INTO public.club_events (organizer_id,title,cancelled_at) VALUES (%L,%L,now())', :'owner', 'Création déjà annulée'),
  '42501', 'L’état d’annulation passe par la transaction de sortie.', 'La création directe ne peut pas fabriquer une annulation');

SELECT set_config('request.jwt.claim.sub', :'confirmed', true);
SELECT is(public.transact_club_event_registration(:'event', true, NULL, 'annulation-lien-recette') #>> '{registration,status}',
  'registered', 'Une inscription confirmée existe avant l’annulation');
SELECT is((SELECT count(*) FROM public.get_confirmed_trip_overview('club-event-cancel-private')), 1::bigint,
  'Le participant accède à l’itinéraire avant l’annulation');
SELECT throws_ok(format('SELECT public.cancel_club_event(%L)', :'event'), '42501', 'Action réservée à l’organisateur.',
  'Un participant ne peut pas annuler la sortie');

SELECT set_config('request.jwt.claim.sub', :'standby', true);
SELECT is(public.transact_club_event_registration(:'event', true) #>> '{registration,status}', 'waitlist',
  'La liste d’attente existe avant l’annulation');

SELECT set_config('request.jwt.claim.sub', :'owner', true);
SELECT lives_ok(format('SELECT public.cancel_club_event(%L)', :'event'), 'L’organisateur annule sa sortie');
SELECT ok((SELECT cancelled_at IS NOT NULL AND cancelled_by = :'owner' AND participants_count = 0
   FROM public.club_events WHERE id = :'event'), 'Auteur, heure et compteur sont enregistrés ensemble');
SELECT is(public.cancel_club_event(:'event'), (SELECT cancelled_at FROM public.club_events WHERE id = :'event'),
  'Une répétition conserve l’horodatage initial');
SELECT throws_ok(format('UPDATE public.club_events SET cancelled_at = NULL WHERE id = %L', :'event'),
  '42501', 'L’état d’annulation passe par la transaction de sortie.', 'La modification directe ne réactive pas la sortie');
SELECT is((SELECT count(*) FROM public.resolve_event_trip('club_event', :'event')), 0::bigint,
  'La fiche annulée ne résout plus le lien du HUB pour son organisateur');
SELECT throws_ok(format('SELECT public.set_event_trip(%L,%L,%L)', 'club_event', :'event', :'trip'),
  '55000', 'Cette sortie est annulée.', 'Le voyage privé ne peut pas être relié à une sortie annulée');

SELECT set_config('request.jwt.claim.sub', :'confirmed', true);
SELECT is((SELECT status FROM public.club_event_registrations_effective WHERE event_id = :'event' AND user_id = :'confirmed'),
  'cancelled', 'L’inscription confirmée affiche l’annulation');
SELECT is((SELECT count(*) FROM public.get_confirmed_trip_overview('club-event-cancel-private')), 0::bigint,
  'La participation annulée ne donne plus d’accès au voyage privé');
SELECT lives_ok(format('SELECT public.transact_club_event_registration(%L,false)', :'event'),
  'Un retrait répété après annulation ne déclenche aucune promotion');

SELECT set_config('request.jwt.claim.sub', :'standby', true);
SELECT is((SELECT status FROM public.club_event_registrations_effective WHERE event_id = :'event' AND user_id = :'standby'),
  'cancelled', 'La liste d’attente affiche aussi l’annulation');
SELECT throws_ok(format('SELECT public.transact_club_event_registration(%L,true,NULL,%L)', :'event', 'annulation-lien-recette'),
  '55000', 'Cette sortie est annulée.', 'L’invitation ne peut pas rouvrir une sortie annulée');
SELECT set_config('request.jwt.claim.sub', :'owner', true);
SELECT ok((SELECT revoked_at IS NOT NULL AND uses_count = 1 FROM public.club_invites WHERE token = 'annulation-lien-recette'),
  'Le lien est révoqué et son historique d’utilisation conservé');
SELECT public.cancel_club_event(:'historic');
SELECT set_config('request.jwt.claim.sub', :'legacy', true);
SELECT is((SELECT status FROM public.club_event_registrations_effective WHERE event_id = :'historic' AND user_id = :'legacy'),
  'cancelled', 'Le RSVP historique expose également l’annulation');

RESET ROLE;
SELECT is((SELECT status FROM public.club_event_registrations WHERE event_id = :'event' AND user_id = :'confirmed'),
  'registered', 'Le RSVP confirmé reste enregistré à des fins historiques');
SELECT is((SELECT status FROM public.club_event_registrations WHERE event_id = :'event' AND user_id = :'standby'),
  'waitlist', 'Le RSVP en attente reste enregistré sans promotion');
SELECT ok(EXISTS (SELECT 1 FROM public.club_event_participants WHERE event_id = :'historic' AND user_id = :'legacy')
  AND EXISTS (SELECT 1 FROM public.trips WHERE id = :'trip')
  AND NOT EXISTS (SELECT 1 FROM public.club_event_attendance WHERE event_id IN (:'event', :'historic')),
  'La sortie conserve son voyage et ses RSVP, sans inventer une présence');
SELECT throws_ok(format('INSERT INTO public.club_invites (token,kind,target_id,club_id,created_by) VALUES (%L,%L,%L,%L,%L)',
                        'annulation-nouveau-lien', 'event', :'event', :'club', :'owner'),
  '55000', 'Cette sortie est annulée.', 'Une nouvelle invitation ne peut pas viser une sortie annulée');
SELECT * FROM finish();
ROLLBACK;
