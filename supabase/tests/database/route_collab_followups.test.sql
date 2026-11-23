-- ============================================================================
-- Itinéraire collaboratif : suites (20261123130000_route_collab_followups.sql)
--   • 4.1  user_ui_prefs : isolation par auth.uid(), aucun accès anon, aucune vue publique
--   • 10.5 publish_club_event_route_from_workspace : organisateur ET propriétaire/co-organisateur délégué,
--          version publiée seule, zone de départ masquée si la sortie est publique, idempotence, adoption possible
--   • 10.10 admin_list_route_moderation / admin_apply_route_moderation : modérateurs seulement, décision appliquée
--          et journalisée dans admin_audit_log (jamais moderation_queue), jamais de jeton
-- Exécution : pgTAP, transaction annulée (ROLLBACK). Ne dépend que du schéma de PRODUCTION (révisions sans
-- canonical_revision_id ; sans les fonctions de décision de 20261119*) : adoption, HUB et sortie annulée sont dans
-- route_collab_followups_clubs_full.test.sql, qui suppose 20261119* appliquées.
-- ============================================================================
\set a 'cf000000-0000-4000-8000-00000000000a'
\set b 'cf000000-0000-4000-8000-00000000000b'
\set c 'cf000000-0000-4000-8000-00000000000c'
\set d 'cf000000-0000-4000-8000-00000000000d'
\set e 'cf000000-0000-4000-8000-00000000000e'
\set f 'cf000000-0000-4000-8000-00000000000f'
\set w1 'cf000000-1000-4000-8000-000000000001'
\set w2 'cf000000-1000-4000-8000-000000000002'
\set rv1 'cf000000-2000-4000-8000-000000000001'
\set rv2 'cf000000-2000-4000-8000-000000000002'
\set club 'cf000000-3000-4000-8000-000000000001'
\set ev1 'cf000000-4000-4000-8000-000000000001'
\set ev2 'cf000000-4000-4000-8000-000000000002'
\set ev3 'cf000000-4000-4000-8000-000000000003'
\set ev4 'cf000000-4000-4000-8000-000000000004'
\set ev5 'cf000000-4000-4000-8000-000000000005'
\set po1 'cf000000-5000-4000-8000-000000000001'
\set po2 'cf000000-5000-4000-8000-000000000002'

BEGIN;
SELECT plan(65);

-- Fixtures (superuser). A propriétaire de l'espace W1 et organisateur ; B co-organisateur délégué ; C co-organisateur
-- sans délégation ; D inscrit à la sortie (participant) ; E modérateur ; F organisateur d'une autre sortie.
INSERT INTO auth.users(id, email) VALUES (:'a','a@x.test'),(:'b','b@x.test'),(:'c','c@x.test'),(:'d','d@x.test'),(:'e','e@x.test'),(:'f','f@x.test');
INSERT INTO public.user_profiles(id, email) VALUES (:'a','a@x.test'),(:'b','b@x.test'),(:'c','c@x.test'),(:'d','d@x.test'),(:'e','e@x.test'),(:'f','f@x.test')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.admin_roles(user_id) VALUES (:'e');
INSERT INTO public.clubs(id, slug, name, privacy, created_by) VALUES (:'club','cf','Club','open',:'a');
INSERT INTO public.club_events(id, club_id, organizer_id, title, meeting_point, visibility) VALUES
  (:'ev1',:'club',:'a','Sortie publique','Parking','public'),
  (:'ev2',:'club',:'a','Sortie du club','Parking','club_only'),
  (:'ev3',:'club',:'f','Sortie de F','Parking','public'),
  (:'ev4',:'club',:'c','Sortie de C','Parking','public'),
  (:'ev5',:'club',:'b','Sortie de B','Parking','public');
INSERT INTO public.club_event_registrations(event_id, user_id, status) VALUES (:'ev1',:'d','registered'),(:'ev2',:'d','registered'),(:'ev3',:'d','registered');

