\set owner 'bbb31200-0000-4000-8000-000000000001'
\set confirmed 'bbb31200-0000-4000-8000-000000000002'
\set legacy 'bbb31200-0000-4000-8000-000000000003'
\set outsider 'bbb31200-0000-4000-8000-000000000004'
\set club 'bbb31200-1000-4000-8000-000000000001'
\set event 'bbb31200-2000-4000-8000-000000000001'
\set trip 'bbb31200-4000-4000-8000-000000000001'
\set canonical_revision 'bbb31200-3000-4000-8000-000000000001'
BEGIN;
SELECT plan(37);

INSERT INTO auth.users(id,email) VALUES
  (:'owner','rte-owner@example.test'), (:'confirmed','rte-confirmed@example.test'),
  (:'legacy','rte-legacy@example.test'), (:'outsider','rte-outsider@example.test');
INSERT INTO public.clubs(id,slug,name,privacy,created_by)
VALUES (:'club','club-test-route-publication','Club de la traversée','open',:'owner');
INSERT INTO public.club_events(id,club_id,organizer_id,title,event_date,meeting_point,lat,lng)
VALUES (:'event',:'club',:'owner','Traversée',now()+interval '2 days','Départ actuel',45,6);
INSERT INTO public.trips (id,user_id,title,slug,visibility)
VALUES (:'trip',:'owner','Traversée du club','test-route-journey','private');
INSERT INTO public.club_event_registrations(event_id,user_id,status) VALUES
  (:'event',:'confirmed','registered'),(:'event',:'outsider','waitlist');
INSERT INTO public.club_event_participants(event_id,user_id) VALUES (:'event',:'legacy');
INSERT INTO public.hiking_routes(id,name,distance_km) VALUES (925000912,'Le col des balcons',4.2);
INSERT INTO public.hiking_route_revisions(id,route_id,revision_number,geometry_hash,geom) VALUES
  (:'canonical_revision',925000912,1,'pinned-route-actual-geometry',
   ST_GeomFromText('MULTILINESTRING((6.0 45.0,6.08 45.06))',4326));

SELECT ok(NOT has_function_privilege('anon', 'public.publish_club_event_route(uuid,integer,bigint,text)', 'EXECUTE'),
  'La publication est réservée à une session');
SELECT ok(NOT has_table_privilege('authenticated', 'public.club_event_route_sync', 'INSERT, UPDATE'),
  'La synchronisation reste réservée à la transaction après les optimisations RLS');
SELECT ok(NOT has_table_privilege('authenticated', 'public.club_event_route_revisions', 'INSERT, UPDATE'),
  'Le client ne peut pas fabriquer une révision en écrivant dans la table');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'confirmed', true);
SELECT throws_ok(format('SELECT public.publish_club_event_route(%L,0,925000912,NULL)', :'event'),
  '42501', 'Publication réservée à l’organisateur ou à la modération du club.', 'Un inscrit ne peut pas publier');

SELECT set_config('request.jwt.claim.sub', :'owner', true);
SELECT public.set_event_trip('club_event', :'event', :'trip');
SELECT throws_ok(format('SELECT public.publish_club_event_route(%L,0,925000999,NULL)', :'event'),
  '22023', 'Tracé indisponible dans le catalogue.', 'Une référence sans route réelle est refusée');
SELECT throws_ok(format('UPDATE public.club_events SET route_revision=7 WHERE id=%L', :'event'),
  '42501', 'La révision du tracé passe par sa publication.', 'Une écriture directe ne peut pas avancer la révision');
SELECT is((SELECT route_revision FROM public.club_events WHERE id=:'event'), 0,
  'Un échec laisse le numéro initial intact');
SELECT is((public.publish_club_event_route(:'event',0,925000912,'Passerelle aval')->'snapshot'->>'revision')::integer, 1,
  'Le propriétaire publie la première proposition');
SELECT ok((SELECT canonical_revision_id=:'canonical_revision'::uuid AND distance_m>0
  AND elevation_gain_m IS NULL AND checksum='pinned-route-actual-geometry'
  FROM public.club_event_route_revisions WHERE event_id=:'event' AND revision=1),
  'La publication fixe la géométrie et conserve l’absence de dénivelé');
SELECT ok((SELECT meeting_point='Passerelle aval' AND lat IS NULL AND lng IS NULL
  FROM public.club_events WHERE id=:'event'), 'Un déplacement textuel efface les anciennes coordonnées');
SELECT throws_ok(format('SELECT public.publish_club_event_route(%L,0,925000912,%L)', :'event','Ancienne version du formulaire'),
  'PT409', 'Le parcours a changé. Actualise la fiche avant de publier.', 'Une version concurrente est refusée');
SELECT is((public.publish_club_event_route(:'event',1,925000912,'Passerelle aval')->'snapshot'->>'revision')::integer, 1,
  'La répétition identique ne republie pas et ne renotifie pas');

SELECT set_config('request.jwt.claim.sub', :'outsider', true);
SELECT is((SELECT count(*) FROM public.club_event_route_revisions WHERE event_id=:'event'), 0::bigint,
  'Une inscription en attente ne voit pas la proposition');
SELECT is(public.get_club_event_route_trace(:'event',1),NULL::jsonb,
  'Le tracé d’une proposition ne contourne pas les droits de lecture');
