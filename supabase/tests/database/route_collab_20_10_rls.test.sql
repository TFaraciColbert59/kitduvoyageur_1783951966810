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
GRANT SELECT ON
  public.route_workspaces, public.route_workspace_members, public.route_operations,
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
CREATE TABLE public.rc_out (k text PRIMARY KEY, v jsonb);
GRANT ALL ON public.rc_out TO PUBLIC;

SELECT plan(134);

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
  (SELECT share_token_hash FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
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
     (SELECT share_token_hash FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a1')) ->> 'status'),
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
   WHERE public.route_haversine_m(45.8992, 6.1294, (p ->> 'lat')::float8, (p ->> 'lon')::float8) <= 500),
  0,
  '110. 1 : aucun point dans le rayon de la zone de départ'
);

SELECT is(
  (SELECT count(*)::int
   FROM jsonb_array_elements((SELECT v -> 'snapshot' -> 'sections' FROM public.rc_out WHERE k = 'shared4')) s,
        jsonb_array_elements(s -> 'geometry' -> 'coordinates') c
   WHERE public.route_haversine_m(45.8992, 6.1294, (c ->> 1)::float8, (c ->> 0)::float8) <= 500),
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
   WHERE public.route_haversine_m(45.8992, 6.1294, (p ->> 'lat')::float8, (p ->> 'lon')::float8) <= 200),
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

SELECT * FROM finish();
ROLLBACK;
