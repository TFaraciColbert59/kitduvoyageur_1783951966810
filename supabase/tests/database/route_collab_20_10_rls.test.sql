-- ============================================================================
-- Itinéraire collaboratif 20/10 — RLS + RPC SECURITY DEFINER
-- Migration : 20261118120000_route_collab_20_10.sql
--   • présence des tables et des fonctions
--   • création via create_route_workspace_tx (auth requise, droit d'édition du voyage)
--   • aucune écriture directe (INSERT/UPDATE) sur route_workspaces
--   • external_viewer et participant refusés ; partie hors liste blanche refusée
--   • un co_organizer ne peut ni révoquer ni nommer un owner
--   • concurrence optimiste (p_base_seq), révocation, publication, lien de partage
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
-- Replay local : privilèges par défaut Supabase (la sécurité repose sur RLS + RPC, pas sur l'absence de GRANT).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.route_workspaces, public.route_workspace_members, public.route_operations,
  public.route_revisions, public.departure_packs TO authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
SELECT plan(45);

-- ----------------------------------------------------------------------------
-- Fixtures (superuser) : A propriétaire, B co-organisateur, C éditeur, D lecteur externe,
-- E tiers (propriétaire d'un voyage), F participant.
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('e2000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'rc_a@test.local', 'x', '{}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'rc_b@test.local', 'x', '{}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'rc_c@test.local', 'x', '{}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-00000000000d', 'authenticated', 'authenticated', 'rc_d@test.local', 'x', '{}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-00000000000e', 'authenticated', 'authenticated', 'rc_e@test.local', 'x', '{}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-00000000000f', 'authenticated', 'authenticated', 'rc_f@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.trips (id, slug, title, user_id, visibility)
VALUES ('e2000000-0000-4000-8000-0000000000b1', 'route-collab-rls-trip', 'Voyage de E', 'e2000000-0000-4000-8000-00000000000e', 'private');

-- ----------------------------------------------------------------------------
-- 1-14. Présence des tables et fonctions
-- ----------------------------------------------------------------------------
SELECT has_table('public', 'route_workspaces', 'table route_workspaces existe');
SELECT has_table('public', 'route_workspace_members', 'table route_workspace_members existe');
SELECT has_table('public', 'route_points', 'table route_points existe');
SELECT has_table('public', 'route_sections', 'table route_sections existe');
SELECT has_table('public', 'route_stages', 'table route_stages existe');
SELECT has_table('public', 'route_operations', 'table route_operations existe');
SELECT has_table('public', 'route_revisions', 'table route_revisions existe');
SELECT has_function('public', 'apply_route_operation_tx', 'RPC transactionnelle apply_route_operation_tx existe');
SELECT has_function('public', 'publish_route_revision_tx', 'RPC transactionnelle publish_route_revision_tx existe');
SELECT has_function('public', 'create_route_workspace_tx', 'RPC create_route_workspace_tx existe');
SELECT has_function('public', 'write_route_workspace_part_tx', 'RPC write_route_workspace_part_tx existe');
SELECT has_function('public', 'set_route_member_tx', 'RPC set_route_member_tx existe');
SELECT has_function('public', 'manage_route_share_link_tx', 'RPC manage_route_share_link_tx existe');
SELECT has_function('public', 'get_shared_route_workspace_tx', 'RPC get_shared_route_workspace_tx existe');

-- ----------------------------------------------------------------------------
-- 15-19. Création (A)
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';

SELECT is(
  public.create_route_workspace_tx(
    NULL, 'Itinéraire RLS', 'marche',
    '{"id":"x","members":[{"userId":"e2000000-0000-4000-8000-00000000000e","role":"owner"}],"points":[],"sections":[],"stages":[],"comments":[],"proposals":[],"kitItems":[]}'::jsonb,
    'e2000000-0000-4000-8000-0000000000a1'
  ),
  'e2000000-0000-4000-8000-0000000000a1'::uuid,
  '15. create_route_workspace_tx renvoie l''id du nouvel espace'
);

SELECT is(
  (SELECT role FROM public.route_workspace_members
   WHERE workspace_id = 'e2000000-0000-4000-8000-0000000000a1' AND user_id = 'e2000000-0000-4000-8000-00000000000a'),
  'owner',
  '16. le créateur est inscrit owner dans route_workspace_members'
);

SELECT is(
  (SELECT jsonb_array_length(state_snapshot -> 'members') FROM public.route_workspaces
   WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
  1,
  '17. les membres du snapshot fourni sont ignorés : seul l''appelant (owner) est inscrit'
);

SELECT throws_ok(
  $$SELECT public.create_route_workspace_tx('e2000000-0000-4000-8000-0000000000b1', 'Sur le voyage de E', 'marche', '{}'::jsonb, NULL)$$,
  '42501',
  'trip_edit_required',
  '18. création refusée sur un voyage que l''appelant ne peut pas éditer'
);

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.create_route_workspace_tx(NULL, 'Anonyme', 'marche', '{}'::jsonb, NULL)$$,
  '42501',
  NULL,
  '19. anon ne peut pas exécuter create_route_workspace_tx'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';

-- ----------------------------------------------------------------------------
-- 20-21. Aucune écriture directe sur route_workspaces
-- ----------------------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.route_workspaces (created_by, title) VALUES ('e2000000-0000-4000-8000-00000000000a', 'Contournement')$$,
  '42501',
  NULL,
  '20. INSERT direct refusé (aucune policy INSERT)'
);

UPDATE public.route_workspaces SET title = 'Piraté', head_seq = 99
WHERE id = 'e2000000-0000-4000-8000-0000000000a1';
SELECT is(
  (SELECT title || ':' || head_seq FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
  'Itinéraire RLS:0',
  '21. UPDATE direct sans effet (aucune policy UPDATE)'
);

-- ----------------------------------------------------------------------------
-- 22-23. Gestion des membres par A
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT (public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000b', 'co_organizer', false, false, 'Bea')) ->> 'status'),
  'ok',
  '22. l''owner nomme B co_organizer'
);
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000c', 'editor', false, false, 'Cyril');
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000d', 'external_viewer', false, false, 'Dora');
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000f', 'participant', false, false, NULL);

SELECT is(
  (SELECT jsonb_array_length(state_snapshot -> 'members') FROM public.route_workspaces
   WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
  5,
  '23. la table ET state_snapshot->members contiennent 5 membres'
);

-- ----------------------------------------------------------------------------
-- 24-28. Éditeur C : opération acceptée, puis conflit sur base_seq périmé
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000c';

SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-1', 0, 'move_point',
     '{"type":"move_point"}'::jsonb, 'hash-1', '{}'::jsonb,
     '{"points":[{"id":"p1"}],"updatedAt":"2026-11-22T10:00:00.000Z","members":[{"userId":"pirate","role":"owner"}]}'::jsonb,
     (SELECT state_version FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a1')
   ) ->> 'status'),
  'accepted',
  '24. l''éditeur applique une opération (base_seq = head_seq)'
);

SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-2', 0, 'move_point',
     '{"type":"move_point"}'::jsonb, 'hash-2', '{}'::jsonb, '{"points":[]}'::jsonb, NULL
   ) ->> 'status'),
  'conflict',
  '25. base_seq périmé => conflict (aucune écriture)'
);

SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-1', 0, 'move_point',
     '{"type":"move_point"}'::jsonb, 'hash-1', '{}'::jsonb, '{"points":[]}'::jsonb, NULL
   ) ->> 'status'),
  'already_applied',
  '26. même op_id et même hash => already_applied (idempotence)'
);