INSERT INTO public.route_workspaces(id, created_by, title, status, state_snapshot, share_token_hash)
VALUES (:'w1',:'a','Traversée','draft', jsonb_build_object('shapeMode','one_way','comments', jsonb_build_array(
          jsonb_build_object('id','c1','body','Texte abusif 1','createdAt','2026-11-20T10:00:00Z'),
          jsonb_build_object('id','c2','body','Texte abusif 2','createdAt','pas-une-date'))),
        encode(extensions.digest('shr-token-de-test-0123456789abcdef0123456789abcdef','sha256'),'hex')),
       (:'w2',:'a','Brouillon seul','draft','{}'::jsonb, NULL);
INSERT INTO public.route_workspace_members(workspace_id, user_id, role, delegated_publish) VALUES
  (:'w1',:'b','co_organizer',true),(:'w1',:'c','co_organizer',false),(:'w1',:'d','participant',false);
-- Version publiée n°1 : 16 coordonnées vers le nord depuis (6.1294 ; 45.8992), pas de 0,002° (~222 m).
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
INSERT INTO public.community_posts(id, author_id, content, creation_meta) VALUES
  (:'po1',:'a','Trace publiée','{"created_from":"route_collab"}'),(:'po2',:'a','Autre publication','{"created_from":"carnet"}');

-- ----------------------------------------------------------------------------
-- 4.1 user_ui_prefs
-- ----------------------------------------------------------------------------
SELECT ok(NOT has_table_privilege('anon','public.user_ui_prefs','SELECT'), 'anon ne lit pas les préférences');
SELECT ok(NOT has_table_privilege('authenticated','public.user_ui_prefs','DELETE'), 'aucune suppression directe côté client');
SELECT is((SELECT count(*)::int FROM information_schema.view_table_usage WHERE table_name = 'user_ui_prefs'), 0,
  'aucune vue ne publie user_ui_prefs');
