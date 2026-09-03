import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { normalizePrompt, buildCacheKey, getCached, setCached } from '../../src/lib/ai/responseStore';
import type { AIResponse } from '../../src/lib/ai/providers/types';

describe('src/lib/ai/cache — store de réponses IA (service role)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('TEST-CACHE-01: normalisation — trim, lowercase, collapse espaces', () => {
    expect(normalizePrompt('  Bonjour   LE  Monde \n')).toBe('bonjour le monde');
    expect(normalizePrompt('Bonjour le monde')).toBe(normalizePrompt('  BONJOUR   LE MONDE  '));
  });

  it('TEST-CACHE-02: clés stables — même prompt normalisé → même clé', () => {
    const a = buildCacheKey('country-guides', 'Faut-il  un  filtre à eau au NÉPAL ?');
    const b = buildCacheKey('country-guides', 'faut-il un filtre à eau au népal ?');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('TEST-CACHE-03: clés distinctes par feature', () => {
    expect(buildCacheKey('country-guides', 'q')).not.toBe(buildCacheKey('kit-configurator', 'q'));
  });

  it('TEST-CACHE-04: sans SUPABASE_SERVICE_ROLE_KEY → cache désactivé sans exception', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', undefined);

    const sample: AIResponse = {
      text: 'réponse', model: 'm', degraded: false, cached: false, provider: 'openrouter',
    };

    await expect(getCached('country-guides', 'question')).resolves.toBeNull();
    await expect(setCached('country-guides', 'question', sample, 3600)).resolves.toBeUndefined();
  });

  it('TEST-CACHE-05: TTL 0 → setCached est un no-op (aucun appel réseau)', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key-test');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test-ref.supabase.co');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const sample: AIResponse = {
      text: 'réponse', model: 'm', degraded: false, cached: false, provider: 'openrouter',
    };

    await setCached('country-guides', 'question', sample, 0);

    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
