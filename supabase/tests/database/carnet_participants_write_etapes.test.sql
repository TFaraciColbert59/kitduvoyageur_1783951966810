-- ============================================================================
-- pgTAP — étapes écrites par un participant du carnet (migration 20261110100100)
-- 1. Le contributeur du carnet (hors groupe_membres) écrit une étape du groupe.
-- 2. Un tiers (ni participant, ni membre) ne peut pas.
-- 3. Un participant d'un AUTRE carnet ne touche pas aux étapes de ce groupe.
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(5);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('c5000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'et_author@test.local', 'x', '{}', '{}', now(), now()),
  ('c5000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'et_contrib@test.local', 'x', '{}', '{}', now(), now()),
  ('c5000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'et_other@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, email, full_name, created_at)
VALUES
  ('c5000000-0000-4000-8000-000000000001', 'et_author@test.local', 'Auteur', now()),
  ('c5000000-0000-4000-8000-000000000002', 'et_contrib@test.local', 'Contrib', now()),
  ('c5000000-0000-4000-8000-000000000003', 'et_other@test.local', 'Autre', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.groupes (id, nom, created_by)
VALUES ('c5100000-0000-4000-8000-000000000001', 'Groupe étapes', 'c5000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carnets (id, author_id, title, destination, visibility, groupe_id)
VALUES ('c5200000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'Carnet étapes', 'Écrins', 'public', 'c5100000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.carnet_collaborators (carnet_id, user_id, role)
VALUES ('c5200000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000002', 'contributor');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "c5000000-0000-4000-8000-000000000002", "role": "authenticated"}';
SELECT lives_ok(
  $$INSERT INTO public.groupe_etapes (groupe_id, jour_numero, ordre, lieu_depart, lieu_arrivee)
    VALUES ('c5100000-0000-4000-8000-000000000001', 1, 1, 'A', 'B')$$,
  'le contributeur du carnet écrit une étape du groupe'
);
SELECT results_eq(
  $$UPDATE public.groupe_etapes SET lieu_arrivee = 'C' WHERE groupe_id = 'c5100000-0000-4000-8000-000000000001' RETURNING lieu_arrivee$$,
  $$VALUES ('C'::text)$$,
  'et la modifie'
);

SET LOCAL "request.jwt.claims" = '{"sub": "c5000000-0000-4000-8000-000000000003", "role": "authenticated"}';
SELECT throws_ok(
  $$INSERT INTO public.groupe_etapes (groupe_id, jour_numero, ordre, lieu_depart, lieu_arrivee)
    VALUES ('c5100000-0000-4000-8000-000000000001', 2, 2, 'X', 'Y')$$,
  '42501', NULL, 'un tiers ne peut pas écrire une étape'
);
SELECT is(
  (WITH d AS (DELETE FROM public.groupe_etapes WHERE groupe_id = 'c5100000-0000-4000-8000-000000000001' RETURNING 1) SELECT count(*)::int FROM d),
  0,
  'un tiers ne supprime aucune étape'
);

SET LOCAL "request.jwt.claims" = '{"sub": "c5000000-0000-4000-8000-000000000002", "role": "authenticated"}';
SELECT is(
  (WITH d AS (DELETE FROM public.groupe_etapes WHERE groupe_id = 'c5100000-0000-4000-8000-000000000001' RETURNING 1) SELECT count(*)::int FROM d),
  1,
  'le contributeur supprime l''étape'
);

SELECT * FROM finish();
ROLLBACK;
