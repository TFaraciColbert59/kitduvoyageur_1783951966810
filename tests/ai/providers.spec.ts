import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { openrouterProvider, noopProvider, getProvider, modelFor, MODEL_BY_TIER } from '../../src/lib/ai/providers';
import type { AIRequest } from '../../src/lib/ai/providers/types';

function makeReq(overrides: Partial<AIRequest> = {}): AIRequest {
  return {
    feature: 'test',
    tier: 'fast',
    system: 'sys',
    prompt: 'salut',
    maxTokens: 512,
    ...overrides,
  };
}

function orResponse(status: number, content: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
  };
}

describe('src/lib/ai/providers — port IA + adapters', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-test-key');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://test.lkdv.app');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('TEST-PRV-01: les IDs de modèles sont exacts', () => {
    expect(MODEL_BY_TIER.heavy).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');
    expect(MODEL_BY_TIER.fast).toBe('nvidia/nemotron-3-nano-30b-a3b:free');
    expect(modelFor('heavy')).toBe(MODEL_BY_TIER.heavy);
  });

  it('TEST-PRV-02: complete fast → URL, headers, modèle nano, sans reasoning', async () => {
    fetchMock.mockResolvedValueOnce(orResponse(200, 'Réponse nano'));

    const text = await openrouterProvider.complete(makeReq());

    expect(text).toBe('Réponse nano');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-or-test-key');
    expect(headers['HTTP-Referer']).toBe('https://test.lkdv.app');
    expect(headers['X-Title']).toBe('LKDV');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(MODEL_BY_TIER.fast);
    expect(body.max_tokens).toBe(512);
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'salut' },
    ]);
    expect(body.reasoning).toBeUndefined();
  });

  it('TEST-PRV-03: reasoning envoyé UNIQUEMENT pour heavy avec reasoningBudget', async () => {
    fetchMock.mockResolvedValue(orResponse(200, 'ok'));

    await openrouterProvider.complete(makeReq({ tier: 'heavy', reasoningBudget: 4000 }));
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).reasoning)
      .toEqual({ max_tokens: 4000 });

    await openrouterProvider.complete(makeReq({ tier: 'fast', reasoningBudget: 4000 }));
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string).reasoning)
      .toBeUndefined();

    await openrouterProvider.complete(makeReq({ tier: 'heavy' }));
    expect(JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string).reasoning)
      .toBeUndefined();
  });

  it('TEST-PRV-04: throw avec status sur 429/500 et sur contenu vide', async () => {
    fetchMock.mockResolvedValueOnce(orResponse(429, ''));
    await expect(openrouterProvider.complete(makeReq())).rejects.toMatchObject({ status: 429 });

    fetchMock.mockResolvedValueOnce(orResponse(500, ''));
    await expect(openrouterProvider.complete(makeReq())).rejects.toMatchObject({ status: 500 });

    fetchMock.mockResolvedValueOnce(orResponse(200, '   '));
    await expect(openrouterProvider.complete(makeReq())).rejects.toMatchObject({ status: 502 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('TEST-PRV-05: AbortSignal transmis pour le timeout', async () => {
    fetchMock.mockResolvedValueOnce(orResponse(200, 'ok'));

    await openrouterProvider.complete(makeReq());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('TEST-PRV-06: isAvailable dépend de la clé ; getProvider bascule vers noop sans clé', () => {
    expect(openrouterProvider.isAvailable()).toBe(true);
    expect(getProvider().name).toBe('openrouter');

    vi.stubEnv('OPENROUTER_API_KEY', undefined);
    expect(openrouterProvider.isAvailable()).toBe(false);
    expect(getProvider().name).toBe('noop');
  });

  it('TEST-PRV-07: noop est toujours disponible et complete() throw IA indisponible', async () => {
    expect(noopProvider.isAvailable()).toBe(true);
    await expect(noopProvider.complete(makeReq())).rejects.toThrow(/IA indisponible/);
  });
});
