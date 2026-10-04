-- ============================================================================
-- POC mini-chat pays — store vectoriel RAG (table + RPC match, RLS fermée)
--   • extension pgvector présente (schema extensions)
--   • RLS activée, aucune policy permissive (service role via RPC uniquement)
--   • match_pays_chat_chunks : filtre pays, ordre similarité, limite
-- Exécution : pgTAP, transaction annulée.
-- ============================================================================
BEGIN;
SET LOCAL search_path = public;
SELECT plan(7);

-- 1. Extension disponible
SELECT ok(
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector'),
  'extension pgvector installee'
);

-- 2. Table + colonne vector(1536)
SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pays_chat_embeddings'
      AND column_name = 'embedding'
  ),
  'table pays_chat_embeddings avec colonne embedding'
);

-- 3. Dimension exacte vector(1536) — jamais de mélange de dimensions
SELECT is(
  (SELECT format_type(a.atttypid, a.atttypmod)::text
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname = 'pays_chat_embeddings'
      AND a.attname = 'embedding'),
  'extensions.vector(1536)'::text,
  'colonne embedding en vector(1536)'
);

-- 4. RLS activée
SELECT ok(
  COALESCE(
    (SELECT relrowsecurity FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname = 'pays_chat_embeddings'),
    false),
  'RLS activee sur pays_chat_embeddings'
);

-- 5. Aucune policy permissive (USING/WITH CHECK tous à false)
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pays_chat_embeddings'
      AND (qual IS DISTINCT FROM 'false'
           OR (with_check IS NOT NULL AND with_check IS DISTINCT FROM 'false'))),
  0,
  'aucune policy permissive'
);

-- Fixtures : 2 chunks FR (été / hiver), 1 chunk IS. Vecteurs factices 1536D :
-- été = que des 1 ; hiver = 1 en tête puis des 0 ; IS = -1 en tête puis des 0.
-- Cosinus vs requête "été" : FR-été = 1.0 > FR-hiver ≈ 0.026 > IS ≈ -0.026.
INSERT INTO public.pays_chat_embeddings (country_code, block_type, chunk_text, embedding)
VALUES
  ('FR', 'meilleure_saison', 'Été : juillet-août, 25°C, foules.',
    array_fill(1.0, ARRAY[1536])::real[]::extensions.vector),
  ('FR', 'meilleure_saison', 'Hiver : décembre, 5°C, pluie.',
    (ARRAY[1.0] || array_fill(0.0, ARRAY[1535]))::real[]::extensions.vector),
  ('IS', 'meilleure_saison', 'Juillet : 10-13°C, vent.',
    (ARRAY[-1.0] || array_fill(0.0, ARRAY[1535]))::real[]::extensions.vector);

-- 6. Filtre pays + ordre : la requête "été" matche FR-été en premier
SELECT is(
  (SELECT chunk_text FROM public.match_pays_chat_chunks(
    array_fill(1.0, ARRAY[1536])::real[]::extensions.vector, 'FR', 5) LIMIT 1),
  'Été : juillet-août, 25°C, foules.'::text,
  'match FR retourne le chunk le plus similaire en premier'
);

-- 7. Limite respectée (sans filtre pays)
SELECT is(
  (SELECT count(*)::int FROM public.match_pays_chat_chunks(
    array_fill(1.0, ARRAY[1536])::real[]::extensions.vector, NULL, 2)),
  2,
  'limite p_limit appliquee'
);

SELECT * FROM finish();
ROLLBACK;
