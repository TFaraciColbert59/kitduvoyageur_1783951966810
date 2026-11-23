-- ============================================================================
-- Itinéraire collaboratif 20/10 — RLS + RPC SECURITY DEFINER
-- Migration : 20261118120000_route_collab_20_10.sql
--   • présence des tables, fonctions, index, clés composites, policies en SETOF évalué une fois
--   • création (auth requise, droit d'édition du voyage), aucune écriture directe (privilèges + RLS)
--   • rôles d'écriture par partie, p_expected_version obligatoire, tailles bornées, hash SQL
--   • rôle du créateur / propriétaire du voyage, membres limités aux collaborateurs du voyage
--   • delegated_publish forcé, co_organizer encadré
--   • lien de partage : jeton généré en SQL (hash seul stocké), rayon >= 200 m, révocation
--   • lecture assainie (lien et external_viewer) : liste blanche, zone privée masquée, sans userId
--   • publication : cohérence de l'instantané avec la base ; espace archivé en lecture seule
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
-- Replay local : lecture par défaut Supabase (la sécurité repose sur RLS + RPC ; aucune écriture directe accordée).
-- (route_workspaces n'y figure PAS : son SELECT est accordé colonne par colonne par la migration, sans
-- share_token_hash ; un GRANT de table ici le masquerait.)
GRANT SELECT ON
  public.route_workspace_members, public.route_operations,
  public.route_revisions, public.departure_packs TO authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- Supabase : le schéma `extensions` (pgcrypto) est utilisable par les rôles API.
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;

-- Aides de test (annulées avec la transaction) : version courante et boîte de sortie lisible par le superuser.
CREATE FUNCTION public.rc_ver(p_id uuid) RETURNS bigint LANGUAGE sql SECURITY DEFINER AS
  $$ SELECT state_version FROM public.route_workspaces WHERE id = p_id $$;
-- Instantané valide construit depuis l'état en base (utilisé par les tests de publication)
CREATE FUNCTION public.rc_snap(p_id uuid, p_rev bigint) RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'basedOnSeq', w.head_seq, 'revisionNo', p_rev,
    'points', COALESCE(w.state_snapshot -> 'points', '[]'::jsonb),
    'sections', COALESCE(w.state_snapshot -> 'sections', '[]'::jsonb),
    'stages', COALESCE(w.state_snapshot -> 'stages', '[]'::jsonb),
    'kitSnapshot', COALESCE(w.state_snapshot -> 'kitItems', '[]'::jsonb))
  FROM public.route_workspaces w WHERE w.id = p_id $$;
-- Empreinte du jeton de partage (colonne illisible pour les clients : lecture réservée à ce helper).
CREATE FUNCTION public.rc_hash(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS
  $$ SELECT share_token_hash FROM public.route_workspaces WHERE id = p_id $$;
-- Distance haversine de référence (oracle de test, indépendant de la migration).
CREATE FUNCTION public.rc_hav(p_lat1 float8, p_lon1 float8, p_lat2 float8, p_lon2 float8) RETURNS float8 LANGUAGE sql IMMUTABLE AS
  $$ SELECT 2 * 6371000 * asin(least(1, sqrt(power(sin(radians(p_lat2 - p_lat1) / 2), 2)
       + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lon2 - p_lon1) / 2), 2)))) $$;
-- Instantané synthétique : p_np points (le premier 'start', le dernier 'finish', boucle), p_np - 1 tronçons de
-- p_nc coordonnées chacun, p_ns étapes, p_del points supprimés en plus. Départ en (45.8992, 6.1294).
CREATE FUNCTION public.rc_big(p_np int, p_nc int, p_ns int, p_del int DEFAULT 0) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('title', 'Gros', 'sport', 'marche', 'shapeMode', 'loop',
    'points', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', 'p' || i, 'kind',
                 CASE WHEN i = 0 THEN 'start' WHEN i = p_np - 1 THEN 'finish' ELSE 'via' END,
                 'orderKey', lpad(i::text, 6, '0'), 'lat', 45.8992 + i * 0.0004, 'lon', 6.1294 + sin(i / 50.0) * 0.01,
                 'name', 'n' || i, 'note', 'note secrete', 'eleM', 1000, 'entityVersion', 1) ORDER BY i), '[]'::jsonb)
               FROM generate_series(0, p_np - 1) i)
      || (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', 'd' || i, 'kind', 'via', 'orderKey', 'z' || i,
                 'lat', 46.5, 'lon', 6.5, 'deletedAt', '2026-01-01T00:00:00Z', 'entityVersion', 1)), '[]'::jsonb)
          FROM generate_series(1, p_del) i),
    'sections', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', 's' || i, 'fromPointId', 'p' || i, 'toPointId', 'p' || (i + 1),
                 'mode', 'routed', 'distanceKm', 0.1,
                 'geometry', jsonb_build_object('type', 'LineString', 'coordinates',
                   (SELECT jsonb_agg(jsonb_build_array(round((6.1294 + sin((i + k / p_nc::float) / 50.0) * 0.01)::numeric, 6),
                                                       round((45.8992 + (i + k / p_nc::float) * 0.0004)::numeric, 6)))
                    FROM generate_series(0, p_nc - 1) k)),
                 'elevationSamples', (SELECT jsonb_agg(1000) FROM generate_series(0, p_nc - 1) k),
                 'provenance', '{"provider":"secret-provider"}'::jsonb, 'entityVersion', 1) ORDER BY i), '[]'::jsonb)
               FROM generate_series(0, p_np - 2) i),
    'stages', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', 'st' || i, 'orderKey', 'k' || lpad(i::text, 3, '0'),
                 'dayNumber', i + 1, 'title', 'J' || i, 'startPointId', 'p' || i, 'endPointId', 'p' || (i + 1),
                 'notes', 'note secrete') ORDER BY i), '[]'::jsonb) FROM generate_series(0, p_ns - 1) i),
    'members', '[]'::jsonb)
$$;
CREATE TABLE public.rc_out (k text PRIMARY KEY, v jsonb);
GRANT ALL ON public.rc_out TO PUBLIC;

SELECT plan(191);

