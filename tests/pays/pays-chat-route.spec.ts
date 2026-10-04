import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/pays/[code]/chat/route';
import { resetMemoryRateLimits } from '@/lib/rate-limit';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/ai/askAI', () => ({
  askAI: vi.fn().mockResolvedValue({
    text: 'Juillet-août : 25°C.',
    degraded: false,
    model: 'test-model',
    cached: false,
    provider: 'test',
  }),
}));

import { askAI } from '@/lib/ai/askAI';
import { createClient as createSbClient } from '@supabase/supabase-js';

const params = (code: string) => ({ params: Promise.resolve({ code }) });
const post = (code: string, body: unknown) =>
  POST(
    new Request('http://localhost/api/pays/FR/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params(code)
  );

const VECTOR_1536 = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));

describe('POST /api/pays/[code]/chat', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.mocked(askAI).mockClear();
    vi.mocked(createSbClient).mockClear();
    resetMemoryRateLimits();
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('refuse un code pays invalide', async () => {
    const res = await post('../etc', { question: 'Bonjour' });
    expect(res.status).toBe(400);
  });

  it('refuse un body invalide', async () => {
    const res = await post('FR', { question: '' });
    expect(res.status).toBe(400);
  });

  it('repond sans RAG quand les cles sont absentes', async () => {
    const res = await post('FR', { question: 'Quand partir ?' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toContain('25°C');
    expect(body.ragUsed).toBe(false);
    expect(askAI).toHaveBeenCalledOnce();
    const arg = vi.mocked(askAI).mock.calls[0][0] as { system: string };
    expect(arg.system).toContain('(FR)');
  });

  it('enrichit via RAG quand embeddings + RPC reussissent', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'k-or');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k-svc');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ embedding: VECTOR_1536 }] }),
      })
    );
    vi.mocked(createSbClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            chunk_text: 'Été : juillet-août, 25°C.',
            country_code: 'FR',
            block_type: 'meilleure_saison',
            similarity: 0.99,
          },
        ],
        error: null,
      }),
    } as never);
    const res = await post('FR', { question: 'Quand partir ?' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ragUsed).toBe(true);
    const arg = vi.mocked(askAI).mock.calls[0][0] as { system: string };
    expect(arg.system).toContain('juillet-août');
  });

  it('degrade gracieusement si les embeddings echouent', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'k-or');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k-svc');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const res = await post('FR', { question: 'Quand partir ?' });
    expect(res.status).toBe(200);
    expect((await res.json()).ragUsed).toBe(false);
  });
});
