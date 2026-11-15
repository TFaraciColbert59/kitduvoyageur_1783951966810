import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServiceSupabase: vi.fn(),
}));

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: mocks.getServiceSupabase,
}));

import { compensateActivityProgression } from '../server/awardProducer';

describe('compensateActivityProgression (C-REWARD)', () => {
  beforeEach(() => {
    mocks.getServiceSupabase.mockReset();
  });

  it('retourne success:false sans crash quand le service client est absent', async () => {
    mocks.getServiceSupabase.mockReturnValue(null);
    const res = await compensateActivityProgression('u1', 'hike_session', 's1', 'deleted');
    expect(res).toEqual({ success: false, compensatedCount: 0, reversedPoints: 0 });
  });

  it('invoque la RPC compensate_progression_source avec idempotence et renvoie le décompte', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { compensatedCount: 1, reversedPoints: 35 },
      error: null,
    });
    mocks.getServiceSupabase.mockReturnValue({ rpc });

    const res = await compensateActivityProgression('u1', 'hike_session', 's1', 'deleted');
    expect(rpc).toHaveBeenCalledWith('compensate_progression_source', {
      p_user_id: 'u1',
      p_source_type: 'hike_session',
      p_source_id: 's1',
      p_reason: 'deleted',
    });
    expect(res).toEqual({ success: true, compensatedCount: 1, reversedPoints: 35 });
  });

  it('avale les erreurs RPC sans casser les mutations de sortie', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'function missing' },
    });
    mocks.getServiceSupabase.mockReturnValue({ rpc });

    const res = await compensateActivityProgression(
      'u1',
      'hike_session',
      's1',
      'visibility_private'
    );
    expect(res).toEqual({ success: false, compensatedCount: 0, reversedPoints: 0 });
  });
});
