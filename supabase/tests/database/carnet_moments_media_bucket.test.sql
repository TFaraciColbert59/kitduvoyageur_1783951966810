-- ============================================================================
-- pgTAP — seau carnet-moments-media (migration 20261110100000)
-- 1. Le seau existe, est limité à 25 Mo et à l'audio / la vidéo.
-- 2. Une personne écrit dans son dossier, pas dans celui d'autrui.
-- 3. Une extension hors liste (.html) est refusée.
-- 4. Un anonyme n'écrit pas.
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(9);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('c4000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'media_a@test.local', 'x', '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

SELECT is((SELECT file_size_limit FROM storage.buckets WHERE id = 'carnet-moments-media'), 26214400::bigint, 'limite de 25 Mo');
SELECT ok(
  NOT EXISTS (SELECT 1 FROM storage.buckets b, unnest(b.allowed_mime_types) m WHERE b.id = 'carnet-moments-media' AND m NOT LIKE 'audio/%' AND m NOT LIKE 'video/%'),
  'audio et vidéo seulement'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "c4000000-0000-4000-8000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('carnet-moments-media', 'c4000000-0000-4000-8000-000000000001/carnet-moments/x/a.webm', 'c4000000-0000-4000-8000-000000000001', '{"size": 1000}'::jsonb)$$,
  'écriture dans son propre dossier'
);
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('carnet-moments-media', 'c4000000-0000-4000-8000-0000000000ff/carnet-moments/x/a.webm', 'c4000000-0000-4000-8000-000000000001', '{"size": 1000}'::jsonb)$$,
  '42501', NULL, 'écriture refusée dans le dossier d''autrui'
);
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('carnet-moments-media', 'c4000000-0000-4000-8000-000000000001/x/a.html', 'c4000000-0000-4000-8000-000000000001', '{"size": 10}'::jsonb)$$,
  '42501', NULL, 'extension hors liste refusée'
);
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('carnet-moments-media', 'c4000000-0000-4000-8000-000000000001/x/big.webm', 'c4000000-0000-4000-8000-000000000001', '{"size": 99999999}'::jsonb)$$,
  '42501', NULL, 'fichier de plus de 25 Mo refusé'
);

-- Pas de politique SELECT (relecture 2026-11-10) : le seau public sert les
-- fichiers par leur chemin exact ; aucune énumération via storage.objects.
SET LOCAL "request.jwt.claims" = '{"sub": "c4000000-0000-4000-8000-0000000000ff", "role": "authenticated"}';
SELECT is_empty(
  $$SELECT 1 FROM storage.objects WHERE bucket_id = 'carnet-moments-media'$$,
  'un authentifié non propriétaire ne liste rien'
);

SET LOCAL ROLE anon;
SELECT is_empty(
  $$SELECT 1 FROM storage.objects WHERE bucket_id = 'carnet-moments-media'$$,
  'un anonyme ne liste rien'
);
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES ('carnet-moments-media', 'anon/a.webm', '{"size": 10}'::jsonb)$$,
  '42501', NULL, 'un anonyme n''écrit pas'
);

SELECT * FROM finish();
ROLLBACK;
