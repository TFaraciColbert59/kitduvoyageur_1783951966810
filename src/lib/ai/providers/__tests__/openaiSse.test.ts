import { describe, expect, it } from 'vitest';
import { readOpenAICompatibleSse } from '../openaiSse';

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const delta of readOpenAICompatibleSse(stream)) out.push(delta);
  return out;
}

describe('readOpenAICompatibleSse', () => {
  it('décode un UTF-8 coupé au milieu d’un caractère et un événement coupé entre deux lectures', async () => {
    const text =
      'data: {"choices":[{"delta":{"content":"Bonjour é"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"té"}}]}\r\n\r\n' +
      'data: [DONE]\n\n';
    const bytes = new TextEncoder().encode(text);
    // Coupe au milieu du « é » (2 octets en UTF-8) et au milieu d'un événement.
    const cut = text.indexOf('é') + 1;
    const chunks = [bytes.slice(0, cut), bytes.slice(cut, cut + 17), bytes.slice(cut + 17)];
    await expect(collect(streamOf(chunks))).resolves.toEqual(['Bonjour é', 'té']);
  });

  it('concatène plusieurs lignes data et ignore les commentaires', async () => {
    const text =
      ': keep-alive\n' +
      'data: {"choices":[\n' +
      'data: {"delta":{"content":"A"}}]}\n\n' +
      'data: [DONE]\n\n';
    await expect(collect(streamOf([new TextEncoder().encode(text)]))).resolves.toEqual(['A']);
  });

  it('remonte une erreur de flux au lieu de la fin silencieuse', async () => {
    const text = 'data: {"error":{"message":"upstream"}}\n\n';
    await expect(collect(streamOf([new TextEncoder().encode(text)]))).rejects.toThrow(
      'erreur dans le flux'
    );
  });

  it('refuse un JSON invalide', async () => {
    const text = 'data: {pas du json}\n\n';
    await expect(collect(streamOf([new TextEncoder().encode(text)]))).rejects.toThrow(
      'JSON invalide'
    );
  });
});