INSERT INTO public.user_ui_prefs(user_id, prefs) VALUES (:'b','{"routeViewMode":"simple"}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT lives_ok(format($$INSERT INTO public.user_ui_prefs(user_id, prefs) VALUES (%L,'{"routeViewMode":"expert"}')$$, :'a'), 'A écrit ses préférences');
SELECT throws_ok(format($$INSERT INTO public.user_ui_prefs(user_id, prefs) VALUES (%L,'{}')$$, :'c'), '42501', NULL, 'A n’écrit pas celles d’un autre');
SELECT is((SELECT count(*)::int FROM public.user_ui_prefs), 1, 'A ne voit que sa ligne');
SELECT is((SELECT prefs ->> 'routeViewMode' FROM public.user_ui_prefs), 'expert', 'valeur relue');
UPDATE public.user_ui_prefs SET prefs = '{"routeViewMode":"simple"}' WHERE user_id = :'b';
SELECT lives_ok($$UPDATE public.user_ui_prefs SET prefs = '{"routeViewMode":"simple"}', updated_at = now()$$, 'A met à jour la sienne');
SELECT throws_ok($$UPDATE public.user_ui_prefs SET prefs = '[]'$$, '23514', NULL, 'prefs doit être un objet');
SELECT throws_ok(format($$UPDATE public.user_ui_prefs SET user_id = %L$$, :'c'), '42501', NULL, 'on ne cède pas sa ligne');
RESET ROLE;
SELECT is((SELECT prefs ->> 'routeViewMode' FROM public.user_ui_prefs WHERE user_id = :'b'), 'simple', 'la ligne de B n’a pas bougé (RLS)');

-- ----------------------------------------------------------------------------
-- 10.5 Clubs
-- ----------------------------------------------------------------------------
SELECT ok(NOT has_function_privilege('anon','public.publish_club_event_route_from_workspace(uuid,uuid)','EXECUTE'), 'anon ne publie pas');
SELECT ok(has_function_privilege('authenticated','public.publish_club_event_route_from_workspace(uuid,uuid)','EXECUTE'), 'authenticated peut appeler la RPC');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'d', true);
SELECT throws_ok(format('SELECT public.publish_club_event_route_from_workspace(%L,%L)', :'ev1', :'w1'), '42501', NULL, 'un inscrit ne publie pas');
SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT throws_ok(format('SELECT public.publish_club_event_route_from_workspace(%L,%L)', :'ev3', :'w1'), '42501', NULL, 'propriétaire de l’espace mais pas organisateur de la sortie');
SELECT set_config('request.jwt.claim.sub', :'f', true);
SELECT throws_ok(format('SELECT public.publish_club_event_route_from_workspace(%L,%L)', :'ev3', :'w1'), '42501', NULL, 'organisateur de la sortie mais étranger à l’espace');
SELECT set_config('request.jwt.claim.sub', :'c', true);
SELECT throws_ok(format('SELECT public.publish_club_event_route_from_workspace(%L,%L)', :'ev4', :'w1'), '42501', NULL, 'co-organisateur sans publication déléguée');
SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT throws_ok(format('SELECT public.publish_club_event_route_from_workspace(%L,%L)', :'ev1', :'w2'), 'P0002', NULL, 'sans version publiée, rien à proposer');
SELECT throws_ok(format('SELECT public.publish_club_event_route_from_workspace(%L,%L)', :'ev1', 'cf000000-1000-4000-8000-0000000000ff'), '42501', NULL, 'espace inexistant : même refus');
SELECT is((public.publish_club_event_route_from_workspace(:'ev1', :'w1') -> 'snapshot' ->> 'revision')::int, 1, 'A publie la version publiée dans la sortie publique');
SELECT ok(NOT ((public.publish_club_event_route_from_workspace(:'ev1', :'w1') -> 'snapshot') ? 'trace'), 'la réponse ne renvoie pas la géométrie');
RESET ROLE;
SELECT is((SELECT route_revision FROM public.club_events WHERE id = :'ev1'), 1, 'la sortie pointe la révision 1');
SELECT is((SELECT count(*)::int FROM public.club_event_route_revisions WHERE event_id = :'ev1'), 1, 'répéter ne crée pas de révision');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE related_id = :'ev1' AND type = 'club_route_revision' AND user_id = :'d'), 1, 'répéter ne renotifie pas');
SELECT ok((SELECT distance_m = 3300 AND elevation_gain_m = 200 AND checksum = 'sum-v1' 
                  AND source_workspace_id = :'w1'::uuid AND source_revision_no = 1 AND requires_participant_decision
           FROM public.club_event_route_revisions WHERE event_id = :'ev1' AND revision = 1), 'distance, dénivelé, contrôle et origine repris de la version publiée');
SELECT ok((SELECT (trace ->> 'sanitized')::boolean FROM public.club_event_route_revisions WHERE event_id = :'ev1'), 'sortie publique : tracé assaini');
SELECT ok((SELECT min(public.ST_DistanceSphere(public.ST_MakePoint((c ->> 0)::float8, (c ->> 1)::float8), public.ST_MakePoint(6.1294, 45.8992))) >= 500
           FROM public.club_event_route_revisions r, jsonb_array_elements(r.trace -> 'coordinates') l, jsonb_array_elements(l) c
           WHERE r.event_id = :'ev1'), 'aucune coordonnée à moins de 500 m du départ privé');
SELECT ok((SELECT jsonb_array_length(trace -> 'coordinates' -> 0) = 13 FROM public.club_event_route_revisions WHERE event_id = :'ev1'),
  'seules les 3 coordonnées de la zone privée sont retirées');
-- Sortie réservée au club : géométrie complète
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT is((public.publish_club_event_route_from_workspace(:'ev2', :'w1') -> 'snapshot' ->> 'revision')::int, 1, 'publication dans la sortie du club');
RESET ROLE;
SELECT ok((SELECT NOT (trace ->> 'sanitized')::boolean AND trace -> 'coordinates' -> 0 -> 0 = '[6.1294, 45.8992]'::jsonb
           FROM public.club_event_route_revisions WHERE event_id = :'ev2'), 'sortie du club : tracé complet, départ exact');
