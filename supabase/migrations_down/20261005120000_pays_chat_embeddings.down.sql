-- Rollback de 20261005120000_pays_chat_embeddings.sql
-- (l'extension pgvector est conservée : partagée, non exclusive au POC).
DROP FUNCTION IF EXISTS public.match_pays_chat_chunks(extensions.vector, text, integer);
DROP TABLE IF EXISTS public.pays_chat_embeddings;
