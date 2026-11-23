import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { GET, POST } from '../route';

const W = '11111111-1111-4111-8111-111111111111';
const E = '22222222-2222-4222-8222-222222222222';

type Rpc = { data?: unknown; error?: { code?: string; message?: string } | null };
function client(opts: { user?: boolean; rpc?: Rpc; events?: unknown[]; routeRevision?: number }) {
  const rpc = vi.fn(async () => opts.rpc ?? { data: null, error: null });
  const builder = (rows: unknown[]) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'order']) b[m] = () => b;
    b.limit = async () => ({ data: rows, error: null });
    b.maybeSingle = async () => ({ data: { route_revision: opts.routeRevision ?? 0 }, error: null });
    return b;
  };
  const c = {
    auth: { getUser: async () => ({ data: { user: opts.user === false ? null : { id: 'u1' } } }) },
    from: () => builder(opts.events ?? []),
    rpc,
  };
  vi.mocked(createClient).mockResolvedValue(c as never);
  return { rpc };
}
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/itineraire/club-route', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

describe('/api/itineraire/club-route (10.5)', () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it('GET : session exigée, sorties à venir de l’organisateur seulement', async () => {
    client({ user: false });
    expect((await GET()).status).toBe(401);
    client({ events: [{ id: E, title: 'Sortie', starts_at: new Date(Date.now() + 86400000).toISOString(), visibility: 'public' }, { id: 'old', title: 'Passée', starts_at: '2020-01-01T00:00:00Z', visibility: 'public' }] });
    const body = await (await GET()).json();
    expect(body.events.map((e: { id: string }) => e.id)).toEqual([E]);
  });

  it('POST : entrée validée (uuid, clés inconnues refusées)', async () => {
    const c = client({});
    expect((await post({ workspaceId: 'x', eventId: E })).status).toBe(400);
    expect((await post({ workspaceId: W, eventId: E, role: 'owner' })).status).toBe(400);
    expect(c.rpc).not.toHaveBeenCalled();
  });

  it('POST : appelle la RPC dédiée et rend la révision', async () => {
    const c = client({ rpc: { data: { snapshot: { revision: 3 } }, error: null }, routeRevision: 2 });
    const res = await post({ workspaceId: W, eventId: E });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', revision: 3, unchanged: false });
    expect(c.rpc).toHaveBeenCalledWith('publish_club_event_route_from_workspace', { p_event_id: E, p_workspace_id: W });
  });

  it('POST : répétition identique = unchanged', async () => {
    client({ rpc: { data: { snapshot: { revision: 3 } }, error: null }, routeRevision: 3 });
    expect(await (await post({ workspaceId: W, eventId: E })).json()).toMatchObject({ unchanged: true });
  });

  it('POST : les refus de la base deviennent 403 / 409 (inscrit, non-propriétaire : 403)', async () => {
    client({ rpc: { error: { code: '42501', message: 'x' } } });
    expect((await post({ workspaceId: W, eventId: E })).status).toBe(403);
    client({ rpc: { error: { code: 'P0002', message: 'Aucune version publiée.' } } });
    expect(await (await post({ workspaceId: W, eventId: E })).json()).toMatchObject({ error: 'no_published' });
    client({ rpc: { error: { code: 'P0002', message: 'Pack de départ absent' } } });
    expect(await (await post({ workspaceId: W, eventId: E })).json()).toMatchObject({ error: 'no_pack' });
    client({ rpc: { error: { code: 'XX000', message: 'boom' } } });
    expect((await post({ workspaceId: W, eventId: E })).status).toBe(500);
    client({ user: false });
    expect((await post({ workspaceId: W, eventId: E })).status).toBe(401);
  });
});
