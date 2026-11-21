\set owner 'abca27e0-0000-4000-8000-000000000001'
\set editor 'abca27e0-0000-4000-8000-000000000002'
\set confirmed 'abca27e0-0000-4000-8000-000000000003'
\set invited 'abca27e0-0000-4000-8000-000000000004'
\set viewer 'abca27e0-0000-4000-8000-000000000005'
\set event_guest 'abca27e0-0000-4000-8000-000000000006'
\set trip 'abca27e0-1000-4000-8000-000000000001'
\set public_trip 'abca27e0-1000-4000-8000-000000000002'
\set first_step 'abca27e0-2000-4000-8000-000000000001'
\set second_step 'abca27e0-2000-4000-8000-000000000002'
\set third_step 'abca27e0-2000-4000-8000-000000000003'
\set fourth_step 'abca27e0-2000-4000-8000-000000000004'
\set initial_op 'abca27e0-3000-4000-8000-000000000001'
\set second_initial_op 'abca27e0-3000-4000-8000-000000000002'
\set plan_updated_at '2021-06-01T12:00:00Z'
\set event 'abca27e0-4000-4000-8000-000000000001'

BEGIN;
SELECT plan(50);

INSERT INTO auth.users (id, email) VALUES
  (:'owner', 'execution-owner@example.test'),
  (:'editor', 'execution-editor@example.test'),
  (:'confirmed', 'execution-confirmed@example.test'),
  (:'invited', 'execution-invited@example.test'),
  (:'viewer', 'execution-viewer@example.test'),
  (:'event_guest', 'execution-event-guest@example.test');
INSERT INTO public.trips (id, user_id, title, slug, visibility) VALUES
  (:'trip', :'owner', 'Suivi terrain', 'execution-suivi-terrain', 'private'),
  (:'public_trip', :'owner', 'Voyage public', 'execution-voyage-public', 'public');
INSERT INTO public.trip_steps (id, trip_id, day_number, order_index, title, start_time, updated_at) VALUES
  (:'first_step', :'trip', 1, 0, 'Lever du camp', '08:00', :'plan_updated_at'),
  (:'second_step', :'trip', 1, 1, 'Col', '12:00', :'plan_updated_at'),
  (:'third_step', :'trip', 1, 2, 'Ravitaillement', '16:00', :'plan_updated_at'),
  (:'fourth_step', :'trip', 1, 3, 'Pause', '17:00', :'plan_updated_at');
INSERT INTO public.trip_collaborators (trip_id, user_id, role) VALUES
  (:'trip', :'editor', 'editor'),
  (:'trip', :'viewer', 'viewer');
INSERT INTO public.trip_participants (trip_id, user_id, status) VALUES
  (:'trip', :'confirmed', 'confirmed'),
  (:'trip', :'invited', 'invited');
INSERT INTO public.events (id, organizer_id, title, event_date)
VALUES (:'event', :'owner', 'Sortie liée', current_date + 1);
INSERT INTO public.event_participants (event_id, user_id, status)
VALUES (:'event', :'event_guest', 'confirmed');

SELECT ok(NOT has_function_privilege('anon', 'public.read_trip_step_execution(uuid)', 'EXECUTE'),
  'La lecture nécessite le rôle authentifié');
SELECT ok(NOT has_function_privilege('anon', 'public.record_trip_step_execution(uuid,uuid,uuid,integer,timestamptz,text,text)', 'EXECUTE'),
  'La saisie nécessite le rôle authentifié');
