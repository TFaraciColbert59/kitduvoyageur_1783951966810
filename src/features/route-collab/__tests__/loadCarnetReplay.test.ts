import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: { detail: unknown; tripId: string | null; throws: boolean } = { detail: null, tripId: null, throws: false };
vi.mock('@/features/carnet/detail/getCarnetDetail', () => ({
  getCarnetDetail: async () => {
    if (state.throws) throw new Error('x');
    return state.detail;
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { trip_id: state.tripId }, error: null }) }) }) }),
  }),
}));

import { loadCarnetReplay } from '../server/loadCarnetReplay';

const trace = { type: 'LineString', coordinates: [[6, 44], [6.1, 44.1]] };

describe('loadCarnetReplay · carnet lu avec les masques du lecteur (9.10)', () => {
  beforeEach(() => {
    state.detail = null;
    state.tripId = null;
    state.throws = false;
  });
  it('propriétaire : tracé et voyage du carnet', async () => {
    state.detail = { title: 'Queyras', isOwner: true, trace, traceMasked: false };
    state.tripId = '0b9d6d2e-6c0e-4c53-9f5c-1d5f7a1a2b3c';
    const r = await loadCarnetReplay('c1');
    expect(r).toMatchObject({ status: 'ok', tripId: state.tripId });
    if (r.status === 'ok') expect(r.replay.coordinates).toHaveLength(2);
  });
  it('visiteur : trace masquée annoncée, jamais le voyage du carnet', async () => {
    state.detail = { title: 'Queyras', isOwner: false, trace, traceMasked: true };
    state.tripId = 'secret';
    const r = await loadCarnetReplay('c1');
    expect(r).toMatchObject({ status: 'ok', tripId: null });
    if (r.status === 'ok') expect(r.replay.traceMasked).toBe(true);
  });
  it('absent, sans tracé, en erreur', async () => {
    expect((await loadCarnetReplay('c1')).status).toBe('not_found');
    state.detail = { title: 'x', isOwner: true, trace: null };
    expect((await loadCarnetReplay('c1')).status).toBe('no_trace');
    state.throws = true;
    expect((await loadCarnetReplay('c1')).status).toBe('error');
  });
});
