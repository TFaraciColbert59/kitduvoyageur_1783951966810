import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * T42 — route admin de simulation : garde is_admin, validation stricte de
 * l'échantillon, rapport projeté pur, aucune écriture (no-store).
 */

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  isAdminRpc: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: h.getUser },
    rpc: (...args: unknown[]) => h.isAdminRpc(...args),
  }),
}));

vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: (identifier: string, config: unknown) => h.enforceRateLimit(identifier, config),
}));

import { POST } from '@/app/api/admin/progression/simulate/route';

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/progression/simulate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('T42 — POST /api/admin/progression/simulate (mocks)', () => {
  beforeEach(() => {
    h.getUser.mockReset();
    h.isAdminRpc.mockReset();
    h.enforceRateLimit.mockReset();
    h.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } });
    h.isAdminRpc.mockResolvedValue({ data: true, error: null });
    h.enforceRateLimit.mockResolvedValue(null);
  });

  it('(a) 403 non-admin (garde is_admin, aucun rate limit consommé)', async () => {
    h.isAdminRpc.mockResolvedValue({ data: false, error: null });
    const res = await POST(post({ samples: [{ action: 'hike_session_processed', count: 1 }] }));
    expect(res.status).toBe(403);
    expect(h.enforceRateLimit).not.toHaveBeenCalled();
  });

  it('(b) 400 échantillon invalide (vide, count négatif, action vide)', async () => {
    expect((await POST(post({ samples: [] }))).status).toBe(400);
    expect(
      (await POST(post({ samples: [{ action: 'hike_session_processed', count: -1 }] }))).status
    ).toBe(400);
    expect((await POST(post({ samples: [{ action: '', count: 3 }] }))).status).toBe(400);
    expect((await POST(post({ samples: 'nope' }))).status).toBe(400);
  });

  it('(c) 200 simulation pure : XP projetés (action publiée) et refus expliqués', async () => {
    const res = await POST(
      post({
        samples: [
          { action: 'hike_session_processed', count: 10 },
          { action: 'place_review', count: 4 },
        ],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.report.totalProjectedXp).toBe(400);
    expect(body.report.refused).toBe(4);
    expect(body.report.lines[1]).toMatchObject({
      action: 'place_review',
      reason: 'action_non_publiee',
    });
  });

  it('(d) aucune écriture : réponse no-store', async () => {
    const res = await POST(post({ samples: [{ action: 'hike_session_processed', count: 1 }] }));
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
