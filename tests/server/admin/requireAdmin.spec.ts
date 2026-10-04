import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

import { requireAdmin } from '@/server/admin/requireAdmin';

const USER = { id: '11111111-1111-4111-8111-111111111111' };

function clientWith(
  user: unknown,
  rpcImpl: (name: string, args?: Record<string, unknown>) => { data: unknown; error: unknown }
) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user } })) },
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

  it('repli is_admin quand has_permission échoue (migration non déployée)', async () => {
    const client = clientWith(USER, (name) => {
      if (name === 'has_permission') return { data: null, error: { code: '42883' } };
      if (name === 'is_admin') return { data: true, error: null };
      return { data: null, error: null };
    });
    mocks.createClient.mockResolvedValue(client);
    const res = await requireAdmin('users.read');
    expect(res.ok).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith('is_admin');
  });

  it('403 quand has_permission est faux et is_admin est faux', async () => {
    mocks.createClient.mockResolvedValue(
      clientWith(USER, () => ({ data: false, error: null }))
    );
    const res = await requireAdmin('rewards.write');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(403);
  });

  it('403 quand les deux RPC échouent', async () => {
    mocks.createClient.mockResolvedValue(
      clientWith(USER, () => ({ data: null, error: { code: 'XX000' } }))
    );
    const res = await requireAdmin('audit.read');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(403);
  });
});
