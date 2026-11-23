import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/cron/auth', () => ({ isCronAuthorized: vi.fn(() => true) }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/features/adventure-intelligence/server/processHikeSession', () => ({ processHikeSession: vi.fn() }));
vi.mock('@/features/progression/server/producerHooks', () => ({ awardHikeSessionProcessed: vi.fn(async () => undefined) }));
vi.mock('@/features/adventure-intelligence/server/recomputeProfileAfterSession', () => ({
  recomputeProfileAfterSession: vi.fn(async () => 'rebuilt'),
  profileIsUpToDate: vi.fn(async () => false),
  supabaseProfileBuildClient: vi.fn(() => ({ marker: 'build' })),
}));

import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { processHikeSession } from '@/features/adventure-intelligence/server/processHikeSession';
import { recomputeProfileAfterSession } from '@/features/adventure-intelligence/server/recomputeProfileAfterSession';
import { POST } from '../route';

const call = () => POST(new NextRequest('http://localhost/api/cron/process-hike-sessions', { method: 'POST' }));
const sessions = (...rows: Array<{ id: string; user_id: string }>) =>
  vi.mocked(getServiceSupabase).mockReturnValue({ rpc: vi.fn(async () => ({ data: rows, error: null })) } as never);

describe('cron process-hike-sessions : recalcul du profil (10.8)', () => {
  beforeEach(() => {
    vi.mocked(processHikeSession).mockReset();
    vi.mocked(recomputeProfileAfterSession).mockClear();
    vi.mocked(recomputeProfileAfterSession).mockResolvedValue('rebuilt');
  });

  it('recalcule le profil des personnes dont une sortie est traitée, une fois par personne', async () => {
    sessions({ id: 's1', user_id: 'u1' }, { id: 's2', user_id: 'u1' }, { id: 's3', user_id: 'u2' });
    vi.mocked(processHikeSession).mockResolvedValue({ status: 'processed' } as never);
    expect(await (await call()).json()).toEqual({ processed: 3, skipped: 0, failed: 0 });
    const calls = vi.mocked(recomputeProfileAfterSession).mock.calls;
    expect(calls.map((c) => c[0])).toEqual(['u1', 'u1', 'u2']);
    // le même ensemble `done` est partagé : la deuxième sortie de u1 ne reconstruit rien
    expect(calls[0][1].done).toBe(calls[1][1].done);
  });

  it('ne recalcule rien pour une session ignorée ou en échec', async () => {
    sessions({ id: 's1', user_id: 'u1' }, { id: 's2', user_id: 'u2' });
    vi.mocked(processHikeSession).mockResolvedValueOnce({ status: 'skipped' } as never).mockResolvedValueOnce({ status: 'failed' } as never);
    await call();
    expect(recomputeProfileAfterSession).not.toHaveBeenCalled();
  });

  it('un échec du recalcul ne change pas le résultat du lot (non bloquant)', async () => {
    sessions({ id: 's1', user_id: 'u1' });
    vi.mocked(processHikeSession).mockResolvedValue({ status: 'processed' } as never);
    vi.mocked(recomputeProfileAfterSession).mockResolvedValue('error');
    expect(await (await call()).json()).toEqual({ processed: 1, skipped: 0, failed: 0 });
  });
});
