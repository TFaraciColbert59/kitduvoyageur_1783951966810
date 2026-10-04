/**
 * POC mini-chat pays — formatage du contexte RAG (pur, testé).
 * Les chunks viennent de la RPC match_pays_chat_chunks (service role) ;
 * seuls des extraits publics du guide y entrent, jamais de PII.
 */

/** Modèle d'embedding OpenRouter — 1536D, cf. migration pays_chat_embeddings. */
export const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
export const MAX_RAG_CHUNKS = 5;
export const MAX_CHUNK_CHARS = 600;

export interface RagChunk {
  chunk_text: string;
  country_code: string;
  block_type: string;
  similarity: number;
}

export function formatRagContext(chunks: RagChunk[]): string {
  const kept = chunks.filter((c) => c.chunk_text && c.chunk_text.trim().length > 0);
  if (kept.length === 0) return '';
  return kept
    .slice(0, MAX_RAG_CHUNKS)
    .map((c) => `- [${c.country_code}/${c.block_type}] ${c.chunk_text.slice(0, MAX_CHUNK_CHARS)}`)
    .join('\n');
}
