import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { providerCompleteMock, getCachedMock, setCachedMock, consumeQuotaMock, getProviderMock } =
  vi.hoisted(() => ({
    providerCompleteMock: vi.fn(),
    getCachedMock: vi.fn(async () => null),
    setCachedMock: vi.fn(async () => {}),
    consumeQuotaMock: vi.fn(async () => true),
    getProviderMock: vi.fn(),
  }));

vi.mock('@/lib/ai/providers', () => ({
  getProvider: getProviderMock,
  modelFor: (tier: string) => (tier === 'heavy' ? 'ultra-model-id' : 'nano-model-id'),
}));

vi.mock('@/lib/ai/responseStore', () => ({
  getCached: getCachedMock,
  setCached: setCachedMock,
}));

vi.mock('@/lib/ai/quota', () => ({
  consumeQuota: consumeQuotaMock,
}));

import { askAI } from '../../src/lib/ai/askAI';
import type { AIRequest, AIProvider } from '../../src/lib/ai/providers/types';

function makeProvider(partial: Partial<AIProvider>): AIProvider {
  return { name: 'openrouter', isAvailable: () => true, complete: providerCompleteMock, ...partial };
}

function makeReq(overrides: Partial<AIRequest> = {}): AIRequest {
  return {
    feature: 'diagnostic',
    tier: 'heavy',
    system: 'sys',
    prompt: 'question',
    maxTokens: 512,
    ...overrides,
  };
}

describe('src/lib/ai/askAI — point d\'entrée unique (port IA + registre)', () => {
  beforeEach(() => {
    providerCompleteMock.mockReset().mockResolvedValue('réponse IA');
    getProviderMock.mockReset().mockReturnValue(makeProvider({}));
    getCachedMock.mockReset().mockResolvedValue(null);
    setCachedMock.mockReset();
    consumeQuotaMock.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('TEST-ASK-01: succès → texte du provider, model mappé par tier, degraded false', async () => {
    const result = await askAI(makeReq({ tier: 'heavy', userId: '11111111-1111-4111-8111-111111111111' }));

    expect(result).toEqual({
      text: 'réponse IA',
      model: 'ultra-model-id',
      degraded: false,
      cached: false,
      provider: 'openrouter',
    });
    expect(consumeQuotaMock).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111', 'heavy', 'diagnostic', 50
    );
  });

  it('TEST-ASK-02: échec provider (429) → fallbackResponse de la feature, AUCUN throw', async () => {
    providerCompleteMock.mockRejectedValue(Object.assign(new Error('OpenRouter HTTP 429'), { status: 429 }));

    const result = await askAI(makeReq({ feature: 'diagnostic' }));

    expect(result.degraded).toBe(true);
    expect(result.provider).toBe('fallback');
    expect(result.cached).toBe(false);
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('TEST-ASK-03: cache hit → provider NON appelé, cached true', async () => {
    getCachedMock.mockResolvedValueOnce({
      text: 'du cache', model: 'm', degraded: false, cached: true, provider: 'openrouter',
    });

    const result = await askAI(makeReq({ feature: 'country-guides' }));

    expect(result).toMatchObject({ text: 'du cache', cached: true });
    expect(providerCompleteMock).not.toHaveBeenCalled();
    expect(consumeQuotaMock).not.toHaveBeenCalled();
  });

  it('TEST-ASK-04: quota dépassé → fallback, provider NON appelé', async () => {
    consumeQuotaMock.mockResolvedValueOnce(false);

    const result = await askAI(makeReq({ feature: 'kit-configurator', userId: '22222222-2222-4222-8222-222222222222' }));

    expect(result.degraded).toBe(true);
    expect(result.provider).toBe('fallback');
    expect(providerCompleteMock).not.toHaveBeenCalled();
    expect(consumeQuotaMock).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222', 'heavy', 'kit-configurator', 10
    );
  });

  it('TEST-ASK-05: reasoningBudget borné par le registre, transmis au provider', async () => {
    await askAI(makeReq({ feature: 'kit-configurator', reasoningBudget: 90_000 }));

    const req = providerCompleteMock.mock.calls[0][0] as AIRequest;
    expect(req.reasoningBudget).toBe(4000); // maxReasoningBudget de kit-configurator
    expect(req.tier).toBe('heavy');
  });

  it('TEST-ASK-06: AUCUNE clé ne fuite dans le résultat (succès comme fallback)', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-secret-leak-check');
    providerCompleteMock.mockRejectedValueOnce(new Error('OpenRouter HTTP 429'));

    const ok = await askAI(makeReq());
    const degraded = await askAI(makeReq());

    for (const result of [ok, degraded]) {
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('sk-or-secret-leak-check');
      expect(serialized).not.toContain('Authorization');
    }
  });

  it('TEST-ASK-07: feature inconnue → throw (bug programmeur, pas un path utilisateur)', async () => {
    await expect(askAI(makeReq({ feature: 'feature-fantome' }))).rejects.toThrow(/feature-fantome/);
    expect(providerCompleteMock).not.toHaveBeenCalled();
  });

  it('TEST-ASK-08: TTL 0 → setCached jamais appelé ; TTL feature → setCached avec la TTL du registre', async () => {
    await askAI(makeReq({ feature: 'kit-configurator' }));
    expect(setCachedMock).not.toHaveBeenCalled();

    await askAI(makeReq({ feature: 'country-guides' }));
    expect(setCachedMock).toHaveBeenCalledWith(
      'country-guides', 'question', expect.objectContaining({ text: 'réponse IA' }), 2_592_000
    );
  });

  it('TEST-ASK-09: sans userId → quota non consulté, IA appelée', async () => {
    const result = await askAI(makeReq());

    expect(consumeQuotaMock).not.toHaveBeenCalled();
    expect(result.degraded).toBe(false);
    expect(providerCompleteMock).toHaveBeenCalledTimes(1);
  });

  it('TEST-ASK-10: provider noop (sans clé) → complete throw → fallback gracieux', async () => {
    getProviderMock.mockReturnValueOnce(makeProvider({
      name: 'noop',
      complete: vi.fn(async () => { throw new Error('IA indisponible'); }),
    }));

    const result = await askAI(makeReq({ feature: 'chat-completion', tier: 'fast' }));

    expect(result.degraded).toBe(true);
    expect(result.provider).toBe('fallback');
    expect(result.text).toMatch(/assistant IA/);
  });
});
