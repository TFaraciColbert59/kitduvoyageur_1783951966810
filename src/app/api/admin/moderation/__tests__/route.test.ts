import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { POST } from '../route';

type Rpc = { data?: unknown; error?: { code?: string; message?: string } | null };
function client(opts: { moderator?: boolean; user?: boolean; apply?: Rpc }) {
  const inserts: Array<{ table: string; row: unknown }> = [];
  const rpc = vi.fn(async (name: string) => {
    if (name === 'is_moderateur') return { data: opts.moderator !== false, error: null };
    return opts.apply ?? { data: { status: 'applied' }, error: null };
  });
  const table = (name: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) b[m] = () => b;
    b.maybeSingle = async () => ({ data: null, error: null });
    b.insert = async (row: unknown) => { inserts.push({ table: name, row }); return { error: null }; };
    b.update = () => b;
    return b;
  };
  vi.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: opts.user === false ? null : { id: 'mod1' } } }) }, rpc, from: table } as never);
  return { rpc, inserts };
}
const W = '11111111-1111-4111-8111-111111111111';
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/admin/moderation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

describe('POST /api/admin/moderation : un rejet est appliqué (10.10)', () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it('rejet d’un commentaire : RPC d’application (masquer par défaut), enforced: true, rien d’écrit à côté', async () => {
    const c = client({});
    const res = await post({ type: 'route_comment', id: `${W}:cmt-1`, decision: 'reject' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', enforced: true, applied: 'applied', statut: 'rejete' });
    expect(c.rpc).toHaveBeenCalledWith('admin_apply_route_moderation', { p_kind: 'route_comment', p_id: `${W}:cmt-1`, p_action: 'hide' });
    expect(c.inserts).toEqual([]); // file et journal sont écrits par la RPC, dans la même transaction
  });

  it('suppression d’un commentaire, révocation d’un lien, retrait d’une trace', async () => {
    const c = client({});
    await post({ type: 'route_comment', id: `${W}:c`, decision: 'reject', action: 'remove' });
    await post({ type: 'route_share_link', id: W, decision: 'reject' });
    await post({ type: 'route_public_trace', id: W, decision: 'reject' });
    expect(c.rpc.mock.calls.filter((x) => x[0] === 'admin_apply_route_moderation').map((x) => (x as unknown[])[1])).toEqual([
      { p_kind: 'route_comment', p_id: `${W}:c`, p_action: 'remove' },
      { p_kind: 'route_share_link', p_id: W, p_action: 'revoke' },
      { p_kind: 'route_public_trace', p_id: W, p_action: 'remove' },
    ]);
  });

  it('action incompatible avec le type, ou action hors rejet : 400, rien d’appliqué', async () => {
    const c = client({});
    expect((await post({ type: 'route_share_link', id: W, decision: 'reject', action: 'hide' })).status).toBe(400);
    expect((await post({ type: 'route_comment', id: `${W}:c`, decision: 'approve', action: 'remove' })).status).toBe(400);
    expect((await post({ type: 'route_comment', id: `${W}:c`, decision: 'reject', action: 'delete' })).status).toBe(400);
    expect(c.rpc).not.toHaveBeenCalledWith('admin_apply_route_moderation', expect.anything());
  });

  it('valider consigne seulement (enforced: false), sans appeler la RPC d’application', async () => {
    const c = client({});
    const body = await (await post({ type: 'route_comment', id: `${W}:c`, decision: 'approve' })).json();
    expect(body).toMatchObject({ status: 'ok', enforced: false, statut: 'approuve' });
    expect(c.rpc).not.toHaveBeenCalledWith('admin_apply_route_moderation', expect.anything());
  });

  it('non modérateur 403, sans session 401, contenu disparu 404, refus de la base : jamais « appliqué »', async () => {
    client({ moderator: false });
    expect((await post({ type: 'route_share_link', id: W, decision: 'reject' })).status).toBe(403);
    client({ user: false });
    expect((await post({ type: 'route_share_link', id: W, decision: 'reject' })).status).toBe(401);
    client({ apply: { data: { status: 'not_found' }, error: null } });
    expect((await post({ type: 'route_share_link', id: W, decision: 'reject' })).status).toBe(404);
    client({ apply: { error: { code: '42501', message: 'forbidden' } } });
    expect((await post({ type: 'route_share_link', id: W, decision: 'reject' })).status).toBe(403);
    client({ apply: { error: { code: 'XX000', message: 'boom' } } });
    expect((await post({ type: 'route_share_link', id: W, decision: 'reject' })).status).toBe(500);
  });

  it('déjà appliqué : ok, enforced, applied: noop', async () => {
    client({ apply: { data: { status: 'noop' }, error: null } });
    expect(await (await post({ type: 'route_share_link', id: W, decision: 'reject' })).json()).toMatchObject({ enforced: true, applied: 'noop' });
  });
});
