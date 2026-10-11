/**
 * T11 — route /api/progression/history :
 *   (a) 401 sans session ; (b) 429 quand le limiteur refuse ;
 *   (c) 200 nominal : bornes de limit, curseur transmis, en-têtes no-store ;
 *   (d) curseur invalide → null sans erreur ; (e) erreur service → 500.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('@/features/progression/server/progressionService', () => ({
  getProgressionHistory: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { getProgressionHistory } from '@/features/progression/server/progressionService';
import { GET } from '@/app/api/progression/history/route';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const mockedCreateClient = vi.mocked(createClient);
const mockedRateLimit = vi.mocked(enforceRateLimit);
const mockedHistory = vi.mocked(getProgressionHistory);

function sessionClient(user: { id: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } } as never;
}

function request(query = '') {
  return new NextRequest(`http://localhost/api/progression/history${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
  mockedRateLimit.mockResolvedValue(null as never);
  mockedHistory.mockResolvedValue({ items: [], pending: [], nextCursor: null });
});

describe('GET /api/progression/history', () => {
  it('(a) refuse sans session, sans consommer de rate limit', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mockedRateLimit).not.toHaveBeenCalled();
    expect(mockedHistory).not.toHaveBeenCalled();
  });

  it('(b) répond le limiteur tel quel quand il refuse', async () => {
    mockedRateLimit.mockResolvedValue(new Response('{}', { status: 429 }) as never);
    const response = await GET(request());
    expect(response.status).toBe(429);
    expect(mockedHistory).not.toHaveBeenCalled();
  });

  it('(c) 200 nominal : limit transmis borné, no-store, payload complet', async () => {
    mockedHistory.mockResolvedValue({
      items: [
        {
          id: 'e1',
          action: 'hike_session_processed',
          label: 'Randonnée accomplie',
          points: 70,
          effectiveAt: '2026-10-05T09:00:00.000Z',
          rulesVersion: 'v1',
          seasonId: 's1',
          skills: [{ skill: 'explorer', points: 70, weight: 1 }],
        },
      ],
      pending: [
        {
          id: 'i1',
          action: 'carnet_published',
          label: 'Carnet publié',
          effectiveAt: '2026-10-06T10:00:00.000Z',
          state: 'pending',
        },
      ],
      nextCursor: { before: '2026-10-05T09:00:00.000Z', beforeId: 'e1' },
    });

    const response = await GET(
      request(
        `?limit=999&before=${encodeURIComponent('2026-10-07T00:00:00.000Z')}&beforeId=e9`
      )
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store, private');
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].label).toBe('Randonnée accomplie');
    expect(body.pending[0].state).toBe('pending');
    expect(body.nextCursor).toEqual({ before: '2026-10-05T09:00:00.000Z', beforeId: 'e1' });
    // limit=999 est borné à 50.
    expect(mockedHistory).toHaveBeenCalledWith(USER_ID, {
      limit: 50,
      before: '2026-10-07T00:00:00.000Z',
      beforeId: 'e9',
    });
  });

  it('(c2) limit absent → 20 par défaut ; beforeId sans before → curseur ignoré', async () => {
    await GET(request('?beforeId=e9'));
    expect(mockedHistory).toHaveBeenCalledWith(USER_ID, {
      limit: 20,
      before: null,
      beforeId: null,
    });
  });

  it('(d) before invalide → null sans erreur', async () => {
    await GET(request('?before=pas-une-date&beforeId=e9'));
    expect(mockedHistory).toHaveBeenCalledWith(USER_ID, {
      limit: 20,
      before: null,
      beforeId: null,
    });
  });

  it('(e) erreur du service → 500 générique', async () => {
    mockedHistory.mockRejectedValue(new Error('boom'));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: 'Erreur interne' });
  });
});
