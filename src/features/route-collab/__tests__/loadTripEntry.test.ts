import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: { row: unknown; error: unknown; throws: boolean } = { row: null, error: null, throws: false };

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (state.throws) throw new Error('no client');
    return {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: state.row, error: state.error }) }),
        }),
      }),
    };
  },
}));

import { loadTripEntry } from '../server/loadTripEntry';

describe('loadTripEntry · voyage d’entrée sous RLS (1.1, 1.2, 1.6)', () => {
  beforeEach(() => {
    state.row = null;
    state.error = null;
    state.throws = false;
  });

  it('un voyage lisible devient une entrée avec son activité et son pays', async () => {
    state.row = {
      id: '11111111-2222-4333-8444-555555555555',
      title: 'Tour du Queyras',
      start_date: null,
      end_date: null,
      destination_name: 'Queyras',
      destination_country_code: 'FR',
      party_size: 2,
      metadata: {},
      primary_activity: 'velo',
    };
    const res = await loadTripEntry('11111111-2222-4333-8444-555555555555');
    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.entry.title).toBe('Tour du Queyras');
      expect(res.entry.countryCode).toBe('FR');
      expect(res.entry.activity).toBe('velo');
      expect(res.entry.routeDraft).toBeNull();
    }
  });

  it('voyage absent ou privé : « not_found », sans rien révéler', async () => {
    expect((await loadTripEntry('x')).status).toBe('not_found');
  });

  it('erreur de lecture ou client indisponible : « error »', async () => {
    state.error = { message: 'boom' };
    expect((await loadTripEntry('x')).status).toBe('error');
    state.error = null;
    state.throws = true;
    expect((await loadTripEntry('x')).status).toBe('error');
  });
});
