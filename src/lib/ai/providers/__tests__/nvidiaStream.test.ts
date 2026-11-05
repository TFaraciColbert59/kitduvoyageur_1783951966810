import { afterEach, describe, expect, it, vi } from 'vitest';
import { nvidiaProvider } from '../nvidia';

function sseBody(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const bytes = new TextEncoder().encode(text);
      const cut = Math.floor(bytes.length / 2);
      controller.enqueue(bytes.slice(0, cut));
      controller.enqueue(bytes.slice(cut));
      controller.close();
    },
  });
}

describe('nvidiaProvider.stream', () => {
  const previous = process.env.NVIDIA_API_KEY;
  afterEach(() => {
    process.env.NVIDIA_API_KEY = previous;
    vi.restoreAllMocks();
  });

  it('rend les deltas content, ignore le raisonnement et s’arrête sur [DONE]', async () => {
    process.env.NVIDIA_API_KEY = 'test-key';
    const body =
      'data: {"choices":[{"delta":{"reasoning_content":"secret"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"Bon"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"jour"}}]}\n\n' +
      'data: [DONE]\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(sseBody(body), { status: 200, headers: { 'content-type': 'text/event-stream' } })),
    );
    const stream = nvidiaProvider.stream!({
      feature: 'chat-completion',
      tier: 'fast',
      system: 'system',
      prompt: 'prompt',
      maxTokens: 128,
    });
    const chunks: string[] = [];
    for await (const delta of stream) chunks.push(delta);
    expect(chunks).toEqual(['Bon', 'jour']);
  });

  it('remonte un statut HTTP en ProviderError', async () => {
    process.env.NVIDIA_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    const stream = nvidiaProvider.stream!({
      feature: 'chat-completion',
      tier: 'fast',
      system: 'system',
      prompt: 'prompt',
      maxTokens: 128,
    });
    await expect(async () => {
      for await (const _ of stream) {
        /* consume */
      }
    }).rejects.toThrow('NVIDIA NIM HTTP 503');
  });
});
