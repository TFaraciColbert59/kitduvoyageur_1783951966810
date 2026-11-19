\set owner 'abca11e0-0000-4000-8000-000000000001'
\set confirmed 'abca11e0-0000-4000-8000-000000000002'
\set standby 'abca11e0-0000-4000-8000-000000000003'
\set outsider 'abca11e0-0000-4000-8000-000000000004'
\set legacy 'abca11e0-0000-4000-8000-000000000005'
\set club 'abca11e0-1000-4000-8000-000000000001'
\set event 'abca11e0-2000-4000-8000-000000000001'
\set other_event 'abca11e0-2000-4000-8000-000000000002'
\set trip1 'abca11e0-3000-4000-8000-000000000001'
\set trip2 'abca11e0-3000-4000-8000-000000000002'
\set foreign_trip 'abca11e0-3000-4000-8000-000000000003'

BEGIN;
SELECT plan(25);

INSERT INTO auth.users (id, email) VALUES
  (:'owner', 'event-link-owner@example.test'),
  (:'confirmed', 'event-link-confirmed@example.test'),
  (:'standby', 'event-link-waitlist@example.test'),
  (:'outsider', 'event-link-outsider@example.test'),
  (:'legacy', 'event-link-legacy@example.test');

INSERT INTO public.clubs (id, slug, name, privacy, created_by)
VALUES (:'club', 'test-lien-aventure', 'Club recette', 'open', :'owner');

INSERT INTO public.club_events (id, club_id, organizer_id, title, event_date, max_participants, route_id, route_revision)
VALUES (:'event', :'club', :'owner', 'Sortie du dimanche', now() + interval '1 day', 2, 'trace-r1', 3),
       (:'other_event', :'club', :'owner', 'Sortie du dimanche', now() - interval '2 days', 0, NULL, 0);

INSERT INTO public.events (id, organizer_id, title, event_date, max_participants, waitlist_enabled)
VALUES (:'event', :'owner', 'Sortie du dimanche', current_date + 1, 1, true);

INSERT INTO public.trips (id, user_id, title, slug, visibility, estimated_budget) VALUES
  (:'trip1', :'owner', 'Sortie du dimanche', 'lien-aventure-club', 'private', 600),
  (:'trip2', :'owner', 'Sortie du dimanche', 'lien-aventure-communaute', 'private', NULL),
  (:'foreign_trip', :'outsider', 'Sortie du dimanche', 'lien-aventure-tiers', 'private', NULL);

INSERT INTO public.trip_steps (trip_id, day_number, order_index, title, description)
VALUES (:'trip1', 1, 1, 'Départ réel', 'Note du propriétaire');

INSERT INTO public.club_event_participants (event_id, user_id) VALUES (:'other_event', :'legacy');

SELECT ok(NOT has_function_privilege('anon', 'public.resolve_event_trip(text, uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.set_event_trip(text, uuid, uuid)', 'EXECUTE'),
  'Résolution et modification requièrent une session');
SELECT ok(NOT has_table_privilege('authenticated', 'trip_private.event_trip_links', 'SELECT,INSERT,UPDATE,DELETE')
  AND NOT has_table_privilege('authenticated', 'trip_private.visible_event_trip_links', 'SELECT'),
  'La table et la vue internes restent privées');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'owner', true);
SELECT is((SELECT count(*) FROM public.resolve_event_trip('club_event', :'event')), 0::bigint,
  'Les titres et UUID communs ne créent aucun lien implicite');
SELECT throws_ok(format('SELECT public.set_event_trip(%L, %L, %L)', 'club_event', :'event', :'foreign_trip'),
  '42501', 'Aventure indisponible.', 'Un organisateur ne peut pas partager le voyage d’un tiers');
SELECT lives_ok(format('SELECT public.set_event_trip(%L, %L, %L)', 'club_event', :'event', :'trip1'),
  'L’organisateur relie son voyage à l’événement de club');
SELECT lives_ok(format('SELECT public.set_event_trip(%L, %L, %L)', 'community_event', :'event', :'trip2'),
  'Le même UUID sur la source communauté est indépendant');
SELECT lives_ok(format('SELECT public.set_event_trip(%L, %L, %L)', 'club_event', :'other_event', :'trip1'),
  'Un événement historique peut pointer vers le même voyage existant');
SELECT results_eq(format('SELECT id, organizer_id, route_revision FROM public.resolve_event_trip(%L, %L)', 'club_event', :'event'),
  format('VALUES (%L::uuid, %L::uuid, 3)', :'trip1', :'owner'), 'Le lien du club résout le voyage, le propriétaire et la révision');
SELECT is((SELECT id FROM public.resolve_event_trip('community_event', :'event')), :'trip2'::uuid,
  'Le lien communauté résout son propre voyage');

