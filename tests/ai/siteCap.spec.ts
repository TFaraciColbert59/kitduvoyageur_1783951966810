/** Plan 2.5 / 1.7 : plafond du site par jour et fail-closed des compteurs IA. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  rate: vi.fn(),
  provider: vi.fn(async () => 'réponse IA'),
  cached: vi.fn(async (..._a: unknown[]) => null as unknown),
  rpc: vi.fn(),
  client: null as unknown,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: h.rate }));
vi.mock('@/lib/ai/providers', () => ({
  providerChain: () => [{ name: 'nvidia', isAvailable: () => true, complete: h.provider }],
  modelNameFor: () => 'modele',
}));
vi.mock('@/lib/ai/responseStore', () => ({ getCached: h.cached, setCached: async () => undefined }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: () => h.client }));

import { askAI, siteAiVerdict } from '@/lib/ai/askAI';
import { consumeQuota } from '@/lib/ai/quota';
import { describeAiFailure } from '@/features/adventure-prep/engine/aiFailure';

const REQ = { feature: 'diagnostic', tier: 'heavy' as const, system: 's', prompt: 'p', maxTokens: 256 };
const USER = '11111111-1111-4111-8111-111111111111';
const ok = (backend = 'postgres') => ({ outcome: 'allowed', allowed: true, backend, degraded: false });

beforeEach(() => {
  h.rate.mockReset().mockResolvedValue(ok());
  h.provider.mockClear();
  h.cached.mockReset().mockResolvedValue(null);
  h.rpc.mockReset().mockResolvedValue({ data: true, error: null });
  h.client = { rpc: h.rpc };
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('plafond du site (AI_DAILY_CAP)', () => {
  it('compte une clé par jour (UTC) et applique le plafond configuré en fenêtre de 24 h, fermée', async () => {
    vi.stubEnv('AI_DAILY_CAP', '50');
    await siteAiVerdict(new Date('2026-10-12T23:59:00Z'));
    expect(h.rate).toHaveBeenCalledWith({ key: 'ai:site:day:2026-10-12', limit: 50, windowMs: 86_400_000, failMode: 'closed' });
    await siteAiVerdict(new Date('2026-10-13T00:01:00Z'));
    expect(h.rate.mock.calls[1][0].key).toBe('ai:site:day:2026-10-13');
  });

  it('plafond atteint : repli par règles, « quota épuisé », fournisseur jamais appelé', async () => {
    h.rate.mockResolvedValue({ outcome: 'limited', allowed: false, backend: 'postgres', degraded: false });
    const r = await askAI(REQ);
    expect(r.provider).toBe('fallback');
    expect(r.failureReason).toBe('quota_epuise');
    expect(h.provider).not.toHaveBeenCalled();
  });

  it('compteur injoignable (outcome unavailable) : l’IA ne répond pas, cause dite', async () => {
    h.rate.mockResolvedValue({ outcome: 'unavailable', allowed: false, backend: 'postgres', degraded: true });
    const r = await askAI(REQ);
    expect(r.provider).toBe('fallback');
    expect(r.failureReason).toBe('compteur_illisible');
    expect(h.provider).not.toHaveBeenCalled();
    expect(describeAiFailure('compteur_illisible')).toMatch(/illisible/);
    expect(describeAiFailure('compteur_illisible')).not.toMatch(/épuisés/);
  });

  it('compteur qui lève : même refus', async () => {
    h.rate.mockRejectedValue(new Error('boom'));
    expect((await askAI(REQ)).failureReason).toBe('compteur_illisible');
    expect(h.provider).not.toHaveBeenCalled();
  });

  it('production sans compteur partagé (mémoire par instance) : refus ; hors production : permis', async () => {
    h.rate.mockResolvedValue(ok('memory'));
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(await siteAiVerdict()).toBe('illisible');
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(await siteAiVerdict()).toBe('ok');
    h.rate.mockResolvedValue(ok('postgres'));
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(await siteAiVerdict()).toBe('ok');
  });

  it('une réponse du cache ne consomme rien du plafond', async () => {
    h.cached.mockResolvedValue({ text: 'cache', model: 'm', degraded: false, cached: true, provider: 'nvidia' });
    const r = await askAI({ ...REQ, feature: 'country-guides' });
    expect(r.cached).toBe(true);
    expect(h.rate).not.toHaveBeenCalled();
  });

  it('IA éteinte : rien n’est compté', async () => {
    vi.stubEnv('AI_MODE', 'off');
    expect((await askAI(REQ)).failureReason).toBe('ia_eteinte');
    expect(h.rate).not.toHaveBeenCalled();
  });

  it('tout va bien : l’IA répond', async () => {
    const r = await askAI(REQ);
    expect(r.degraded).toBe(false);
    expect(h.provider).toHaveBeenCalledTimes(1);
  });
});

describe('quota par personne : fail-closed en production', () => {
  it('production, RPC en erreur : refus et prévient l’appelant', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    h.rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });
    const onUnreadable = vi.fn();
    expect(await consumeQuota(USER, 'heavy', 'diagnostic', 50, { onUnreadable })).toBe(false);
    expect(onUnreadable).toHaveBeenCalledTimes(1);
  });

  it('production, clé de service absente ou exception : refus', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    h.client = null;
    expect(await consumeQuota(USER, 'heavy', 'diagnostic', 50)).toBe(false);
    h.client = { rpc: h.rpc };
    h.rpc.mockRejectedValue(new Error('réseau'));
    expect(await consumeQuota(USER, 'heavy', 'diagnostic', 50)).toBe(false);
  });

  it('hors production : compteur illisible = permis, avec avertissement', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    const onUnreadable = vi.fn();
    expect(await consumeQuota(USER, 'heavy', 'diagnostic', 50, { onUnreadable })).toBe(true);
    expect(onUnreadable).not.toHaveBeenCalled();
  });

  it('quota lisible : la réponse de la base fait foi (refus ≠ illisible)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const onUnreadable = vi.fn();
    h.rpc.mockResolvedValue({ data: false, error: null });
    expect(await consumeQuota(USER, 'heavy', 'diagnostic', 50, { onUnreadable })).toBe(false);
    h.rpc.mockResolvedValue({ data: true, error: null });
    expect(await consumeQuota(USER, 'heavy', 'diagnostic', 50, { onUnreadable })).toBe(true);
    expect(onUnreadable).not.toHaveBeenCalled();
  });

  it('askAI : quota illisible en production → « compteur illisible », pas « quota épuisé »', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    h.rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    const r = await askAI({ ...REQ, userId: USER });
    expect(r.failureReason).toBe('compteur_illisible');
    expect(h.provider).not.toHaveBeenCalled();
    // Le plafond du site n'est même pas consulté : la personne est refusée avant.
    expect(h.rate).not.toHaveBeenCalled();
  });

  it('askAI : quota refusé par la base (lisible) → « quota épuisé »', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    h.rpc.mockResolvedValue({ data: false, error: null });
    const r = await askAI({ ...REQ, userId: USER });
    expect(r.failureReason).toBe('quota_epuise');
  });
});
