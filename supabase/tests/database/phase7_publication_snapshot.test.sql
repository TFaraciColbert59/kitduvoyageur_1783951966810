-- ============================================================================
-- Phase 7 — Carnet privé par défaut + publication en snapshot figé
--   • TEST-PHASE7-DB-01 : visibilité par défaut `private` + commentaire
--   • TEST-PHASE7-DB-02 : colonnes/tronc de snapshot + trigger + fonction
--   • TEST-PHASE7-DB-03 : publication liée → snapshot figé du carnet
--   • TEST-PHASE7-DB-04 : accès carnet vérifié (privé d'autrui refusé)
--   • TEST-PHASE7-DB-05 : GATE — modifier le carnet après publication ne
--                         change ni le snapshot ni le contenu publié
--   • TEST-PHASE7-DB-06 : snapshot immuable (UPDATE du post ne le réécrit pas)
--   • TEST-PHASE7-DB-07 : pas de snapshot forgé sans carnet lié
--   • TEST-PHASE7-DB-08 : retrait des points de carte (snapshot_exclude_location)
--   • TEST-PHASE7-DB-09 : suppression du carnet → lien NULL, snapshot conservé
--   • TEST-PHASE7-DB-10 : chaîne session → voyage (hike_sessions.trip_id)
-- Exécution : pgTAP, transaction annulée (ROLLBACK).
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
-- Replay local : grants explicites (défauts prod non garantis).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carnets, public.community_posts, public.hike_sessions, public.trips TO service_role, authenticated;
GRANT USAGE ON SCHEMA public TO service_role, authenticated;
SELECT plan(24);

-- ----------------------------------------------------------------------------
-- TEST-PHASE7-DB-01 — visibilité par défaut
-- ----------------------------------------------------------------------------
SELECT col_default_is('public', 'carnets', 'visibility', 'private',
  '1. DB-01. carnets.visibility est privée par défaut');
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_description d
    JOIN pg_attribute a ON a.attrelid = d.objoid AND a.attnum = d.objsubid
    WHERE a.attrelid = 'public.carnets'::regclass
      AND a.attname = 'visibility'
  ),
  '2. DB-01. carnets.visibility porte un commentaire Phase 7'
);

-- ----------------------------------------------------------------------------
-- TEST-PHASE7-DB-02 — structures du snapshot
-- ----------------------------------------------------------------------------
SELECT has_column('public', 'community_posts', 'snapshot_payload',
  '3. DB-02. community_posts.snapshot_payload existe');
SELECT has_column('public', 'community_posts', 'snapshot_at',
  '4. DB-02. community_posts.snapshot_at existe');
SELECT has_column('public', 'community_posts', 'snapshot_exclude_location',
  '5. DB-02. community_posts.snapshot_exclude_location existe');
SELECT has_trigger('public', 'community_posts', 'trg_snapshot_community_post_carnet',
  '6. DB-02. trigger de snapshot présent');
SELECT ok(
  to_regprocedure('public.snapshot_community_post_carnet()') IS NOT NULL,
  '7. DB-02. fonction de snapshot présente'
);

