/**
 * Phase 6 — Rate limiting distribué (`src/lib/rate-limit`).
 *
 *   • TEST-PHASE6-RL-01 : non configuré ⇒ repli mémoire, quota + fenêtre ;
 *   • TEST-PHASE6-RL-02 : configuré ⇒ Upstash REST (pipeline), clé et auth ;
 *   • TEST-PHASE6-RL-03 : quota Upstash dépassé ⇒ limited + Retry-After (PTTL) ;
 *   • TEST-PHASE6-RL-04 : Upstash injoignable + failMode open ⇒ repli mémoire dégradé ;
 *   • TEST-PHASE6-RL-05 : Upstash injoignable + failMode closed ⇒ unavailable (503) ;
 *   • TEST-PHASE6-RL-06 : réponse HTTP en erreur / invalide ⇒ fail-safe ;
 *   • TEST-PHASE6-RL-07 : timeout ⇒ fail-safe sans requête bloquante ;
 *   • TEST-PHASE6-RL-08 : helpers clé/IP/en-têtes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clientIpFromHeaders,
  rateLimit,
  rateLimitHeaders,
  rateLimitKey,
  resetMemoryRateLimits,
} from '@/lib/rate-limit';

const ENV_CONFIGURED = { url: 'https://redis.example.upstash.io', token: 'jeton-test' };

function pipelineResponse(results: number[]): Response {
  return new Response(
    JSON.stringify(results.map((result) => ({ result }))),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

describe('Phase 6 — rate limiting distribué (TEST-PHASE6-RL)', () => {
  beforeEach(() => {
    resetMemoryRateLimits();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('TEST-PHASE6-RL-01: non configuré ⇒ repli mémoire avec quota et fenêtre', async () => {
    const now = 1_000_000;
    const call = () =>
      rateLimit({ key: 'scope:alice', limit: 3, windowMs: 60_000, env: {}, now: () => now });

    const first = await call();
    expect(first.outcome).toBe('allowed');
    expect(first.backend).toBe('memory');
    expect(first.remaining).toBe(2);
    expect(first.degraded).toBe(false);

    await call();
    const third = await call();
    expect(third.remaining).toBe(0);
    expect(third.allowed).toBe(true);

    const fourth = await call();
    expect(fourth.outcome).toBe('limited');
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBe(60);
    expect(rateLimitHeaders(fourth)['Retry-After']).toBe('60');

    const otherKey = await rateLimit({
      key: 'scope:bob',
      limit: 3,
      windowMs: 60_000,
      env: {},
      now: () => now,
    });
    expect(otherKey.outcome).toBe('allowed');

    const afterWindow = await rateLimit({
      key: 'scope:alice',
      limit: 3,
      windowMs: 60_000,
      env: {},
      now: () => now + 60_001,
    });
    expect(afterWindow.outcome).toBe('allowed');
    expect(afterWindow.remaining).toBe(2);
  });

  it('TEST-PHASE6-RL-02: configuré ⇒ Upstash REST avec clé, jeton et pipeline', async () => {
    const fetchImpl = vi.fn(async () => pipelineResponse([1, 0, 42_000])) as unknown as typeof fetch;

    const result = await rateLimit({
      key: 'adventure-generate:user-1',
      limit: 5,
      windowMs: 300_000,
      env: ENV_CONFIGURED,
      fetchImpl,
      now: () => 5_000_000,
    });

    expect(result.outcome).toBe('allowed');
    expect(result.backend).toBe('redis');
    expect(result.degraded).toBe(false);
    expect(result.remaining).toBe(4);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://redis.example.upstash.io/pipeline');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jeton-test');
    const body = JSON.parse(String(init.body)) as unknown[][];
    expect(body[0]).toEqual(['INCR', 'adventure-generate:user-1']);
    expect(body[1]).toEqual(['PEXPIRE', 'adventure-generate:user-1', 300_000, 'NX']);
    expect(body[2]).toEqual(['PTTL', 'adventure-generate:user-1']);
  });

  it('TEST-PHASE6-RL-03: quota Upstash dépassé ⇒ limited + Retry-After (PTTL)', async () => {
    const fetchImpl = vi.fn(async () => pipelineResponse([4, 0, 12_500])) as unknown as typeof fetch;

    const result = await rateLimit({
      key: 'ai-jobs:user-2',
      limit: 3,
      windowMs: 60_000,
      env: ENV_CONFIGURED,
      fetchImpl,
      now: () => 1_000_000,
    });

    expect(result.outcome).toBe('limited');
    expect(result.backend).toBe('redis');
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBe(13);
  });

  it('TEST-PHASE6-RL-04: Upstash injoignable + failMode open ⇒ repli mémoire dégradé', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('socket hang up');
    }) as unknown as typeof fetch;

    const first = await rateLimit({
      key: 'terrain-conditions:ip-1',
      limit: 2,
      windowMs: 60_000,
      failMode: 'open',
      env: ENV_CONFIGURED,
      fetchImpl,
      now: () => 2_000_000,
    });
    expect(first.outcome).toBe('allowed');
    expect(first.backend).toBe('memory');
    expect(first.degraded).toBe(true);
    expect(first.detail).toContain('repli_memoire:');
    expect(rateLimitHeaders(first)['X-RateLimit-Degraded']).toBe('1');

    await rateLimit({
      key: 'terrain-conditions:ip-1',
      limit: 2,
      windowMs: 60_000,
      failMode: 'open',
      env: ENV_CONFIGURED,
      fetchImpl,
      now: () => 2_000_000,
    });
    const limited = await rateLimit({
      key: 'terrain-conditions:ip-1',
      limit: 2,
      windowMs: 60_000,
      failMode: 'open',
      env: ENV_CONFIGURED,
      fetchImpl,
      now: () => 2_000_000,
    });
    expect(limited.outcome).toBe('limited');
    expect(limited.degraded).toBe(true);
  });

  it('TEST-PHASE6-RL-05: Upstash injoignable + failMode closed ⇒ unavailable explicite', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('econnrefused');
    }) as unknown as typeof fetch;

    const result = await rateLimit({
      key: 'adventure-generate:user-3',
      limit: 10,
      windowMs: 300_000,
      failMode: 'closed',
      env: ENV_CONFIGURED,
      fetchImpl,
      now: () => 3_000_000,
    });

    expect(result.outcome).toBe('unavailable');
    expect(result.allowed).toBe(false);
    expect(result.backend).toBe('redis');
    expect(result.degraded).toBe(true);
    expect(result.detail).toContain('fail_closed:');
    expect(result.retryAfterSeconds).toBe(300);

    vi.stubGlobal('fetch', undefined);
    const withoutGlobal = await rateLimit({
      key: 'adventure-generate:user-3',
      limit: 10,
      windowMs: 300_000,
      failMode: 'closed',
      env: ENV_CONFIGURED,
      now: () => 3_000_000,
    });
    expect(withoutGlobal.outcome).toBe('unavailable');
    expect(withoutGlobal.detail).toContain('fetch_indisponible');
  });

  it('TEST-PHASE6-RL-06: statut HTTP en erreur ou réponse invalide ⇒ fail-safe', async () => {
    const httpError = vi.fn(
      async () => new Response('boom', { status: 503 })
    ) as unknown as typeof fetch;

    const closed = await rateLimit({
      key: 'scope:http',
      limit: 1,
      windowMs: 10_000,
      failMode: 'closed',
      env: ENV_CONFIGURED,
      fetchImpl: httpError,
      now: () => 4_000_000,
    });
    expect(closed.outcome).toBe('unavailable');
    expect(closed.detail).toContain('upstash_http_503');

    const malformed = vi.fn(
      async () => new Response(JSON.stringify({ nope: true }), { status: 200 })
    ) as unknown as typeof fetch;

    const open = await rateLimit({
      key: 'scope:malformed',
      limit: 1,
      windowMs: 10_000,
      failMode: 'open',
      env: ENV_CONFIGURED,
      fetchImpl: malformed,
      now: () => 4_000_000,
    });
    expect(open.outcome).toBe('allowed');
    expect(open.degraded).toBe(true);
    expect(open.detail).toContain('upstash_reponse_invalide');
  });

  it('TEST-PHASE6-RL-07: timeout ⇒ fail-safe sans blocage', async () => {
    const hangingFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    ) as unknown as typeof fetch;

    const result = await rateLimit({
      key: 'scope:timeout',
      limit: 1,
      windowMs: 10_000,
      failMode: 'closed',
      env: ENV_CONFIGURED,
      fetchImpl: hangingFetch,
      timeoutMs: 20,
      now: () => 5_000_000,
    });

    expect(result.outcome).toBe('unavailable');
    expect(result.detail).toContain('aborted');
  });

  it('TEST-PHASE6-RL-08: helpers de clé, IP et en-têtes', () => {
    expect(rateLimitKey('adventure-generate', 'user-1')).toBe('adventure-generate:user-1');
    expect(rateLimitKey('   ', '  ')).toBe('rate:inconnu');

    const headers = new Headers({
      'x-forwarded-for': '203.0.113.7, 10.0.0.1',
      'x-real-ip': '198.51.100.9',
    });
    expect(clientIpFromHeaders(headers)).toBe('203.0.113.7');
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '198.51.100.9' }))).toBe(
      '198.51.100.9'
    );
    expect(clientIpFromHeaders(new Headers())).toBe('inconnue');

    const limitedHeaders = rateLimitHeaders({
      outcome: 'limited',
      allowed: false,
      limit: 10,
      remaining: 0,
      retryAfterSeconds: 42,
      backend: 'redis',
      degraded: false,
      detail: 'upstash_redis',
    });
    expect(limitedHeaders).toEqual({
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': '0',
      'Retry-After': '42',
    });
  });
});
