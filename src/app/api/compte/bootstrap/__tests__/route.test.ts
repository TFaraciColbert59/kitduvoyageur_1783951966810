import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  loadAccountBootstrap: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/features/compte/data/accountBootstrap', () => ({
  loadAccountBootstrap: mocks.loadAccountBootstrap,
}));

import { GET } from '../route';

describe('/api/compte/bootstrap — cache du payload privé', () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.loadAccountBootstrap.mockReset();
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn() } });
    mocks.loadAccountBootstrap.mockResolvedValue({
      authenticated: true,
      profile: { handle: 'owner' },
      followStates: {},
      followStatesUnavailable: false,
    });
  });

  it('interdit tout cache HTTP du bootstrap authentifié', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('vary')).toBe('Cookie');
  });

  it('relit le bootstrap à chaque requête (aucun cache mémoire processus)', async () => {
    await GET();
    await GET();

    expect(mocks.loadAccountBootstrap).toHaveBeenCalledTimes(2);
  });

  it('applique aussi no-store à la réponse d’erreur', async () => {
    mocks.loadAccountBootstrap.mockRejectedValue(new Error('lecture impossible'));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    await expect(response.json()).resolves.toEqual({
      authenticated: false,
      error: 'bootstrap_unavailable',
    });
  });
});
