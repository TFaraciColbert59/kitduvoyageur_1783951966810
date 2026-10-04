/**
 * POC mini-chat pays — découpage des contenus guide en chunks RAG (pur, testé).
 * Paragraphes fusionnés jusqu'à maxChars ; paragraphe trop long découpé au
 * mot ; mot trop long découpé en dur. La copie de cette logique dans
 * scripts/ai/ingest-pays-chat-embeddings.mjs doit rester synchronisée
 * (même convention que pregen-country-guides.mjs).
 */

export const DEFAULT_CHUNK_CHARS = 1500;

export function chunkMarkdown(markdown: string, maxChars = DEFAULT_CHUNK_CHARS): string[] {
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paragraphs.length === 0) return [];

  const chunks: string[] = [];
  let current = '';
  const push = (text: string) => {
    if (text.length > 0) chunks.push(text);
  };
  const flush = () => {
    push(current);
    current = '';
  };
  const appendToCurrent = (piece: string) => {
    current = current.length === 0 ? piece : `${current}\n\n${piece}`;
  };

  for (const para of paragraphs) {
    if (para.length <= maxChars && (current + (current ? '\n\n' : '') + para).length <= maxChars) {
      appendToCurrent(para);
      continue;
    }
    if (current.length > 0 && para.length <= maxChars) {
      flush();
      appendToCurrent(para);
      continue;
    }
    // Paragraphe trop long : découpe au mot.
    flush();
    const words = para.split(/\s+/).filter((w) => w.length > 0);
    let piece = '';
    for (const word of words) {
      if (word.length > maxChars) {
        if (piece.length > 0) {
          push(piece);
          piece = '';
        }
        for (let i = 0; i < word.length; i += maxChars) push(word.slice(i, i + maxChars));
        continue;
      }
      const next = piece.length === 0 ? word : `${piece} ${word}`;
      if (next.length > maxChars) {
        push(piece);
        piece = word;
      } else {
        piece = next;
      }
    }
    if (piece.length > 0) {
      // Dernier morceau : devient le courant (peut fusionner avec la suite).
      current = piece;
    }
  }
  flush();
  return chunks;
}