-- ----------------------------------------------------------------------------
-- Fixtures (superuser) : A propriétaire du voyage T1 et créateur, B co-organisateur, C éditeur, D lecteur
-- externe, E tiers (propriétaire d'un autre voyage), F participant, G contributeur, H collaborateur lecteur
-- du voyage, I étranger au voyage, J collaborateur éditeur du voyage sans ligne de membre.
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('e2000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'rc_a@test.local', 'x', '{}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'rc_b@test.local', 'x', '{}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'rc_c@test.local', 'x', '{}', '{"full_name":"Nom Cache Meta"}', now(), now()),
  ('e2000000-0000-4000-8000-00000000000d', 'authenticated', 'authenticated', 'rc_d@test.local', 'x', '{}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-00000000000e', 'authenticated', 'authenticated', 'rc_e@test.local', 'x', '{}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-00000000000f', 'authenticated', 'authenticated', 'rc_f@test.local', 'x', '{}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'rc_g@test.local', 'x', '{}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'rc_h@test.local', 'x', '{}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'rc_i@test.local', 'x', '{}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'rc_j@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.trips (id, slug, title, user_id, visibility)
VALUES
  ('e2000000-0000-4000-8000-0000000000b1', 'route-collab-rls-trip-e', 'Voyage de E', 'e2000000-0000-4000-8000-00000000000e', 'private'),
  ('e2000000-0000-4000-8000-0000000000b2', 'route-collab-rls-trip-a', 'Voyage de A', 'e2000000-0000-4000-8000-00000000000a', 'private');

-- Collaborateurs du voyage T1 (le propriétaire A est inscrit par le déclencheur du voyage).
INSERT INTO public.trip_collaborators (trip_id, user_id, role)
VALUES
  ('e2000000-0000-4000-8000-0000000000b2', 'e2000000-0000-4000-8000-00000000000b', 'editor'),
  ('e2000000-0000-4000-8000-0000000000b2', 'e2000000-0000-4000-8000-00000000000c', 'editor'),
  ('e2000000-0000-4000-8000-0000000000b2', 'e2000000-0000-4000-8000-00000000000d', 'viewer'),
  ('e2000000-0000-4000-8000-0000000000b2', 'e2000000-0000-4000-8000-00000000000f', 'viewer'),
  ('e2000000-0000-4000-8000-0000000000b2', 'e2000000-0000-4000-8000-000000000011', 'viewer'),
  ('e2000000-0000-4000-8000-0000000000b2', 'e2000000-0000-4000-8000-000000000012', 'viewer'),
  ('e2000000-0000-4000-8000-0000000000b2', 'e2000000-0000-4000-8000-000000000014', 'editor');

-- ----------------------------------------------------------------------------
-- 1-17. Présence des tables, fonctions, index, clés composites, policies
-- ----------------------------------------------------------------------------
SELECT has_table('public', 'route_workspaces', 'table route_workspaces existe');
SELECT has_table('public', 'route_workspace_members', 'table route_workspace_members existe');
SELECT has_table('public', 'route_points', 'table route_points existe');
SELECT has_table('public', 'route_sections', 'table route_sections existe');
SELECT has_table('public', 'route_stages', 'table route_stages existe');
SELECT has_table('public', 'route_operations', 'table route_operations existe');
SELECT has_table('public', 'route_revisions', 'table route_revisions existe');
SELECT has_function('public', 'apply_route_operation_tx', 'RPC apply_route_operation_tx existe');
SELECT has_function('public', 'publish_route_revision_tx', 'RPC publish_route_revision_tx existe');
SELECT has_function('public', 'create_route_workspace_tx', 'RPC create_route_workspace_tx existe');
SELECT has_function('public', 'write_route_workspace_part_tx', 'RPC write_route_workspace_part_tx existe');
SELECT has_function('public', 'set_route_member_tx', 'RPC set_route_member_tx existe');
SELECT has_function('public', 'manage_route_share_link_tx', 'RPC manage_route_share_link_tx existe');
SELECT has_function('public', 'get_shared_route_workspace_tx', 'RPC get_shared_route_workspace_tx existe');

-- 11. Index : workspace_id sur les tables filles, user_id sur participant_pack_states, clés (workspace_id, id).
SELECT ok(
  (SELECT bool_and(c) FROM (VALUES
     (EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_route_proposals_workspace')),
     (EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_route_comments_workspace')),
     (EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_departure_packs_workspace')),
     (EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_participant_pack_states_user'))
  ) AS t(c)),
  '15. index workspace_id (proposals, comments, packs) et user_id (participant_pack_states) présents'
);
SELECT col_is_pk('public', 'route_operations', ARRAY['workspace_id', 'seq'], '16. route_operations : la clé (workspace_id, seq) sert les lectures par espace');
SELECT col_is_pk('public', 'route_points', ARRAY['workspace_id', 'id'], '17. route_points : clé primaire (workspace_id, id)');
SELECT col_is_pk('public', 'route_sections', ARRAY['workspace_id', 'id'], '18. route_sections : clé primaire (workspace_id, id)');
SELECT col_is_pk('public', 'route_stages', ARRAY['workspace_id', 'id'], '19. route_stages : clé primaire (workspace_id, id)');
SELECT ok(
  (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.route_sections'::regclass AND contype = 'f' AND cardinality(conkey) = 2) = 2
  AND (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.route_stages'::regclass AND contype = 'f' AND cardinality(conkey) = 2) = 2,
  '20. tronçons et étapes : clés étrangères composites (workspace_id, point)'
);
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND cmd = 'SELECT'
     AND tablename IN ('route_workspaces', 'route_workspace_members', 'route_points', 'route_sections', 'route_stages',
                       'route_operations', 'route_revisions', 'route_proposals', 'route_comments', 'departure_packs')
     AND qual LIKE '%readable_route_workspace_ids%'),
  10,
  '21. policies SELECT : sous-requête SETOF readable_route_workspace_ids() (évaluée une fois par requête)'
);

-- 12. Privilèges de table : aucune écriture directe pour anon / authenticated, rien du tout pour anon.
SELECT is(
  (SELECT count(*)::int
   FROM unnest(ARRAY['route_workspaces', 'route_workspace_members', 'route_points', 'route_sections', 'route_stages',
                     'route_operations', 'route_revisions', 'route_proposals', 'route_comments', 'departure_packs',
                     'participant_pack_states']) AS n
   WHERE has_table_privilege('authenticated', 'public.' || n, 'INSERT')
      OR has_table_privilege('authenticated', 'public.' || n, 'UPDATE')
      OR has_table_privilege('authenticated', 'public.' || n, 'DELETE')
      OR has_table_privilege('authenticated', 'public.' || n, 'TRUNCATE')
      OR has_table_privilege('anon', 'public.' || n, 'SELECT')
      OR has_table_privilege('anon', 'public.' || n, 'INSERT')),
  0,
  '22. 12 : INSERT/UPDATE/DELETE/TRUNCATE retirés à authenticated, aucun droit pour anon sur les 11 tables'
);

-- ----------------------------------------------------------------------------
-- 20-24. Création (A)
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';

SELECT is(
  public.create_route_workspace_tx(
    'e2000000-0000-4000-8000-0000000000b2', 'Itinéraire RLS', 'marche',
    '{"id":"x","members":[{"userId":"e2000000-0000-4000-8000-00000000000e","role":"owner"}],"points":[],"sections":[],"stages":[],"comments":[],"proposals":[],"kitItems":[]}'::jsonb,
    'e2000000-0000-4000-8000-0000000000a1'
  ),
  'e2000000-0000-4000-8000-0000000000a1'::uuid,
  '23. create_route_workspace_tx renvoie l''id du nouvel espace (lié au voyage T1)'
);

SELECT is(
  (SELECT role FROM public.route_workspace_members
   WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1' AND user_id = 'e2000000-0000-4000-8000-00000000000a'),
  'owner',
  '24. le créateur est inscrit owner dans route_workspace_members'
);

SELECT is(
  (SELECT jsonb_array_length(state_snapshot -> 'members') FROM public.route_workspaces
   WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
  1,
  '25. les membres du snapshot fourni sont ignorés : seul l''appelant (owner) est inscrit'
);

SELECT throws_ok(
  $$SELECT public.create_route_workspace_tx('e2000000-0000-4000-8000-0000000000b1', 'Sur le voyage de E', 'marche', '{}'::jsonb, NULL)$$,
  '42501',
  'trip_edit_required',
  '26. création refusée sur un voyage que l''appelant ne peut pas éditer'
);

SELECT throws_ok(
  $$SELECT public.create_route_workspace_tx(NULL, 'Forme invalide', 'marche', '{"points":{"a":1}}'::jsonb, NULL)$$,
  '22023',
  'invalid_snapshot_shape',
  '27. 8 : instantané initial dont points n''est pas un tableau refusé'
);

SELECT is(
  public.create_route_workspace_tx(NULL, 'Sans voyage', 'marche', '{}'::jsonb, 'e2000000-0000-4000-8000-0000000000a2'),
  'e2000000-0000-4000-8000-0000000000a2'::uuid,
  '28. espace sans voyage créé (a2)'
);

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.create_route_workspace_tx(NULL, 'Anonyme', 'marche', '{}'::jsonb, NULL)$$,
  '42501',
  NULL,
  '29. anon ne peut pas exécuter create_route_workspace_tx'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';

-- ----------------------------------------------------------------------------
-- 27-28. Aucune écriture directe sur route_workspaces
-- ----------------------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.route_workspaces (created_by, title) VALUES ('e2000000-0000-4000-8000-00000000000a', 'Contournement')$$,
  '42501',
  NULL,
  '30. INSERT direct refusé'
);
SELECT throws_ok(
  $$UPDATE public.route_workspaces SET title = 'Piraté', head_seq = 99 WHERE id = 'e2000000-0000-4000-8000-0000000000a1'$$,
  '42501',
  NULL,
  '31. UPDATE direct refusé (privilège retiré)'
);

-- ----------------------------------------------------------------------------
-- 29-37. Gestion des membres par A (6 : seuls les collaborateurs du voyage ; pas de lecture de auth.users)
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT (public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000b', 'co_organizer', false, false, 'Bea')) ->> 'status'),
  'ok',
  '32. l''owner nomme B (collaborateur du voyage) co_organizer'
);
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000c', 'editor', false, false, NULL);
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000d', 'external_viewer', false, false, 'Dora');
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000f', 'participant', false, false, NULL);
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000011', 'contributor', false, false, 'Gaspard');

SELECT is(
  (SELECT jsonb_array_length(state_snapshot -> 'members') FROM public.route_workspaces
   WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
  6,
  '33. la table ET state_snapshot->members contiennent 6 membres'
);

SELECT is(
  (SELECT m ->> 'displayName' FROM public.route_workspaces w, jsonb_array_elements(w.state_snapshot -> 'members') m
   WHERE w.id = 'e2000000-0000-4000-8000-0000000000a1' AND m ->> 'userId' = 'e2000000-0000-4000-8000-00000000000c'),
  'Voyageur e20000',
  '34. 6 : le nom affiché ne vient plus de raw_user_meta_data (libellé neutre)'
);

SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000013', 'editor', false, false, 'Intruse')) ->> 'reason',
  'not_eligible',
  '35. 6 : une personne étrangère au voyage n''est pas éligible'
);

SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-0000000000ff', 'editor', false, false, NULL)) ->> 'reason',
  'not_eligible',
  '36. 6 : un UUID inexistant donne la même réponse (l''existence n''est pas révélée)'
);

SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a2', 'e2000000-0000-4000-8000-00000000000b', 'editor', false, false, NULL)) ->> 'reason',
  'not_eligible',
  '37. 6 : un espace sans voyage n''accepte aucun nouveau membre'
);

-- ----------------------------------------------------------------------------
-- 35-45. Éditeur C : opération acceptée ; version obligatoire ; conflits ; hash SQL ; tailles
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000c';

SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-1', 0, 'move_point',
     '{"type":"move_point"}'::jsonb, 'hash-fourni-ignore', '{}'::jsonb,
     '{"points":[{"id":"p1"}],"updatedAt":"2026-11-22T10:00:00.000Z","members":[{"userId":"pirate","role":"owner"}]}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'status'),
  'accepted',
  '38. l''éditeur applique une opération (base_seq = head_seq)'
);

SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-2', 1, 'move_point',
     '{"type":"move_point"}'::jsonb, 'h', '{}'::jsonb, '{"points":[]}'::jsonb, NULL
   ) ->> 'reason'),
  'expected_version_required',
  '39. 2 : p_expected_version NULL => refus (apply)'
);

SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-2', 0, 'move_point',
     '{"type":"move_point"}'::jsonb, 'h', '{}'::jsonb, '{"points":[]}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'status'),
  'conflict',
  '40. base_seq périmé => conflict (aucune écriture)'
);

SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-1', 0, 'move_point',
     '{"type":"move_point"}'::jsonb, 'autre-hash-ignore', '{}'::jsonb, '{"points":[]}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'status'),
  'already_applied',
  '41. même op_id et même payload => already_applied (le hash fourni est ignoré)'
);

SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-1', 1, 'move_point',
     '{"type":"move_point","pointId":"autre"}'::jsonb, 'hash-1', '{}'::jsonb, '{"points":[]}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'reason'),
  'idempotency_payload_mismatch',
  '42. même op_id, payload différent => refus (hash calculé en SQL)'
);

