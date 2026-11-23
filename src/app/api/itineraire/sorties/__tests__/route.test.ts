import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/api/requireUser', () => ({ requireUser: vi.fn() }));
import { requireUser } from '@/lib/api/requireUser';
import { GET } from '../route';

const WS = '0b9d6d2e-6c0e-4c53-9f5c-1d5f7a1a2b3c';
function client(result: { data: unknown; error: unknown }) {
  const eq = vi.fn();
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit']) c[m] = vi.fn(() => c);
  c.eq = eq.mockImplementation(() => c);
  c.then = (resolve: (v: unknown) => void) => resolve(result);
  return { sb: { from: vi.fn(() => c) }, eq };
}
const get = (q: string) => GET(new NextRequest(`http://localhost/api/itineraire/sorties${q}`));

beforeEach(() => vi.mocked(requireUser).mockReset());

describe('GET /api/itineraire/sorties', () => {
  it('exige une session et un espace valide', async () => {
    vi.mocked(requireUser).mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) });
    expect((await get(`?workspaceId=${WS}`)).status).toBe(401);
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: client({ data: [], error: null }).sb as never, user: { id: 'u1' } });
    expect((await get('?workspaceId=x')).status).toBe(400);
  });

  it('ne lit que les sorties de la personne, avec trace horodatée et sac emporté', async () => {
    const { sb, eq } = client({
      data: [{ id: 's1', started_at: '2026-07-10T08:00:00Z', ended_at: '2026-07-10T14:00:00Z', distance_km: 18.2, duration_seconds: 21600, elevation_gain_m: 900, positions_timed: [{ lat: 45.9, lng: 6, timestamp: '2026-07-10T08:00:00Z' }, { lat: 45.9, lng: 6.1, timestamp: '2026-07-10T09:00:00Z' }], positions_geojson: null, route_revision_id: 'r1', kit_snapshot: [{ id: 'k1', name: 'Tente', weightGrams: 1000, quantity: 1 }] }],
      error: null,
    });
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: sb as never, user: { id: 'u1' } });
    const json = await (await get(`?workspaceId=${WS}`)).json();
    expect(sb.from).toHaveBeenCalledWith('hike_sessions_participant');
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(eq).toHaveBeenCalledWith('route_workspace_id', WS);
    expect(json.sessions[0]).toMatchObject({ sessionId: 's1', distanceKm: 18.2, routeRevisionId: 'r1' });
    expect(json.sessions[0].track[1]).toEqual({ lat: 45.9, lon: 6.1, t: '2026-07-10T09:00:00Z' });
    expect(json.sessions[0].kitSnapshot[0]).toMatchObject({ id: 'k1', name: 'Tente', shared: false });
  });

  it('colonnes absentes (migration pas appliquée) : indisponible et liste vide', async () => {
    vi.mocked(requireUser).mockResolvedValue({ ok: true, supabase: client({ data: null, error: { code: '42703' } }).sb as never, user: { id: 'u1' } });
    const json = await (await get(`?workspaceId=${WS}`)).json();
    expect(json.status).toBe('unavailable');
    expect(json.sessions).toEqual([]);
  });
});
