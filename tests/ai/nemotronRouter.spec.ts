import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getCachedResponseMock, storeCachedResponseMock, buildCacheKeyMock } = vi.hoisted(() => ({
  getCachedResponseMock: vi.fn(async () => null),
  storeCachedResponseMock: vi.fn(async () => {}),
  buildCacheKeyMock: vi.fn(() => 'test-cache-key'),
}));

vi.mock('@/lib/ai/responseStore', () => ({
  buildCacheKey: buildCacheKeyMock,
  getCachedResponse: getCachedResponseMock,
  storeCachedResponse: storeCachedResponseMock,
}));

import {
  askAI,
  NEMOTRON_MODELS,
  AI_TIMEOUT_MS,
  MAX_REASONING_BUDGET,
} from '../../src/lib/ai/nemotronRouter';

const TEST_KEY = 'sk-or-test-1234567890abcdef';

function orResponse(status: number, content: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
  };
}

function parseBody(callIndex: number) {
  const fetchMock = vi.mocked(globalThis.fetch);
  return JSON.parse((fetchMock.mock.calls[callIndex][1] as RequestInit).body as string) as {
    model: string;
    max_tokens?: number;
    reasoning?: { max_tokens?: number };
  };
}

describe('src/lib/ai/nemotronRouter — routeur Nemotron via OpenRouter', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('OPENROUTER_API_KEY', TEST_KEY);
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://test.lkdv.app');
    getCachedResponseMock.mockClear().mockResolvedValue(null);
    storeCachedResponseMock.mockClear();
    buildCacheKeyMock.mockClear().mockReturnValue('test-cache-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('TEST-RT-01: task fast → modèle nano, headers OpenRouter corrects, pas de reasoning', async () => {
    fetchMock.mockResolvedValueOnce(orResponse(200, 'Bonjour !'));

    const result = await askAI({ task: 'fast', system: 'sys', prompt: 'salut' });

    expect(result).toEqual({
      ok: true,
      text: 'Bonjour !',
      model: NEMOTRON_MODELS.fast,
      degraded: false,
      cached: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TEST_KEY}`);
    expect(headers['HTTP-Referer']).toBe('https://test.lkdv.app');
    expect(headers['X-Title']).toBe('LKDV');

    const body = parseBody(0);
    expect(body.model).toBe(NEMOTRON_MODELS.fast);
    expect(body.reasoning).toBeUndefined();
  });

  it('TEST-RT-02: task heavy → modèle ultra avec reasoning borné (défaut)', async () => {
    fetchMock.mockResolvedValueOnce(orResponse(200, 'Analyse complète'));

    const result = await askAI({ task: 'heavy', system: 'sys', prompt: 'analyse' });

    expect(result.ok).toBe(true);
    expect(result.model).toBe(NEMOTRON_MODELS.heavy);
    const body = parseBody(0);
    expect(body.reasoning?.max_tokens).toBeLessThanOrEqual(MAX_REASONING_BUDGET);
  });

  it('TEST-RT-03: reasoningBudget excessif est borné à MAX_REASONING_BUDGET', async () => {
    fetchMock.mockResolvedValueOnce(orResponse(200, 'ok'));

    await askAI({ task: 'heavy', system: 'sys', prompt: 'analyse', reasoningBudget: 999_999 });

    const body = parseBody(0);
    expect(body.reasoning?.max_tokens).toBe(MAX_REASONING_BUDGET);
  });

  it('TEST-RT-04: 429 sur le primaire → fallback (heavy→nano), degraded: true', async () => {
    fetchMock.mockResolvedValueOnce(orResponse(429, ''));
    fetchMock.mockResolvedValueOnce(orResponse(200, 'Réponse de secours'));

    const result = await askAI({ task: 'heavy', system: 'sys', prompt: 'q' });

    expect(result).toEqual({
      ok: true,
      text: 'Réponse de secours',
      model: NEMOTRON_MODELS.fast,
      degraded: true,
      cached: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(parseBody(1).model).toBe(NEMOTRON_MODELS.fast);
  });

  it('TEST-RT-05: 5xx sur le primaire → fallback', async () => {
    fetchMock.mockResolvedValueOnce(orResponse(503, ''));
    fetchMock.mockResolvedValueOnce(orResponse(200, 'ok'));

    const result = await askAI({ task: 'fast', system: 'sys', prompt: 'q' });

    expect(result.ok).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.model).toBe(NEMOTRON_MODELS.heavy);
  });

  it('TEST-RT-06: timeout (AbortError) sur le primaire → fallback, signal AbortSignal transmis', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    fetchMock.mockRejectedValueOnce(abortError);
    fetchMock.mockResolvedValueOnce(orResponse(200, 'ok'));

    const result = await askAI({ task: 'fast', system: 'sys', prompt: 'q' });

    expect(result.ok).toBe(true);
    expect(result.degraded).toBe(true);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('TEST-RT-07: 401 → pas de fallback (erreur de configuration), fetch appelé une fois', async () => {
    fetchMock.mockResolvedValueOnce(orResponse(401, ''));

    const result = await askAI({ task: 'fast', system: 'sys', prompt: 'q' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ALL_PROVIDERS_FAILED');
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('TEST-RT-08: double échec → erreur typée, AUCUNE fuite de la clé API', async () => {
    fetchMock.mockResolvedValueOnce(orResponse(429, ''));
    fetchMock.mockResolvedValueOnce(orResponse(500, ''));

    const result = await askAI({ task: 'fast', system: 'sys', prompt: 'q' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ALL_PROVIDERS_FAILED');
      expect(result.error.message).toBeTruthy();
    }
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(TEST_KEY);
    expect(serialized).not.toContain('Authorization');
  });

  it('TEST-RT-09: OPENROUTER_API_KEY absente → NO_KEY, aucun appel réseau', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', undefined);

    const result = await askAI({ task: 'fast', system: 'sys', prompt: 'q' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NO_KEY');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('TEST-RT-10: cache hit → réponse du cache, aucun appel réseau', async () => {
    getCachedResponseMock.mockResolvedValueOnce('réponse mémorisée');

    const result = await askAI({ task: 'fast', system: 'sys', prompt: 'q' });

    expect(result).toEqual({
      ok: true,
      text: 'réponse mémorisée',
      model: 'cache',
      degraded: false,
      cached: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('TEST-RT-11: succès → la réponse est écrite dans le store avec la TTL demandée', async () => {
    fetchMock.mockResolvedValueOnce(orResponse(200, 'fraîche'));

    await askAI({ task: 'fast', system: 'sys', prompt: 'q', cacheTtlSeconds: 86_400 });

    expect(storeCachedResponseMock).toHaveBeenCalledWith(
      'test-cache-key',
      'chat',
      'fraîche',
      NEMOTRON_MODELS.fast,
      86_400,
    );
  });

  it('TEST-RT-12: entrée invalide (task inconnu) → INVALID_INPUT, aucun appel réseau', async () => {
    // @ts-expect-error — volontairement invalide
    const result = await askAI({ task: 'moyen', system: 'sys', prompt: 'q' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('TEST-RT-13: fallback fast→ultra borné (max_tokens ≤ 1000, reasoning réduit)', async () => {
    fetchMock.mockResolvedValueOnce(orResponse(429, ''));
    fetchMock.mockResolvedValueOnce(orResponse(200, 'ok'));

    await askAI({ task: 'fast', system: 'sys', prompt: 'q', maxTokens: 4_000 });

    const body = parseBody(1);
    expect(body.model).toBe(NEMOTRON_MODELS.heavy);
    expect(body.max_tokens).toBeLessThanOrEqual(1_000);
    expect(body.reasoning?.max_tokens).toBeLessThanOrEqual(512);
  });

  it('TEST-RT-14: les timeouts sont 8s (fast) et 45s (heavy)', () => {
    expect(AI_TIMEOUT_MS.fast).toBe(8_000);
    expect(AI_TIMEOUT_MS.heavy).toBe(45_000);
  });
});