-- ----------------------------------------------------------------------------
-- Fixtures — propriétaire A, tiers B (aucune donnée perso)
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('f7a70000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'phase7_owner@test.local', 'x', '{}', '{}', now(), now()),
  ('f7a70000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'phase7_other@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, full_name, email) VALUES
  ('f7a70000-0000-4000-8000-0000000000a2', 'Propriétaire A', 'phase7_owner@test.local'),
  ('f7a70000-0000-4000-8000-0000000000a3', 'Tiers B', 'phase7_other@test.local')
ON CONFLICT (id) DO NOTHING;

-- Carnet privé de A (upsert idempotent, transaction annulée en fin de test).
INSERT INTO public.carnets (id, author_id, title, destination, description, visibility, tags)
VALUES (
  'f7a70000-0000-4000-8000-0000000000c1',
  'f7a70000-0000-4000-8000-0000000000a2',
  'Carnet privé A',
  'Chartreuse',
  'Version publiée — ne doit jamais fuiter de mise à jour',
  'private',
  ARRAY['bivouac']
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- TEST-PHASE7-DB-03 — publication liée = snapshot figé
-- ----------------------------------------------------------------------------
SET LOCAL ROLE service_role;
INSERT INTO public.community_posts (id, author_id, content, linked_carnet_id)
VALUES (
  'f7a70000-0000-4000-8000-0000000000b1',
  'f7a70000-0000-4000-8000-0000000000a2',
  'Contenu publié au moment du geste',
  'f7a70000-0000-4000-8000-0000000000c1'
);

SELECT is(
  (SELECT snapshot_payload->>'title' FROM public.community_posts WHERE id = 'f7a70000-0000-4000-8000-0000000000b1'),
  'Carnet privé A',
  '8. DB-03. snapshot_payload fige le titre du carnet');
SELECT is(
  (SELECT snapshot_payload->>'description' FROM public.community_posts WHERE id = 'f7a70000-0000-4000-8000-0000000000b1'),
  'Version publiée — ne doit jamais fuiter de mise à jour',
  '9. DB-03. snapshot_payload fige la description du carnet');
SELECT ok(
  (SELECT snapshot_at IS NOT NULL FROM public.community_posts WHERE id = 'f7a70000-0000-4000-8000-0000000000b1'),
  '10. DB-03. snapshot_at est estampillé');
SELECT ok(
  (SELECT snapshot_payload ? 'map_points' FROM public.community_posts WHERE id = 'f7a70000-0000-4000-8000-0000000000b1'),
  '11. DB-03. points de carte inclus par défaut');

-- ----------------------------------------------------------------------------
-- TEST-PHASE7-DB-04 — accès carnet vérifié
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f7a70000-0000-4000-8000-0000000000a3';
SELECT throws_ok(
  $$ INSERT INTO public.community_posts (author_id, content, linked_carnet_id)
     VALUES ('f7a70000-0000-4000-8000-0000000000a3', 'tentative', 'f7a70000-0000-4000-8000-0000000000c1') $$,
  NULL, NULL,
  '12. DB-04. un tiers ne peut pas publier le carnet privé d''autrui');
SET LOCAL "request.jwt.claim.sub" = 'f7a70000-0000-4000-8000-0000000000a2';
SELECT lives_ok(
  $$ INSERT INTO public.community_posts (id, author_id, content, linked_carnet_id, snapshot_exclude_location)
     VALUES ('f7a70000-0000-4000-8000-0000000000b2', 'f7a70000-0000-4000-8000-0000000000a2', 'Retrait coordonnées', 'f7a70000-0000-4000-8000-0000000000c1', true) $$,
  '13. DB-04. l''auteur publie son propre carnet privé');
SELECT ok(
  NOT (SELECT snapshot_payload ? 'map_points' FROM public.community_posts WHERE id = 'f7a70000-0000-4000-8000-0000000000b2'),
  '14. DB-08. snapshot_exclude_location retire les points de carte');

-- ----------------------------------------------------------------------------
-- TEST-PHASE7-DB-05 — GATE : modification du carnet après publication
-- ----------------------------------------------------------------------------
SET LOCAL ROLE service_role;
UPDATE public.carnets
SET title = 'TITRE MODIFIÉ APRÈS PUBLICATION',
    description = 'NOUVELLE DESCRIPTION PRIVÉE',
    map_points = '[{"lat": 45.1, "lng": 5.7}]'::jsonb,
    updated_at = clock_timestamp()
WHERE id = 'f7a70000-0000-4000-8000-0000000000c1';

SELECT is(
  (SELECT snapshot_payload->>'title' FROM public.community_posts WHERE id = 'f7a70000-0000-4000-8000-0000000000b1'),
  'Carnet privé A',
  '15. DB-05. GATE — le titre publié ne change pas après modification du carnet');
SELECT is(
  (SELECT snapshot_payload->>'description' FROM public.community_posts WHERE id = 'f7a70000-0000-4000-8000-0000000000b1'),
  'Version publiée — ne doit jamais fuiter de mise à jour',
  '16. DB-05. GATE — la description publiée ne change pas');
SELECT is(
  (SELECT content FROM public.community_posts WHERE id = 'f7a70000-0000-4000-8000-0000000000b1'),
  'Contenu publié au moment du geste',
  '17. DB-05. GATE — le contenu du post ne change pas');
SELECT ok(
  (SELECT snapshot_at FROM public.community_posts WHERE id = 'f7a70000-0000-4000-8000-0000000000b1')
    < (SELECT updated_at FROM public.carnets WHERE id = 'f7a70000-0000-4000-8000-0000000000c1'),
  '18. DB-05. GATE — l''estampille de snapshot précède la modification privée');

-- ----------------------------------------------------------------------------
-- TEST-PHASE7-DB-06/07 — immuabilité et absence de snapshot forgé
-- ----------------------------------------------------------------------------
UPDATE public.community_posts
SET snapshot_payload = '{"title": "SNAPSHOT RÉÉCRIT"}'::jsonb
WHERE id = 'f7a70000-0000-4000-8000-0000000000b1';

SELECT is(
  (SELECT snapshot_payload->>'title' FROM public.community_posts WHERE id = 'f7a70000-0000-4000-8000-0000000000b1'),
  'Carnet privé A',
  '19. DB-06. un UPDATE ne peut pas réécrire le snapshot');

INSERT INTO public.community_posts (id, author_id, content, snapshot_payload)
VALUES (
  'f7a70000-0000-4000-8000-0000000000b3',
  'f7a70000-0000-4000-8000-0000000000a2',
  'Post libre sans carnet',
  '{"title": "FAUX SNAPSHOT"}'::jsonb
);

SELECT ok(
  (SELECT snapshot_payload IS NULL AND snapshot_at IS NULL FROM public.community_posts WHERE id = 'f7a70000-0000-4000-8000-0000000000b3'),
  '20. DB-07. pas de snapshot sans carnet lié (valeur client ignorée)');

-- ----------------------------------------------------------------------------
-- TEST-PHASE7-DB-09 — suppression du carnet : lien NULL, snapshot conservé
-- ----------------------------------------------------------------------------
DELETE FROM public.carnets WHERE id = 'f7a70000-0000-4000-8000-0000000000c1';

SELECT ok(
  (SELECT linked_carnet_id IS NULL AND snapshot_payload->>'title' = 'Carnet privé A'
   FROM public.community_posts WHERE id = 'f7a70000-0000-4000-8000-0000000000b1'),
  '21. DB-09. suppression du carnet : lien coupé, snapshot conservé');

-- ----------------------------------------------------------------------------
-- TEST-PHASE7-DB-10 — chaîne session → voyage
-- ----------------------------------------------------------------------------
SELECT has_column('public', 'hike_sessions', 'trip_id',
  '22. DB-10. hike_sessions.trip_id existe');
SELECT col_is_fk('public', 'hike_sessions', 'trip_id',
  '23. DB-10. hike_sessions.trip_id est une FK trips');
SELECT has_index('public', 'hike_sessions', 'idx_hike_sessions_trip',
  '24. DB-10. index partiel sur hike_sessions.trip_id');

SELECT * FROM finish();
ROLLBACK;
