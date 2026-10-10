import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

import { requireAdmin } from '@/server/admin/requireAdmin';

const USER = { id: '11111111-1111-4111-8111-111111111111' };

function clientWith(
  user: unknown,
  rpcImpl: (name: string, args?: Record<string, unknown>) => { data: unknown; error: unknown },
  mfaLevel: 'aal1' | 'aal2' | 'error' = 'aal1'
) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => {
          if (mfaLevel === 'error') throw new Error('mfa indisponible');
          return { data: { currentLevel: mfaLevel, nextLevel: mfaLevel }, error: null };
        }),
      },
    },
    rpc: vi.fn(async (name: string, args?: Record<string, unknown>) => rpcImpl(name, args)),
  };
}

beforeEach(() => {
  mocks.createClient.mockReset();
});

describe('requireAdmin', () => {
  it('401 sans session, sans évaluer de permission', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
      rpc,
    });
    const res = await requireAdmin('users.read');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('ok quand has_permission est vrai', async () => {
    mocks.createClient.mockResolvedValue(
      clientWith(USER, (name) =>
        name === 'has_permission' ? { data: true, error: null } : { data: null, error: null }
      )
    );
    const res = await requireAdmin('users.read');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ctx.user).toEqual(USER);
  });

  it('503 fail-closed quand has_permission échoue (aucun repli is_admin)', async () => {
    const client = clientWith(USER, (name) => {
      if (name === 'has_permission') return { data: null, error: { code: '42883' } };
      return { data: null, error: null };
    });
    mocks.createClient.mockResolvedValue(client);
    const res = await requireAdmin('users.read');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(503);
    expect(client.rpc).not.toHaveBeenCalledWith('is_admin');
  });

  it('403 quand has_permission est faux, sans appeler is_admin', async () => {
    const client = clientWith(USER, () => ({ data: false, error: null }));
    mocks.createClient.mockResolvedValue(client);
    const res = await requireAdmin('rewards.write');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(403);
    expect(client.rpc).not.toHaveBeenCalledWith('is_admin');
  });

  it("n'appelle jamais is_admin (autorité canonique unique)", async () => {    const client = clientWith(USER, () => ({ data: true, error: null }));
    mocks.createClient.mockResolvedValue(client);
    const res = await requireAdmin('audit.read');
    expect(res.ok).toBe(true);
    expect(client.rpc).not.toHaveBeenCalledWith('is_admin');
  });

  it('ok sur permission critique avec session AAL2', async () => {
    mocks.createClient.mockResolvedValue(
      clientWith(USER, () => ({ data: true, error: null }), 'aal2')
    );
    const res = await requireAdmin('rewards.write');
    expect(res.ok).toBe(true);
  });

  it('403 mfa_required sur permission critique en AAL1', async () => {
    mocks.createClient.mockResolvedValue(
      clientWith(USER, () => ({ data: true, error: null }), 'aal1')
    );
    const res = await requireAdmin('roles.grant');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.status).toBe(403);
      expect(await res.response.json()).toEqual({
        error: 'Authentification à deux facteurs requise',
        code: 'mfa_required',
      });
    }
  });

  it('403 fail-closed quand la vérification MFA échoue', async () => {
    mocks.createClient.mockResolvedValue(
      clientWith(USER, () => ({ data: true, error: null }), 'error')
    );
    const res = await requireAdmin('rewards.write');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(403);
  });

  it('élévation JIT active habilite sans rôle (sans is_admin)', async () => {
    const client = clientWith(USER, (name) => {
      if (name === 'has_permission') return { data: false, error: null };
      if (name === 'has_active_elevation') return { data: true, error: null };
      return { data: false, error: null };
    }, 'aal2');
    mocks.createClient.mockResolvedValue(client);
    const res = await requireAdmin('commerce.refund.approve');
    expect(res.ok).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith('has_active_elevation', {
      p_code: 'commerce.refund.approve',
    });
    expect(client.rpc).not.toHaveBeenCalledWith('is_admin');
  });

  it('403 quand ni permission ni élévation', async () => {
    mocks.createClient.mockResolvedValue(
      clientWith(USER, () => ({ data: false, error: null }))
    );
    const res = await requireAdmin('commerce.refund.approve');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(403);
  });
});
