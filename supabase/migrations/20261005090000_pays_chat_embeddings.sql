-- ═══════════════════════════════════════════════════════════════════════════
-- POC mini-chat pays — store vectoriel RAG (phase RAG, §3/§4 du rapport)
-- Table pays_chat_embeddings + RPC match_pays_chat_chunks (cosinus).
-- Idempotent : IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.
--
-- Dimension 1536 = text-embedding-3-small (standard de facto, compatible
-- OpenRouter). Si le modèle d'ingestion change, recréer la colonne avec la
-- nouvelle dimension — jamais de mélange de dimensions dans une table.
-- L'ingestion (INSERT) et la recherche (RPC) passent par le service role
-- uniquement ; aucun accès anon/authenticated direct (cf. ai_response_cache).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Extension pgvector (schema extensions, convention Supabase) ─────────
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ── 2. Store des chunks (guide pays + docs, texte public uniquement) ────────
CREATE TABLE IF NOT EXISTS public.pays_chat_embeddings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  block_type   text NOT NULL DEFAULT 'guide',
  chunk_text   text NOT NULL CHECK (char_length(chunk_text) BETWEEN 1 AND 8000),
  embedding    extensions.vector(1536) NOT NULL,
  model        text NOT NULL DEFAULT 'text-embedding-3-small',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pays_chat_embeddings_country
  ON public.pays_chat_embeddings(country_code);

-- HNSW cosinus : adapté aux petits corpus, sans phase d'entraînement
-- (contrairement à IVFFlat qui exige des lists calibrées).
CREATE INDEX IF NOT EXISTS idx_pays_chat_embeddings_hnsw
  ON public.pays_chat_embeddings
  USING hnsw (embedding extensions.vector_cosine_ops);

ALTER TABLE public.pays_chat_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pays_chat_embeddings_select_false" ON public.pays_chat_embeddings;
CREATE POLICY "pays_chat_embeddings_select_false" ON public.pays_chat_embeddings
  FOR SELECT USING (false);

DROP POLICY IF EXISTS "pays_chat_embeddings_no_write" ON public.pays_chat_embeddings;
CREATE POLICY "pays_chat_embeddings_no_write" ON public.pays_chat_embeddings
  FOR ALL USING (false) WITH CHECK (false);

-- ── 3. Recherche par similarité cosinus (service role uniquement) ──────────
-- NOTE search_path : `extensions` est requis pour l'opérateur de distance
-- pgvector (<=>) ; public + pg_temp restent verrouillés (durcissement habituel).
CREATE OR REPLACE FUNCTION public.match_pays_chat_chunks(
  p_query_embedding extensions.vector(1536),
  p_country_code text DEFAULT NULL,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  chunk_text   text,
  country_code text,
  block_type   text,
  similarity   float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT
    e.chunk_text,
    e.country_code,
    e.block_type,
    1 - (e.embedding <=> p_query_embedding)::float AS similarity
  FROM public.pays_chat_embeddings AS e
  WHERE (p_country_code IS NULL OR e.country_code = p_country_code)
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT LEAST(greatest(COALESCE(p_limit, 5), 1), 50);
$$;

-- ── 4. Durcissement des privilèges ──────────────────────────────────────────
REVOKE ALL ON FUNCTION public.match_pays_chat_chunks(extensions.vector, text, integer) FROM public;

GRANT EXECUTE ON FUNCTION public.match_pays_chat_chunks(extensions.vector, text, integer)
  TO service_role;