SELECT ok(NOT has_table_privilege('authenticated', 'trip_private.trip_step_execution_events', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
  'Le client passe exclusivement par les RPC autorisés');
SELECT ok(NOT has_table_privilege('service_role', 'trip_private.trip_step_execution_events', 'INSERT,UPDATE,DELETE,TRUNCATE'),
  'Le rôle de service ne réécrit pas le journal');

SET LOCAL ROLE authenticated;
SELECT throws_ok(format('SELECT public.read_trip_step_execution(%L)', :'trip'), '42501',
  'Suivi réservé aux membres autorisés du voyage.', 'Un rôle authentifié sans acteur n’ouvre pas le suivi');
SELECT set_config('request.jwt.claim.sub', :'editor', true);
SELECT throws_ok('SELECT * FROM trip_private.trip_step_execution_events', '42501',
  'permission denied for table trip_step_execution_events', 'La lecture directe du journal reste interdite');
SELECT is((SELECT count(*) FROM public.read_trip_step_execution(:'trip')), 0::bigint,
  'Le prévu reste implicite lorsque le journal est vide');
SELECT public.record_trip_step_execution(:'trip', :'first_step', :'initial_op', 0, :'plan_updated_at', 'started', ' Départ réel ') AS initial \gset
SELECT is((:'initial'::jsonb ->> 'status'), 'started', 'Un éditeur démarre une étape');
SELECT is((:'initial'::jsonb ->> 'version')::integer, 1, 'La version initiale est 1');
SELECT ok((:'initial'::jsonb ->> 'actual_started_at') = (:'initial'::jsonb ->> 'occurred_at')
  AND (:'initial'::jsonb ->> 'actual_arrived_at') IS NULL
  AND (:'initial'::jsonb ->> 'actual_completed_at') IS NULL,
  'Le serveur enregistre le départ réel sans inventer d’arrivée ou de fin');
SELECT is((:'initial'::jsonb ->> 'note'), 'Départ réel', 'La saisie conserve le texte utile');
SELECT throws_ok(format('SELECT public.record_trip_step_execution(%L, %L, %L, 0, %L, %L)',
  :'trip', :'first_step', :'initial_op', :'plan_updated_at', 'arrived'), 'PT409',
  'Cette opération terrain a déjà été utilisée.', 'Un identifiant d’opération ne représente pas une autre action');
SELECT throws_ok(format('SELECT public.record_trip_step_execution(%L, %L, %L, 0, %L, %L, %L)',
  :'trip', :'second_step', :'initial_op', :'plan_updated_at', 'started', 'Départ réel'), 'PT409',
  'Cette opération terrain a déjà été utilisée.', 'Une opération ne peut pas viser une autre étape');
SELECT throws_ok(format('SELECT public.record_trip_step_execution(%L, %L, gen_random_uuid(), 0, %L, %L)',
  :'trip', :'first_step', :'plan_updated_at', 'arrived'), 'PT409',
  'Cette étape a changé. Actualise son suivi.', 'Une commande concurrente avec version périmée signale un conflit');
SELECT throws_ok(format('SELECT public.record_trip_step_execution(%L, %L, gen_random_uuid(), 1, %L, %L, %L)',
  :'trip', :'first_step', :'plan_updated_at', 'arrived', repeat('x', 501)), '22023',
  'Action terrain invalide.', 'La limite de la note est contrôlée en base');
SELECT throws_ok(format('SELECT public.record_trip_step_execution(%L, %L, gen_random_uuid(), 1, %L, %L)',
  :'trip', :'first_step', :'plan_updated_at', 'pending'), '22023',
  'Action terrain invalide.', 'Le statut prévu ne s’écrit pas dans le journal');
SELECT throws_ok(format('SELECT public.record_trip_step_execution(%L, %L, gen_random_uuid(), 1, NULL, %L)',
  :'trip', :'first_step', 'arrived'), '22023',
  'Action terrain invalide.', 'La version du plan est obligatoire');

SELECT public.record_trip_step_execution(:'trip', :'first_step', gen_random_uuid(), 1, :'plan_updated_at', 'arrived') AS arrival \gset
SELECT is((:'arrival'::jsonb ->> 'version')::integer, 2, 'L’arrivée augmente la version');
SELECT ok((:'arrival'::jsonb ->> 'actual_started_at') = (:'initial'::jsonb ->> 'actual_started_at')
  AND (:'arrival'::jsonb ->> 'actual_arrived_at') = (:'arrival'::jsonb ->> 'occurred_at'),
  'L’arrivée préserve le départ réel');
SELECT public.record_trip_step_execution(:'trip', :'first_step', gen_random_uuid(), 2, :'plan_updated_at', 'completed') AS completion \gset
SELECT ok((:'completion'::jsonb ->> 'actual_completed_at') = (:'completion'::jsonb ->> 'occurred_at')
  AND (:'completion'::jsonb ->> 'actual_arrived_at') = (:'arrival'::jsonb ->> 'actual_arrived_at'),
  'La fin ajoute son instant au suivi');
SELECT is(public.record_trip_step_execution(:'trip', :'first_step', :'initial_op', 0, :'plan_updated_at', 'started', 'Départ réel'),
  :'initial'::jsonb, 'Le renvoi d’origine reste idempotent après deux nouvelles versions');
SELECT throws_ok(format('SELECT public.record_trip_step_execution(%L, %L, gen_random_uuid(), 3, %L, %L)',
  :'trip', :'first_step', :'plan_updated_at', 'postponed'), 'PT409',
  'Cette action ne correspond plus à l’état de l’étape.', 'Une étape terminée reste terminale');

SELECT public.record_trip_step_execution(:'trip', :'second_step', :'second_initial_op', 0, :'plan_updated_at', 'arrived') AS direct_arrival \gset
SELECT ok((:'direct_arrival'::jsonb ->> 'actual_started_at') IS NULL
  AND (:'direct_arrival'::jsonb ->> 'actual_arrived_at') IS NOT NULL,
  'Une arrivée directe peut être confirmée sans horaire de départ');
SELECT public.record_trip_step_execution(:'trip', :'second_step', gen_random_uuid(), 1, :'plan_updated_at', 'postponed', 'Orage') AS postponed \gset
SELECT is((:'postponed'::jsonb ->> 'actual_arrived_at'), (:'direct_arrival'::jsonb ->> 'actual_arrived_at'),
  'Le report conserve l’arrivée de la tentative précédente dans le journal');
SELECT public.record_trip_step_execution(:'trip', :'second_step', gen_random_uuid(), 2, :'plan_updated_at', 'started') AS resumed \gset
SELECT ok((:'resumed'::jsonb ->> 'actual_started_at') = (:'resumed'::jsonb ->> 'occurred_at')
  AND (:'resumed'::jsonb ->> 'actual_arrived_at') IS NULL,
  'La reprise ouvre une tentative dont l’arrivée reste inconnue');
SELECT is(public.record_trip_step_execution(:'trip', :'third_step', gen_random_uuid(), 0, :'plan_updated_at', 'skipped', 'Ravitaillement fermé') ->> 'status',
  'skipped', 'Une étape prévue peut être ignorée');
SELECT is((SELECT note FROM public.read_trip_step_execution(:'trip') WHERE step_id = :'third_step'),
  'Ravitaillement fermé', 'Un éditeur peut relire la note interne');
SELECT is(public.record_trip_step_execution(:'trip', :'fourth_step', gen_random_uuid(), 0, :'plan_updated_at', 'cancelled') ->> 'status',
  'cancelled', 'L’annulation d’une étape conserve son plan');

SELECT is((SELECT string_agg(status, ',' ORDER BY observed_order)
  FROM public.read_trip_step_execution(:'trip') WITH ORDINALITY AS r(
    step_id,status,version,occurred_at,actual_started_at,actual_arrived_at,actual_completed_at,note,
    archived,planned_title,planned_day_number,planned_start_time,observed_order
  )), 'completed,started,skipped,cancelled', 'Une seule version par étape suit l’ordre du plan');
SELECT is((SELECT start_time FROM public.trip_steps WHERE id = :'first_step'),
  '08:00'::time, 'Le suivi réel ne modifie pas l’heure prévue');

SELECT set_config('request.jwt.claim.sub', :'confirmed', true);
SELECT is((SELECT count(*) FROM public.read_trip_step_execution(:'trip')), 4::bigint,
  'Un participant confirmé peut consulter le suivi');
SELECT ok((SELECT status = 'skipped' AND note IS NULL
  FROM public.read_trip_step_execution(:'trip') WHERE step_id = :'third_step'),
  'Le participant confirmé voit l’état et la note interne est masquée');
SELECT throws_ok(format('SELECT public.record_trip_step_execution(%L, %L, gen_random_uuid(), 3, %L, %L)',
  :'trip', :'second_step', :'plan_updated_at', 'arrived'), '42501',
  'Modification réservée aux éditeurs du voyage.', 'La confirmation ne confère pas de droit d’écriture');
SELECT set_config('request.jwt.claim.sub', :'invited', true);
SELECT throws_ok(format('SELECT public.read_trip_step_execution(%L)', :'trip'), '42501',
  'Suivi réservé aux membres autorisés du voyage.', 'Une invitation en attente ne confère pas de lecture du suivi');
SELECT throws_ok(format('SELECT public.read_trip_step_execution(%L)', :'public_trip'), '42501',
  'Suivi réservé aux membres autorisés du voyage.', 'La publicité du plan ne rend pas le suivi public');
SELECT set_config('request.jwt.claim.sub', :'viewer', true);
SELECT throws_ok(format('SELECT public.read_trip_step_execution(%L)', :'trip'), '42501',
  'Suivi réservé aux membres autorisés du voyage.', 'Un accès au plan seul ne donne pas accès aux notes terrain');

SELECT set_config('request.jwt.claim.sub', :'owner', true);
SELECT public.set_event_trip('community_event', :'event', :'trip');
SELECT throws_ok(format('SELECT public.record_trip_step_execution(%L, %L, gen_random_uuid(), 0, %L, %L)',
  :'public_trip', :'second_step', :'plan_updated_at', 'started'), 'PT404',
  'Étape introuvable dans ce voyage.', 'Une étape d’un autre voyage est refusée');
SELECT set_config('request.jwt.claim.sub', :'event_guest', true);
SELECT is((SELECT count(*) FROM public.read_trip_step_execution(:'trip')), 4::bigint,
  'Un inscrit confirmé via un événement lié peut consulter le suivi');
SELECT ok((SELECT status = 'skipped' AND note IS NULL
  FROM public.read_trip_step_execution(:'trip') WHERE step_id = :'third_step'),
  'L’inscrit à l’événement voit l’état et la note interne est masquée');

RESET ROLE;
UPDATE public.events SET status = 'cancelled' WHERE id = :'event';
SET LOCAL ROLE authenticated;
SELECT throws_ok(format('SELECT public.read_trip_step_execution(%L)', :'trip'), '42501',
  'Suivi réservé aux membres autorisés du voyage.', 'L’annulation de l’événement retire son accès au suivi');
SELECT set_config('request.jwt.claim.sub', :'owner', true);
UPDATE public.trip_steps SET day_number = 2, title = 'Col déplacé' WHERE id = :'second_step';
SELECT throws_ok(format('SELECT public.record_trip_step_execution(%L, %L, gen_random_uuid(), 3, %L, %L)',
  :'trip', :'second_step', :'plan_updated_at', 'arrived'), 'PT409',
  'Le plan de cette étape a changé. Actualise son suivi.', 'Un état terrain courant ne suffit pas si le plan est périmé');
SELECT set_config('request.jwt.claim.sub', :'editor', true);
SELECT is(public.record_trip_step_execution(:'trip', :'second_step', :'second_initial_op', 0, :'plan_updated_at', 'arrived'),
  :'direct_arrival'::jsonb, 'Une opération confirmée reste idempotente après modification du plan');
SELECT is((SELECT version FROM public.read_trip_step_execution(:'trip') WHERE step_id = :'second_step'),
  3, 'La réorganisation du plan préserve le suivi de la même étape');
SELECT ok((SELECT NOT archived AND planned_title = 'Col' AND planned_day_number = 1
  FROM public.read_trip_step_execution(:'trip') WHERE step_id = :'second_step'),
  'Une étape déplacée est toujours active et son dernier instantané reste intact');
DELETE FROM public.trip_steps WHERE id = :'first_step';
SELECT ok((SELECT archived AND status = 'completed' AND version = 3
  AND planned_title = 'Lever du camp' AND planned_day_number = 1 AND planned_start_time = '08:00'::time
  FROM public.read_trip_step_execution(:'trip') WHERE step_id = :'first_step'),
  'Le dernier événement d’une étape retirée reste consultable avec son contexte prévu');
SELECT is((SELECT string_agg(status, ',' ORDER BY observed_order)
  FROM public.read_trip_step_execution(:'trip') WITH ORDINALITY AS r(
    step_id,status,version,occurred_at,actual_started_at,actual_arrived_at,actual_completed_at,note,
    archived,planned_title,planned_day_number,planned_start_time,observed_order
  )), 'completed,skipped,cancelled,started', 'Le tri combine les positions d’archive et les positions actuelles');
SELECT set_config('request.jwt.claim.sub', :'editor', true);
SELECT is(public.record_trip_step_execution(:'trip', :'first_step', :'initial_op', 0, :'plan_updated_at', 'started', 'Départ réel'),
  :'initial'::jsonb || '{"archived": true}'::jsonb, 'Le renvoi après retrait conserve l’événement et signale son archivage');

RESET ROLE;
SELECT is((SELECT count(*) FROM trip_private.trip_step_execution_events
  WHERE trip_id = :'trip' AND step_id = :'first_step'), 3::bigint,
  'Les trois événements de l’étape supprimée restent en base');
SELECT ok((SELECT planned_title = 'Col' AND planned_day_number = 1 AND planned_start_time = '12:00'::time
  AND actor_id = :'editor' AND source = 'manual'
  FROM trip_private.trip_step_execution_events
  WHERE trip_id = :'trip' AND step_id = :'second_step' AND version = 1),
  'Le journal conserve l’auteur, la source et le plan d’origine');
DELETE FROM public.trips WHERE id = :'trip';
SELECT is((SELECT count(*) FROM trip_private.trip_step_execution_events WHERE trip_id = :'trip'), 0::bigint,
  'La suppression du voyage emporte son journal');

SELECT * FROM finish();
ROLLBACK;