-- Le même tracé devenu public est recopié avec masquage (le mode compte dans l'idempotence)
UPDATE public.club_events SET visibility = 'public' WHERE id = :'ev2';
SET LOCAL ROLE authenticated;
SELECT is((public.publish_club_event_route_from_workspace(:'ev2', :'w1') -> 'snapshot' ->> 'revision')::int, 2, 'visibilité changée : nouvelle révision');
RESET ROLE;
SELECT ok((SELECT (trace ->> 'sanitized')::boolean FROM public.club_event_route_revisions WHERE event_id = :'ev2' AND revision = 2), 'et cette fois masquée');
-- Co-organisateur délégué
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'b', true);
SELECT is((public.publish_club_event_route_from_workspace(:'ev5', :'w1') -> 'snapshot' ->> 'revision')::int, 1, 'co-organisateur délégué publie sur sa sortie');
-- Nouvelle version publiée de l'espace => nouvelle révision
RESET ROLE;
INSERT INTO public.route_revisions(id, workspace_id, revision_no, based_on_seq, created_by, kind, snapshot)
SELECT :'rv2', workspace_id, 2, 0, created_by, 'published', jsonb_set(snapshot, '{revisionNo}', '2') FROM public.route_revisions WHERE id = :'rv1';
INSERT INTO public.departure_packs(workspace_id, revision_id, revision_no, checksum, manifest) VALUES (:'w1',:'rv2',2,'sum-v2','{}');
UPDATE public.route_workspaces SET published_revision_id = :'rv2', published_revision_no = 2 WHERE id = :'w1';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT is((public.publish_club_event_route_from_workspace(:'ev1', :'w1') -> 'snapshot' ->> 'revision')::int, 2, 'version 2 de l’espace : révision 2 de la sortie');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.club_event_route_revisions WHERE event_id = :'ev1'), 2, 'deux révisions pour la sortie');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE related_id = :'ev1' AND type = 'club_route_revision' AND user_id = :'d'), 2, 'l’inscrit est notifié à chaque nouvelle révision');
SELECT ok((SELECT source_revision_no = 2 AND trace IS NOT NULL AND source_workspace_id = :'w1'::uuid FROM public.club_event_route_revisions WHERE event_id = :'ev1' AND revision = 2), 'la révision 2 vient de la version 2 de l’espace');

-- ----------------------------------------------------------------------------
-- 10.10 Modération
-- ----------------------------------------------------------------------------
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon','public.admin_list_route_moderation(integer)','EXECUTE'), 'anon : pas de liste');
SELECT ok(NOT has_function_privilege('anon','public.admin_apply_route_moderation(text,text,text)','EXECUTE'), 'anon : pas de décision');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT throws_ok($$SELECT * FROM public.admin_list_route_moderation(10)$$, '42501', NULL, 'un non-modérateur ne lit pas la file');
SELECT throws_ok(format($$SELECT public.admin_apply_route_moderation('route_share_link', %L, 'revoke')$$, :'w1'), '42501', NULL, 'un non-modérateur n’applique rien');
SELECT set_config('request.jwt.claim.sub', :'e', true);
SELECT is((SELECT count(*)::int FROM public.admin_list_route_moderation(50) WHERE type = 'route_comment'), 2, 'deux commentaires listés (date illisible tolérée)');
SELECT is((SELECT count(*)::int FROM public.admin_list_route_moderation(50) WHERE type = 'route_share_link' AND id = :'w1'), 1, 'un lien partagé listé');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.admin_list_route_moderation(50) t WHERE t::text LIKE '%shr-token%' OR t::text ~ '[0-9a-f]{64}'), 'ni jeton ni empreinte dans la liste');
SELECT throws_ok(format($$SELECT public.admin_apply_route_moderation('route_comment', %L, 'revoke')$$, :'w1' || ':c1'), '22023', NULL, 'action incompatible avec le type');
SELECT throws_ok($$SELECT public.admin_apply_route_moderation('route_comment', 'pas-un-uuid:c1', 'hide')$$, '22023', NULL, 'identifiant invalide');
SELECT throws_ok(format($$SELECT public.admin_apply_route_moderation('autre', %L, 'remove')$$, :'po1'), '22023', NULL, 'type inconnu');
SELECT is(public.admin_apply_route_moderation('route_comment', :'w1' || ':c1', 'hide') ->> 'status', 'applied', 'commentaire masqué');
RESET ROLE;
SELECT ok((SELECT state_snapshot -> 'comments' -> 0 ->> 'body' = '[Commentaire masqué par la modération]'
              AND state_snapshot -> 'comments' -> 0 ->> 'moderation' = 'hidden'
              AND state_snapshot -> 'comments' -> 1 ->> 'body' = 'Texte abusif 2' AND state_version = 1
           FROM public.route_workspaces WHERE id = :'w1'), 'seul c1 est masqué, la version de l’espace avance');
