import { ProviderError } from './types';

/**
 * Lecture SSE d'un provider OpenAI-compatible, sans dépendance.
 *
 * - UTF-8 fragmenté (un caractère peut être coupé entre deux `read()`).
 * - Séparateurs `\n\n`, `\r\n\r\n`, `\r\r`.
 * - Plusieurs lignes `data:` par événement, concaténées par `\n`.
 * - `[DONE]` et `data.error` terminent explicitement.
 * - Mémoire bornée : un flux anormalement long est refusé, pas bufferisé sans fin.
 * - Le signal d'abandon est porté par `fetch` ; une lecture interrompue devient
 *   une `ProviderError` 504, jamais un succès partiel silencieux.
 */
const MAX_BUFFER = 1_000_000;

type ParsedEvent = { deltas: string[]; done: boolean };

function parseEvent(raw: string): ParsedEvent {
  const dataLines: string[] = [];
  for (const line of raw.split(/\r\n|\n|\r/)) {
    if (line.startsWith(':')) continue; // commentaire / heartbeat
    if (!line.startsWith('data:')) continue;
    dataLines.push(line.slice(5).replace(/^ /, ''));
  }
  if (dataLines.length === 0) return { deltas: [], done: false };
  const data = dataLines.join('\n').trim();
  if (!data) return { deltas: [], done: false };
  if (data === '[DONE]') return { deltas: [], done: true };

  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    // Un JSON invalide n'est pas un keepalive : le taire masquerait un flux
    // corrompu et ferait croire à une réponse complète.
    throw new ProviderError('Provider: événement SSE JSON invalide', 502);
  }
  const record = payload as {
    error?: { message?: string };
    choices?: Array<{
      delta?: { content?: unknown };
      text?: unknown;
    }>;
  };
  if (record?.error) {
    throw new ProviderError('Provider: erreur dans le flux', 502);
  }
  const deltas: string[] = [];
  for (const choice of record?.choices ?? []) {
    const content = choice?.delta?.content ?? choice?.text;
    if (typeof content === 'string' && content.length > 0) deltas.push(content);
  }
  return { deltas, done: false };
}

export async function* readOpenAICompatibleSse(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  try {
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > MAX_BUFFER) {
        throw new ProviderError('Provider: flux SSE trop long', 502);
      }
      let match = buffer.match(/\r\n\r\n|\n\n|\r\r/);
      while (match && match.index !== undefined) {
        const index = match.index;
        const raw = buffer.slice(0, index);
        buffer = buffer.slice(index + match[0].length);
        const parsed = parseEvent(raw);
        for (const delta of parsed.deltas) yield delta;
        if (parsed.done) {
          finished = true;
          break;
        }
        match = buffer.match(/\r\n\r\n|\n\n|\r\r/);
      }
    }
    if (!finished) {
      buffer += decoder.decode();
      const parsed = parseEvent(buffer);
      for (const delta of parsed.deltas) yield delta;
    }
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new ProviderError('Provider: flux interrompu', 504);
    }
    throw error;
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* le corps est déjà fermé */
    }
    reader.releaseLock();
  }
}
