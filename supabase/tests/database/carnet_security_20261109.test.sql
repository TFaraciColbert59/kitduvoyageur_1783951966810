-- ============================================================================
-- Tests de la migration 20261109120000_carnet_security_collaborators_moments
-- 1. Personne ne s'inscrit seul comme collaborateur (ni owner, ni contributor).
-- 2. Seul l'auteur inscrit, modifie ou retire un collaborateur ; chacun se retire.
-- 3. Un moment ne s'écrit que dans un carnet dont on est participant.
-- 4. Lecture des moments : carnet public oui, carnet privé non (visiteur).
-- ============================================================================

BEGIN;
SET LOCAL search_path = public;
SELECT plan(12);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('c3000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'sec_author@test.local', 'x', '{}', '{}', now(), now()),
  ('c3000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'sec_collab@test.local', 'x', '{}', '{}', now(), now()),
  ('c3000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'sec_intrus@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, email, full_name, created_at)
VALUES
  ('c3000000-0000-4000-8000-000000000001', 'sec_author@test.local', 'Auteur Sécu', now()),
  ('c3000000-0000-4000-8000-000000000002', 'sec_collab@test.local', 'Collab Sécu', now()),
  ('c3000000-0000-4000-8000-000000000003', 'sec_intrus@test.local', 'Intrus Sécu', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carnets (id, author_id, title, destination, visibility)
VALUES
  ('c3100000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'Carnet privé sécu', 'Écrins', 'private'),
  ('c3100000-0000-4000-8000-000000000002', 'c3000000-0000-4000-8000-000000000001', 'Carnet public sécu', 'Vercors', 'public')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carnet_moments (id, carnet_id, jour_numero, citation, auteur_id)
VALUES
  ('c3200000-0000-4000-8000-000000000001', 'c3100000-0000-4000-8000-000000000001', 1, 'Moment privé', 'c3000000-0000-4000-8000-000000000001'),
  ('c3200000-0000-4000-8000-000000000002', 'c3100000-0000-4000-8000-000000000002', 1, 'Moment public', 'c3000000-0000-4000-8000-000000000001');

SET LOCAL ROLE authenticated;

-- 1. L'intrus ne peut pas s'inscrire lui-même, ni comme owner ni comme contributor
SET LOCAL "request.jwt.claims" = '{"sub": "c3000000-0000-4000-8000-000000000003", "role": "authenticated"}';
SELECT throws_ok(
  'INSERT INTO public.carnet_collaborators (carnet_id, user_id, role) VALUES (''c3100000-0000-4000-8000-000000000001'', ''c3000000-0000-4000-8000-000000000003'', ''owner'')',
  '42501', NULL,
  'Un intrus ne peut pas s''inscrire owner dans un carnet d''autrui'
);
SELECT throws_ok(
  'INSERT INTO public.carnet_collaborators (carnet_id, user_id, role) VALUES (''c3100000-0000-4000-8000-000000000002'', ''c3000000-0000-4000-8000-000000000003'', ''contributor'')',
  '42501', NULL,
  'Un intrus ne peut pas s''inscrire contributor, même sur un carnet public'
);
SELECT is(public.is_carnet_participant('c3100000-0000-4000-8000-000000000001'), false, 'L''intrus n''est pas participant');

-- 1 bis. Chemin de la relecture : rattacher sa propre sortie au carnet d'autrui
SELECT throws_ok(
  'INSERT INTO public.hike_sessions (user_id, carnet_id, started_at, ended_at, distance_km, duration_seconds) VALUES (''c3000000-0000-4000-8000-000000000003'', ''c3100000-0000-4000-8000-000000000001'', now(), now(), 1, 60)',
  '42501', NULL,
  'Un intrus ne peut pas rattacher sa sortie au carnet d''autrui'
);

-- 1 ter. Même si une telle sortie existait (créée avant la migration), elle
--        ne rend pas participant : la sortie n'est pas tenue par l'auteur.
RESET ROLE;
INSERT INTO public.hike_sessions (id, user_id, carnet_id, started_at, ended_at, distance_km, duration_seconds)
VALUES ('c3300000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000003', 'c3100000-0000-4000-8000-000000000001', now(), now(), 1, 60);
INSERT INTO public.hike_session_participants (session_id, user_id, role)
VALUES ('c3300000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000003', 'owner');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "c3000000-0000-4000-8000-000000000003", "role": "authenticated"}';
SELECT is(public.is_carnet_participant('c3100000-0000-4000-8000-000000000001'), false, 'Une sortie d''intrus rattachée ne rend pas participant');

-- 2. L'intrus ne peut pas écrire de moment, même en s'en déclarant l'auteur
SELECT throws_ok(
  'INSERT INTO public.carnet_moments (carnet_id, jour_numero, citation, auteur_id) VALUES (''c3100000-0000-4000-8000-000000000002'', 1, ''Intrusion'', ''c3000000-0000-4000-8000-000000000003'')',
  '42501', NULL,
  'Un non-participant ne peut pas ajouter de moment, même en auteur déclaré'
);

-- 3. Lecture : public oui, privé non
SELECT isnt_empty(
  'SELECT 1 FROM public.carnet_moments WHERE carnet_id = ''c3100000-0000-4000-8000-000000000002''',
  'Un visiteur lit les moments d''un carnet public'
);
SELECT is_empty(
  'SELECT 1 FROM public.carnet_moments WHERE carnet_id = ''c3100000-0000-4000-8000-000000000001''',
  'Un visiteur ne lit aucun moment d''un carnet privé'
);

-- 4. L'auteur inscrit un collaborateur, qui devient participant et écrit
SET LOCAL "request.jwt.claims" = '{"sub": "c3000000-0000-4000-8000-000000000001", "role": "authenticated"}';
SELECT lives_ok(
  'INSERT INTO public.carnet_collaborators (carnet_id, user_id, role) VALUES (''c3100000-0000-4000-8000-000000000001'', ''c3000000-0000-4000-8000-000000000002'', ''contributor'')',
  'L''auteur inscrit un collaborateur'
);

SET LOCAL "request.jwt.claims" = '{"sub": "c3000000-0000-4000-8000-000000000002", "role": "authenticated"}';
SELECT lives_ok(
  'INSERT INTO public.carnet_moments (carnet_id, jour_numero, citation, auteur_id) VALUES (''c3100000-0000-4000-8000-000000000001'', 2, ''Moment du collaborateur'', ''c3000000-0000-4000-8000-000000000002'')',
  'Un collaborateur inscrit par l''auteur écrit un moment'
);

-- 5. Le collaborateur ne se promeut pas owner, mais peut se retirer
SELECT is_empty(
  $$UPDATE public.carnet_collaborators SET role = 'owner'
    WHERE carnet_id = 'c3100000-0000-4000-8000-000000000001' AND user_id = 'c3000000-0000-4000-8000-000000000002'
    RETURNING 1$$,
  'Un collaborateur ne peut pas se promouvoir owner'
);
SELECT isnt_empty(
  $$DELETE FROM public.carnet_collaborators
    WHERE carnet_id = 'c3100000-0000-4000-8000-000000000001' AND user_id = 'c3000000-0000-4000-8000-000000000002'
    RETURNING 1$$,
  'Un collaborateur peut se retirer lui-même'
);

SELECT * FROM finish();
ROLLBACK;
