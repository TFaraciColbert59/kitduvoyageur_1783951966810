import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/requireUser', () => ({ requireUser: vi.fn() }));

import { requireUser } from '@/lib/api/requireUser';
import { GET, PUT } from '../route';

/** Faux client Supabase : une ligne `user_ui_prefs` en mémoire, requêtes filtrées par `user_id`. */
function fakeClient(initial: Record<string, unknown> | null, failRead = false) {
  const state = { row: initial, upserts: [] as unknown[] };
  const client = {
    from: (table: string) => {
      expect(table).toBe('user_ui_prefs');
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => (failRead ? { data: null, error: { message: 'x' } } : { data: state.row ? { prefs: state.row } : null, error: null }) }) }),
        upsert: async (value: { prefs: Record<string, unknown> }) => {
          state.upserts.push(value);
          state.row = value.prefs;
          return { error: null };
        },
      };
    },
  };
  return { client, state };
}

const put = (body: unknown) =>
  PUT(new NextRequest('http://localhost/api/itineraire/prefs', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

describe('/api/itineraire/prefs (4.1)', () => {
  beforeEach(() => vi.mocked(requireUser).mockReset());

  it('exige une session', async () => {
    vi.mocked(requireUser).mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'x' }, { status: 401 }) });
    expect((await GET()).status).toBe(401);
    expect((await put({ routeViewMode: 'expert' })).status).toBe(401);
  });

  it('GET : rend la valeur du compte, ou null sans ligne, ignore les autres clés', async () => {
    const a = fakeClient({ routeViewMode: 'expert', autre: 1 });
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: a.client as never, user: { id: 'u1' } });
    expect(await (await GET()).json()).toEqual({ routeViewMode: 'expert' });
    const b = fakeClient(null);
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: b.client as never, user: { id: 'u1' } });
    expect(await (await GET()).json()).toEqual({ routeViewMode: null });
  });

  it('GET : une lecture en échec n’est pas présentée comme « aucune préférence »', async () => {
    const c = fakeClient(null, true);
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: c.client as never, user: { id: 'u1' } });
    expect((await GET()).status).toBe(500);
  });

  it('PUT : écrit la clé unique en gardant les autres clés du compte', async () => {
    const c = fakeClient({ future: 'x' });
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: c.client as never, user: { id: 'u1' } });
    const res = await put({ routeViewMode: 'expert' });
    expect(res.status).toBe(200);
    expect(c.state.upserts).toHaveLength(1);
    expect(c.state.row).toEqual({ future: 'x', routeViewMode: 'expert' });
    expect((c.state.upserts[0] as { user_id: string }).user_id).toBe('u1');
  });

  it('PUT : refuse toute autre clé, valeur ou JSON illisible', async () => {
    const c = fakeClient(null);
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: c.client as never, user: { id: 'u1' } });
    expect((await put({ routeViewMode: 'pro' })).status).toBe(400);
    expect((await put({ routeViewMode: 'simple', role: 'admin' })).status).toBe(400);
    expect((await put({})).status).toBe(400);
    expect((await put('{pas du json')).status).toBe(400);
    expect(c.state.upserts).toHaveLength(0);
  });
});