SELECT is((SELECT count(*)::int FROM public.admin_audit_log WHERE cible_type = 'route_comment' AND action = 'REJECT' AND admin_id = :'e' AND apres ->> 'statut' = 'rejete' AND apres ->> 'enforced' = 'hide'), 1, 'décision journalisée (REJECT, statut rejete)');
SELECT is((SELECT count(*)::int FROM public.moderation_queue), 0, 'la file des annonces de la place de marché n’est pas touchée');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'e', true);
SELECT is(public.admin_apply_route_moderation('route_comment', :'w1' || ':c1', 'hide') ->> 'status', 'noop', 'masquer deux fois : sans effet');
SELECT is(public.admin_apply_route_moderation('route_comment', :'w1' || ':c2', 'remove') ->> 'status', 'applied', 'commentaire supprimé');
SELECT is(public.admin_apply_route_moderation('route_comment', :'w1' || ':c2', 'remove') ->> 'status', 'not_found', 'déjà supprimé');
RESET ROLE;
SELECT is((SELECT jsonb_array_length(state_snapshot -> 'comments') FROM public.route_workspaces WHERE id = :'w1'), 1, 'un seul commentaire reste');
SELECT is((SELECT count(*)::int FROM public.admin_audit_log WHERE cible_type = 'route_comment'), 2, 'pas de doublon dans le journal');
SELECT ok(EXISTS (SELECT 1 FROM public.admin_audit_log WHERE action = 'REJECT' AND apres ->> 'enforced' = 'remove' AND cible_id = :'w1' || ':c2'), 'la suppression est journalisée (enforced remove)');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'e', true);
SELECT is(public.admin_apply_route_moderation('route_share_link', :'w1', 'revoke') ->> 'status', 'applied', 'lien révoqué');
SELECT is(public.admin_apply_route_moderation('route_share_link', :'w1', 'revoke') ->> 'status', 'noop', 'révoquer deux fois : sans effet');
RESET ROLE;
SELECT ok((SELECT share_revoked_at IS NOT NULL FROM public.route_workspaces WHERE id = :'w1'), 'share_revoked_at posé');
SET LOCAL ROLE anon;
SELECT is(public.get_shared_route_workspace_tx(:'w1', 'shr-token-de-test-0123456789abcdef0123456789abcdef') ->> 'status', 'revoked', 'le lien ne s’ouvre plus');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'e', true);
SELECT is(public.admin_apply_route_moderation('route_public_trace', :'po2', 'remove') ->> 'status', 'not_found', 'une publication étrangère à l’itinéraire n’est pas retirée');
SELECT is(public.admin_apply_route_moderation('route_public_trace', :'po1', 'remove') ->> 'status', 'applied', 'trace publique retirée');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.community_posts WHERE id IN (:'po1', :'po2')), 1, 'seule la trace publique a disparu');
SELECT is((SELECT count(*)::int FROM public.admin_audit_log WHERE admin_id = :'e'), 4, 'quatre décisions appliquées, quatre lignes de journal');

SELECT * FROM finish();
ROLLBACK;