SELECT set_config('request.jwt.claim.sub', :'confirmed', true);
SELECT is((SELECT revision FROM public.club_event_route_revisions WHERE event_id=:'event'), 1,
  'L’inscrit confirmé lit la proposition');
SELECT is(public.get_club_event_route_trace(:'event',1)->>'type','MultiLineString',
  'La fiche lit la géométrie publiée depuis le catalogue');
SELECT ok((SELECT decision_pending AND adopted_revision IS NULL FROM public.get_trip_club_route_updates(:'trip')),
  'Le HUB du participant signale la proposition avant décision');
SELECT ok((public.save_event_route_state(:'event') @> '{"pending_revision":1,"adopted_revision":null}'),
  'Recevoir une révision ne vaut pas adoption');
SELECT ok((public.save_event_route_state(:'event',1,true) @> '{"pending_revision":null,"adopted_revision":1}'),
  'L’inscrit choisit explicitement le tracé proposé');
SELECT is((SELECT count(*) FROM public.club_event_route_decisions WHERE event_id=:'event'),1::bigint,
  'La première décision est conservée dans l’historique');
SELECT set_config('request.jwt.claim.sub', :'legacy', true);
SELECT is((SELECT revision FROM public.club_event_route_revisions WHERE event_id=:'event'), 1,
  'Le RSVP historique admissible lit la même proposition');
RESET ROLE;

SELECT is((SELECT count(*) FROM public.notifications WHERE related_id=:'event' AND type='club_route_revision'), 2::bigint,
  'Une notification par participant confirmé, sans notification au publieur ni à la liste d’attente');
SELECT is((SELECT count(DISTINCT message) FROM public.notifications WHERE related_id=:'event' AND type='club_route_revision'),1::bigint,
  'Les deux notifications visent la même révision');
SELECT ok((SELECT bool_and(link LIKE '/sorties/%?source=club#parcours') FROM public.notifications WHERE related_id=:'event'),
  'La notification ouvre la fiche du bon registre');

INSERT INTO public.hiking_route_revisions(id,route_id,revision_number,geometry_hash,geom) VALUES
  ('bbb31200-3000-4000-8000-000000000002',925000912,2,'nouvelle-géométrie',
   ST_GeomFromText('MULTILINESTRING((6.0 45.0,6.09 45.06))',4326));
UPDATE public.hiking_route_revisions SET is_current=false WHERE id=:'canonical_revision';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'owner', true);
SELECT is((public.publish_club_event_route(:'event',1,925000912,NULL)->'snapshot'->>'revision')::integer,2,
  'Une mise à jour réelle crée une révision suivante');
SELECT is((SELECT canonical_revision_id FROM public.club_event_route_revisions WHERE event_id=:'event' AND revision=1),
  :'canonical_revision'::uuid,'La première géométrie reste référencée');

SELECT set_config('request.jwt.claim.sub', :'confirmed', true);
SELECT throws_ok(format('SELECT public.save_event_route_state(%L,1,true)', :'event'),
  'PT409', 'Le parcours a changé. Actualise la fiche avant de répondre.', 'Une réponse sur la version précédente est refusée');
SELECT ok((public.save_event_route_state(:'event') @> '{"pending_revision":2,"adopted_revision":1}'),
  'Le participant reçoit la nouvelle version en conservant son ancienne variante');
SELECT ok((public.save_event_route_state(:'event',2,false) @> '{"pending_revision":null,"adopted_revision":1}'),
  'Garder son tracé conserve la dernière adoption');
SELECT ok((SELECT NOT decision_pending AND adopted_revision=1 FROM public.get_trip_club_route_updates(:'trip')),
  'Le HUB signale le tracé conservé après décision');
SELECT isnt(public.get_club_event_route_trace(:'event',1),public.get_club_event_route_trace(:'event',2),
  'Le tracé conservé et le proposé traversent la fiche sans écrasement');
SELECT set_config('request.jwt.claim.sub', :'legacy', true);
SELECT ok((public.save_event_route_state(:'event',2,true) @> '{"pending_revision":null,"adopted_revision":2}'),
  'Un deuxième inscrit adopte indépendamment la même publication');
SELECT is((SELECT count(*) FROM public.club_event_route_decisions WHERE event_id=:'event'),1::bigint,
  'Les décisions des autres participants restent privées');
SELECT set_config('request.jwt.claim.sub', :'owner', true);
SELECT public.cancel_club_event(:'event');
SELECT throws_ok(format('SELECT public.publish_club_event_route(%L,2,925000912,NULL)', :'event'),
  '55000','Cette sortie est annulée.','Une sortie annulée ne peut plus publier de parcours');
SELECT set_config('request.jwt.claim.sub', :'confirmed', true);
SELECT is((SELECT count(*) FROM public.club_event_route_revisions WHERE event_id=:'event'),0::bigint,
  'L’annulation ferme la lecture participante');
SELECT ok((SELECT adopted_revision=1 FROM public.club_event_route_sync WHERE event_id=:'event' AND user_id=:'confirmed'),
  'Le retrait de l’accès ne supprime pas l’adoption antérieure');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.club_event_route_revisions WHERE event_id=:'event'),2::bigint,
  'Les deux révisions restent conservées après annulation');
SELECT * FROM finish();
ROLLBACK;