SELECT is(
  (SELECT payload_hash FROM public.route_operations WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1' AND op_id = 'op-1'),
  encode(extensions.digest('{"type": "move_point"}', 'sha256'), 'hex'),
  '43. 8 : payload_hash = SHA-256 du payload calculé par la base'
);

SELECT is(
  (SELECT state_snapshot -> 'members' -> 0 ->> 'userId' FROM public.route_workspaces
   WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
  'e2000000-0000-4000-8000-00000000000a',
  '44. l''opération ne peut pas réécrire members dans le snapshot (fusion des clés propres)'
);

SELECT is(
  (SELECT (state_snapshot ->> 'headSeq')::int FROM public.route_workspaces
   WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
  1,
  '45. headSeq du snapshot = head_seq après acceptation'
);

SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-big', 1, 'update_stage_note',
     jsonb_build_object('type', 'update_stage_note', 'notes', repeat('x', 250000)), 'h', '{}'::jsonb, '{"points":[]}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'reason'),
  'payload_too_large',
  '46. 8 : payload > 200 Ko refusé'
);

SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-shape', 1, 'move_point',
     '{"type":"move_point"}'::jsonb, 'h', '{}'::jsonb, '{"points":{"a":1}}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'reason'),
  'invalid_snapshot_shape',
  '47. 8 : points qui n''est pas un tableau refusé (jsonb_typeof)'
);

SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-huge', 1, 'move_point',
     '{"type":"move_point"}'::jsonb, 'h', '{}'::jsonb,
     jsonb_build_object('points', jsonb_build_array(repeat('y', 5100000))),
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'reason'),
  'payload_too_large',
  '48. 8 : état suivant > 5 Mo refusé'
);

-- ----------------------------------------------------------------------------
-- 46-62. Parties : rôles autorisés (2), liste blanche, version obligatoire, objets seulement
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'comments', '[{"id":"c1"}]'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
  'ok',
  '49. un éditeur écrit la partie comments'
);

SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'members', '[]'::jsonb, 0) ->> 'reason'),
  'part_not_allowed',
  '50. une clé hors liste blanche (members) est refusée'
);

SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'comments', '[]'::jsonb, NULL) ->> 'reason'),
  'expected_version_required',
  '51. 2 : p_expected_version NULL => refus (write_part)'
);

SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'comments', '["texte"]'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'reason'),
  'invalid_value',
  '52. 8 : un élément qui n''est pas un objet est refusé'
);

-- D : external_viewer (membre) refusé ; H : trip_viewer refusé ; F : participant ; G : contributeur
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000d';
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'comments', '[]'::jsonb, 0) ->> 'status'),
  'denied',
  '53. external_viewer refusé sur write_route_workspace_part_tx'
);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-000000000012';
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'comments', '[]'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
  'denied',
  '54. 2 : trip_viewer (collaborateur lecteur du voyage) refusé sur comments'
);
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'kitItems', '[]'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
  'denied',
  '55. 2 : trip_viewer refusé sur kitItems'
);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000f';
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'comments', '[]'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
  'denied',
  '56. 2 : participant refusé sur comments'
);
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'proposals', '[]'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
  'denied',
  '57. 2 : participant refusé sur proposals'
);
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'notifications', '[]'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
  'denied',
  '58. 2 : participant refusé sur notifications'
);
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'participantPacks', '[{"userId":"u"}]'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
  'ok',
  '59. 2 : participant autorisé sur participantPacks'
);
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'kitItems', '[{"id":"k1"}]'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
  'ok',
  '60. 2 : participant autorisé sur kitItems'
);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-000000000011';
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'proposals', '[{"id":"pr1"}]'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
  'ok',
  '61. 2 : contributeur autorisé sur proposals'
);
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'notifications', '[]'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
  'denied',
  '62. 2 : contributeur refusé sur notifications'
);

-- J : collaborateur éditeur du voyage sans ligne de membre (trip_editor)
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-000000000014';
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'notifications', '[]'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
  'ok',
  '63. 2 : trip_editor autorisé sur notifications'
);
SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-j', 1, 'move_point',
     '{"type":"move_point","pointId":"p1"}'::jsonb, 'h', '{}'::jsonb, '{"points":[{"id":"p1"}]}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'status'),
  'accepted',
  '64. trip_editor peut modifier le tracé'
);

-- Participant et lecteur du voyage ne modifient pas le tracé
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000f';
SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-3', 2, 'move_point',
     '{"type":"move_point"}'::jsonb, 'hash-3', '{}'::jsonb, '{"points":[]}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'status'),
  'denied',
  '65. un participant ne peut pas modifier le tracé'
);
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-000000000012';
SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-h', 2, 'move_point',
     '{"type":"move_point"}'::jsonb, 'h', '{}'::jsonb, '{"points":[]}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'status'),
  'denied',
  '66. un trip_viewer ne peut pas modifier le tracé'
);

-- ----------------------------------------------------------------------------
-- 64-77. Co-organisateur B, propriétaire figé, delegated_publish (7)
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000012', 'owner', false, false, 'Hugo');

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000b';
SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000012', NULL, true, NULL) ->> 'reason'),
  'owner_protected',
  '67. un co_organizer ne peut pas révoquer un owner'
);
SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000a', NULL, true, NULL) ->> 'status'),
  'denied',
  '68. un co_organizer ne peut pas révoquer le créateur'
);
SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000c', 'owner', false, NULL) ->> 'reason'),
  'owner_protected',
  '69. un co_organizer ne peut pas nommer un owner'
);
SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000b', NULL, false, true) ->> 'reason'),
  'delegated_publish_requires_owner',
  '70. un co_organizer ne peut pas s''octroyer la délégation de publication'
);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000a', NULL, true, NULL) ->> 'reason'),
  'creator_immutable',
  '71. le créateur (propriétaire du voyage) n''est pas révocable, même par lui-même'
);

SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000b', 'co_organizer', false, true, NULL);
SELECT is(
  (SELECT delegated_publish FROM public.route_workspace_members
   WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1' AND user_id = 'e2000000-0000-4000-8000-00000000000b'),
  true,
  '72. l''owner accorde la délégation de publication à un co_organizer'
);

SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000b', 'editor', false, true, NULL);
SELECT is(
  (SELECT delegated_publish FROM public.route_workspace_members
   WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1' AND user_id = 'e2000000-0000-4000-8000-00000000000b'),
  false,
  '73. 7 : delegated_publish forcé à false quand le rôle n''est plus co_organizer'
);

SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000b', 'co_organizer', false, NULL, NULL);
SELECT is(
  (SELECT delegated_publish FROM public.route_workspace_members
   WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1' AND user_id = 'e2000000-0000-4000-8000-00000000000b'),
  false,
  '74. 7 : repasser co_organizer ne rétablit pas la délégation'
);

-- G : co_organizer avec délégation, puis B révoqué (délégation retombée à false)
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000011', 'co_organizer', false, true, NULL);
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000b', NULL, true, true, NULL);
SELECT is(
  (SELECT delegated_publish::text || ':' || (revoked_at IS NOT NULL)::text FROM public.route_workspace_members
   WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1' AND user_id = 'e2000000-0000-4000-8000-00000000000b'),
  'false:true',
  '75. 7 : la révocation force delegated_publish à false'
);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-000000000011';
SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000b', NULL, false, NULL) ->> 'reason'),
  'reactivation_requires_owner',
  '76. 7 : un co_organizer ne réactive pas un membre révoqué'
);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000b', 'co_organizer', false, false, NULL);
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000b';
SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000011', 'editor', false, NULL) ->> 'reason'),
  'delegated_publish_requires_owner',
  '77. 7 : un co_organizer ne promeut/rétrograde pas une cible qui porte la délégation'
);
SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000c', 'co_organizer', false, true) ->> 'reason'),
  'delegated_publish_requires_owner',
  '78. 7 : un co_organizer n''accorde pas la délégation à autrui'
);

-- ----------------------------------------------------------------------------
-- 76-80. Rôle du créateur adossé au voyage (3) : a3 créé par C sur T1
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000c';
SELECT is(
  public.create_route_workspace_tx('e2000000-0000-4000-8000-0000000000b2', 'Espace de C', 'marche', '{}'::jsonb, 'e2000000-0000-4000-8000-0000000000a3'),
  'e2000000-0000-4000-8000-0000000000a3'::uuid,
  '79. C (éditeur du voyage) crée un espace sur T1'
);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT is(
  (SELECT public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a3', 'revoke', NULL, 500)) ->> 'status',
  'ok',
  '80. 3 : le propriétaire du voyage (sans ligne de membre) a le rôle owner sur l''espace d''un autre'
);
SELECT is(
  (SELECT count(*)::int FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a3'),
  1,
  '81. 3 : le propriétaire du voyage lit l''espace (cohérence RLS / rôle)'
);

RESET ROLE;
UPDATE public.trip_collaborators SET role = 'viewer'
WHERE trip_id = 'e2000000-0000-4000-8000-0000000000b2' AND user_id = 'e2000000-0000-4000-8000-00000000000c';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000c';
SELECT is(
  (SELECT public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a3', 'revoke', NULL, 500)) ->> 'status',
  'denied',
  '82. 3 : le créateur rétrogradé lecteur du voyage perd le rôle owner'
);

RESET ROLE;
DELETE FROM public.trip_collaborators
WHERE trip_id = 'e2000000-0000-4000-8000-0000000000b2' AND user_id = 'e2000000-0000-4000-8000-00000000000c';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000c';
SELECT is(
  (SELECT count(*)::int FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a3')
  + (SELECT CASE WHEN public.apply_route_operation_tx(
       'e2000000-0000-4000-8000-0000000000a3', 'op-c', 0, 'move_point', '{"type":"move_point"}'::jsonb, 'h', '{}'::jsonb,
       '{"points":[]}'::jsonb, public.rc_ver('e2000000-0000-4000-8000-0000000000a3')) ->> 'status' = 'denied' THEN 0 ELSE 1 END),
  0,
  '83. 3 : le créateur sorti du voyage n''a plus aucun droit (lecture et écriture)'
);
SELECT is(
  public.can_read_route_workspace('e2000000-0000-4000-8000-0000000000a3'),
  false,
  '84. 3 : can_read_route_workspace cohérent (faux pour le créateur sorti du voyage)'
);

-- Sans voyage : le créateur est owner (a2)
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a2', 'op-a2', 0, 'move_point', '{"type":"move_point"}'::jsonb, 'h', '{}'::jsonb,
     '{"points":[]}'::jsonb, public.rc_ver('e2000000-0000-4000-8000-0000000000a2')) ->> 'status'),
  'accepted',
  '85. sans voyage : le créateur reste owner'
);

-- ----------------------------------------------------------------------------
-- 83-89. external_viewer (5) : ni lecture directe, ni journal ; vue assainie
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000d';
SELECT is(
  (SELECT count(*)::int FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
  0,
  '86. 5 : external_viewer ne lit pas route_workspaces (snapshot complet)'
);
SELECT is(
  (SELECT count(*)::int FROM public.route_operations WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1')
  + (SELECT count(*)::int FROM public.route_revisions WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1')
  + (SELECT count(*)::int FROM public.departure_packs WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1')
  + (SELECT count(*)::int FROM public.route_workspace_members WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1'),
  0,
  '87. 5 : external_viewer ne lit ni journal, ni révisions, ni packs, ni membres'
);
SELECT is(
  public.can_read_route_workspace('e2000000-0000-4000-8000-0000000000a1'),
  false,
  '88. 5 : can_read_route_workspace faux pour external_viewer (lecture complète)'
);
SELECT is(
  (SELECT public.get_route_external_view_tx('e2000000-0000-4000-8000-0000000000a1')) ->> 'status',
  'ok',
  '89. 5 : external_viewer reçoit la vue assainie'
);
SELECT is(
  (SELECT (public.get_route_external_view_tx('e2000000-0000-4000-8000-0000000000a1') -> 'snapshot' -> 'comments')::text),
  '[]',
  '90. 5 : la vue assainie ne contient aucun commentaire'
);
SELECT is(
  (SELECT count(*)::int FROM jsonb_array_elements(public.get_route_external_view_tx('e2000000-0000-4000-8000-0000000000a1') -> 'snapshot' -> 'members') m
   WHERE m ? 'userId'),
  0,
  '91. 5 : les membres de la vue assainie n''ont pas de userId'
);
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT is(
  (SELECT public.get_route_external_view_tx('e2000000-0000-4000-8000-0000000000a1')) ->> 'status',
  'not_found',
  '92. 5 : un autre rôle n''utilise pas la vue externe (not_found)'
);

-- ----------------------------------------------------------------------------
-- 90-103. Lien de partage (4, 12)
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a1', 'create', NULL, 100)) ->> 'reason',
  'invalid_radius',
  '93. 1 : rayon < 200 m refusé'
);
SELECT is(
  (SELECT public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a1', 'create', NULL, 0)) ->> 'reason',
  'invalid_radius',
  '94. 12 : rayon 0 interdit'
);
SELECT is(
  (SELECT public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a1', 'create', now() - interval '1 hour', 500)) ->> 'reason',
  'invalid_expiry',
  '95. une expiration passée est refusée'
);

INSERT INTO public.rc_out
SELECT 'link1', public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a1', 'create', NULL, 500);

SELECT is(
  (SELECT v ->> 'status' FROM public.rc_out WHERE k = 'link1'),
  'ok',
  '96. l''owner crée un lien de partage'
);
SELECT ok(
  (SELECT char_length(v ->> 'token') >= 32 AND (v ->> 'token') LIKE 'shr-%' FROM public.rc_out WHERE k = 'link1'),
  '97. 4 : le jeton (>= 32 caractères) est généré par la base et renvoyé une fois'
);
SELECT is(
  public.rc_hash('e2000000-0000-4000-8000-0000000000a1'),
  (SELECT encode(extensions.digest(v ->> 'token', 'sha256'), 'hex') FROM public.rc_out WHERE k = 'link1'),
  '98. 4 : seul le SHA-256 du jeton est stocké'
);
SELECT ok(
  (SELECT NOT (state_snapshot -> 'shareLink' ? 'token') AND state_snapshot -> 'shareLink' ? 'expiresAt'
          AND state_snapshot -> 'shareLink' ? 'revokedAt' AND state_snapshot -> 'shareLink' ? 'hidePrivateStartRadiusM'
   FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
  '99. 4 : le snapshot garde expiresAt/revokedAt/hidePrivateStartRadiusM mais jamais le jeton'
);
SELECT ok(
  (SELECT NOT (v -> 'shareLink' ? 'token') FROM public.rc_out WHERE k = 'link1'),
  '100. 4 : shareLink renvoyé sans jeton (clé token séparée)'
);

SET LOCAL ROLE anon;
SELECT is(
  (SELECT (public.get_shared_route_workspace_tx('e2000000-0000-4000-8000-0000000000a1', (SELECT v ->> 'token' FROM public.rc_out WHERE k = 'link1')) -> 'snapshot' -> 'proposals')::text),
  '[]',
  '101. lecture anon par jeton : snapshot assaini (propositions retirées)'
);
SELECT is(
  (SELECT public.get_shared_route_workspace_tx('e2000000-0000-4000-8000-0000000000a1', 'shr-ffffffffffffffffffffffffffffffffff') ->> 'status'),
  'not_found',
  '102. jeton invalide => not_found'
);
SELECT throws_ok(
  $$SELECT public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a1', 'create', NULL, 500)$$,
  '42501',
  NULL,
  '103. anon ne peut pas exécuter manage_route_share_link_tx'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT is(
  (SELECT public.get_shared_route_workspace_tx('e2000000-0000-4000-8000-0000000000a1',
     public.rc_hash('e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
  'not_found',
  '104. 4 : le hash stocké n''ouvre pas l''accès (il ne tient pas lieu de jeton)'
);

INSERT INTO public.rc_out
SELECT 'link2', public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a1', 'create', NULL, 500);
SELECT is(
  (SELECT public.get_shared_route_workspace_tx('e2000000-0000-4000-8000-0000000000a1', (SELECT v ->> 'token' FROM public.rc_out WHERE k = 'link1')) ->> 'status'),
  'not_found',
  '105. 4 : régénérer le lien invalide l''ancien jeton'
);
SELECT public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a1', 'revoke', NULL, 500);
SET LOCAL ROLE anon;
SELECT is(
  (SELECT public.get_shared_route_workspace_tx('e2000000-0000-4000-8000-0000000000a1', (SELECT v ->> 'token' FROM public.rc_out WHERE k = 'link2')) ->> 'status'),
  'revoked',
  '106. lien révoqué => revoked'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';

-- ----------------------------------------------------------------------------
-- 104-117. Lecture assainie (1) : boucle avec zone de départ privée
--   Départ « home » (45.8992, 6.1294) ; « near » à ~220 m ; « far » à ~2,2 km ; arrivée « fin » à ~45 m
--   du départ (boucle). Rayon 500 m.
-- ----------------------------------------------------------------------------
SELECT is(
  public.create_route_workspace_tx(
    NULL, 'Boucle privée', 'marche',
    jsonb_build_object(
      'tripId', 'trip-secret', 'shapeMode', 'loop',
      'sourceOrigin', jsonb_build_object('kind', 'gpx_import', 'sourceId', 'src-secret', 'sourceUrl', 'https://exemple.test/prive',
                                         'sourceTitle', 'Sortie', 'originalGpxXml', '<gpx>secret-gpx</gpx>'),
      'points', jsonb_build_array(
        jsonb_build_object('id', 'home', 'workspaceId', 'x', 'kind', 'start', 'orderKey', 'a0', 'lat', 45.8992, 'lon', 6.1294, 'eleM', 450, 'name', 'Chez moi', 'note', 'note secrète', 'entityVersion', 1),
        jsonb_build_object('id', 'near', 'workspaceId', 'x', 'kind', 'via', 'orderKey', 'a1', 'lat', 45.9012, 'lon', 6.1294, 'eleM', 451, 'name', 'Voisin', 'entityVersion', 1),
        jsonb_build_object('id', 'far', 'workspaceId', 'x', 'kind', 'via', 'orderKey', 'a2', 'lat', 45.9192, 'lon', 6.1294, 'eleM', 700, 'name', 'Sommet', 'entityVersion', 1),
        jsonb_build_object('id', 'fin', 'workspaceId', 'x', 'kind', 'finish', 'orderKey', 'a3', 'lat', 45.8996, 'lon', 6.1294, 'eleM', 452, 'name', 'Retour', 'entityVersion', 1),
        jsonb_build_object('id', 'gone', 'workspaceId', 'x', 'kind', 'via', 'orderKey', 'a4', 'lat', 45.9500, 'lon', 6.2000, 'deletedAt', '2026-11-01T00:00:00Z', 'entityVersion', 1)
      ),
      'sections', jsonb_build_array(
        jsonb_build_object('id', 's1', 'fromPointId', 'home', 'toPointId', 'near', 'mode', 'routed', 'distanceKm', 0.2,
          'geometry', jsonb_build_object('type', 'LineString', 'coordinates', jsonb_build_array(jsonb_build_array(6.1294, 45.8992), jsonb_build_array(6.1294, 45.9012))),
          'provenance', jsonb_build_object('provider', 'geoapify-secret', 'confidence', 'verified'), 'entityVersion', 1),
        jsonb_build_object('id', 's2', 'fromPointId', 'near', 'toPointId', 'far', 'mode', 'routed', 'distanceKm', 2,
          'geometry', jsonb_build_object('type', 'LineString', 'coordinates', (SELECT jsonb_agg(jsonb_build_array(6.1294, round((45.9012 + 0.001 * i)::numeric, 6))) FROM generate_series(0, 18) i)),
          'provenance', jsonb_build_object('provider', 'geoapify-secret'), 'entityVersion', 1),
        jsonb_build_object('id', 's3', 'fromPointId', 'far', 'toPointId', 'fin', 'mode', 'routed', 'distanceKm', 2.2,
          'geometry', jsonb_build_object('type', 'LineString', 'coordinates', (SELECT jsonb_agg(jsonb_build_array(6.1294, round((45.9192 - 0.00098 * i)::numeric, 6))) FROM generate_series(0, 20) i)),
          'elevationSamples', (SELECT jsonb_agg(500 + i) FROM generate_series(0, 20) i),
          'provenance', jsonb_build_object('provider', 'geoapify-secret'), 'surfaceSegments', '[]'::jsonb, 'entityVersion', 1)
      ),
      'stages', jsonb_build_array(
        jsonb_build_object('id', 'st1', 'workspaceId', 'x', 'orderKey', '001', 'dayNumber', 1, 'title', 'Jour 1', 'dateIso', '2026-11-23',
          'startPointId', 'home', 'endPointId', 'far', 'notes', 'secret note', 'entityVersion', 1,
          'overnightPlace', jsonb_build_object('id', 'o1', 'name', 'Refuge secret', 'lat', 45.9192, 'lon', 6.1294),
          'waterObservations', jsonb_build_array(jsonb_build_object('id', 'w', 'name', 'Source secrete', 'lat', 45.91, 'lon', 6.13)),
          'hazards', jsonb_build_array(jsonb_build_object('id', 'h', 'title', 'Danger secret')))
      ),
      'comments', jsonb_build_array(jsonb_build_object('id', 'c', 'body', 'commentaire secret')),
      'kitItems', jsonb_build_array(jsonb_build_object('id', 'k', 'name', 'objet secret')),
      'members', jsonb_build_array(jsonb_build_object('userId', 'e2000000-0000-4000-8000-00000000000a', 'displayName', 'Alice', 'role', 'owner'))
    ),
    'e2000000-0000-4000-8000-0000000000a4'
  ),
  'e2000000-0000-4000-8000-0000000000a4'::uuid,
  '107. espace a4 (boucle, zone de départ privée) créé'
);
INSERT INTO public.rc_out
SELECT 'link4', public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a4', 'create', NULL, 500);

SET LOCAL ROLE anon;
INSERT INTO public.rc_out
SELECT 'shared4', public.get_shared_route_workspace_tx('e2000000-0000-4000-8000-0000000000a4', (SELECT v ->> 'token' FROM public.rc_out WHERE k = 'link4'));
RESET ROLE;

SELECT is((SELECT v ->> 'status' FROM public.rc_out WHERE k = 'shared4'), 'ok', '108. lecture anon du lien de la boucle');

SELECT is(
  (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys((SELECT v -> 'snapshot' FROM public.rc_out WHERE k = 'shared4')) k),
  ARRAY['comments', 'headSeq', 'id', 'kitItems', 'members', 'packs', 'participantPacks', 'points', 'proposals', 'publishedRevisionNo',
        'reviewedSeq', 'revisions', 'routingOptions', 'sections', 'shapeMode', 'shareLink', 'sourceOrigin', 'sport', 'stages',
        'status', 'title', 'updatedAt', 'variants'],
  '109. 1 : clés du snapshot partagé = liste blanche (ni tripId, ni publishedRevisionId, ni clubEventId)'
);

SELECT is(
  (SELECT count(*)::int
   FROM jsonb_array_elements((SELECT v -> 'snapshot' -> 'points' FROM public.rc_out WHERE k = 'shared4')) p
   WHERE public.rc_hav(45.8992, 6.1294, (p ->> 'lat')::float8, (p ->> 'lon')::float8) <= 500),
  0,
  '110. 1 : aucun point dans le rayon de la zone de départ'
);

SELECT is(
  (SELECT count(*)::int
   FROM jsonb_array_elements((SELECT v -> 'snapshot' -> 'sections' FROM public.rc_out WHERE k = 'shared4')) s,
        jsonb_array_elements(s -> 'geometry' -> 'coordinates') c
   WHERE public.rc_hav(45.8992, 6.1294, (c ->> 1)::float8, (c ->> 0)::float8) <= 500),
  0,
  '111. 1 : aucune coordonnée de géométrie dans le rayon'
);

SELECT is(
  (SELECT string_agg(p ->> 'id' || ':' || coalesce(p ->> 'masked', '-'), ',' ORDER BY p ->> 'orderKey')
   FROM jsonb_array_elements((SELECT v -> 'snapshot' -> 'points' FROM public.rc_out WHERE k = 'shared4')) p),
  'home:true,far:-,fin:true',
  '112. 1 : départ et arrivée (boucle) déplacés hors du rayon, point intermédiaire de la zone retiré, point supprimé absent'
);

SELECT is(
  (SELECT p ->> 'name' FROM jsonb_array_elements((SELECT v -> 'snapshot' -> 'points' FROM public.rc_out WHERE k = 'shared4')) p WHERE p ->> 'id' = 'home'),
  'Départ (zone privée masquée)',
  '113. 1 : le départ masqué ne garde ni son nom, ni son altitude, ni sa note'
);

SELECT is(
  (SELECT string_agg(s ->> 'id', ',') FROM jsonb_array_elements((SELECT v -> 'snapshot' -> 'sections' FROM public.rc_out WHERE k = 'shared4')) s),
  's3',
  '114. 1 : seuls les tronçons entre deux points conservés restent'
);

SELECT ok(
  (SELECT NOT (s ? 'provenance') AND NOT (s ? 'elevationSamples') AND jsonb_array_length(s -> 'geometry' -> 'coordinates') < 21
   FROM jsonb_array_elements((SELECT v -> 'snapshot' -> 'sections' FROM public.rc_out WHERE k = 'shared4')) s LIMIT 1),
  '115. 1 : pas de provenance, altitudes retirées quand la géométrie est coupée'
);

SELECT is(
  (SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys((SELECT v -> 'snapshot' -> 'stages' -> 0 FROM public.rc_out WHERE k = 'shared4')) k),
  ARRAY['dateIso', 'dayNumber', 'distanceKm', 'endPointId', 'id', 'kind', 'orderKey', 'startPointId', 'title', 'workspaceId'],
  '116. 1 : étapes réduites (ni overnightPlace, ni notes, ni eau, ni dangers)'
);

SELECT is(
  (SELECT jsonb_array_length(v -> 'snapshot' -> 'members')::text || ':' || (v -> 'snapshot' -> 'members' -> 0)::text
   FROM public.rc_out WHERE k = 'shared4'),
  '1:{"role": "owner", "displayName": "Alice"}',
  '117. 1 : membres réduits à displayName + role (sans userId)'
);

SELECT is(
  (SELECT count(*)::int FROM unnest(ARRAY['trip-secret', 'src-secret', 'exemple.test', 'secret-gpx', 'secret note', 'Refuge secret',
                                          'Source secrete', 'Danger secret', 'commentaire secret', 'objet secret', 'geoapify-secret',
                                          'note secrète', 'Chez moi', 'Voisin', 'e2000000-0000-4000-8000-00000000000a']) AS needle
   WHERE position(needle IN (SELECT (v -> 'snapshot')::text FROM public.rc_out WHERE k = 'shared4')) > 0),
  0,
  '118. 1 : aucune donnée privée dans le texte du snapshot (tripId, sourceId/sourceUrl, GPX, notes, lieux, userId, noms)'
);

SELECT is(
  (SELECT v -> 'snapshot' ->> 'tripId' FROM public.rc_out WHERE k = 'shared4') IS NULL
  AND (SELECT v -> 'snapshot' -> 'sourceOrigin' ? 'originalGpxXml' FROM public.rc_out WHERE k = 'shared4') = false,
  true,
  '119. 1 : pas de tripId ; sourceOrigin sans originalGpxXml'
);

SELECT is(
  (SELECT count(*)::int
   FROM jsonb_array_elements(public.route_sanitize_snapshot_for_share(
          'e2000000-0000-4000-8000-0000000000a4',
          (SELECT state_snapshot FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a4'), 0, 10) -> 'points') p
   WHERE public.rc_hav(45.8992, 6.1294, (p ->> 'lat')::float8, (p ->> 'lon')::float8) <= 200),
  0,
  '120. 1 : rayon minimal 200 m même si un rayon plus petit est demandé'
);

SELECT is(
  public.route_sanitize_snapshot_for_share('e2000000-0000-4000-8000-0000000000a4', '{"points":[{"id":"a","kind":"start","orderKey":"a","lat":45.0,"lon":6.0}],"sections":[]}'::jsonb, 0, 500) -> 'points',
  '[]'::jsonb,
  '121. 1 : sans coordonnée hors du rayon, le départ n''est pas montré'
);

-- ----------------------------------------------------------------------------
-- 119-126. Publication (14) et espace archivé (12) sur a1
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000b', 'co_organizer', false, false, NULL);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000b';
SELECT is(
  (SELECT public.publish_route_revision_tx(
     'e2000000-0000-4000-8000-0000000000a1', 2, 'v1', '{}'::jsonb, 'chk', '{}'::jsonb, '{"status":"published"}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'reason'),
  'publish_permission_required',
  '122. un co_organizer sans délégation ne peut pas publier'
);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT is(
  (SELECT public.publish_route_revision_tx(
     'e2000000-0000-4000-8000-0000000000a1', 0, 'v1', '{}'::jsonb, 'chk', '{}'::jsonb, '{"status":"published"}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'reason'),
  'head_changed_requires_review',
  '123. publication bloquée si head_seq a changé depuis la relecture'
);

SELECT is(
  (SELECT public.publish_route_revision_tx(
     'e2000000-0000-4000-8000-0000000000a1', 2, 'v1', '{}'::jsonb, 'chk', '{}'::jsonb, '{"status":"published"}'::jsonb, NULL
   ) ->> 'reason'),
  'expected_version_required',
  '124. 2 : p_expected_version NULL => refus (publish)'
);

-- Instantané valide construit depuis l'état en base (rc_snap, défini en tête de fichier)

SELECT is(
  (SELECT public.publish_route_revision_tx(
     'e2000000-0000-4000-8000-0000000000a1', 2, 'v1',
     public.rc_snap('e2000000-0000-4000-8000-0000000000a1', 1) || '{"basedOnSeq": 1}'::jsonb,
     'chk', '{"checksum":"chk"}'::jsonb, '{"status":"published"}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'reason'),
  'snapshot_head_mismatch',
  '125. 14 : basedOnSeq de l''instantané différent de head_seq => refus'
);

SELECT is(
  (SELECT public.publish_route_revision_tx(
     'e2000000-0000-4000-8000-0000000000a1', 2, 'v1',
     jsonb_set(public.rc_snap('e2000000-0000-4000-8000-0000000000a1', 1), '{points}', '[{"id":"p1"},{"id":"intrus"}]'::jsonb),
     'chk', '{"checksum":"chk"}'::jsonb, '{"status":"published"}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'reason'),
  'snapshot_content_mismatch',
  '126. 14 : points publiés différents de ceux de la base => refus'
);

SELECT is(
  (SELECT public.publish_route_revision_tx(
     'e2000000-0000-4000-8000-0000000000a1', 2, 'v1',
     jsonb_set(public.rc_snap('e2000000-0000-4000-8000-0000000000a1', 1), '{stages}', '[{"id":"st-inventee"}]'::jsonb),
     'chk', '{"checksum":"chk"}'::jsonb, '{"status":"published"}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'reason'),
  'snapshot_content_mismatch',
  '127. 14 : étapes publiées différentes de celles de la base => refus'
);

-- G (co_organizer avec délégation) publie un instantané fidèle
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-000000000011';
SELECT is(
  (SELECT public.publish_route_revision_tx(
     'e2000000-0000-4000-8000-0000000000a1', 2, 'v1',
     public.rc_snap('e2000000-0000-4000-8000-0000000000a1', 1),
     'chk', '{"checksum":"chk"}'::jsonb,
     '{"revisions":[{"id":"rev-1"}],"packs":[{"packId":"pack-1"}],"updatedAt":"2026-11-22T11:00:00.000Z","members":[]}'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'status'),
  'published',
  '128. un co_organizer avec délégation publie un instantané fidèle à la base'
);

SELECT is(
  (SELECT (state_snapshot ->> 'status') || ':' || (state_snapshot ->> 'publishedRevisionNo') || ':' || jsonb_array_length(state_snapshot -> 'members')::text
   FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
  'published:1:7',
  '129. le snapshot est mis à jour dans la même transaction (members intact)'
);

-- Espace archivé : lecture seule (12) — a2 (sans voyage, créateur A)
RESET ROLE;
UPDATE public.route_workspaces SET status = 'archived' WHERE id = 'e2000000-0000-4000-8000-0000000000a2';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a2', 'op-arch', 1, 'move_point', '{"type":"move_point"}'::jsonb, 'h', '{}'::jsonb,
     '{"points":[]}'::jsonb, public.rc_ver('e2000000-0000-4000-8000-0000000000a2')) ->> 'reason'),
  'workspace_archived',
  '130. 12 : un espace archivé refuse apply_route_operation_tx'
);
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a2', 'comments', '[]'::jsonb,
     public.rc_ver('e2000000-0000-4000-8000-0000000000a2')) ->> 'reason'),
  'workspace_archived',
  '131. 12 : un espace archivé refuse write_route_workspace_part_tx'
);
SELECT is(
  (SELECT public.publish_route_revision_tx(
     'e2000000-0000-4000-8000-0000000000a2', 1, 'v1', public.rc_snap('e2000000-0000-4000-8000-0000000000a2', 1), 'chk',
     '{"checksum":"chk"}'::jsonb, '{"status":"published"}'::jsonb, public.rc_ver('e2000000-0000-4000-8000-0000000000a2')) ->> 'reason'),
  'workspace_archived',
  '132. 12 : un espace archivé refuse publish_route_revision_tx'
);

-- Journal : un membre révoqué ne lit plus ; un co_organizer lit
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000f', NULL, true, NULL, NULL);
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000f';
SELECT is(
  (SELECT count(*)::int FROM public.route_operations WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1'),
  0,
  '133. un membre révoqué ne lit plus le journal des opérations (RLS)'
);
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-000000000011';
SELECT is(
  (SELECT count(*)::int FROM public.route_operations WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1') > 0,
  true,
  '134. un co_organizer lit le journal des opérations'
);


-- ============================================================================
-- Troisième passe : B1 (masquage borné), N2 (membre retiré du voyage), route_jf, archivé, plafonds,
-- stage_scope_ids (8.3), temps réel privé (8.8), colonnes de sorties, share_token_hash.
-- ============================================================================
RESET ROLE;

-- route_jf : jamais d'exception sur un nombre hors bornes.
SELECT ok(public.route_jf('1e400'::jsonb) IS NULL AND public.route_jf('-1e400'::jsonb) IS NULL,
  '135. route_jf : 1e400 et -1e400 (dépassement) => NULL, sans exception');
SELECT is(public.route_jf('1e-400'::jsonb), 0::float8, '136. route_jf : 1e-400 (sous-dépassement) => 0, sans exception');
SELECT ok(public.route_jf('45.5'::jsonb) = 45.5 AND public.route_jf('"45.5"'::jsonb) IS NULL AND public.route_jf('null'::jsonb) IS NULL
          AND public.route_jf('1e299'::jsonb) IS NOT NULL AND public.route_jf('1e300'::jsonb) IS NULL,
  '137. route_jf : nombre ordinaire conservé, chaîne / null => NULL, borne 1e300');
SELECT lives_ok(
  $$SELECT public.route_sanitize_snapshot_for_share('e2000000-0000-4000-8000-0000000000a1', '{"points":[{"id":"a","kind":"start","orderKey":"a","lat":1e400,"lon":6.0},
      {"id":"b","kind":"via","orderKey":"b","lat":45.0,"lon":1e400},{"id":"c","kind":"finish","orderKey":"c","lat":46.0,"lon":7.0}],
      "sections":[{"id":"s","fromPointId":"c","toPointId":"c","geometry":{"coordinates":[[1e400,45.0],[6.0,1e-400],[7.0,46.0],"x",[7.1]]}}]}'::jsonb, 0, 500)$$,
  '138. masquage : coordonnées 1e400 / 1e-400 / types inattendus ne lèvent aucune exception');
SELECT is(
  (SELECT jsonb_array_length(public.route_sanitize_snapshot_for_share('e2000000-0000-4000-8000-0000000000a1',
     '{"points":[{"id":"c","kind":"via","orderKey":"c","lat":46.0,"lon":7.0}],
        "sections":[{"id":"s","fromPointId":"c","toPointId":"c","geometry":{"coordinates":[[1e400,45.0],[6.0,1e-400],[7.0,46.0],"x",[7.1]]}}]}'::jsonb, 0, 500)
     -> 'sections' -> 0 -> 'geometry' -> 'coordinates')),
  1,
  '139. masquage : seule la coordonnée numérique valide hors zone est gardée (1e400, texte, couple incomplet, point du départ retirés)');

-- Plafonds d'écriture (fonction interne, superuser).
SELECT ok(public.route_snapshot_within_caps(public.rc_big(2000, 1, 60, 500) -> 'points', public.rc_big(2000, 1, 60) -> 'sections', public.rc_big(2000, 1, 60) -> 'stages'),
  '140. plafonds : 2 000 points actifs (+ 500 supprimés non comptés), 1 999 tronçons, 60 étapes => accepté');
SELECT ok(NOT public.route_snapshot_within_caps(public.rc_big(2001, 1, 0) -> 'points', '[]', '[]'), '141. plafonds : 2 001 points actifs => refusé');
SELECT ok(NOT public.route_snapshot_within_caps('[]', public.rc_big(2002, 1, 0) -> 'sections', '[]'), '142. plafonds : 2 001 tronçons => refusé');
SELECT ok(NOT public.route_snapshot_within_caps('[]', public.rc_big(2, 80001, 0) -> 'sections', '[]')
          AND public.route_snapshot_within_caps('[]', public.rc_big(2, 80000, 0) -> 'sections', '[]'),
  '143. plafonds : 80 001 coordonnées refusé, 80 000 accepté');
SELECT ok(NOT public.route_snapshot_within_caps('[]', '[]', public.rc_big(2, 1, 61) -> 'stages') AND public.route_snapshot_within_caps(NULL, NULL, NULL)
          AND public.route_snapshot_within_caps('{}', '"x"', '5'),
  '144. plafonds : 61 étapes refusé ; NULL / non-tableau comptent pour vide');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT throws_ok(
  $$SELECT public.create_route_workspace_tx(NULL, 'Trop de points', 'marche', public.rc_big(2001, 1, 0))$$,
  '22023', 'snapshot_too_large', '145. create_route_workspace_tx : 2 001 points actifs => snapshot_too_large');
SELECT throws_ok(
  $$SELECT public.create_route_workspace_tx(NULL, 'Trop de coordonnées', 'marche', public.rc_big(2, 80001, 0))$$,
  '22023', 'snapshot_too_large', '146. create_route_workspace_tx : 80 001 coordonnées => snapshot_too_large');
SELECT is(
  (SELECT public.apply_route_operation_tx('e2000000-0000-4000-8000-0000000000a1', 'op-too-large', 1, 'move_point', '{"type":"move_point"}'::jsonb, 'h', '{}'::jsonb,
     jsonb_build_object('points', public.rc_big(2001, 1, 0) -> 'points'), public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'reason'),
  'snapshot_too_large',
  '147. apply_route_operation_tx : plus de 2 000 points actifs => snapshot_too_large');
SELECT is(
  (SELECT public.apply_route_operation_tx('e2000000-0000-4000-8000-0000000000a1', 'op-too-large-st', 1, 'move_point', '{"type":"move_point"}'::jsonb, 'h', '{}'::jsonb,
     jsonb_build_object('stages', public.rc_big(2, 1, 61) -> 'stages'), public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'reason'),
  'snapshot_too_large',
  '148. apply_route_operation_tx : 61 étapes => snapshot_too_large');
SELECT is(
  (SELECT public.publish_route_revision_tx('e2000000-0000-4000-8000-0000000000a1', 0, 'v', jsonb_build_object('points', public.rc_big(2001, 1, 0) -> 'points'), 'chk',
     '{}'::jsonb, '{}'::jsonb, public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'reason'),
  'snapshot_too_large',
  '149. publish_route_revision_tx : instantané publié au-delà des plafonds => snapshot_too_large');
SELECT is(
  (SELECT public.apply_route_operation_tx('e2000000-0000-4000-8000-0000000000a1', 'op-ev-big', 1, 'move_point', '{"type":"move_point"}'::jsonb, 'h',
     (SELECT jsonb_object_agg('e' || i, i) FROM generate_series(1, 20000) i), '{"points":[]}'::jsonb, public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'reason'),
  'payload_too_large',
  '150. apply_route_operation_tx : p_entity_versions de plus de 100 Ko => payload_too_large');

-- create_route_workspace_tx : tripId jamais recopié du snapshot fourni.
INSERT INTO public.rc_out
SELECT 'ws_notrip', to_jsonb(public.create_route_workspace_tx(NULL, 'Sans voyage', 'marche', '{"tripId":"trip-evil","points":[]}'::jsonb)::text);
SELECT is(
  (SELECT state_snapshot -> 'tripId' FROM public.route_workspaces WHERE id = (SELECT (v #>> '{}')::uuid FROM public.rc_out WHERE k = 'ws_notrip')),
  'null'::jsonb,
  '151. create_route_workspace_tx : sans p_trip_id, le tripId du snapshot fourni n''est pas recopié');

-- B1 : masquage d'un instantané AU PLAFOND (2 000 points actifs + 300 supprimés, 1 999 tronçons, 79 960
-- coordonnées, 60 étapes) lu par anon : durée mesurée, résultat exact.
INSERT INTO public.rc_out SELECT 'big_src', public.rc_big(2000, 40, 60, 300);
INSERT INTO public.rc_out
SELECT 'big_id', to_jsonb(public.create_route_workspace_tx(NULL, 'Plafond', 'marche', public.rc_big(2000, 40, 60, 300), 'e2000000-0000-4000-8000-0000000000c1'::uuid)::text);
INSERT INTO public.rc_out SELECT 'big_link', public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000c1', 'create', NULL, 500);
SET LOCAL ROLE anon;
DO $do$
DECLARE
  t0 timestamptz;
  r JSONB;
BEGIN
  t0 := clock_timestamp();
  r := public.get_shared_route_workspace_tx('e2000000-0000-4000-8000-0000000000c1', (SELECT v ->> 'token' FROM public.rc_out WHERE k = 'big_link'));
  INSERT INTO public.rc_out VALUES ('big_ms', to_jsonb(extract(epoch FROM clock_timestamp() - t0) * 1000));
  INSERT INTO public.rc_out VALUES ('big_res', r);
END;
$do$;
RESET ROLE;
SELECT diag('B1 : masquage anon au plafond = ' || round((SELECT (v #>> '{}')::numeric FROM public.rc_out WHERE k = 'big_ms')) || ' ms');
SELECT ok((SELECT (v #>> '{}')::numeric FROM public.rc_out WHERE k = 'big_ms') < 500,
  '152. B1 : masquage d''un instantané au plafond (2 000 points, 1 999 tronçons, ~80 000 coordonnées) en moins de 500 ms');
SELECT is((SELECT v ->> 'status' FROM public.rc_out WHERE k = 'big_res'), 'ok', '153. B1 : lecture anon au plafond => ok');
-- Sources pré-extraites (une seule fois : extraire dans une jointure rejouerait la lecture d'un jsonb de plusieurs Mo).
CREATE TEMP TABLE rc_last AS
  SELECT (v -> 'points' -> 1999 ->> 'lat')::float8 AS la, (v -> 'points' -> 1999 ->> 'lon')::float8 AS lo
  FROM public.rc_out WHERE k = 'big_src';
CREATE TEMP TABLE rc_src_p AS
  SELECT (p ->> 'lat')::float8 AS lat, (p ->> 'lon')::float8 AS lon
  FROM public.rc_out src, jsonb_array_elements(src.v -> 'points') p
  WHERE src.k = 'big_src' AND COALESCE(p ->> 'deletedAt', '') = '';
SELECT is(
  (SELECT jsonb_array_length(v -> 'snapshot' -> 'points') FROM public.rc_out WHERE k = 'big_res'),
  (SELECT (count(*) + 2)::int FROM rc_src_p p, rc_last f
   WHERE public.rc_hav(45.8992, 6.1294, p.lat, p.lon) > 500 AND public.rc_hav(f.la, f.lo, p.lat, p.lon) > 500),
  '154. B1 : points conservés = points hors des deux zones (départ et arrivée de la boucle) + départ/arrivée masqués');
SELECT is(
  (SELECT count(*)::int
   FROM jsonb_array_elements((SELECT v -> 'snapshot' -> 'sections' FROM public.rc_out WHERE k = 'big_res')) s,
        jsonb_array_elements(s -> 'geometry' -> 'coordinates') c
   WHERE public.rc_hav(45.8992, 6.1294, (c ->> 1)::float8, (c ->> 0)::float8) <= 500),
  0,
  '155. B1 : aucune coordonnée de géométrie dans le rayon, au plafond');
CREATE TEMP TABLE rc_kept AS
  SELECT p ->> 'id' AS id FROM public.rc_out o, jsonb_array_elements(o.v -> 'snapshot' -> 'points') p WHERE o.k = 'big_res';
CREATE TEMP TABLE rc_src_c AS
  SELECT s ->> 'fromPointId' AS f, s ->> 'toPointId' AS t, (c ->> 0)::float8 AS lon, (c ->> 1)::float8 AS lat
  FROM public.rc_out src, jsonb_array_elements(src.v -> 'sections') s, jsonb_array_elements(s -> 'geometry' -> 'coordinates') c
  WHERE src.k = 'big_src';
ANALYZE rc_kept;
ANALYZE rc_src_c;
SELECT is(
  (SELECT sum(jsonb_array_length(s -> 'geometry' -> 'coordinates'))::int
   FROM jsonb_array_elements((SELECT v -> 'snapshot' -> 'sections' FROM public.rc_out WHERE k = 'big_res')) s),
  (SELECT count(*)::int
   FROM rc_src_c c, rc_last f
   WHERE c.f IN (SELECT id FROM rc_kept) AND c.t IN (SELECT id FROM rc_kept)
     AND public.rc_hav(45.8992, 6.1294, c.lat, c.lon) > 500
     AND public.rc_hav(f.la, f.lo, c.lat, c.lon) > 500),
  '156. B1 : coordonnées conservées = celles des tronçons entre points conservés hors des deux zones');
SELECT is(
  (SELECT count(*)::int FROM unnest(ARRAY['note secrete', 'secret-provider']) AS needle
   WHERE position(needle IN (SELECT (v -> 'snapshot')::text FROM public.rc_out WHERE k = 'big_res')) > 0),
  0,
  '157. B1 : aucune donnée privée (notes, provenance) dans le snapshot masqué au plafond');
SELECT is(
  (SELECT jsonb_array_length(v -> 'snapshot' -> 'stages') FROM public.rc_out WHERE k = 'big_res'),
  60,
  '158. B1 : les 60 étapes sont rendues (identifiants de points non conservés mis à null)');

-- N2 + 8.3 : stage_scope_ids. J (collaborateur éditeur du voyage T1) devient contributeur avec deux étapes confiées.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000014', 'contributor', false, false, 'Jo', ARRAY['st-1', 'st-2']) ->> 'status'),
  'ok',
  '159. 8.3 : set_route_member_tx écrit une étape confiée (p_stage_scope_ids)');
SELECT is(
  (SELECT stage_scope_ids FROM public.route_workspace_members WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1' AND user_id = 'e2000000-0000-4000-8000-000000000014'),
  ARRAY['st-1', 'st-2'],
  '160. 8.3 : la colonne stage_scope_ids est écrite');
SELECT is(
  (SELECT m -> 'stageScopeIds' FROM public.route_workspaces w, jsonb_array_elements(w.state_snapshot -> 'members') m
   WHERE w.id = 'e2000000-0000-4000-8000-0000000000a1' AND m ->> 'userId' = 'e2000000-0000-4000-8000-000000000014'),
  '["st-1", "st-2"]'::jsonb,
  '161. 8.3 : stageScopeIds est écrit dans state_snapshot -> members');
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000014', 'contributor', false, false, NULL, NULL);
SELECT is(
  (SELECT stage_scope_ids FROM public.route_workspace_members WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1' AND user_id = 'e2000000-0000-4000-8000-000000000014'),
  ARRAY['st-1', 'st-2'],
  '162. 8.3 : p_stage_scope_ids NULL = inchangé');
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000014', NULL, NULL, NULL, NULL, ARRAY['st-3']);
SELECT is(
  (SELECT stage_scope_ids FROM public.route_workspace_members WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1' AND user_id = 'e2000000-0000-4000-8000-000000000014'),
  ARRAY['st-3'],
  '163. 8.3 : une nouvelle liste remplace l''ancienne, rôle inchangé');
SELECT is(
  (SELECT (public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000014', NULL, NULL, NULL, NULL, ARRAY['st 1']) ->> 'reason')
          || (public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000014', NULL, NULL, NULL, NULL, ARRAY['ok', NULL]) ->> 'reason')
          || (public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000014', NULL, NULL, NULL, NULL, ARRAY[repeat('a', 81)]) ->> 'reason')
          || (public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000014', NULL, NULL, NULL, NULL, (SELECT array_agg('s' || i) FROM generate_series(1, 61) i)) ->> 'reason')),
  'invalid_stage_scopeinvalid_stage_scopeinvalid_stage_scopeinvalid_stage_scope',
  '164. 8.3 : identifiant hors [A-Za-z0-9_-], NULL, > 80 caractères ou > 60 éléments => invalid_stage_scope');
SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000014', NULL, NULL, NULL, NULL, (SELECT array_agg('s' || i) FROM generate_series(1, 60) i)) ->> 'status'),
  'ok',
  '165. 8.3 : 60 identifiants acceptés');
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000014', NULL, NULL, NULL, NULL, ARRAY[]::text[]);
SELECT is(
  (SELECT stage_scope_ids FROM public.route_workspace_members WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1' AND user_id = 'e2000000-0000-4000-8000-000000000014'),
  ARRAY[]::text[],
  '166. 8.3 : tableau vide = plus d''étape confiée');
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000c';
SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000014', NULL, NULL, NULL, NULL, ARRAY['st-9']) ->> 'reason'),
  'member_management_requires_owner_or_co_organizer',
  '167. 8.3 : un éditeur ne peut pas confier d''étape (mêmes règles que le reste de la fonction)');

-- N2 : J, contributeur de l'espace, est retiré de trip_collaborators => plus aucun accès.
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-000000000014';
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'comments', '[]'::jsonb, public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
  'ok',
  '168. N2 : tant qu''il est collaborateur du voyage, le contributeur écrit');
RESET ROLE;
DELETE FROM public.trip_collaborators WHERE trip_id = 'e2000000-0000-4000-8000-0000000000b2' AND user_id = 'e2000000-0000-4000-8000-000000000014';
SELECT ok(
  (SELECT revoked_at IS NULL FROM public.route_workspace_members WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1' AND user_id = 'e2000000-0000-4000-8000-000000000014')
  AND public.route_workspace_effective_role('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000014') IS NULL,
  '169. N2 : la ligne de membre est intacte mais le rôle effectif est NULL (retiré du voyage)');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-000000000014';
SELECT is((SELECT count(*)::int FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a1'), 0, '170. N2 : l''ancien collaborateur ne lit plus l''espace (RLS)');
SELECT is((SELECT count(*)::int FROM public.route_operations WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1'), 0, '171. N2 : ni le journal des opérations');
SELECT is((SELECT count(*)::int FROM public.readable_route_workspace_ids() r WHERE r = 'e2000000-0000-4000-8000-0000000000a1'), 0, '172. N2 : readable_route_workspace_ids() l''exclut');
SELECT is((SELECT public.can_read_route_workspace('e2000000-0000-4000-8000-0000000000a1')), false, '173. N2 : can_read_route_workspace faux');
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'comments', '[]'::jsonb, public.rc_ver('e2000000-0000-4000-8000-0000000000a1')) ->> 'reason'),
  'insufficient_permissions_or_revoked',
  '174. N2 : les RPC d''écriture le refusent');
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-000000000011';
SELECT is((SELECT count(*)::int FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a1'), 1, '175. N2 : les autres membres, encore collaborateurs, gardent l''accès');
RESET ROLE;
INSERT INTO public.trip_collaborators (trip_id, user_id, role) VALUES ('e2000000-0000-4000-8000-0000000000b2', 'e2000000-0000-4000-8000-000000000014', 'viewer');
SELECT is(public.route_workspace_effective_role('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-000000000014'), 'contributor',
  '176. N2 : redevenu collaborateur du voyage, son rôle de membre (toujours enregistré) s''applique de nouveau');

-- Espace archivé (a2) : membres et lien de partage.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a2', 'e2000000-0000-4000-8000-00000000000b', 'editor', false, false, NULL) ->> 'reason'),
  'workspace_archived',
  '177. archivé : set_route_member_tx refuse');
SELECT is(
  (SELECT public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a2', 'create', NULL, 500) ->> 'reason'),
  'workspace_archived',
  '178. archivé : manage_route_share_link_tx refuse la création d''un lien');
SELECT is(
  (SELECT public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a2', 'revoke', NULL, 500) ->> 'status'),
  'ok',
  '179. archivé : la révocation d''un lien reste permise (geste protecteur)');

-- share_token_hash : illisible pour les clients (privilège de colonne), lisible pour les autres colonnes.
SELECT throws_ok($$SELECT share_token_hash FROM public.route_workspaces LIMIT 1$$, '42501', NULL,
  '180. share_token_hash : lecture directe refusée à authenticated (permission denied)');
SELECT throws_ok($$SELECT * FROM public.route_workspaces LIMIT 1$$, '42501', NULL,
  '181. route_workspaces : `select *` refusé (la colonne sensible n''est pas accordée ; le store liste ses colonnes)');
SELECT ok(
  has_column_privilege('authenticated', 'public.route_workspaces', 'state_snapshot', 'SELECT')
  AND has_column_privilege('authenticated', 'public.route_workspaces', 'state_version', 'SELECT')
  AND NOT has_column_privilege('authenticated', 'public.route_workspaces', 'share_token_hash', 'SELECT')
  AND NOT has_column_privilege('anon', 'public.route_workspaces', 'share_token_hash', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.route_workspaces', 'SELECT'),
  '182. privilèges : colonnes de lecture accordées une à une, jamais share_token_hash, aucun SELECT de table');

-- Index des clés étrangères ajoutées.
RESET ROLE;
SELECT ok(
  (SELECT count(*) = 3 FROM pg_indexes
   WHERE indexname IN ('idx_hike_sessions_route_workspace', 'idx_hike_sessions_route_revision', 'idx_carnets_planned_revision')),
  '183. index sur hike_sessions(route_workspace_id), hike_sessions(route_revision_id), carnets(planned_revision_id)');

-- Temps réel privé (8.8) : topic « route:<uuid> ».
SELECT ok(
  public.route_topic_workspace_id('route:' || 'e2000000-0000-4000-8000-0000000000a1') = 'e2000000-0000-4000-8000-0000000000a1'::uuid
  AND public.route_topic_workspace_id('route:not-a-uuid') IS NULL
  AND public.route_topic_workspace_id('chat:' || 'e2000000-0000-4000-8000-0000000000a1') IS NULL
  AND public.route_topic_workspace_id('route:' || 'e2000000-0000-4000-8000-0000000000a1' || 'x') IS NULL
  AND public.route_topic_workspace_id(NULL) IS NULL,
  '184. 8.8 : route_topic_workspace_id lit « route:<uuid> » et rend NULL (jamais d''exception) pour tout autre topic');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT is(public.can_read_route_workspace(public.route_topic_workspace_id('route:' || 'e2000000-0000-4000-8000-0000000000a1')), true, '185. 8.8 : le propriétaire peut lire le canal de son espace');
SELECT is(public.can_read_route_workspace(public.route_topic_workspace_id('route:garbage')), false, '186. 8.8 : un topic mal formé est refusé sans exception');
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000e';
SELECT is(public.can_read_route_workspace(public.route_topic_workspace_id('route:' || 'e2000000-0000-4000-8000-0000000000a1')), false, '187. 8.8 : une personne étrangère à l''espace est refusée');
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000d';
SELECT is(public.can_read_route_workspace(public.route_topic_workspace_id('route:' || 'e2000000-0000-4000-8000-0000000000a1')), false, '188. 8.8 : un external_viewer est refusé (il n''a que la vue assainie)');
RESET ROLE;
SELECT CASE WHEN to_regclass('realtime.messages') IS NULL OR to_regprocedure('realtime.topic()') IS NULL
  THEN pass('189. 8.8 : schéma realtime absent, policies non applicables (migration applicable partout)')
  ELSE ok(
    (SELECT count(*) = 2 FROM pg_policies
     WHERE schemaname = 'realtime' AND tablename = 'messages'
       AND ((policyname = 'route_realtime_read' AND cmd = 'SELECT') OR (policyname = 'route_realtime_write' AND cmd = 'INSERT'))
       AND roles = '{authenticated}'
       AND coalesce(qual, with_check) LIKE '%route_topic_workspace_id%' AND coalesce(qual, with_check) LIKE '%can_read_route_workspace%'),
    '189. 8.8 : policies realtime.messages SELECT et INSERT (authenticated, topic route:<uuid> + can_read_route_workspace)') END;

-- Sorties : colonnes de liaison et vue participant (si elles existent dans cette base).
SELECT CASE WHEN to_regclass('public.hike_sessions_participant') IS NULL
  THEN pass('190. vue hike_sessions_participant absente de cette base : rien à vérifier')
  ELSE ok(
    (SELECT array_agg(a.attname ORDER BY a.attnum) FILTER (WHERE a.attnum > (SELECT max(attnum) - 3 FROM pg_attribute
                WHERE attrelid = 'public.hike_sessions_participant'::regclass AND attnum > 0 AND NOT attisdropped))
     = ARRAY['route_workspace_id', 'route_revision_id', 'kit_snapshot']::name[]
     FROM pg_attribute a WHERE a.attrelid = 'public.hike_sessions_participant'::regclass AND a.attnum > 0 AND NOT a.attisdropped)
    AND NOT (SELECT coalesce(reloptions, '{}') @> ARRAY['security_invoker=true'] FROM pg_class WHERE oid = 'public.hike_sessions_participant'::regclass)
    AND has_table_privilege('authenticated', 'public.hike_sessions_participant', 'SELECT')
    AND NOT has_table_privilege('anon', 'public.hike_sessions_participant', 'SELECT'),
    '190. vue hike_sessions_participant : route_workspace_id, route_revision_id, kit_snapshot ajoutées EN FIN de liste, droits inchangés') END;
SELECT ok(
  has_column_privilege('authenticated', 'public.hike_sessions', 'route_workspace_id', 'SELECT')
  AND has_column_privilege('authenticated', 'public.hike_sessions', 'route_revision_id', 'SELECT')
  AND has_column_privilege('authenticated', 'public.hike_sessions', 'kit_snapshot', 'SELECT')
  AND NOT has_column_privilege('anon', 'public.hike_sessions', 'kit_snapshot', 'SELECT'),
  '191. hike_sessions : colonnes de liaison lisibles par authenticated (colonne par colonne si les droits le sont), jamais par anon');

SELECT * FROM finish();
ROLLBACK;
