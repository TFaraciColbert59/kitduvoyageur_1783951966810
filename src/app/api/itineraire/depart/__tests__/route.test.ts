import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/api/requireUser', () => ({ requireUser: vi.fn() }));
import { requireUser } from '@/lib/api/requireUser';
import { GET, PATCH } from '../route';

const TRIP = '0b9d6d2e-6c0e-4c53-9f5c-1d5f7a1a2b3c';
const ITEM = '1c9d6d2e-6c0e-4c53-9f5c-1d5f7a1a2b3d';

/** Chaîne Supabase minimale : chaque méthode renvoie la chaîne, `await` rend le résultat de la table. */
function chain(result: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'update']) c[m] = vi.fn(() => c);
  c.then = (resolve: (v: unknown) => void) => resolve(result);
  return c;
}
function client(tables: Record<string, { data: unknown; error: unknown }>) {
  const from = vi.fn((t: string) => chain(tables[t]));
  return { from };
}
const get = (q: string) => GET(new NextRequest(`http://localhost/api/itineraire/depart${q}`));
const patch = (body: unknown) => PATCH(new NextRequest('http://localhost/api/itineraire/depart', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

beforeEach(() => {
  vi.mocked(requireUser).mockReset();
});

describe('GET /api/itineraire/depart', () => {
  it('exige une session et un voyage valide', async () => {
    vi.mocked(requireUser).mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) });
    expect((await get(`?tripId=${TRIP}`)).status).toBe(401);
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: client({}) as never, user: { id: 'u1' } });
    expect((await get('?tripId=pas-un-uuid')).status).toBe(400);
    expect((await get('')).status).toBe(400);
  });

  it('rend le sac du voyage et la liste du HUB avec leur table source', async () => {
    const sb = client({
      trip_items: { data: [{ id: 'i1', item_name: 'Tente', category: 'abri', quantity: 1, weight_grams: 1800, ownership: 'shared', owner_id: null, inventory_item_id: null, is_packed: false }], error: null },
      trip_checklist_items: { data: [{ id: 'c1', label: 'Réserver le refuge', due_offset_days: 30, done: true, done_at: '2026-11-01T00:00:00Z', position: 0 }], error: null },
    });
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: sb as never, user: { id: 'u1' } });
    const res = await get(`?tripId=${TRIP}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.kit).toHaveLength(1);
    expect(json.kitSource).toBe('trip_items');
    expect(json.checklistSource).toBe('trip_checklist_items');
    expect(json.checklist[0].done).toBe(true);
    expect(sb.from).toHaveBeenCalledWith('trip_items');
    expect(sb.from).toHaveBeenCalledWith('trip_checklist_items');
  });

  it('une partie illisible (RLS, panne) vaut null, jamais une liste vide inventée', async () => {
    const sb = client({ trip_items: { data: null, error: { code: '42501' } }, trip_checklist_items: { data: [], error: null } });
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: sb as never, user: { id: 'u1' } });
    const json = await (await get(`?tripId=${TRIP}`)).json();
    expect(json.kit).toBeNull();
    expect(json.checklist).toEqual([]);
  });
});

describe('PATCH /api/itineraire/depart', () => {
  it('coche l’élément de la liste du HUB', async () => {
    const sb = client({ trip_checklist_items: { data: [{ id: ITEM, done: true, done_at: '2026-11-23T00:00:00Z' }], error: null } });
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: sb as never, user: { id: 'u1' } });
    const res = await patch({ tripId: TRIP, itemId: ITEM, done: true });
    expect(res.status).toBe(200);
    expect((await res.json()).item.done).toBe(true);
  });
  it('refuse l’entrée invalide et une mise à jour bloquée par la RLS (0 ligne)', async () => {
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: client({ trip_checklist_items: { data: [], error: null } }) as never, user: { id: 'u1' } });
    expect((await patch({ tripId: TRIP, itemId: 'x', done: true })).status).toBe(400);
    expect((await patch({ tripId: TRIP, itemId: ITEM, done: true, extra: 1 })).status).toBe(400);
    expect((await patch({ tripId: TRIP, itemId: ITEM, done: true })).status).toBe(403);
  });
});
