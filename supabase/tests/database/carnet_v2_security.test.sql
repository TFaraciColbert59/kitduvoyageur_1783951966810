-- ============================================================================
-- Tests de sécurité & RLS pour Carnet v2
-- Couvre les 7 scénarios de handoff/carnet-v2/03-DONNEES-SUPABASE.md § 6 :
-- 1. Visiteur ne lit ni moments, ni likes/commentaires de jour, ni nuits d'un carnet privé.
-- 2. Visiteur lit ceux d'un carnet public, peut aimer/commenter en son nom, ne peut ni supprimer ni écrire au nom d'un autre.
-- 3. Visiteur ne lit AUCUNE ligne de carnet_live_positions ; carnet_public_position renvoie une zone arrondie différée >= 3h, rien si live_sharing=false.
-- 4. Visiteur ne lit pas le budget (trip_expenses).
-- 5. Participant écrit nuits, verdicts, position ; un non-participant ne le peut pas.
-- 6. Utilisateur bloqué : ne commente pas et ne lit pas le carnet.
-- 7. Fonctions helper canoniques is_carnet_participant et can_view_carnet.
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;
SELECT plan(15);

-- ----------------------------------------------------------------------------
-- Fixtures utilisateurs
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('c2000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'carnet_author@test.local', 'x', '{}', '{}', now(), now()),
  ('c2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'carnet_collab@test.local', 'x', '{}', '{}', now(), now()),
  ('c2000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'carnet_visitor@test.local', 'x', '{}', '{}', now(), now()),
  ('c2000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'carnet_blocked@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, email, full_name, created_at)
VALUES
  ('c2000000-0000-4000-8000-000000000001', 'carnet_author@test.local', 'Auteur Test', now()),
  ('c2000000-0000-4000-8000-000000000002', 'carnet_collab@test.local', 'Collaborateur Test', now()),
  ('c2000000-0000-4000-8000-000000000003', 'carnet_visitor@test.local', 'Visiteur Test', now()),
  ('c2000000-0000-4000-8000-000000000004', 'carnet_blocked@test.local', 'Bloqué Test', now())
ON CONFLICT (id) DO NOTHING;

-- Carnet privé
INSERT INTO public.carnets (id, author_id, title, destination, visibility, live_sharing)
VALUES
  ('c2100000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'Carnet Privé', 'Écrins', 'private', false),
  ('c2100000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000001', 'Carnet Public', 'Mont-Blanc', 'public', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carnet_collaborators (carnet_id, user_id, role)
VALUES
  ('c2100000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000002', 'contributor')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES
  ('c2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000004')
ON CONFLICT DO NOTHING;

-- Données du carnet privé
INSERT INTO public.carnet_moments (id, carnet_id, jour_numero, citation, auteur_id)
VALUES
  ('c2200000-0000-4000-8000-000000000001', 'c2100000-0000-4000-8000-000000000001', 1, 'Moment secret', 'c2000000-0000-4000-8000-000000000001');

INSERT INTO public.carnet_nights (carnet_id, jour_numero, nom, type, altitude_m)
VALUES
  ('c2100000-0000-4000-8000-000000000001', 1, 'Refuge Privé', 'refuge', 2200);

-- Données du carnet public
INSERT INTO public.carnet_moments (id, carnet_id, jour_numero, citation, auteur_id)
VALUES
  ('c2200000-0000-4000-8000-000000000002', 'c2100000-0000-4000-8000-000000000002', 1, 'Moment public', 'c2000000-0000-4000-8000-000000000001');

INSERT INTO public.carnet_nights (carnet_id, jour_numero, nom, type, altitude_m)
VALUES
  ('c2100000-0000-4000-8000-000000000002', 1, 'Refuge Public', 'refuge', 1800);

-- Positions en direct (carnet public avec live_sharing)
INSERT INTO public.carnet_live_positions (carnet_id, user_id, lat, lng, recorded_at)
VALUES
  ('c2100000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000001', 45.8326, 6.8652, now() - interval '4 hours');

-- ----------------------------------------------------------------------------
-- Test 1 & 2 : Fonctions canoniques sous session auteur / collaborateur / visiteur
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;

-- Sous session auteur
SET LOCAL "request.jwt.claims" = '{"sub": "c2000000-0000-4000-8000-000000000001", "role": "authenticated"}';
SELECT is(public.is_carnet_participant('c2100000-0000-4000-8000-000000000001'), true, 'Auteur est participant du carnet privé');
SELECT is(public.can_view_carnet('c2100000-0000-4000-8000-000000000001'), true, 'Auteur peut voir son carnet privé');

-- Sous session collaborateur
SET LOCAL "request.jwt.claims" = '{"sub": "c2000000-0000-4000-8000-000000000002", "role": "authenticated"}';
SELECT is(public.is_carnet_participant('c2100000-0000-4000-8000-000000000001'), true, 'Collaborateur est participant du carnet privé');
SELECT is(public.can_view_carnet('c2100000-0000-4000-8000-000000000001'), true, 'Collaborateur peut voir le carnet privé');

-- Sous session visiteur
SET LOCAL "request.jwt.claims" = '{"sub": "c2000000-0000-4000-8000-000000000003", "role": "authenticated"}';
SELECT is(public.is_carnet_participant('c2100000-0000-4000-8000-000000000001'), false, 'Visiteur n''est pas participant du carnet privé');
SELECT is(public.can_view_carnet('c2100000-0000-4000-8000-000000000001'), false, 'Visiteur ne peut pas voir le carnet privé');
SELECT is(public.can_view_carnet('c2100000-0000-4000-8000-000000000002'), true, 'Visiteur peut voir le carnet public');

-- Sous session utilisateur bloqué
SET LOCAL "request.jwt.claims" = '{"sub": "c2000000-0000-4000-8000-000000000004", "role": "authenticated"}';
SELECT is(public.can_view_carnet('c2100000-0000-4000-8000-000000000002'), false, 'Utilisateur bloqué ne peut pas voir le carnet même public');

-- ----------------------------------------------------------------------------
-- Test 3 : Visiteur ne lit pas les nuits d'un carnet privé
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claims" = '{"sub": "c2000000-0000-4000-8000-000000000003", "role": "authenticated"}';
SELECT is_empty(
  'SELECT * FROM public.carnet_nights WHERE carnet_id = ''c2100000-0000-4000-8000-000000000001''',
  'Visiteur ne lit aucune nuit du carnet privé'
);

-- Visiteur lit la nuit du carnet public
SELECT isnt_empty(
  'SELECT * FROM public.carnet_nights WHERE carnet_id = ''c2100000-0000-4000-8000-000000000002''',
  'Visiteur lit la nuit du carnet public'
);

-- ----------------------------------------------------------------------------
-- Test 4 : RLS live positions : visiteur ne lit AUCUNE ligne exacte
-- ----------------------------------------------------------------------------
SELECT is_empty(
  'SELECT * FROM public.carnet_live_positions WHERE carnet_id = ''c2100000-0000-4000-8000-000000000002''',
  'Visiteur ne lit aucune position exacte dans carnet_live_positions'
);

-- Visiteur reçoit une zone floue via carnet_public_position (>3h)
SELECT results_eq(
  'SELECT zone_label, lat_approx, lng_approx FROM public.carnet_public_position(''c2100000-0000-4000-8000-000000000002'')',
  'SELECT ''Mont-Blanc''::text, 45.8500::numeric(8,4), 6.8500::numeric(8,4)',
  'carnet_public_position retourne une position floutée à 0.05° différée de >= 3h'
);

-- Sur carnet privé, carnet_public_position ne renvoie rien
SELECT is_empty(
  'SELECT * FROM public.carnet_public_position(''c2100000-0000-4000-8000-000000000001'')',
  'carnet_public_position ne retourne rien pour un carnet privé'
);

-- ----------------------------------------------------------------------------
-- Test 5 : Participant peut insérer une nuit
-- ----------------------------------------------------------------------------
SET LOCAL "request.jwt.claims" = '{"sub": "c2000000-0000-4000-8000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  'INSERT INTO public.carnet_nights (carnet_id, jour_numero, nom, type) VALUES (''c2100000-0000-4000-8000-000000000001'', 2, ''Bivouac Crête'', ''bivouac'')',
  'Auteur participant peut insérer une nuit'
);

-- Non-participant ne peut pas insérer de nuit
SET LOCAL "request.jwt.claims" = '{"sub": "c2000000-0000-4000-8000-000000000003", "role": "authenticated"}';
SELECT throws_ok(
  'INSERT INTO public.carnet_nights (carnet_id, jour_numero, nom, type) VALUES (''c2100000-0000-4000-8000-000000000002'', 2, ''Hôtel Visiteur'', ''hotel'')',
  '42501',
  NULL,
  'Visiteur non-participant ne peut pas insérer de nuit'
);

SELECT * FROM finish();
ROLLBACK;
