-- ============================================================================
-- 10.5 (suite) : révision de tracé issue d'un espace, avec le socle complet des clubs (20261119*, 20261120220000)
--   • lecture sous RLS, géométrie via get_club_event_route_trace (trace de la révision)
--   • adoption / décision (save_event_route_state) : même geste qu'une révision du catalogue
--   • HUB : get_trip_club_route_updates liste la révision issue d'un espace (trace, sans révision canonique)
--   • sortie annulée refusée
-- Ne s'exécute que sur une base où 20261119204829 et 20261119205238 sont appliquées (voir
-- route_collab_followups.test.sql pour la partie valable avec le schéma de production seul).
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
\set a 'cf100000-0000-4000-8000-00000000000a'
\set d 'cf100000-0000-4000-8000-00000000000d'
\set f 'cf100000-0000-4000-8000-00000000000f'
\set w1 'cf100000-1000-4000-8000-000000000001'
\set rv1 'cf100000-2000-4000-8000-000000000001'
\set rv2 'cf100000-2000-4000-8000-000000000002'
\set club 'cf100000-3000-4000-8000-000000000001'
\set ev1 'cf100000-4000-4000-8000-000000000001'
\set ev3 'cf100000-4000-4000-8000-000000000003'
\set ev5 'cf100000-4000-4000-8000-000000000005'
\set trp 'cf100000-6000-4000-8000-000000000001'
BEGIN;
SELECT plan(16);

INSERT INTO auth.users(id, email) VALUES (:'a','a@x.test'),(:'d','d@x.test'),(:'f','f@x.test');
INSERT INTO public.user_profiles(id, email) VALUES (:'a','a@x.test'),(:'d','d@x.test'),(:'f','f@x.test') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.clubs(id, slug, name, privacy, created_by) VALUES (:'club','cf1','Club','open',:'a');
INSERT INTO public.club_events(id, club_id, organizer_id, title, meeting_point, visibility) VALUES
  (:'ev1',:'club',:'a','Sortie publique','Parking','public'),
  (:'ev3',:'club',:'f','Sortie de F','Parking','public');
INSERT INTO public.club_events(id, club_id, organizer_id, title, meeting_point, visibility, cancelled_at)
VALUES (:'ev5',:'club',:'a','Sortie annulée','Parking','public', now());
INSERT INTO public.club_event_registrations(event_id, user_id, status) VALUES (:'ev1',:'d','registered'),(:'ev3',:'d','registered');
INSERT INTO public.route_workspaces(id, created_by, title, status, state_snapshot) VALUES (:'w1',:'a','Traversée','draft','{"shapeMode":"one_way"}');
INSERT INTO public.route_revisions(id, workspace_id, revision_no, based_on_seq, created_by, kind, snapshot)
VALUES (:'rv1',:'w1',1,0,:'a','published', jsonb_build_object('basedOnSeq',0,'revisionNo',1,
  'points', jsonb_build_array(
    jsonb_build_object('id','p0','kind','start','orderKey','A','lat',45.8992,'lon',6.1294,'name','Maison'),
    jsonb_build_object('id','p1','kind','finish','orderKey','Z','lat',45.9292,'lon',6.1294,'name','Col')),
  'sections', jsonb_build_array(jsonb_build_object('id','s1','fromPointId','p0','toPointId','p1','mode','routed',
    'distanceKm',3.3,'ascentM',200,'geometry', jsonb_build_object('type','LineString','coordinates',
      (SELECT jsonb_agg(jsonb_build_array(6.1294, round((45.8992 + i * 0.002)::numeric, 6)) ORDER BY i) FROM generate_series(0,15) i)))),
  'stages','[]'::jsonb, 'kitSnapshot','[]'::jsonb));