SELECT set_config('request.jwt.claim.sub', :'confirmed', true);
SELECT throws_ok(format('SELECT public.set_event_trip(%L, %L, NULL)', 'club_event', :'event'),
  '42501', 'Action réservée à l’organisateur.', 'Un inscrit ne peut pas retirer le lien');
SELECT is((SELECT count(*) FROM public.get_confirmed_trip_overview()), 0::bigint, 'Accès fermé avant inscription');
SELECT public.transact_club_event_registration(:'event', true);
SELECT public.join_event(:'event');
SELECT is((SELECT count(*) FROM public.get_confirmed_trip_overview()), 2::bigint, 'Les deux sources confirmées alimentent la même liste');
SELECT is(
  (SELECT steps #>> '{0,title}' FROM public.get_confirmed_trip_overview('lien-aventure-club')),
  'Départ réel', 'L’étape provient du voyage déjà enregistré');
SELECT ok(
  (SELECT NOT (steps -> 0 ? 'description') AND NOT (to_jsonb(o) ?| ARRAY['estimated_budget', 'share_token'])
    FROM public.get_confirmed_trip_overview('lien-aventure-club') AS o)
  AND NOT EXISTS (SELECT 1 FROM public.trips WHERE id = :'trip1'),
  'L’inscription n’ouvre pas les champs privés ou la table du voyage');

SELECT set_config('request.jwt.claim.sub', :'legacy', true);
SELECT is((SELECT id FROM public.resolve_event_trip('club_event', :'other_event')), :'trip1'::uuid,
  'Un RSVP historique admissible ouvre le même itinéraire');
SELECT public.transact_club_event_registration(:'event', true);
SELECT is((SELECT count(*) FROM public.get_confirmed_trip_overview()), 1::bigint,
  'Deux inscriptions confirmées au même voyage donnent une seule aventure');

SELECT set_config('request.jwt.claim.sub', :'standby', true);
SELECT public.transact_club_event_registration(:'event', true);
SELECT public.join_event(:'event');
SELECT is((SELECT count(*) FROM public.get_confirmed_trip_overview()), 0::bigint, 'Les personnes en attente ne reçoivent aucun itinéraire');

SELECT set_config('request.jwt.claim.sub', :'confirmed', true);
SELECT public.transact_club_event_registration(:'event', false);
SELECT is((SELECT count(*) FROM public.resolve_event_trip('club_event', :'event')), 0::bigint, 'Le retrait ferme immédiatement l’itinéraire du club');

RESET ROLE;
UPDATE public.events SET status = 'cancelled' WHERE id = :'event';
INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES (:'owner', :'standby');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'confirmed', true);
SELECT is((SELECT count(*) FROM public.get_confirmed_trip_overview()), 0::bigint, 'L’annulation communauté ferme sa projection');
SELECT set_config('request.jwt.claim.sub', :'standby', true);
SELECT is((SELECT count(*) FROM public.resolve_event_trip('club_event', :'event')), 0::bigint,
  'Même après promotion, un blocage de l’organisateur ferme l’accès');

RESET ROLE;
UPDATE public.club_events SET organizer_id = :'outsider' WHERE id = :'other_event';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'legacy', true);
SELECT is((SELECT count(*) FROM public.resolve_event_trip('club_event', :'other_event')), 0::bigint,
  'Le transfert d’organisation invalide le lien ancien');
SELECT set_config('request.jwt.claim.sub', :'owner', true);
SELECT lives_ok(format('SELECT public.set_event_trip(%L, %L, NULL)', 'club_event', :'event'),
  'L’organisateur peut délier son itinéraire');
SELECT is((SELECT count(*) FROM public.resolve_event_trip('club_event', :'event')), 0::bigint, 'Le lien retiré ne résout plus rien');

RESET ROLE;
\ir ../../migrations_down/20261119202544_cancel_club_event.down.sql
\ir ../../migrations_down/20261119195142_link_events_to_canonical_trips.down.sql
SELECT ok(to_regclass('trip_private.event_trip_links') IS NULL
  AND to_regprocedure('public.resolve_event_trip(text,uuid)') IS NULL,
  'Le retour arrière retire le lien et sa résolution');
SELECT ok(EXISTS (SELECT 1 FROM public.trips WHERE id = :'trip1')
  AND EXISTS (SELECT 1 FROM public.club_event_participants WHERE event_id = :'other_event' AND user_id = :'legacy')
  AND EXISTS (SELECT 1 FROM public.event_participants WHERE event_id = :'event' AND user_id = :'confirmed'),
  'Le retour arrière conserve le voyage et les inscriptions sources');
SELECT * FROM finish();
ROLLBACK;
