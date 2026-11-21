BEGIN;
SELECT plan(8);

INSERT INTO auth.users (id, email)
VALUES
  ('d0de0000-0000-4000-8000-000000000001', 'owner-ret@test.local'),
  ('d0de0000-0000-4000-8000-000000000002', 'member-ret@test.local'),
  ('d0de0000-0000-4000-8000-000000000003', 'pending-ret@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.trips (id, slug, title, user_id, status, visibility)
VALUES ('d0de1111-0000-4000-8000-000000000001', 'trip-ret-pgtap', 'Voyage rétention', 'd0de0000-0000-4000-8000-000000000001', 'active', 'private');

INSERT INTO public.trip_participants (trip_id, user_id, role, status)
VALUES
  ('d0de1111-0000-4000-8000-000000000001', 'd0de0000-0000-4000-8000-000000000002', 'member', 'confirmed'),
  ('d0de1111-0000-4000-8000-000000000001', 'd0de0000-0000-4000-8000-000000000003', 'member', 'invited');

-- Doublon volontaire : le membre confirmé est aussi collaborateur
INSERT INTO public.trip_collaborators (trip_id, user_id, role)
VALUES ('d0de1111-0000-4000-8000-000000000001', 'd0de0000-0000-4000-8000-000000000002', 'editor');

INSERT INTO public.trip_items (id, trip_id, item_name, quantity, ownership)
VALUES ('d0de2222-0000-4000-8000-000000000001', 'd0de1111-0000-4000-8000-000000000001', 'Tente 2P', 1, 'personal');

-- Position expirée > 24h et signalement expiré > 30j
INSERT INTO public.trip_live_positions (trip_id, user_id, lat, lon, recorded_at, expires_at)
VALUES ('d0de1111-0000-4000-8000-000000000001', 'd0de0000-0000-4000-8000-000000000001', 45.9, 6.8, now() - interval '3 days', now() - interval '2 days');

INSERT INTO public.hub_field_reports (trip_id, author_id, category, title, lat, lon, expires_at)
VALUES ('d0de1111-0000-4000-8000-000000000001', 'd0de0000-0000-4000-8000-000000000001', 'mud', 'Ancienne boue', 45.9, 6.8, now() - interval '40 days');

-- 1 : Taille de groupe dédupliquée (owner + member = 2, pending exclu)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'd0de0000-0000-4000-8000-000000000001', true);
SELECT is(
  public.get_trip_effective_party_size('d0de1111-0000-4000-8000-000000000001'),
  2,
  'La taille canonique déduplique les affiliations et exclut les invitations en attente'
);

-- 2-3 : Attribution objet partagé par éditeur
SELECT is(
  (SELECT owner_id FROM public.assign_trip_shared_item('d0de1111-0000-4000-8000-000000000001', 'd0de2222-0000-4000-8000-000000000001', 'd0de0000-0000-4000-8000-000000000002')),
  'd0de0000-0000-4000-8000-000000000002'::uuid,
  'L’éditeur attribue un objet partagé au porteur'
);
SELECT is(
  (SELECT ownership FROM public.trip_items WHERE id = 'd0de2222-0000-4000-8000-000000000001'),
  'shared',
  'L’objet passe bien en ownership=shared'
);

-- 4 : Un non-éditeur ne peut pas réattribuer l'objet
SELECT set_config('request.jwt.claim.sub', 'd0de0000-0000-4000-8000-000000000003', true);
SELECT throws_ok(
  $$SELECT * FROM public.assign_trip_shared_item('d0de1111-0000-4000-8000-000000000001', 'd0de2222-0000-4000-8000-000000000001', 'd0de0000-0000-4000-8000-000000000003')$$,
  '42501',
  'FORBIDDEN',
  'Un utilisateur sans droit d’édition ne peut pas attribuer un objet partagé'
);

-- 5 : authenticated ne peut pas lancer la purge globale
SELECT throws_ok(
  $$SELECT * FROM public.purge_expired_hub_ephemeral_data()$$,
  '42501',
  NULL,
  'Le rôle authenticated ne peut pas exécuter la purge globale'
);

-- 6-8 : service_role purge proprement positions et signalements expirés
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT is(
  (SELECT purged_positions FROM public.purge_expired_hub_ephemeral_data()),
  1,
  'La purge supprime exactement 1 position live expirée depuis >24h'
);
SELECT is(
  (SELECT count(*)::int FROM public.trip_live_positions WHERE trip_id = 'd0de1111-0000-4000-8000-000000000001'),
  0,
  'Plus aucune position expirée ne subsiste'
);
SELECT is(
  (SELECT count(*)::int FROM public.hub_field_reports WHERE trip_id = 'd0de1111-0000-4000-8000-000000000001'),
  0,
  'Plus aucun signalement expiré depuis >30j ne subsiste'
);

SELECT * FROM finish();
ROLLBACK;