SELECT is(
  (SELECT state_snapshot -> 'members' -> 0 ->> 'userId' FROM public.route_workspaces
   WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
  'e2000000-0000-4000-8000-00000000000a',
  '27. l''opération ne peut pas réécrire members dans le snapshot (fusion des clés propres)'
);

SELECT is(
  (SELECT (state_snapshot ->> 'headSeq')::int FROM public.route_workspaces
   WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
  1,
  '28. headSeq du snapshot = head_seq après acceptation'
);

-- ----------------------------------------------------------------------------
-- 29-31. Parties : liste blanche, external_viewer et participant refusés
-- ----------------------------------------------------------------------------
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'comments', '[{"id":"c1"}]'::jsonb) ->> 'status'),
  'ok',
  '29. un éditeur écrit la partie comments'
);

SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'members', '[]'::jsonb) ->> 'reason'),
  'part_not_allowed',
  '30. une clé hors liste blanche (members) est refusée'
);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000d';
SELECT is(
  (SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'comments', '[]'::jsonb) ->> 'status'),
  'denied',
  '31. external_viewer refusé sur write_route_workspace_part_tx'
);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000f';
SELECT is(
  (SELECT public.apply_route_operation_tx(
     'e2000000-0000-4000-8000-0000000000a1', 'op-3', 1, 'move_point',
     '{"type":"move_point"}'::jsonb, 'hash-3', '{}'::jsonb, '{"points":[]}'::jsonb, NULL
   ) ->> 'status'),
  'denied',
  '32. un participant ne peut pas modifier le tracé'
);

-- ----------------------------------------------------------------------------
-- 33-36. Co-organisateur B : ne peut ni révoquer ni nommer un owner
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000f', 'owner', false, false, NULL);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000b';
SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000f', NULL, true, NULL) ->> 'reason'),
  'owner_protected',
  '33. un co_organizer ne peut pas révoquer un owner'
);

SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000a', NULL, true, NULL) ->> 'status'),
  'denied',
  '34. un co_organizer ne peut pas révoquer le créateur'
);

SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000c', 'owner', false, NULL) ->> 'reason'),
  'owner_protected',
  '35. un co_organizer ne peut pas nommer un owner'
);

SELECT is(
  (SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000b', NULL, false, true) ->> 'reason'),
  'delegated_publish_requires_owner',
  '36. un co_organizer ne peut pas s''octroyer la délégation de publication'
);

-- ----------------------------------------------------------------------------
-- 37. Révocation par l'owner : l'éditeur perd lecture et écriture
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT public.set_route_member_tx('e2000000-0000-4000-8000-0000000000a1', 'e2000000-0000-4000-8000-00000000000c', NULL, true, NULL);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000c';
SELECT is(
  (SELECT count(*)::int FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a1')
  + (SELECT CASE WHEN public.apply_route_operation_tx(
       'e2000000-0000-4000-8000-0000000000a1', 'op-4', 1, 'move_point',
       '{"type":"move_point"}'::jsonb, 'hash-4', '{}'::jsonb, '{"points":[]}'::jsonb, NULL
     ) ->> 'status' = 'denied' THEN 0 ELSE 1 END),
  0,
  '37. membre révoqué : plus de lecture RLS et écriture refusée'
);

-- ----------------------------------------------------------------------------
-- 38-41. Lien de partage : création (owner), lecture anon assainie, jeton invalide, révocation
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT public.write_route_workspace_part_tx('e2000000-0000-4000-8000-0000000000a1', 'proposals', '[{"id":"secret-proposal"}]'::jsonb);

SELECT is(
  (SELECT public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a1', 'create', 'shr-0123456789abcdef0123456789abcdef01', NULL, 500) ->> 'status'),
  'ok',
  '38. l''owner crée un lien de partage'
);

SET LOCAL ROLE anon;
SELECT is(
  (SELECT (public.get_shared_route_workspace_tx('e2000000-0000-4000-8000-0000000000a1', 'shr-0123456789abcdef0123456789abcdef01') -> 'snapshot' -> 'proposals')::text),
  '[]',
  '39. lecture anon par jeton : snapshot assaini (propositions retirées)'
);
SELECT is(
  (SELECT public.get_shared_route_workspace_tx('e2000000-0000-4000-8000-0000000000a1', 'shr-ffffffffffffffffffffffffffffffffff') ->> 'status'),
  'not_found',
  '40. jeton invalide => not_found'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT public.manage_route_share_link_tx('e2000000-0000-4000-8000-0000000000a1', 'revoke', NULL, NULL, 500);
SET LOCAL ROLE anon;
SELECT is(
  (SELECT public.get_shared_route_workspace_tx('e2000000-0000-4000-8000-0000000000a1', 'shr-0123456789abcdef0123456789abcdef01') ->> 'status'),
  'revoked',
  '41. lien révoqué => revoked'
);
SET LOCAL ROLE authenticated;

-- ----------------------------------------------------------------------------
-- 42-45. Publication : droit, tête changée, succès + snapshot mis à jour atomiquement
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000b';
SELECT is(
  (SELECT public.publish_route_revision_tx(
     'e2000000-0000-4000-8000-0000000000a1', 1, 'v1', '{}'::jsonb, 'chk', '{}'::jsonb, '{"status":"published"}'::jsonb, NULL
   ) ->> 'reason'),
  'publish_permission_required',
  '42. un co_organizer sans délégation ne peut pas publier'
);

SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-4000-8000-00000000000a';
SELECT is(
  (SELECT public.publish_route_revision_tx(
     'e2000000-0000-4000-8000-0000000000a1', 0, 'v1', '{}'::jsonb, 'chk', '{}'::jsonb, '{"status":"published"}'::jsonb, NULL
   ) ->> 'reason'),
  'head_changed_requires_review',
  '43. publication bloquée si head_seq a changé depuis la relecture'
);

SELECT is(
  (SELECT public.publish_route_revision_tx(
     'e2000000-0000-4000-8000-0000000000a1', 1, 'v1', '{"points":[]}'::jsonb, 'chk', '{"checksum":"chk"}'::jsonb,
     '{"revisions":[{"id":"rev-1"}],"packs":[{"packId":"pack-1"}],"updatedAt":"2026-11-22T11:00:00.000Z","members":[]}'::jsonb, NULL
   ) ->> 'status'),
  'published',
  '44. l''owner publie avec head_seq relu'
);

SELECT is(
  (SELECT (state_snapshot ->> 'status') || ':' || (state_snapshot ->> 'publishedRevisionNo') || ':' || jsonb_array_length(state_snapshot -> 'members')::text
   FROM public.route_workspaces WHERE id = 'e2000000-0000-4000-8000-0000000000a1'),
  'published:1:5',
  '45. le snapshot est mis à jour dans la même transaction (members intact)'
);

SELECT * FROM finish();
ROLLBACK;
