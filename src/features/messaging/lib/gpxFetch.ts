/**
 * Lecture bornée d'un fichier GPX distant : une réponse démesurée n'est ni
 * téléchargée en entier ni analysée (l'analyse se ferait sur le fil principal).
 */
import { MAX_GPX_FILE_BYTES } from '@/features/hiking/gpx/GPXEngine';

export const GPX_TOO_LARGE_MESSAGE = 'Fichier trop volumineux (5 Mo maximum).';

export class GpxTooLargeError extends Error {
  constructor() {
    super(GPX_TOO_LARGE_MESSAGE);
    this.name = 'GpxTooLargeError';
  }
}

/** Texte d'une réponse, ou `GpxTooLargeError` au-delà de `maxBytes` (flux interrompu dès le dépassement). */
export async function readLimitedText(response: Response, maxBytes = MAX_GPX_FILE_BYTES): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    void response.body?.cancel();
    throw new GpxTooLargeError();
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > maxBytes) throw new GpxTooLargeError();
    return text;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      void reader.cancel();
      throw new GpxTooLargeError();
    }
    chunks.push(value);
  }
  const decoder = new TextDecoder();
  return chunks.map((chunk, index) => decoder.decode(chunk, { stream: index < chunks.length - 1 })).join('');
}