INSERT INTO public.departure_packs(workspace_id, revision_id, revision_no, checksum, manifest) VALUES (:'w1',:'rv1',1,'sum-v1','{}');
UPDATE public.route_workspaces SET status='published', published_revision_id=:'rv1', published_revision_no=1 WHERE id=:'w1';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT is((public.publish_club_event_route_from_workspace(:'ev1', :'w1') -> 'snapshot' ->> 'revision')::int, 1, 'A publie la version publiée de l’espace');
SELECT throws_ok(format('SELECT public.publish_club_event_route_from_workspace(%L,%L)', :'ev5', :'w1'), '55000', NULL, 'sortie annulée');
-- Lecture et adoption par un inscrit
SELECT set_config('request.jwt.claim.sub', :'d', true);
SELECT is((SELECT count(*)::int FROM public.club_event_route_revisions WHERE event_id = :'ev1'), 1, 'un inscrit lit la révision');
SELECT ok(NOT has_table_privilege('authenticated','public.club_event_route_revisions','INSERT, UPDATE, DELETE'), 'et ne peut pas l’écrire');
SELECT is(public.get_club_event_route_trace(:'ev1', 1) ->> 'type', 'MultiLineString', 'le tracé de la révision est lisible (trace)');
SELECT ok((SELECT canonical_revision_id IS NULL AND trace IS NOT NULL AND route_name = 'Traversée'
           FROM public.club_event_route_revisions WHERE event_id = :'ev1' AND revision = 1), 'sans révision canonique, avec trace et nom');
SELECT is((public.save_event_route_state(:'ev1', 1, true) ->> 'adopted_revision')::int, 1, 'l’inscrit peut adopter cette révision');
-- Une révision sans aucune géométrie reste inadoptable
RESET ROLE;
INSERT INTO public.club_event_route_revisions(event_id, revision, route_id, checksum, distance_m, updated_by)
VALUES (:'ev3', 1, 'x', 'x', 10, :'f');
UPDATE public.club_events SET route_revision = 1 WHERE id = :'ev3';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'d', true);
SELECT throws_ok(format('SELECT public.save_event_route_state(%L, 1, true)', :'ev3'), '55000', NULL, 'sans géométrie, pas d’adoption');
-- Version 2 de l'espace => révision 2 de la sortie ; HUB
RESET ROLE;
INSERT INTO public.route_revisions(id, workspace_id, revision_no, based_on_seq, created_by, kind, snapshot)
SELECT :'rv2', workspace_id, 2, 0, created_by, 'published', jsonb_set(snapshot, '{revisionNo}', '2') FROM public.route_revisions WHERE id = :'rv1';
INSERT INTO public.departure_packs(workspace_id, revision_id, revision_no, checksum, manifest) VALUES (:'w1',:'rv2',2,'sum-v2','{}');
UPDATE public.route_workspaces SET published_revision_id = :'rv2', published_revision_no = 2 WHERE id = :'w1';
INSERT INTO public.trips (id, user_id, title, slug, visibility) VALUES (:'trp', :'a', 'Traversée du club', 'cf1-route-trip', 'private');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT is((public.publish_club_event_route_from_workspace(:'ev1', :'w1') -> 'snapshot' ->> 'revision')::int, 2, 'version 2 : révision 2 de la sortie');
SELECT lives_ok(format($$SELECT public.set_event_trip('club_event', %L, %L)$$, :'ev1', :'trp'), 'la sortie est rattachée au voyage');
SELECT set_config('request.jwt.claim.sub', :'d', true);
SELECT ok((SELECT count(*) = 1 AND bool_and(revision = 2 AND route_name = 'Traversée' AND decision_pending AND adopted_revision = 1)
           FROM public.get_trip_club_route_updates(:'trp')), 'HUB : révision issue d’un espace listée, décision en attente, tracé 1 adopté');
SELECT is((public.save_event_route_state(:'ev1', 2, true) ->> 'adopted_revision')::int, 2, 'adoption de la révision 2');
SELECT ok((SELECT NOT decision_pending AND adopted_revision = 2 FROM public.get_trip_club_route_updates(:'trp')), 'HUB : décision prise, révision adoptée');
SELECT is(public.get_club_event_route_trace(:'ev1', 2) ->> 'type', 'MultiLineString', 'tracé de la révision 2 lisible');
RESET ROLE;
-- Sans trace ni révision canonique, la révision reste exclue du HUB
UPDATE public.club_event_route_revisions SET trace = NULL WHERE event_id = :'ev1' AND revision = 2;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'d', true);
SELECT is((SELECT count(*)::int FROM public.get_trip_club_route_updates(:'trp')), 0, 'HUB : une révision sans géométrie n’est pas listée');
SELECT ok(has_function_privilege('authenticated','public.get_trip_club_route_updates(uuid)','EXECUTE')
          AND NOT has_function_privilege('anon','public.get_trip_club_route_updates(uuid)','EXECUTE'), 'droits de la fonction inchangés');

SELECT * FROM finish();
ROLLBACK;
